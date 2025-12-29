import { z } from "zod";
import { EcommerceEstadoPago, EcommerceMetodoPago } from "@prisma/client";

export const pagoCrearSchema = z.object({
  pedidoId: z.string().min(1),
  metodo: z.nativeEnum(EcommerceMetodoPago),
  monto: z.number().int().positive(),
  referencia: z.string().max(200).optional(),
  evidenciaUrl: z.string().url().max(500).optional(),
  gatewayPayloadJson: z.unknown().optional(),
  estado: z.nativeEnum(EcommerceEstadoPago).optional(),
});
