import { z } from "zod";

export const applePayDevCreateIntentSchema = z.object({
  orderId: z.string().min(1),
  usuarioId: z.string().min(1),
});
