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
      tipo: filtros.tipo,
      visibleEcommerce: true,
      activo: true,
      OR: filtros.q
        ? [
            { nombre: { contains: filtros.q, mode: "insensitive" } },
            { sku: { contains: filtros.q, mode: "insensitive" } },
            { categoria: { is: { nombre: { contains: filtros.q, mode: "insensitive" } } } },
            { categoria: { is: { slug: { contains: filtros.q, mode: "insensitive" } } } },
          ]
        : undefined,
    },
    include: {
      inventarios: {
        select: {
          stock: true,
        },
      },
      imagenes: {
        select: {
          url: true,
          orden: true,
        },
      },
      variantes: {
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
      categoria: {
        select: {
          id: true,
          nombre: true,
          slug: true,
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
  prisma.producto.findFirst({
    where: { id, visibleEcommerce: true, activo: true },
    include: {
      inventarios: {
        select: {
          stock: true,
        },
      },
      imagenes: {
        select: {
          url: true,
          orden: true,
        },
      },
      variantes: {
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
      categoria: {
        select: {
          id: true,
          nombre: true,
          slug: true,
        },
      },
    },
  });
