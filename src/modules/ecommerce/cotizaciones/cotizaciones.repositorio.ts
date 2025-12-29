import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../../lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

const db = (tx?: DbClient) => tx ?? prisma;

export const buscarProductosPorIds = (ids: string[], tx?: DbClient) =>
  db(tx).producto.findMany({
    where: {
      id: { in: ids },
    },
  });

export const buscarClientePorId = (id: string, tx?: DbClient) =>
  db(tx).cliente.findUnique({
    where: { id },
    select: { id: true },
  });

export const crearCotizacion = (
  data: Prisma.EcommerceCotizacionCreateInput,
  tx?: DbClient
) =>
  db(tx).ecommerceCotizacion.create({
    data,
    select: {
      id: true,
      correlativo: true,
      codigo: true,
      estado: true,
      subtotalNeto: true,
      iva: true,
      total: true,
      createdAt: true,
    },
  });

export const actualizarCodigoCotizacion = (
  id: string,
  codigo: string,
  tx?: DbClient
) =>
  db(tx).ecommerceCotizacion.update({
    where: { id },
    data: { codigo },
    select: {
      id: true,
      codigo: true,
      estado: true,
      subtotalNeto: true,
      iva: true,
      total: true,
      createdAt: true,
    },
  });

export const obtenerCotizacionPorId = (id: string) =>
  prisma.ecommerceCotizacion.findUnique({
    where: { id },
    include: {
      items: true,
    },
  });
