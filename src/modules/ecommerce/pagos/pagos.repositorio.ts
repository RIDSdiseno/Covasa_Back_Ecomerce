import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../../lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

const db = (tx?: DbClient) => tx ?? prisma;

export const buscarPedidoPorId = (id: string, tx?: DbClient) =>
  db(tx).ecommercePedido.findUnique({
    where: { id },
    select: { id: true },
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
