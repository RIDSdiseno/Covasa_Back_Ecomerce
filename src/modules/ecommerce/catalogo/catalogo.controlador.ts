import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { catalogoProductoIdSchema, catalogoQuerySchema } from "./catalogo.esquemas";
import { listarProductosCatalogo, obtenerProductoCatalogo } from "./catalogo.servicio";

export const listarProductos = manejarAsync(async (req: Request, res: Response) => {
  const query = catalogoQuerySchema.parse(req.query);
  const productos = await listarProductosCatalogo(query);
  res.json({ ok: true, data: productos });
});

export const obtenerProducto = manejarAsync(async (req: Request, res: Response) => {
  const { id } = catalogoProductoIdSchema.parse(req.params);
  const producto = await obtenerProductoCatalogo(id);
  res.json({ ok: true, data: producto });
});
