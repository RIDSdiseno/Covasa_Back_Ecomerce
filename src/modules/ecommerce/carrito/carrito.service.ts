import { ErrorApi } from "../../../lib/errores";
import { prisma } from "../../../lib/prisma";
import { calcularTotales, obtenerIvaPct } from "../common/ecommerce.utils";
import {
  actualizarCarritoItem,
  actualizarCarritoTimestamp,
  buscarCarritoActivoPorCliente,
  buscarCarritoPorId,
  buscarItemPorCarritoProducto,
  buscarItemPorId,
  buscarProductoPorId,
  crearCarrito,
  eliminarCarritoItem,
  eliminarItemsCarrito,
  obtenerCarritoPorId,
  upsertCarritoItem,
} from "./carrito.repo";

const mapearCarritoConTotales = (carrito: {
  id: string;
  ecommerceClienteId: string | null;
  estado: string;
  createdAt: Date;
  updatedAt: Date;
  items: {
    subtotalNetoSnapshot: number;
    ivaMontoSnapshot: number;
    totalSnapshot: number;
  }[];
}) => {
  const totales = calcularTotales(carrito.items);
  return {
    ...carrito,
    totales,
  };
};

// Crea un carrito ACTIVO o devuelve el activo existente para el cliente.
export const crearCarritoServicio = async (payload: {
  ecommerceClienteId?: string;
}) => {
  const ecommerceClienteId = payload.ecommerceClienteId;

  if (ecommerceClienteId) {
    const cliente = await prisma.ecommerceCliente.findUnique({
      where: { id: ecommerceClienteId },
      select: { id: true },
    });

    if (!cliente) {
      throw new ErrorApi("Cliente no encontrado", 404, { id: ecommerceClienteId });
    }

    const activo = await buscarCarritoActivoPorCliente(ecommerceClienteId);
    if (activo) {
      return activo;
    }
  }

  return crearCarrito({
    ecommerceCliente: ecommerceClienteId ? { connect: { id: ecommerceClienteId } } : undefined,
  });
};

// Agrega item por UPSERT y mergea cantidad si ya existe el producto.
export const agregarItemCarritoServicio = async (
  carritoId: string,
  payload: { productoId: string; cantidad: number }
) => {
  const ivaPct = obtenerIvaPct();

  await prisma.$transaction(async (tx) => {
    const carrito = await buscarCarritoPorId(carritoId, tx);
    if (!carrito) {
      throw new ErrorApi("Carrito no encontrado", 404, { id: carritoId });
    }

    const producto = await buscarProductoPorId(payload.productoId, tx);
    if (!producto) {
      throw new ErrorApi("Producto no encontrado", 404, { id: payload.productoId });
    }

    const existente = await buscarItemPorCarritoProducto(carritoId, payload.productoId, tx);
    const cantidadFinal = (existente?.cantidad ?? 0) + payload.cantidad;

    const precioNeto =
      producto.precioConDescto > 0 ? producto.precioConDescto : producto.precioGeneral;
    const subtotal = precioNeto * cantidadFinal;
    const ivaMonto = Math.round((subtotal * ivaPct) / 100);
    const total = subtotal + ivaMonto;

    await upsertCarritoItem(
      {
        carritoId,
        productoId: payload.productoId,
        cantidad: cantidadFinal,
        precioUnitarioNetoSnapshot: precioNeto,
        subtotalNetoSnapshot: subtotal,
        ivaPctSnapshot: ivaPct,
        ivaMontoSnapshot: ivaMonto,
        totalSnapshot: total,
      },
      tx
    );

    await actualizarCarritoTimestamp(carritoId, tx);
  });

  return obtenerCarritoServicio(carritoId);
};

// Actualiza cantidad de un item existente y recalcula snapshots.
export const actualizarCantidadItemCarritoServicio = async (
  carritoId: string,
  itemId: string,
  payload: { cantidad: number }
) => {
  const ivaPct = obtenerIvaPct();

  await prisma.$transaction(async (tx) => {
    const item = await buscarItemPorId(carritoId, itemId, tx);
    if (!item) {
      throw new ErrorApi("Item no encontrado", 404, { id: itemId });
    }

    const producto = await buscarProductoPorId(item.productoId, tx);
    if (!producto) {
      throw new ErrorApi("Producto no encontrado", 404, { id: item.productoId });
    }

    const precioNeto =
      producto.precioConDescto > 0 ? producto.precioConDescto : producto.precioGeneral;
    const subtotal = precioNeto * payload.cantidad;
    const ivaMonto = Math.round((subtotal * ivaPct) / 100);
    const total = subtotal + ivaMonto;

    await actualizarCarritoItem(
      item.id,
      {
        cantidad: payload.cantidad,
        precioUnitarioNetoSnapshot: precioNeto,
        subtotalNetoSnapshot: subtotal,
        ivaPctSnapshot: ivaPct,
        ivaMontoSnapshot: ivaMonto,
        totalSnapshot: total,
      },
      tx
    );

    await actualizarCarritoTimestamp(carritoId, tx);
  });

  return obtenerCarritoServicio(carritoId);
};

// Elimina un item del carrito.
export const eliminarItemCarritoServicio = async (carritoId: string, itemId: string) => {
  await prisma.$transaction(async (tx) => {
    const item = await buscarItemPorId(carritoId, itemId, tx);
    if (!item) {
      throw new ErrorApi("Item no encontrado", 404, { id: itemId });
    }

    await eliminarCarritoItem(item.id, tx);
    await actualizarCarritoTimestamp(carritoId, tx);
  });

  return obtenerCarritoServicio(carritoId);
};

// Vacia un carrito completo (borra items).
export const vaciarCarritoServicio = async (carritoId: string) => {
  await prisma.$transaction(async (tx) => {
    const carrito = await buscarCarritoPorId(carritoId, tx);
    if (!carrito) {
      throw new ErrorApi("Carrito no encontrado", 404, { id: carritoId });
    }

    await eliminarItemsCarrito(carritoId, tx);
    await actualizarCarritoTimestamp(carritoId, tx);
  });

  return obtenerCarritoServicio(carritoId);
};

// Obtiene carrito con items y totales recalculados.
export const obtenerCarritoServicio = async (id: string) => {
  const carrito = await obtenerCarritoPorId(id);
  if (!carrito) {
    throw new ErrorApi("Carrito no encontrado", 404, { id });
  }
  return mapearCarritoConTotales(carrito);
};
