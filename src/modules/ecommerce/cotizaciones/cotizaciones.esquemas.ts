import { z } from "zod";

export const cotizacionCrearSchema = z.object({
  clienteId: z.string().min(1).optional(),
  contacto: z.object({
    nombre: z.string().min(1).max(200),
    email: z.string().email(),
    telefono: z.string().min(6).max(30),
    empresa: z.string().max(200).optional(),
    rut: z.string().max(30).optional(),
  }),
  observaciones: z.string().max(1000).optional(),
  ocCliente: z.string().max(100).optional(),
  canal: z.string().max(50).optional(),
  items: z
    .array(
      z.object({
        productoId: z.string().min(1),
        cantidad: z.number().int().positive(),
      })
    )
    .min(1),
});

export const cotizacionIdSchema = z.object({
  id: z.string().min(1),
});
