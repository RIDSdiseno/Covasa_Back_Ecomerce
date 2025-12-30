import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { catalogoProductoIdSchema, catalogoQuerySchema } from "./catalogo.esquemas";
import { listarProductosCatalogo, obtenerProductoCatalogo } from "./catalogo.servicio";

// GET /api/ecommerce/productos | /api/products
// Inputs: query q/tipo/limit/offset. Output: lista de productos con precios y stock.
export const listarProductos = manejarAsync(async (req: Request, res: Response) => {
  const query = catalogoQuerySchema.parse(req.query);
  const productos = await listarProductosCatalogo(query);
  res.json({ ok: true, data: productos });
});

// GET /api/ecommerce/productos/:id
// Output: producto con precios y stock o 404 si no existe.
export const obtenerProducto = manejarAsync(async (req: Request, res: Response) => {
  const { id } = catalogoProductoIdSchema.parse(req.params);
  const producto = await obtenerProductoCatalogo(id);
  res.json({ ok: true, data: producto });
});