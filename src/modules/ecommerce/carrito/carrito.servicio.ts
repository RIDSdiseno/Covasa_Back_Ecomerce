import { ErrorApi } from "../../../lib/errores";
import { prisma } from "../../../lib/prisma";
import { obtenerIvaPct } from "../ecommerce.utilidades";
import {
  buscarCarritoPorId,
  buscarProductoPorId,
  crearCarrito,
  obtenerCarritoPorId,
  upsertCarritoItem,
} from "./carrito.repositorio";

export const crearCarritoServicio = async (payload: { clienteId?: string }) => {
  if (payload.clienteId) {
    const cliente = await prisma.cliente.findUnique({
      where: { id: payload.clienteId },
      select: { id: true },
    });

    if (!cliente) {
      throw new ErrorApi("Cliente no encontrado", 404, { id: payload.clienteId });
    }
  }

  return crearCarrito({
    cliente: payload.clienteId ? { connect: { id: payload.clienteId } } : undefined,
  });
};

export const agregarItemCarritoServicio = async (
  carritoId: string,
  payload: { productoId: string; cantidad: number }
) => {
  const ivaPct = obtenerIvaPct();

  const resultado = await prisma.$transaction(async (tx) => {
    const carrito = await buscarCarritoPorId(carritoId, tx);
    if (!carrito) {
      throw new ErrorApi("Carrito no encontrado", 404, { id: carritoId });
    }

    const producto = await buscarProductoPorId(payload.productoId, tx);
    if (!producto) {
      throw new ErrorApi("Producto no encontrado", 404, { id: payload.productoId });
    }

    const precioNeto =
      producto.precioConDescto > 0 ? producto.precioConDescto : producto.precioGeneral;
    const subtotal = precioNeto * payload.cantidad;
    const ivaMonto = Math.round((subtotal * ivaPct) / 100);
    const total = subtotal + ivaMonto;

    return upsertCarritoItem(
      {
        carritoId,
        productoId: payload.productoId,
        cantidad: payload.cantidad,
        precioUnitarioNetoSnapshot: precioNeto,
        subtotalNetoSnapshot: subtotal,
        ivaPctSnapshot: ivaPct,
        ivaMontoSnapshot: ivaMonto,
        totalSnapshot: total,
      },
      tx
    );
  });

  return resultado;
};

export const obtenerCarritoServicio = async (id: string) => {
  const carrito = await obtenerCarritoPorId(id);
  if (!carrito) {
    throw new ErrorApi("Carrito no encontrado", 404, { id });
  }
  return carrito;
};
