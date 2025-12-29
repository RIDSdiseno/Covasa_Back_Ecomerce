import { Request, Response } from "express";
import { createHash, randomUUID } from "crypto";
import { OrigenRegistro } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { manejarAsync } from "../lib/manejarAsync";
import { ErrorApi } from "../lib/errores";

const cotizacionSchema = z.object({
  contacto: z.object({
    nombre: z.string().min(1).max(200),
    empresa: z.string().max(200).optional(),
    email: z.string().email(),
    telefono: z.string().min(6).max(30),
    tipoObra: z.string().min(1).max(80),
    ubicacion: z.string().min(1).max(120),
  }),
  observaciones: z.string().max(1000).optional(),
  ocNumero: z.string().max(100).optional(),
  carritoId: z.string().min(1).optional(),
  canal: z.string().max(50).optional(),
  origenRef: z.string().max(100).optional(),
  fingerprint: z.string().max(200).optional(),
  items: z
    .array(
      z.object({
        productoId: z.string().min(1),
        cantidad: z.number().int().positive(),
      })
    )
    .min(1),
});

const IVA_POR_DEFECTO = Number(process.env.IVA_PCT ?? 19);

const normalizarNumero = (valor: unknown, fallback: number, min: number, max?: number) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < min) {
    return fallback;
  }
  if (typeof max === "number" && numero > max) {
    return fallback;
  }
  return numero;
};

const normalizarTexto = (valor?: string) => (valor ?? "").trim();

const generarHash = (valor: string) => createHash("sha256").update(valor).digest("hex");

const obtenerIp = (req: Request) => {
  const ip = req.ips?.[0] ?? req.ip ?? "";
  return ip.split(",")[0].trim();
};

