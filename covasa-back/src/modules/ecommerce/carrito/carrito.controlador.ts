import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import {
  carritoCrearSchema,
  carritoIdSchema,
  carritoItemActualizarSchema,
  carritoItemAgregarSchema,
  carritoItemParamSchema,
} from "./carrito.esquemas";
import {
  actualizarCantidadItemCarritoServicio,
  agregarItemCarritoServicio,
  crearCarritoServicio,
  eliminarItemCarritoServicio,
  obtenerCarritoServicio,
  vaciarCarritoServicio,
} from "./carrito.servicio";

// POST /api/ecommerce/cart
// Input: { ecommerceClienteId? }. Output: { carritoId, estado }.
export const crearCarrito = manejarAsync(async (req: Request, res: Response) => {
  const payload = carritoCrearSchema.parse(req.body);
  const carrito = await crearCarritoServicio(payload);

  res.status(201).json({
    ok: true,
    data: {
      carritoId: carrito.id,
      estado: carrito.estado,
    },
    message: "Carrito listo",
  });
});

// GET /api/ecommerce/cart/:id
// Output: carrito con items y totales.
export const obtenerCarrito = manejarAsync(async (req: Request, res: Response) => {
  const { id } = carritoIdSchema.parse(req.params);
  const carrito = await obtenerCarritoServicio(id);
  res.json({ ok: true, data: carrito });
});

// POST /api/ecommerce/cart/:id/items
// Input: { productoId, cantidad }. Reglas: UPSERT + merge cantidades, snapshots desde Producto.
export const agregarItemCarrito = manejarAsync(async (req: Request, res: Response) => {
  const { id } = carritoIdSchema.parse(req.params);
  const payload = carritoItemAgregarSchema.parse(req.body);
  const carrito = await agregarItemCarritoServicio(id, payload);

  res.status(201).json({
    ok: true,
    data: carrito,
    message: "Item agregado al carrito",
  });
});

// PATCH /api/ecommerce/cart/:id/items/:itemId
// Input: { cantidad }. Recalcula snapshots y totales.
export const actualizarItemCarrito = manejarAsync(async (req: Request, res: Response) => {
  const { id, itemId } = carritoItemParamSchema.parse(req.params);
  const payload = carritoItemActualizarSchema.parse(req.body);
  const carrito = await actualizarCantidadItemCarritoServicio(id, itemId, payload);

  res.json({
    ok: true,
    data: carrito,
    message: "Item actualizado",
  });
});

// DELETE /api/ecommerce/cart/:id/items/:itemId
// Output: carrito actualizado sin el item.
export const eliminarItemCarrito = manejarAsync(async (req: Request, res: Response) => {
  const { id, itemId } = carritoItemParamSchema.parse(req.params);
  const carrito = await eliminarItemCarritoServicio(id, itemId);

  res.json({
    ok: true,
    data: carrito,
    message: "Item eliminado",
  });
});

// DELETE /api/ecommerce/cart/:id/items
// Output: carrito vacio.
export const vaciarCarrito = manejarAsync(async (req: Request, res: Response) => {
  const { id } = carritoIdSchema.parse(req.params);
  const carrito = await vaciarCarritoServicio(id);

  res.json({
    ok: true,
    data: carrito,
    message: "Carrito vaciado",
  });
});
