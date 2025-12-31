import { randomUUID } from "crypto";
import { CrmEstadoCotizacion, EcommerceEstadoCotizacion, OrigenCliente } from "@prisma/client";
import { ErrorApi } from "../../../lib/errores";
import { prisma } from "../../../lib/prisma";
import {
  construirObservaciones,
  formatearCodigo,
  normalizarTexto,
  obtenerIvaPct,
} from "../ecommerce.utilidades";
import {
  actualizarCodigoCotizacion,
  actualizarEstadoCotizacion,
  buscarClientePorId,
  buscarProductosPorIds,
  crearCotizacion,
  obtenerCotizacionConItems,
  obtenerCotizacionPorId,
} from "./cotizaciones.repositorio";
import {
  actualizarCarritoTimestamp,
  buscarCarritoActivoPorCliente,
  crearCarrito,
  upsertCarritoItem,
} from "../carrito/carrito.repositorio";
import { registrarNotificacion } from "../notificaciones/notificaciones.servicio";

type ItemSolicitud = { productoId: string; cantidad: number };

type CotizacionBasePayload = {
  ecommerceClienteId?: string;
  contacto: {
    nombre: string;
    email: string;
    telefono: string;
    empresa?: string;
    rut?: string;
  };
  observaciones?: string;
  ocCliente?: string;
  extra?: {
    tipoObra?: string;
    comunaRegion?: string;
    detalleAdicional?: string;
    ubicacion?: string;
  };
  items: ItemSolicitud[];
};

// Crea una cotizacion Ecommerce con snapshots calculados y notificacion.
export const crearCotizacionServicio = async (payload: CotizacionBasePayload) => {
  const ivaPct = obtenerIvaPct();
  const itemsAgrupados = payload.items;
  const ids = itemsAgrupados.map((item) => item.productoId);
  const productos = await buscarProductosPorIds(ids);
  const productosPorId = new Map(productos.map((producto) => [producto.id, producto]));

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

    subtotalNeto += subtotal;
    ivaTotal += ivaMonto;

    return {
      producto: { connect: { id: item.productoId } },
      descripcionSnapshot: producto.nombre,
      cantidad: item.cantidad,
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
    tipoObra: payload.extra?.tipoObra,
    comunaRegion: payload.extra?.comunaRegion,
    detalleAdicional: payload.extra?.detalleAdicional,
    ubicacion: payload.extra?.ubicacion,
  });

  const resultado = await prisma.$transaction(async (tx) => {
    const crmCotizacion = await tx.crmCotizacion.create({
      data: {
        clienteNombreSnapshot: normalizarTexto(payload.contacto.nombre),
        clienteRutSnapshot: normalizarTexto(payload.contacto.rut) || undefined,
        clienteEmailSnapshot: normalizarTexto(payload.contacto.email).toLowerCase(),
        clienteTelefonoSnapshot: normalizarTexto(payload.contacto.telefono) || undefined,
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
        ecommerceCliente: ecommerceClienteId
          ? { connect: { id: ecommerceClienteId } }
          : undefined,
        nombreContacto: normalizarTexto(payload.contacto.nombre),
        email: normalizarTexto(payload.contacto.email).toLowerCase(),
        telefono: normalizarTexto(payload.contacto.telefono),
        empresa: normalizarTexto(payload.contacto.empresa) || undefined,
        rut: normalizarTexto(payload.contacto.rut) || undefined,
        observaciones,
        ocCliente: normalizarTexto(payload.ocCliente) || undefined,
        subtotalNeto,
        iva: ivaTotal,
        total,
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
      detalle: `Contacto ${normalizarTexto(payload.contacto.nombre)} (${normalizarTexto(
        payload.contacto.email
      )}). Items ${itemsCrear.length}. Total ${total}.`,
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