export const crearCotizacion = manejarAsync(async (req: Request, res: Response) => {
  const payload = cotizacionSchema.parse(req.body);
  const ivaPct = Number.isFinite(IVA_POR_DEFECTO) ? IVA_POR_DEFECTO : 19;

  if (ivaPct <= 0 || ivaPct > 100) {
    throw new ErrorApi("IVA configurado invalido", 500, { ivaPct });
  }

  const ahora = new Date();
  const ventanaMin = normalizarNumero(process.env.COTIZACIONES_VENTANA_MIN, 15, 1, 1440);
  const dedupMin = normalizarNumero(process.env.COTIZACIONES_DEDUP_MIN, 30, 1, 1440);
  const limiteIp = normalizarNumero(process.env.COTIZACIONES_MAX_POR_IP, 5, 1, 100);
  const limiteHuella = normalizarNumero(process.env.COTIZACIONES_MAX_POR_HUELLA, 5, 1, 100);
  const desdeRate = new Date(ahora.getTime() - ventanaMin * 60 * 1000);
  const desdeDedup = new Date(ahora.getTime() - dedupMin * 60 * 1000);

  const ip = obtenerIp(req);
  const userAgent = req.get("user-agent") ?? "";
  const ipHash = ip ? generarHash(ip) : null;
  const userAgentHash = userAgent ? generarHash(userAgent) : null;
  const fingerprintHash = payload.fingerprint ? generarHash(payload.fingerprint) : null;

  const itemsAgrupados = new Map<string, number>();
  payload.items.forEach((item) => {
    const actual = itemsAgrupados.get(item.productoId) ?? 0;
    itemsAgrupados.set(item.productoId, actual + item.cantidad);
  });

  const itemsOrdenados = Array.from(itemsAgrupados.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, cantidad]) => `${id}:${cantidad}`)
    .join("|");

  const emailNormalizado = normalizarTexto(payload.contacto.email).toLowerCase();
  const nombreHash = normalizarTexto(payload.contacto.nombre).toLowerCase();
  const empresaHash = normalizarTexto(payload.contacto.empresa).toLowerCase();
  const telefonoHash = normalizarTexto(payload.contacto.telefono);
  const tipoObraHash = normalizarTexto(payload.contacto.tipoObra).toLowerCase();
  const ubicacionHash = normalizarTexto(payload.contacto.ubicacion).toLowerCase();
  const observacionesHash = normalizarTexto(payload.observaciones).toLowerCase();
  const ocHash = normalizarTexto(payload.ocNumero).toLowerCase();

  const contenidoHash = generarHash(
    [
      emailNormalizado,
      nombreHash,
      empresaHash,
      telefonoHash,
      tipoObraHash,
      ubicacionHash,
      observacionesHash,
      ocHash,
      itemsOrdenados,
    ].join("||")
  );

  if (ipHash) {
    const totalIp = await prisma.solicitudCotizacion.count({
      where: {
        ipHash,
        createdAt: { gte: desdeRate },
      },
    });

    if (totalIp >= limiteIp) {
      throw new ErrorApi("Limite de cotizaciones alcanzado por IP", 429, {
        limite: limiteIp,
      });
    }
  }

  const huellaHash = fingerprintHash ?? userAgentHash;
  if (huellaHash) {
    const totalHuella = await prisma.solicitudCotizacion.count({
      where: fingerprintHash
        ? { fingerprintHash: huellaHash, createdAt: { gte: desdeRate } }
        : { userAgentHash: huellaHash, createdAt: { gte: desdeRate } },
    });

    if (totalHuella >= limiteHuella) {
      throw new ErrorApi("Limite de cotizaciones alcanzado por huella", 429, {
        limite: limiteHuella,
      });
    }
  }

  const duplicada = await prisma.solicitudCotizacion.findFirst({
    where: {
      contenidoHash,
      createdAt: { gte: desdeDedup },
    },
    select: {
      id: true,
      createdAt: true,
    },
  });

  if (duplicada) {
    throw new ErrorApi("Cotizacion duplicada", 409, {
      id: duplicada.id,
      createdAt: duplicada.createdAt,
    });
  }

  const productos = await prisma.producto.findMany({
    where: {
      id: {
        in: Array.from(itemsAgrupados.keys()),
      },
    },
  });

  const productosPorId = new Map(productos.map((producto) => [producto.id, producto]));
  const productosFaltantes = Array.from(itemsAgrupados.keys()).filter(
    (id) => !productosPorId.has(id)
  );

  if (productosFaltantes.length > 0) {
    throw new ErrorApi("Productos no encontrados", 404, {
      productos: productosFaltantes,
    });
  }

  const itemsCrear: {
    productoId: string;
    nombreProducto: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    precioUnitarioNeto: number;
    subtotalNeto: number;
    ivaPct: number;
    ivaMonto: number;
    total: number;
  }[] = [];
  let subtotalNeto = 0;
  let ivaMontoTotal = 0;

  for (const [productoId, cantidad] of itemsAgrupados) {
    const producto = productosPorId.get(productoId);
    if (!producto) {
      continue;
    }

    const precioNeto =
      producto.precioConDescto > 0 ? producto.precioConDescto : producto.precioGeneral;
    const subtotal = precioNeto * cantidad;
    const ivaMonto = Math.round((subtotal * ivaPct) / 100);
    const total = subtotal + ivaMonto;

    itemsCrear.push({
      productoId,
      nombreProducto: producto.nombre,
      descripcion: producto.nombre,
      unidad: producto.unidadMedida,
      cantidad,
      precioUnitarioNeto: precioNeto,
      subtotalNeto: subtotal,
      ivaPct,
      ivaMonto,
      total,
    });

    subtotalNeto += subtotal;
    ivaMontoTotal += ivaMonto;
  }

  const total = subtotalNeto + ivaMontoTotal;
  const nombreContacto = normalizarTexto(payload.contacto.nombre);
  const empresa = normalizarTexto(payload.contacto.empresa);
  const telefono = normalizarTexto(payload.contacto.telefono);
  const tipoObra = normalizarTexto(payload.contacto.tipoObra);
  const ubicacion = normalizarTexto(payload.contacto.ubicacion);
  const canal = normalizarTexto(payload.canal) || "WEB";
  const origenRef = normalizarTexto(payload.origenRef) || payload.carritoId || null;

  const resultado = await prisma.$transaction(async (tx) => {
    let cliente = await tx.cliente.findFirst({
      where: {
        email: emailNormalizado,
      },
    });

    if (!cliente) {
      cliente = await tx.cliente.create({
        data: {
          id: randomUUID(),
          nombre: nombreContacto,
          email: emailNormalizado,
          telefono,
          ciudad: ubicacion,
          updatedAt: ahora,
        },
      });
    }

    const solicitud = await tx.solicitudCotizacion.create({
      data: {
        carritoId: payload.carritoId,
        clienteId: cliente?.id,
        nombreContacto,
        empresa: empresa || undefined,
        email: emailNormalizado,
        telefono,
        tipoObra,
        ubicacion,
        observaciones: normalizarTexto(payload.observaciones) || undefined,
        ocNumero: normalizarTexto(payload.ocNumero) || undefined,
        subtotalNeto,
        ivaPct,
        ivaMonto: ivaMontoTotal,
        total,
        origen: OrigenRegistro.ECOMMERCE,
        canal,
        origenRef,
        contenidoHash,
        ipHash,
        userAgentHash,
        fingerprintHash,
        SolicitudCotizacionItem: {
          create: itemsCrear,
        },
      },
      select: {
        id: true,
        estado: true,
        createdAt: true,
      },
    });

    await tx.mensajeNotificacion.create({
      data: {
        tipo: "COTIZACION_RECIBIDA",
        titulo: "Nueva cotizacion ecommerce",
        mensaje: `Contacto ${nombreContacto} (${emailNormalizado}). Items ${itemsCrear.length}. Total ${total}.`,
        entidad: "SolicitudCotizacion",
        entidadId: solicitud.id,
        origen: OrigenRegistro.ECOMMERCE,
        canal,
        solicitudCotizacionId: solicitud.id,
      },
    });

    return solicitud;
  });

  res.status(201).json({
    ok: true,
    data: {
      id: resultado.id,
      estado: resultado.estado,
      subtotalNeto,
      ivaPct,
      ivaMonto: ivaMontoTotal,
      total,
      createdAt: resultado.createdAt,
    },
    message: "Cotizacion registrada",
  });
});
