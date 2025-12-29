import { randomUUID } from "crypto";
import { ErrorApi } from "../../../lib/errores";
import { prisma } from "../../../lib/prisma";
import { agruparItems, formatearCodigo, normalizarTexto, obtenerIvaPct } from "../ecommerce.utilidades";
import {
  actualizarCodigoCotizacion,
  buscarClientePorId,
  buscarProductosPorIds,
  crearCotizacion,
  obtenerCotizacionPorId,
} from "./cotizaciones.repositorio";
import { registrarNotificacion } from "../notificaciones/notificaciones.servicio";

type ItemSolicitud = { productoId: string; cantidad: number };

export const crearCotizacionServicio = async (payload: {
  clienteId?: string;
  contacto: {
    nombre: string;
    email: string;
    telefono: string;
    empresa?: string;
    rut?: string;
  };
  observaciones?: string;
  ocCliente?: string;
  canal?: string;
  items: ItemSolicitud[];
}) => {
  const ivaPct = obtenerIvaPct();
  const itemsAgrupados = agruparItems(payload.items);
  const ids = itemsAgrupados.map((item) => item.productoId);
  const productos = await buscarProductosPorIds(ids);
  const productosPorId = new Map(productos.map((producto) => [producto.id, producto]));

  const faltantes = ids.filter((id) => !productosPorId.has(id));
  if (faltantes.length > 0) {
    throw new ErrorApi("Productos no encontrados", 404, { productos: faltantes });
  }

  if (payload.clienteId) {
    const cliente = await buscarClientePorId(payload.clienteId);
    if (!cliente) {
      throw new ErrorApi("Cliente no encontrado", 404, { id: payload.clienteId });
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
  const resultado = await prisma.$transaction(async (tx) => {
    const creada = await crearCotizacion(
      {
        codigo: codigoTemporal,
        cliente: payload.clienteId ? { connect: { id: payload.clienteId } } : undefined,
        nombreContacto: normalizarTexto(payload.contacto.nombre),
        email: normalizarTexto(payload.contacto.email).toLowerCase(),
        telefono: normalizarTexto(payload.contacto.telefono),
        empresa: normalizarTexto(payload.contacto.empresa) || undefined,
        rut: normalizarTexto(payload.contacto.rut) || undefined,
        observaciones: normalizarTexto(payload.observaciones) || undefined,
        ocCliente: normalizarTexto(payload.ocCliente) || undefined,
        subtotalNeto,
        iva: ivaTotal,
        total,
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

export const obtenerCotizacionServicio = async (id: string) => {
  const cotizacion = await obtenerCotizacionPorId(id);
  if (!cotizacion) {
    throw new ErrorApi("Cotizacion no encontrada", 404, { id });
  }
  return cotizacion;
};
