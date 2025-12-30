import { z } from "zod";

export const transbankCrearSchema = z.object({
  pedidoId: z.string().min(1),
  returnUrl: z.string().url().optional(),
});

export const transbankTokenSchema = z.object({
  token: z.string().min(1),
});
