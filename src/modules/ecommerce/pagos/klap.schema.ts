import { z } from "zod";

export const klapCrearSchema = z.object({
  pedidoId: z.string().min(1),
  frontUrl: z.string().url().optional(),
});

export const klapWebhookSchema = z
  .object({
    reference_id: z.string().min(1).optional(),
    referenceId: z.string().min(1).optional(),
    order_id: z.string().min(1).optional(),
    orderId: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
    amount: z.coerce.number().optional(),
  })
  .passthrough()
  .transform((payload) => ({
    ...payload,
    reference_id: payload.reference_id ?? payload.referenceId ?? "",
    order_id: payload.order_id ?? payload.orderId ?? "",
  }))
  .superRefine((payload, ctx) => {
    if (!payload.reference_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "reference_id requerido",
        path: ["reference_id"],
      });
    }

    if (!payload.order_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "order_id requerido",
        path: ["order_id"],
      });
    }
  });

export const klapMockWebhookSchema = z.object({
  referencia: z.string().min(1),
  estado: z.enum(["CONFIRMADO", "RECHAZADO"]),
});

export type KlapCrearInput = z.infer<typeof klapCrearSchema>;
export type KlapWebhookInput = z.infer<typeof klapWebhookSchema>;
export type KlapMockWebhookInput = z.infer<typeof klapMockWebhookSchema>;
