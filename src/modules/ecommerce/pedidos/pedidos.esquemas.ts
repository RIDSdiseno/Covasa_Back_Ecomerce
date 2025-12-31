import { z } from "zod";

export const pedidoCrearSchema = z.object({
  ecommerceClienteId: z.string().min(1).optional(),
  clienteId: z.string().min(1).optional(),
  usuarioId: z.string().min(1).optional(),
  despacho: z
    .object({
      nombre: z.string().max(200).optional(),
      telefono: z.string().max(30).optional(),
      email: z.string().email().optional(),
      direccion: z.string().max(200).optional(),
      comuna: z.string().max(100).optional(),
      ciudad: z.string().max(100).optional(),
      region: z.string().max(100).optional(),
      notas: z.string().max(500).optional(),
    })
    .optional(),
  items: z
    .array(
      z.object({
        productoId: z.string().min(1),
        cantidad: z.number().int().positive(),
      })
    )
    .min(1),
});

export const pedidoDesdeCarritoSchema = z.object({
  usuarioId: z.string().min(1).optional(),
  despacho: z
    .object({
      nombre: z.string().max(200).optional(),
      telefono: z.string().max(30).optional(),
      email: z.string().email().optional(),
      direccion: z.string().max(200).optional(),
      comuna: z.string().max(100).optional(),
      ciudad: z.string().max(100).optional(),
      region: z.string().max(100).optional(),
      notas: z.string().max(500).optional(),
    })
    .optional(),
});

export const pedidoIdSchema = z.object({
  id: z.string().min(1),
});

export const pedidoCarritoIdSchema = z.object({
  cartId: z.string().min(1),
});
