import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { applePayDevCreateIntentSchema } from "./applePayDev.esquemas";
import { crearApplePayDevIntentServicio } from "./applePayDev.servicio";

// POST /api/ecommerce/payments/applepay-dev/create-intent
// Input: { orderId, usuarioId }. Output: { clientSecret }.
export const crearApplePayDevIntent = manejarAsync(async (req: Request, res: Response) => {
  const payload = applePayDevCreateIntentSchema.parse(req.body);
  const resultado = await crearApplePayDevIntentServicio(payload);

  res.status(201).json({
    ok: true,
    data: resultado,
    message: "PaymentIntent Apple Pay DEV creado",
  });
});
