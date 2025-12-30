import { PrismaClient, Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

const db = (tx?: DbClient) => tx ?? prisma;

export const buscarClientePorId = (id: string, tx?: DbClient) =>
  db(tx).cliente.findUnique({
    where: { id },
    select: {
      id: true,
      nombre: true,
      personaContacto: true,
      email: true,
      telefono: true,
      direccion: true,
      comuna: true,
      ciudad: true,
      region: true,
    },
  });
