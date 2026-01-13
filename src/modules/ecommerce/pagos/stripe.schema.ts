import { z } from "zod";

export const stripeIntentSchema = z.object({
  pedidoId: z.string().min(1),
  usuarioId: z.string().min(1).optional(),
});

export const stripeCreateIntentSchema = z
  .object({
    orderId: z.string().min(1),
    amount: z.coerce.number().int().min(1),
    currency: z.string().min(1),
    customerEmail: z.string().email().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  });

export const stripeStatusSchema = z
  .object({
    pedidoId: z.string().min(1).optional(),
    payment_intent: z.string().min(1).optional(),
  })
  .refine((data) => Boolean(data.pedidoId || data.payment_intent), {
    message: "pedidoId o payment_intent requerido",
  });
