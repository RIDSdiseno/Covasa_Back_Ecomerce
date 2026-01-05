import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { mercadoPagoCrearSchema } from "./mercadopago.esquemas";
import { crearMercadoPagoServicio } from "./mercadopago.servicio";

// POST /api/ecommerce/payments/mercadopago
// Input: { pedidoId }. Output: { pagoId, preferenceId, redirectUrl }.
export const crearMercadoPago = manejarAsync(async (req: Request, res: Response) => {
  const payload = mercadoPagoCrearSchema.parse(req.body);
  const resultado = await crearMercadoPagoServicio(payload);

  res.status(201).json({
    ok: true,
    data: resultado,
    message: "Preferencia Mercado Pago creada",
  });
});
