import { EcommerceEstadoCarrito, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../../lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

const db = (tx?: DbClient) => tx ?? prisma;

export const crearCarrito = (data: Prisma.EcommerceCarritoCreateInput, tx?: DbClient) =>
  db(tx).ecommerceCarrito.create({
    data,
    select: {
      id: true,
      estado: true,
      createdAt: true,
    },
  });

export const obtenerCarritoPorId = (id: string) =>
  prisma.ecommerceCarrito.findUnique({
    where: { id },
    include: {
      items: true,
    },
  });

export const buscarCarritoPorId = (id: string, tx?: DbClient) =>
  db(tx).ecommerceCarrito.findUnique({
    where: { id },
    select: { id: true, estado: true, ecommerceClienteId: true },
  });

export const buscarCarritoActivoPorCliente = (ecommerceClienteId: string, tx?: DbClient) =>
  db(tx).ecommerceCarrito.findFirst({
    where: {
      ecommerceClienteId,
      estado: EcommerceEstadoCarrito.ACTIVO,
    },
    select: { id: true, estado: true, ecommerceClienteId: true },
  });

export const actualizarCarritoEstado = (id: string, estado: EcommerceEstadoCarrito, tx?: DbClient) =>
  db(tx).ecommerceCarrito.update({
    where: { id },
    data: { estado },
  });

export const actualizarCarritoTimestamp = (id: string, tx?: DbClient) =>
  db(tx).ecommerceCarrito.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

export const buscarProductoPorId = (id: string, tx?: DbClient) =>
  db(tx).producto.findFirst({
    where: { id, activo: true, visibleEcommerce: true },
  });

export const buscarItemPorCarritoProducto = (
  carritoId: string,
  productoId: string,
  tx?: DbClient
) =>
  db(tx).ecommerceCarritoItem.findUnique({
    where: {
      carritoId_productoId: {
        carritoId,
        productoId,
      },
    },
  });

export const buscarItemPorId = (carritoId: string, itemId: string, tx?: DbClient) =>
  db(tx).ecommerceCarritoItem.findFirst({
    where: {
      id: itemId,
      carritoId,
    },
  });

export const upsertCarritoItem = (
  data: Prisma.EcommerceCarritoItemUncheckedCreateInput,
  tx?: DbClient
) =>
  db(tx).ecommerceCarritoItem.upsert({
    where: {
      carritoId_productoId: {
        carritoId: data.carritoId,
        productoId: data.productoId,
      },
    },
    create: data,
    update: {
      cantidad: data.cantidad,
      precioUnitarioNetoSnapshot: data.precioUnitarioNetoSnapshot,
      subtotalNetoSnapshot: data.subtotalNetoSnapshot,
      ivaPctSnapshot: data.ivaPctSnapshot,
      ivaMontoSnapshot: data.ivaMontoSnapshot,
      totalSnapshot: data.totalSnapshot,
    },
  });

export const actualizarCarritoItem = (
  itemId: string,
  data: Prisma.EcommerceCarritoItemUpdateInput,
  tx?: DbClient
) =>
  db(tx).ecommerceCarritoItem.update({
    where: { id: itemId },
    data,
  });

export const eliminarCarritoItem = (itemId: string, tx?: DbClient) =>
  db(tx).ecommerceCarritoItem.delete({
    where: { id: itemId },
  });

export const eliminarItemsCarrito = (carritoId: string, tx?: DbClient) =>
  db(tx).ecommerceCarritoItem.deleteMany({
    where: { carritoId },
  });
