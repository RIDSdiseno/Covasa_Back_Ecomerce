import { randomUUID } from "crypto";
import { CrmEstadoCotizacion, EcommerceEstadoCotizacion, OrigenCliente, Prisma } from "@prisma/client";
import { ErrorApi } from "../../../lib/errores";
import { prisma } from "../../../lib/prisma";

const PAGE_SIZE = 20;
import {
  construirObservaciones,
  formatearCodigo,
  normalizarTelefonoChile,
  normalizarTexto,
  obtenerIvaPct,
} from "../common/ecommerce.utils";
import {
  actualizarCodigoCotizacion,
  actualizarEstadoCotizacion,
  buscarClientePorId,
  buscarProductosPorIds,
  crearCotizacion,
  eliminarCotizacion,
  eliminarCotizacionItems,
  obtenerCotizacionParaEliminar,
  obtenerCotizacionConItems,
  obtenerCotizacionPorId,
  actualizarCotizacionCancelacion,
} from "./cotizaciones.repo";
import {
  actualizarCarritoTimestamp,
  buscarCarritoActivoPorCliente,
  crearCarrito,
  upsertCarritoItem,
} from "../carrito/carrito.repo";
import { registrarNotificacion } from "../notificaciones/notificaciones.service";
import { buscarClientePorUsuarioId, buscarUsuarioPorId } from "../usuarios/usuarios.repo";

type ItemSolicitud = { productoId: string; cantidad: number; observacion?: string | null };

type CotizacionBasePayload = {
  ecommerceClienteId?: string;
  contacto: {
    nombre: string;
    email?: string | null;
    telefono?: string | null;
    empresa?: string | null;
    rut?: string | null;
    direccion?: string | null;
    region?: string | null;
    comuna?: string | null;
    mensaje?: string | null;
  };
  observaciones?: string;
  ocCliente?: string;
  origen?: string;
  metadata?: {
    userAgent?: string | null;
    utm?: Record<string, unknown> | null;
  } | null;
  extra?: {
    tipoObra?: string;
    comunaRegion?: string;
    detalleAdicional?: string;
    ubicacion?: string;
    region?: string;
    comuna?: string;
  };
  items: ItemSolicitud[];
};

type EliminarCotizacionResultado = {
  action: "deleted" | "cancelled";
  cotizacionId: string;
  estado: EcommerceEstadoCotizacion;
  pedidoId: string | null;
  pagoCount: number;
};

const resolverClienteUsuario = async (usuarioId: string) => {
  const usuario = await buscarUsuarioPorId(usuarioId);
  if (!usuario) {
    throw new ErrorApi("Usuario ecommerce no encontrado", 404, { id: usuarioId });
  }

  const cliente = await buscarClientePorUsuarioId(usuarioId);
  if (!cliente) {
    throw new ErrorApi("Cliente ecommerce no encontrado", 404, { usuarioId });
  }

  return { usuarioId: usuario.id, ecommerceClienteId: cliente.id };
};

const esJsonObject = (valor: Prisma.InputJsonValue | null | undefined): valor is Prisma.InputJsonObject =>
  Boolean(valor && typeof valor === "object" && !Array.isArray(valor));

const fusionarMetadata = (
  actual: Prisma.InputJsonValue | null | undefined,
  extra: Record<string, Prisma.InputJsonValue>
): Prisma.InputJsonValue => {
  if (esJsonObject(actual)) {
    return { ...(actual as Prisma.InputJsonObject), ...extra };
  }
  return extra as Prisma.InputJsonObject;
};

