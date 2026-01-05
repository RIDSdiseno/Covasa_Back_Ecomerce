import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../../lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

const db = (tx?: DbClient) => tx ?? prisma;

export type DatosNotificacion = {
  tipo: string;
  referenciaTabla: string;
  referenciaId: string;
  titulo: string;
  detalle: string;
};

export const crearNotificacion = (datos: DatosNotificacion, tx?: DbClient) =>
  db(tx).ecommerceNotificacion.create({
    data: datos,
    select: {
      id: true,
      tipo: true,
      titulo: true,
      detalle: true,
      leido: true,
      createdAt: true,
    },
  });

export const listarNotificaciones = (filtros: {
  leido?: boolean;
  limit?: number;
  offset?: number;
}) =>
  prisma.ecommerceNotificacion.findMany({
    where: {
      leido: typeof filtros.leido === "boolean" ? filtros.leido : undefined,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: filtros.limit,
    skip: filtros.offset,
  });
