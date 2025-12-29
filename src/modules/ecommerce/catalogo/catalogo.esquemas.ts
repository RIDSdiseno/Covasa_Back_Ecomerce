import { z } from "zod";
import { ProductoTipo } from "@prisma/client";

export const catalogoQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  tipo: z.nativeEnum(ProductoTipo).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const catalogoProductoIdSchema = z.object({
  id: z.string().min(1),
});
