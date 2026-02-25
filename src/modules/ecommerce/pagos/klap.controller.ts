import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { klapCrearSchema, klapWebhookSchema } from "./klap.schema";
import { crearKlapPagoServicio, procesarKlapWebhookServicio } from "./klap.service";

// POST /api/ecommerce/payments/klap
// Input: { pedidoId, frontUrl? }. Output: { pagoId, pedidoId, orderId, redirectUrl? }.
export const crearKlapPago = manejarAsync(async (req: Request, res: Response) => {
  const payload = klapCrearSchema.parse(req.body);
  const resultado = await crearKlapPagoServicio(payload);

  res.status(200).json({
    ok: true,
    data: resultado,
    message: "Orden KLAP creada",
  });
});

// POST /api/ecommerce/payments/klap/webhook
// Valida firma y actualiza estado del pago/pedido.
export const recibirKlapWebhook = manejarAsync(async (req: Request, res: Response) => {
  const payload = klapWebhookSchema.parse(req.body);
  const apikeyHeader = req.headers.apikey;
  const apikey = Array.isArray(apikeyHeader) ? apikeyHeader[0] : apikeyHeader;

  await procesarKlapWebhookServicio({
    payload,
    apikeyHeader: typeof apikey === "string" ? apikey : undefined,
  });

  res.status(200).json({ status: "ok" });
});
