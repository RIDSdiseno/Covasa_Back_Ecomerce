import { z } from "zod";
import { EcommerceEstadoPago, EcommerceMetodoPago } from "@prisma/client";

export const pagoCrearSchema = z.object({
  pedidoId: z.string().min(1),
  metodo: z.nativeEnum(EcommerceMetodoPago),
  monto: z.number().int().positive(),
  referencia: z.string().max(200).optional(),
  evidenciaUrl: z.string().url().max(500).optional(),
  gatewayPayloadJson: z.unknown().optional(),
});

export const pagoIdSchema = z.object({
  id: z.string().min(1),
});

export const pagosIntegracionQuerySchema = z.object({
  since: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  estado: z.nativeEnum(EcommerceEstadoPago).optional(),
});
