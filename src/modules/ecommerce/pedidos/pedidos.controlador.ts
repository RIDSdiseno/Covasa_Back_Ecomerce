import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import {
  pedidoCarritoIdSchema,
  pedidoCrearSchema,
  pedidoDesdeCarritoSchema,
  pedidoIdSchema,
} from "./pedidos.esquemas";
import {
  crearPedidoDesdeCarritoServicio,
  crearPedidoServicio,
  obtenerPedidoServicio,
} from "./pedidos.servicio";

// POST /api/ecommerce/orders
// Input: despacho + items. Output: { pedidoId, codigo, total }.
export const crearPedido = manejarAsync(async (req: Request, res: Response) => {
  const payload = pedidoCrearSchema.parse(req.body);
  const pedido = await crearPedidoServicio(payload);

  res.status(201).json({
    ok: true,
    data: {
      pedidoId: pedido.id,
      codigo: pedido.codigo,
      total: pedido.total,
    },
    message: "Pedido creado",
  });
});

// POST /api/ecommerce/orders/from-cart/:cartId
// Input: despacho opcional. Output: { pedidoId, codigo, total }.
export const crearPedidoDesdeCarrito = manejarAsync(async (req: Request, res: Response) => {
  const { cartId } = pedidoCarritoIdSchema.parse(req.params);
  const payload = pedidoDesdeCarritoSchema.parse(req.body ?? {});
  const pedido = await crearPedidoDesdeCarritoServicio(cartId, payload.despacho);

  res.status(201).json({
    ok: true,
    data: {
      pedidoId: pedido.id,
      codigo: pedido.codigo,
      total: pedido.total,
    },
    message: "Pedido creado desde carrito",
  });
});

// GET /api/ecommerce/orders/:id
// Output: pedido con items y pagos.
export const obtenerPedido = manejarAsync(async (req: Request, res: Response) => {
  const { id } = pedidoIdSchema.parse(req.params);
  const pedido = await obtenerPedidoServicio(id);
  res.json({ ok: true, data: pedido });
});