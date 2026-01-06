import { z } from "zod";

export const mercadoPagoCrearSchema = z.object({
  pedidoId: z.string().min(1),
});
