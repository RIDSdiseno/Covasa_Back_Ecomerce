import { Prisma, PrismaClient } from "@prisma/client";
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
    select: { id: true },
  });

export const buscarProductoPorId = (id: string, tx?: DbClient) =>
  db(tx).producto.findUnique({
    where: { id },
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
