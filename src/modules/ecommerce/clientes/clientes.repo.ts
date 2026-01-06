import { PrismaClient, Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

const db = (tx?: DbClient) => tx ?? prisma;

export const buscarClientePorId = (id: string, tx?: DbClient) =>
  db(tx).ecommerceCliente.findUnique({
    where: { id },
    select: {
      id: true,
      nombres: true,
      apellidos: true,
      emailContacto: true,
      telefono: true,
    },
  });
