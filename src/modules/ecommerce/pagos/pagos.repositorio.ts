import { EcommerceEstadoPago, EcommerceEstadoPedido, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../../lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

const db = (tx?: DbClient) => tx ?? prisma;

export const buscarPedidoPorId = (id: string, tx?: DbClient) =>
  db(tx).ecommercePedido.findUnique({
    where: { id },
    select: { id: true },
  });

export const buscarPedidoParaPago = (id: string, tx?: DbClient) =>
  db(tx).ecommercePedido.findUnique({
    where: { id },
    select: {
      id: true,
      codigo: true,
      total: true,
      estado: true,
    },
  });

export const buscarPedidoParaMercadoPago = (id: string, tx?: DbClient) =>
  db(tx).ecommercePedido.findUnique({
    where: { id },
    select: {
      id: true,
      codigo: true,
      total: true,
      estado: true,
      despachoEmail: true,
      items: {
        select: {
          id: true,
          productoId: true,
          descripcionSnapshot: true,
          cantidad: true,
          totalSnapshot: true,
        },
      },
    },
  });

export const crearPago = (data: Prisma.EcommercePagoCreateInput, tx?: DbClient) =>
  db(tx).ecommercePago.create({
    data,
    select: {
      id: true,
      estado: true,
      monto: true,
      createdAt: true,
    },
  });

export const buscarPagoPorId = (id: string, tx?: DbClient) =>
  db(tx).ecommercePago.findUnique({
    where: { id },
  });

export const buscarPagoPorReferencia = (referencia: string, tx?: DbClient) =>
  db(tx).ecommercePago.findFirst({
    where: { referencia },
  });

export const actualizarPagoDatos = (
  id: string,
  data: Prisma.EcommercePagoUpdateInput,
  tx?: DbClient
) =>
  db(tx).ecommercePago.update({
    where: { id },
    data,
  });

export const actualizarPagoEstado = (
  id: string,
  estado: EcommerceEstadoPago,
  tx?: DbClient
) =>
  db(tx).ecommercePago.update({
    where: { id },
    data: { estado },
  });

export const actualizarPedidoEstado = (
  id: string,
  estado: EcommerceEstadoPedido,
  tx?: DbClient
) =>
  db(tx).ecommercePedido.update({
    where: { id },
    data: { estado },
  });
