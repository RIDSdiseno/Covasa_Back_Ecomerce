import { z } from "zod";

export const crmProductoIdSchema = z.object({
  id: z.string().min(1),
});

export const crmProductoEstadoSchema = z
  .object({
    activo: z.coerce.boolean().optional(),
    visibleEcommerce: z.coerce.boolean().optional(),
  })
  .refine((data) => data.activo !== undefined || data.visibleEcommerce !== undefined, {
    message: "Debe enviar activo o visibleEcommerce",
  });
