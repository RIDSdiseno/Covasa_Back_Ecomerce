import { z } from "zod";
import { normalizarTelefonoChile } from "../common/ecommerce.utils";

const normalizarTelefono = (valor?: string | null, ctx?: z.RefinementCtx) => {
  const limpio = (valor ?? "").trim();
  if (!limpio) {
    return null;
  }

  const normalizado = normalizarTelefonoChile(limpio);
  if (!normalizado && ctx) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Telefono invalido. Usa 9XXXXXXXX o +569XXXXXXXX.",
    });
  }
  return normalizado ?? limpio;
};

const telefonoChileSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value, ctx) => normalizarTelefono(value, ctx));

const telefonoChileRequiredSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value, ctx) => normalizarTelefono(value, ctx));

const contactoSchema = z
  .object({
    nombre: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(200).optional().nullable(),
    telefono: telefonoChileSchema,
    empresa: z.string().trim().max(200).optional().nullable(),
    rut: z.string().trim().max(30).optional().nullable(),
    direccion: z.string().trim().max(250).optional().nullable(),
    region: z.string().trim().max(120).optional().nullable(),
    comuna: z.string().trim().max(120).optional().nullable(),
    mensaje: z.string().trim().max(500).optional().nullable(),
    tipoObra: z.string().trim().max(120).optional().nullable(),
    ubicacion: z.string().trim().max(120).optional().nullable(),
  })
  .refine((data) => {
    const email = (data.email ?? "").trim();
    const telefono = (data.telefono ?? "").trim();
    return email.length > 0 || telefono.length > 0;
  }, {
    message: "Email o telefono requerido",
    path: ["email"],
  });

const cotizacionItemSchema = z.object({
  productoId: z.string().min(1),
  cantidad: z.number().int().positive(),
  observacion: z.string().trim().max(500).optional().nullable(),
});

export const cotizacionCrearSchema = z.object({
  ecommerceClienteId: z.string().min(1).optional(),
  clienteId: z.string().min(1).optional(),
  contacto: contactoSchema,
  observaciones: z.string().trim().max(1000).optional(),
  ocCliente: z.string().trim().max(100).optional(),
  ocNumero: z.string().trim().max(100).optional(),
  canal: z.string().trim().max(50).optional(),
  origen: z.string().trim().max(30).optional(),
  metadata: z
    .object({
      userAgent: z.string().trim().max(300).optional().nullable(),
      utm: z.record(z.string(), z.unknown()).optional().nullable(),
    })
    .optional()
    .nullable(),
  items: z.array(cotizacionItemSchema).min(1),
});

export const quoteCrearSchema = z.object({
  nombreContacto: z.string().min(1).max(200),
  empresa: z.string().max(200).optional(),
  email: z.string().email(),
  telefono: telefonoChileRequiredSchema,
  tipoObra: z.string().min(1).max(120),
  comunaRegion: z.string().min(1).max(120),
  ocCliente: z.string().max(100).optional(),
  detalleAdicional: z.string().max(1000).optional(),
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

export const cotizacionQuerySchema = z.object({
  status: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  from: z.string().trim().min(1).optional(),
  to: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
});

export const cotizacionEliminarSchema = z.object({
  motivo: z.string().trim().max(300).optional(),
});