// Crea una cotizacion Ecommerce con snapshots calculados y notificacion.
export const crearCotizacionServicio = async (payload: CotizacionBasePayload) => {
  const ivaPct = obtenerIvaPct();
  const itemsAgrupados = payload.items;
  const ids = itemsAgrupados.map((item) => item.productoId);
  const productos = await buscarProductosPorIds(ids);
  const productosPorId = new Map(productos.map((producto) => [producto.id, producto]));
  const nombreContacto = normalizarTexto(payload.contacto.nombre);
  const emailNormalizado = normalizarTexto(payload.contacto.email ?? undefined);
  const email = emailNormalizado ? emailNormalizado.toLowerCase() : undefined;
  const telefonoNormalizado = normalizarTelefonoChile(payload.contacto.telefono ?? undefined);
  if (payload.contacto.telefono && !telefonoNormalizado) {
    throw new ErrorApi("Telefono invalido", 400, { telefono: payload.contacto.telefono });
  }
  const telefono = telefonoNormalizado || undefined;
  const empresa = normalizarTexto(payload.contacto.empresa ?? undefined) || undefined;
  const rut = normalizarTexto(payload.contacto.rut ?? undefined) || undefined;
  const direccion = normalizarTexto(payload.contacto.direccion ?? undefined);
  const region = normalizarTexto(payload.contacto.region ?? undefined);
  const comuna = normalizarTexto(payload.contacto.comuna ?? undefined);
  const mensaje = normalizarTexto(payload.contacto.mensaje ?? undefined);
  const origen = normalizarTexto(payload.origen ?? undefined) || "ECOMMERCE";
  const metadataUtm = payload.metadata?.utm ?? undefined;
  const metadataUserAgent = normalizarTexto(payload.metadata?.userAgent ?? undefined);
  const metadata = (() => {
    const data: Record<string, Prisma.InputJsonValue> = {};
    if (metadataUserAgent) {
      data.userAgent = metadataUserAgent;
    }
    if (metadataUtm && Object.keys(metadataUtm).length > 0) {
      data.utm = metadataUtm as Prisma.InputJsonValue;
    }
    return Object.keys(data).length > 0 ? (data as Prisma.InputJsonObject) : undefined;
  })();

  const faltantes = ids.filter((id) => !productosPorId.has(id));
  if (faltantes.length > 0) {
    throw new ErrorApi("Productos no encontrados", 404, { productos: faltantes });
  }

  const ecommerceClienteId = payload.ecommerceClienteId;
  if (ecommerceClienteId) {
    const cliente = await buscarClientePorId(ecommerceClienteId);
    if (!cliente) {
      throw new ErrorApi("Cliente no encontrado", 404, { id: ecommerceClienteId });
    }
  }

  let subtotalNeto = 0;
  let ivaTotal = 0;
  const itemsCrear = itemsAgrupados.map((item) => {
    const producto = productosPorId.get(item.productoId);
    if (!producto) {
      throw new ErrorApi("Producto no encontrado", 404, { id: item.productoId });
    }

    const precioNeto = producto.precioConDescto > 0 ? producto.precioConDescto : producto.precioGeneral;
    const subtotal = precioNeto * item.cantidad;
    const ivaMonto = Math.round((subtotal * ivaPct) / 100);
    const total = subtotal + ivaMonto;
    const observacion = normalizarTexto(item.observacion ?? undefined);

    subtotalNeto += subtotal;
    ivaTotal += ivaMonto;

    return {
      producto: { connect: { id: item.productoId } },
      skuSnapshot: producto.sku ?? undefined,
      descripcionSnapshot: producto.nombre,
      unidadSnapshot: producto.unidadMedida,
      cantidad: item.cantidad,
      observacion: observacion || undefined,
      precioUnitarioNetoSnapshot: precioNeto,
      subtotalNetoSnapshot: subtotal,
      ivaPctSnapshot: ivaPct,
      ivaMontoSnapshot: ivaMonto,
      totalSnapshot: total,
    };
  });

  const total = subtotalNeto + ivaTotal;
  const codigoTemporal = `ECQ-TMP-${randomUUID()}`;
  const observaciones = construirObservaciones({
    observaciones: payload.observaciones,
    direccion,
    mensaje,
    tipoObra: payload.extra?.tipoObra,
    region: payload.extra?.region ?? region,
    comuna: payload.extra?.comuna ?? comuna,
    comunaRegion: payload.extra?.comunaRegion,
    detalleAdicional: payload.extra?.detalleAdicional,
    ubicacion: payload.extra?.ubicacion,
  });

  // EcommerceCotizacion: trazabilidad ecommerce (front/checkout) + referencia de items/snapshots.
  // CrmCotizacion: bandeja CRM; no depende de Cliente CRM, solo snapshots y OrigenCliente.CLIENTE_ECOMMERCE.
  const resultado = await prisma.$transaction(async (tx) => {
    // CRM cotizacion se usa como inbox, sin depender de Cliente CRM (solo snapshots).
    const crmCotizacion = await tx.crmCotizacion.create({
      data: {
        clienteNombreSnapshot: nombreContacto,
        clienteRutSnapshot: rut || undefined,
        clienteEmailSnapshot: email || undefined,
        clienteTelefonoSnapshot: telefono || undefined,
        nombreObra: normalizarTexto(payload.extra?.tipoObra) || undefined,
        numeroOC: normalizarTexto(payload.ocCliente) || undefined,
        observaciones,
        subtotalNeto,
        iva: ivaTotal,
        total,
        estado: CrmEstadoCotizacion.NUEVA,
        origenCliente: OrigenCliente.CLIENTE_ECOMMERCE,
      },
      select: { id: true },
    });

    const creada = await crearCotizacion(
      {
        codigo: codigoTemporal,
        origen,
        ecommerceCliente: ecommerceClienteId
          ? { connect: { id: ecommerceClienteId } }
          : undefined,
        nombreContacto,
        
        email: (email ?? '').trim(),
        telefono: (telefono ?? '').trim(),

        empresa: empresa || undefined,
        rut: rut || undefined,
        observaciones,
        ocCliente: normalizarTexto(payload.ocCliente) || undefined,
        subtotalNeto,
        iva: ivaTotal,
        total,
        metadata,
        crmCotizacion: { connect: { id: crmCotizacion.id } },
        items: {
          create: itemsCrear,
        },
      },
      tx
    );

    const codigoFinal = formatearCodigo("ECQ", creada.correlativo);
    const actualizada = await actualizarCodigoCotizacion(creada.id, codigoFinal, tx);

    await registrarNotificacion({
      tipo: "NUEVA_COTIZACION",
      referenciaTabla: "EcommerceCotizacion",
      referenciaId: creada.id,
      titulo: "Nueva cotizacion ecommerce",
      detalle: `Contacto ${nombreContacto} (${email || "sin email"}${telefono ? ` / ${telefono}` : ""}). Items ${
        itemsCrear.length
      }. Total ${total}.`,
      tx,
    });

    return actualizada;
  });

  return resultado;
};

