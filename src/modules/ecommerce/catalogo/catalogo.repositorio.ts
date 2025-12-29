import { ProductoTipo } from "@prisma/client";
import { prisma } from "../../../lib/prisma";

type FiltrosCatalogo = {
  q?: string;
  tipo?: ProductoTipo;
  limit?: number;
  offset?: number;
};

export const buscarProductos = (filtros: FiltrosCatalogo) =>
  prisma.producto.findMany({
    where: {
      nombre: filtros.q ? { contains: filtros.q, mode: "insensitive" } : undefined,
      tipo: filtros.tipo,
    },
    include: {
      Inventario: {
        select: {
          stock: true,
        },
      },
    },
    orderBy: {
      nombre: "asc",
    },
    take: filtros.limit,
    skip: filtros.offset,
  });

export const buscarProductoPorId = (id: string) =>
  prisma.producto.findUnique({
    where: { id },
    include: {
      Inventario: {
        select: {
          stock: true,
        },
      },
    },
  });
