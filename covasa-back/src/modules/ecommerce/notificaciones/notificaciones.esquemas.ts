import { z } from "zod";

const leidoSchema = z.preprocess((valor) => {
  if (typeof valor === "string") {
    const normalizado = valor.toLowerCase();
    if (normalizado === "true") return true;
    if (normalizado === "false") return false;
  }
  return valor;
}, z.boolean().optional());

export const notificacionesQuerySchema = z.object({
  leido: leidoSchema,
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
