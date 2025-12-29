import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { carritoCrearSchema, carritoIdSchema, carritoItemSchema } from "./carrito.esquemas";
import { agregarItemCarritoServicio, crearCarritoServicio, obtenerCarritoServicio } from "./carrito.servicio";

export const crearCarrito = manejarAsync(async (req: Request, res: Response) => {
  const payload = carritoCrearSchema.parse(req.body);
  const carrito = await crearCarritoServicio(payload);

  res.status(201).json({
    ok: true,
    data: carrito,
    message: "Carrito creado",
  });
});

export const agregarItemCarrito = manejarAsync(async (req: Request, res: Response) => {
  const { id } = carritoIdSchema.parse(req.params);
  const payload = carritoItemSchema.parse(req.body);
  const item = await agregarItemCarritoServicio(id, payload);

  res.status(201).json({
    ok: true,
    data: item,
    message: "Item agregado al carrito",
  });
});

export const obtenerCarrito = manejarAsync(async (req: Request, res: Response) => {
  const { id } = carritoIdSchema.parse(req.params);
  const carrito = await obtenerCarritoServicio(id);
  res.json({ ok: true, data: carrito });
});