// Obtiene una cotizacion con items.
export const obtenerCotizacionServicio = async (id: string) => {
  const cotizacion = await obtenerCotizacionPorId(id);
  if (!cotizacion) {
    throw new ErrorApi("Cotizacion no encontrada", 404, { id });
  }
  return cotizacion;
};

// Lista cotizaciones ecommerce con paginacion y filtros.
export const listarCotizacionesServicio = async (params: {
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
}) => {
  const status = (params.status ?? "").trim().toUpperCase();
  const estadoEcommerce = status && Object.values(EcommerceEstadoCotizacion).includes(status as EcommerceEstadoCotizacion)
    ? (status as EcommerceEstadoCotizacion)
    : undefined;

  if (params.status && !estadoEcommerce) {
    throw new ErrorApi("Estado invalido", 400, { status: params.status });
  }

  const q = (params.q ?? "").trim();
  const desde = params.from ? new Date(params.from) : undefined;
  const hasta = params.to ? new Date(params.to) : undefined;

  if (desde && Number.isNaN(desde.getTime())) {
    throw new ErrorApi("Fecha invalida", 400, { from: params.from });
  }
  if (hasta && Number.isNaN(hasta.getTime())) {
    throw new ErrorApi("Fecha invalida", 400, { to: params.to });
  }

  const page = params.page ?? 1;
  const skip = (page - 1) * PAGE_SIZE;

  const filtros: Prisma.EcommerceCotizacionWhereInput[] = [];

  if (estadoEcommerce) {
    filtros.push({ estado: estadoEcommerce });
  }

  if (q) {
    filtros.push({
      OR: [
        { codigo: { contains: q, mode: "insensitive" } },
        { nombreContacto: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { telefono: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (desde || hasta) {
    filtros.push({
      createdAt: {
        gte: desde,
        lte: hasta,
      },
    });
  }

  const where = filtros.length > 0 ? { AND: filtros } : {};

  const items = await prisma.ecommerceCotizacion.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      codigo: true,
      createdAt: true,
      nombreContacto: true,
      email: true,
      telefono: true,
      estado: true,
      total: true,
      _count: { select: { items: true } },
    },
  });

  return items.map((item) => ({
    id: item.id,
    codigo: item.codigo,
    createdAt: item.createdAt,
    nombreContacto: item.nombreContacto,
    email: item.email ?? null,
    telefono: item.telefono ?? null,
    estado: item.estado,
    total: item.total,
    itemsCount: item._count.items,
  }));
};

// Convierte una cotizacion a carrito ACTIVO usando snapshots de la cotizacion.
export const convertirCotizacionACarritoServicio = async (id: string) => {
  const resultado = await prisma.$transaction(async (tx) => {
    const cotizacion = await obtenerCotizacionConItems(id, tx);
    if (!cotizacion) {
      throw new ErrorApi("Cotizacion no encontrada", 404, { id });
    }

    let carritoId: string | null = null;

    if (cotizacion.ecommerceClienteId) {
      const activo = await buscarCarritoActivoPorCliente(cotizacion.ecommerceClienteId, tx);
      carritoId = activo?.id ?? null;
    }

    if (!carritoId) {
      const creado = await crearCarrito(
        {
          ecommerceCliente: cotizacion.ecommerceClienteId
            ? { connect: { id: cotizacion.ecommerceClienteId } }
            : undefined,
        },
        tx
      );
      carritoId = creado.id;
    }

    for (const item of cotizacion.items) {
      await upsertCarritoItem(
        {
          carritoId,
          productoId: item.productoId,
          cantidad: item.cantidad,
          precioUnitarioNetoSnapshot: item.precioUnitarioNetoSnapshot,
          subtotalNetoSnapshot: item.subtotalNetoSnapshot,
          ivaPctSnapshot: item.ivaPctSnapshot,
          ivaMontoSnapshot: item.ivaMontoSnapshot,
          totalSnapshot: item.totalSnapshot,
        },
        tx
      );
    }

    await actualizarCarritoTimestamp(carritoId, tx);
    await actualizarEstadoCotizacion(id, EcommerceEstadoCotizacion.EN_REVISION, tx);

    await registrarNotificacion({
      tipo: "COTIZACION_CONVERTIDA_A_CARRITO",
      referenciaTabla: "EcommerceCotizacion",
      referenciaId: cotizacion.id,
      titulo: "Cotizacion convertida a carrito",
      detalle: `Carrito ${carritoId} con ${cotizacion.items.length} items.`,
      tx,
    });

    return { carritoId, cotizacionId: cotizacion.id };
  });

  return resultado;
};

export const eliminarCotizacionServicio = async (payload: {
  id: string;
  usuarioId: string;
  motivo?: string;
}): Promise<EliminarCotizacionResultado> => {
  const { ecommerceClienteId } = await resolverClienteUsuario(payload.usuarioId);
  const motivo = normalizarTexto(payload.motivo ?? "") || "Solicitud de usuario";

  const resultado = await prisma.$transaction(async (tx) => {
    const cotizacion = await obtenerCotizacionParaEliminar(payload.id, ecommerceClienteId, tx);
    if (!cotizacion) {
      throw new ErrorApi("Cotizacion no encontrada", 404, { id: payload.id });
    }

    const pedido = cotizacion.crmCotizacionId
      ? await tx.ecommercePedido.findFirst({
          where: { crmCotizacionId: cotizacion.crmCotizacionId },
          select: { id: true, _count: { select: { pagos: true } } },
        })
      : null;

    const tienePedido = Boolean(pedido);
    const tienePago = (pedido?._count.pagos ?? 0) > 0;
    const estadoFinal = cotizacion.estado === EcommerceEstadoCotizacion.CERRADA;
    const estadoCrmGanado = cotizacion.crmCotizacion?.estado === CrmEstadoCotizacion.GANADA;

    if (tienePedido || tienePago || estadoFinal || estadoCrmGanado) {
      const metadata = fusionarMetadata(cotizacion.metadata ?? null, {
        cancelacion: {
          fecha: new Date().toISOString(),
          motivo,
          usuarioId: payload.usuarioId,
        },
      });

      await actualizarCotizacionCancelacion(
        cotizacion.id,
        {
          estado: EcommerceEstadoCotizacion.CERRADA,
          metadata,
        },
        tx
      );

      return {
        action: "cancelled",
        cotizacionId: cotizacion.id,
        estado: EcommerceEstadoCotizacion.CERRADA,
        pedidoId: pedido?.id ?? null,
        pagoCount: pedido?._count.pagos ?? 0,
      } satisfies EliminarCotizacionResultado;
    }

    await eliminarCotizacionItems(cotizacion.id, tx);
    await eliminarCotizacion(cotizacion.id, tx);

    return {
      action: "deleted",
      cotizacionId: cotizacion.id,
      estado: cotizacion.estado,
      pedidoId: null,
      pagoCount: 0,
    } satisfies EliminarCotizacionResultado;
  });

  return resultado;
};
