import { Request, Response } from "express";
import { z } from "zod";
import { ProductoTipo } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { manejarAsync } from "../lib/manejarAsync";
import { ErrorApi } from "../lib/errores";

const productosQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  tipo: z.nativeEnum(ProductoTipo).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const productoIdSchema = z.object({
  id: z.string().min(1),
});

const mapearProducto = (producto: {
  id: string;
  sku: string | null;
  nombre: string;
  unidadMedida: string;
  fotoUrl: string | null;
  precioGeneral: number;
  precioConDescto: number;
  tipo: ProductoTipo;
  Inventario: { stock: number }[];
}) => {
  const stockDisponible = producto.Inventario.reduce((sum, item) => sum + item.stock, 0);
  const precioNeto = producto.precioConDescto > 0 ? producto.precioConDescto : producto.precioGeneral;

  return {
    id: producto.id,
    sku: producto.sku,
    nombre: producto.nombre,
    descripcion: producto.nombre,
    unidad: producto.unidadMedida,
    fotoUrl: producto.fotoUrl,
    tipo: producto.tipo,
    precioNeto,
    precioLista: producto.precioGeneral,
    precioConDescuento: producto.precioConDescto,
    stockDisponible,
  };
};

export const listarProductos = manejarAsync(async (req: Request, res: Response) => {
  const query = productosQuerySchema.parse(req.query);

  const productos = await prisma.producto.findMany({
    where: {
      nombre: query.q ? { contains: query.q, mode: "insensitive" } : undefined,
      tipo: query.tipo,
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
    take: query.limit,
    skip: query.offset,
  });

  res.json({ ok: true, data: productos.map(mapearProducto) });
});

export const obtenerProducto = manejarAsync(async (req: Request, res: Response) => {
  const { id } = productoIdSchema.parse(req.params);

  const producto = await prisma.producto.findUnique({
    where: { id },
    include: {
      Inventario: {
        select: {
          stock: true,
        },
      },
    },
  });

  if (!producto) {
    throw new ErrorApi("Producto no encontrado", 404, { id });
  }

  res.json({ ok: true, data: mapearProducto(producto) });
});
