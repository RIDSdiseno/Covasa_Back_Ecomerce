import { randomUUID } from "crypto";
import { ErrorApi } from "../../../lib/errores";
import { prisma } from "../../../lib/prisma";
import { agruparItems, formatearCodigo, normalizarTexto, obtenerIvaPct } from "../ecommerce.utilidades";
import { registrarNotificacion } from "../notificaciones/notificaciones.servicio";
import {
  actualizarCodigoPedido,
  buscarClientePorId,
  buscarProductosPorIds,
  crearPedido,
  obtenerPedidoPorId,
} from "./pedidos.repositorio";

type ItemSolicitud = { productoId: string; cantidad: number };

export const crearPedidoServicio = async (payload: {
  clienteId?: string;
  despacho?: {
    nombre?: string;
    telefono?: string;
    email?: string;
    direccion?: string;
    comuna?: string;
    ciudad?: string;
    region?: string;
    notas?: string;
  };
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
  const codigoTemporal = `ECP-TMP-${randomUUID()}`;

  const resultado = await prisma.$transaction(async (tx) => {
    const creado = await crearPedido(
      {
        codigo: codigoTemporal,
        cliente: payload.clienteId ? { connect: { id: payload.clienteId } } : undefined,
        despachoNombre: normalizarTexto(payload.despacho?.nombre) || undefined,
        despachoTelefono: normalizarTexto(payload.despacho?.telefono) || undefined,
        despachoEmail: normalizarTexto(payload.despacho?.email) || undefined,
        despachoDireccion: normalizarTexto(payload.despacho?.direccion) || undefined,
        despachoComuna: normalizarTexto(payload.despacho?.comuna) || undefined,
        despachoCiudad: normalizarTexto(payload.despacho?.ciudad) || undefined,
        despachoRegion: normalizarTexto(payload.despacho?.region) || undefined,
        despachoNotas: normalizarTexto(payload.despacho?.notas) || undefined,
        subtotalNeto,
        iva: ivaTotal,
        total,
        items: { create: itemsCrear },
      },
      tx
    );

    const codigoFinal = formatearCodigo("ECP", creado.correlativo);
    const actualizado = await actualizarCodigoPedido(creado.id, codigoFinal, tx);

    await registrarNotificacion({
      tipo: "NUEVO_PEDIDO",
      referenciaTabla: "EcommercePedido",
      referenciaId: creado.id,
      titulo: "Nuevo pedido ecommerce",
      detalle: `Items ${itemsCrear.length}. Total ${total}.`,
      tx,
    });

    return actualizado;
  });

  return resultado;
};

export const obtenerPedidoServicio = async (id: string) => {
  const pedido = await obtenerPedidoPorId(id);
  if (!pedido) {
    throw new ErrorApi("Pedido no encontrado", 404, { id });
  }
  return pedido;
};
