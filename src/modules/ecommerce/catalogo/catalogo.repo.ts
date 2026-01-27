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
      visibleEcommerce: true,
      activo: true,
    },
    include: {
      Inventario: {
        select: {
          stock: true,
        },
      },
      ProductoImagen: {
        select: {
          url: true,
          orden: true,
        },
      },
      ProductoVariante: {
        where: { activa: true },
        select: {
          id: true,
          atributo: true,
          valor: true,
          precio: true,
          stock: true,
          stockMinimo: true,
          skuVariante: true,
          orden: true,
        },
        orderBy: [{ atributo: "asc" }, { orden: "asc" }, { valor: "asc" }],
      },
    },
    orderBy: {
      nombre: "asc",
    },
    take: filtros.limit,
    skip: filtros.offset,
  });

export const buscarProductoPorId = (id: string) =>
  prisma.producto.findFirst({
    where: { id, visibleEcommerce: true, activo: true },
    include: {
      Inventario: {
        select: {
          stock: true,
        },
      },
      ProductoImagen: {
        select: {
          url: true,
          orden: true,
        },
      },
      ProductoVariante: {
        where: { activa: true },
        select: {
          id: true,
          atributo: true,
          valor: true,
          precio: true,
          stock: true,
          stockMinimo: true,
          skuVariante: true,
          orden: true,
        },
        orderBy: [{ atributo: "asc" }, { orden: "asc" }, { valor: "asc" }],
      },
    },
  });
