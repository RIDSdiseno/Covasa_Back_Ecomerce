import { z } from "zod";

export const crmCotizacionQuerySchema = z.object({
  status: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  from: z.string().trim().min(1).optional(),
  to: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
});

export const crmCotizacionIdSchema = z.object({
  id: z.string().min(1),
});
