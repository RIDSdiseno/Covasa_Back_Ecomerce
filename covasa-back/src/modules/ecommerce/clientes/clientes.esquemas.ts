import { z } from "zod";

export const clienteIdSchema = z.object({
  id: z.string().min(1),
});
