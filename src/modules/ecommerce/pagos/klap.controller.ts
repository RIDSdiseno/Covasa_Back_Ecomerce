import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { klapCrearSchema, klapMockWebhookSchema, klapWebhookSchema } from "./klap.schema";
import {
  crearKlapPagoServicio,
  procesarKlapMockWebhookServicio,
  procesarKlapWebhookServicio,
} from "./klap.service";

// POST /api/ecommerce/payments/klap
// Input: { pedidoId, frontUrl? }. Output: { pagoId, pedidoId, orderId, redirectUrl? }.
export const crearKlapPago = manejarAsync(async (req: Request, res: Response) => {
  const payload = klapCrearSchema.parse(req.body);
  const resultado = await crearKlapPagoServicio(payload);

  res.status(200).json({
    ok: true,
    data: resultado,
    redirectUrl: resultado.redirectUrl,
    mock: Boolean(resultado.mock),
    message: resultado.mock ? "Orden KLAP mock creada" : "Orden KLAP creada",
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

// POST /api/ecommerce/payments/klap/mock-webhook
// Solo para sandbox/mock: actualiza pago KLAP simulando confirmacion/rechazo.
export const recibirKlapMockWebhook = manejarAsync(async (req: Request, res: Response) => {
  const payload = klapMockWebhookSchema.parse(req.body);
  const resultado = await procesarKlapMockWebhookServicio(payload);

  res.status(200).json({
    ok: true,
    referencia: resultado.referencia,
    estadoFinal: resultado.estadoFinal,
  });
});
