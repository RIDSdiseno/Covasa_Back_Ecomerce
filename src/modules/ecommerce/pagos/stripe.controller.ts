import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { ErrorApi } from "../../../lib/errores";
import { stripeCreateIntentSchema, stripeIntentSchema, stripeStatusSchema } from "./stripe.schema";
import {
  crearStripeIntentEcommerceServicio,
  crearStripeIntentServicio,
  obtenerEstadoStripeServicio,
  procesarStripeWebhook,
} from "./stripe.service";

// POST /api/ecommerce/payments/stripe/intent
// Input: { pedidoId, usuarioId? }. Output: { clientSecret, paymentIntentId, pagoId }.
export const crearStripeIntent = manejarAsync(async (req: Request, res: Response) => {
  const payload = stripeIntentSchema.parse(req.body);
  const resultado = await crearStripeIntentServicio(payload);

  res.status(201).json({
    ok: true,
    data: resultado,
    clientSecret: resultado.clientSecret,
    message: "PaymentIntent Stripe creado",
  });
});

// POST /api/ecommerce/pagos/stripe/create-intent
// Input: { orderId, amount, currency, customerEmail?, metadata? }.
// Output: { clientSecret, paymentIntentId, pagoId? }.
export const crearStripeCreateIntent = manejarAsync(async (req: Request, res: Response) => {
  const payload = stripeCreateIntentSchema.parse(req.body);
  const resultado = await crearStripeIntentEcommerceServicio(payload);

  res.status(201).json({
    ok: true,
    data: resultado,
    message: "PaymentIntent Stripe creado",
  });
});

// POST /api/ecommerce/payments/stripe/webhook
export const recibirStripeWebhook = manejarAsync(async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"];
  if (!Buffer.isBuffer(req.body)) {
    throw new ErrorApi("Stripe webhook requiere raw body", 400);
  }

  const rawBody = req.body;

  await procesarStripeWebhook(rawBody, typeof signature === "string" ? signature : undefined);

  res.status(200).json({ ok: true });
});

// GET /api/ecommerce/payments/stripe/status?pedidoId=...&payment_intent=...
export const obtenerEstadoStripe = manejarAsync(async (req: Request, res: Response) => {
  const query = stripeStatusSchema.parse(req.query);
  const resultado = await obtenerEstadoStripeServicio({
    pedidoId: query.pedidoId,
    paymentIntentId: query.payment_intent,
  });

  res.json({
    ok: true,
    data: resultado,
  });
});
