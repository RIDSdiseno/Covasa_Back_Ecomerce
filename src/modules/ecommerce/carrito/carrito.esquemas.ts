import { z } from "zod";

export const carritoCrearSchema = z.object({
  clienteId: z.string().min(1).optional(),
});

export const carritoIdSchema = z.object({
  id: z.string().min(1),
});

export const carritoItemSchema = z.object({
  productoId: z.string().min(1),
  cantidad: z.number().int().positive(),
});
