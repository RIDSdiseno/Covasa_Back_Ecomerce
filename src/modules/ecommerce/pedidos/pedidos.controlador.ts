import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { pedidoCrearSchema, pedidoIdSchema } from "./pedidos.esquemas";
import { crearPedidoServicio, obtenerPedidoServicio } from "./pedidos.servicio";

export const crearPedido = manejarAsync(async (req: Request, res: Response) => {
  const payload = pedidoCrearSchema.parse(req.body);
  const pedido = await crearPedidoServicio(payload);

  res.status(201).json({
    ok: true,
    data: pedido,
    message: "Pedido creado",
  });
});

export const obtenerPedido = manejarAsync(async (req: Request, res: Response) => {
  const { id } = pedidoIdSchema.parse(req.params);
  const pedido = await obtenerPedidoServicio(id);
  res.json({ ok: true, data: pedido });
});
