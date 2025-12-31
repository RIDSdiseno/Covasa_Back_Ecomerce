import { z } from "zod";

export const carritoCrearSchema = z.object({
  ecommerceClienteId: z.string().min(1).optional(),
  clienteId: z.string().min(1).optional(),
});

export const carritoIdSchema = z.object({
  id: z.string().min(1),
});

export const carritoItemAgregarSchema = z.object({
  productoId: z.string().min(1),
  cantidad: z.number().int().positive(),
});

export const carritoItemActualizarSchema = z.object({
  cantidad: z.number().int().positive(),
});

export const carritoItemParamSchema = z.object({
  id: z.string().min(1),
  itemId: z.string().min(1),
});
