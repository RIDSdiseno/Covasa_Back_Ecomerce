import { z } from "zod";

export const usuarioRegistroSchema = z.object({
  nombre: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  telefono: z.string().max(30).optional(),
});

export const usuarioLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export const usuarioIdSchema = z.object({
  id: z.string().min(1),
});
