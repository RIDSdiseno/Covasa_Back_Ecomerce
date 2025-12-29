import { Request, Response } from "express";
import { z } from "zod";
import { MetodoPago, OrigenRegistro, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { manejarAsync } from "../lib/manejarAsync";
import { ErrorApi } from "../lib/errores";

const pagoSchema = z.object({
  solicitudCotizacionId: z.string().min(1).optional(),
  pedidoId: z.string().min(1).optional(),
  metodo: z.nativeEnum(MetodoPago),
  monto: z.number().int().positive(),
  moneda: z.string().min(1).max(10).optional(),
  referenciaExterna: z.string().max(200).optional(),
  canal: z.string().max(50).optional(),
  origenRef: z.string().max(100).optional(),
  payload: z.unknown().optional(),
});

export const crearPago = manejarAsync(async (req: Request, res: Response) => {
  const payload = pagoSchema.parse(req.body);

  if (!payload.solicitudCotizacionId && !payload.pedidoId) {
    throw new ErrorApi("Debe indicar solicitudCotizacionId o pedidoId", 400);
  }

  if (payload.solicitudCotizacionId) {
    const solicitud = await prisma.solicitudCotizacion.findUnique({
      where: { id: payload.solicitudCotizacionId },
      select: { id: true },
    });

    if (!solicitud) {
      throw new ErrorApi("Solicitud de cotizacion no encontrada", 404, {
        id: payload.solicitudCotizacionId,
      });
    }
  }

  if (payload.pedidoId) {
    const pedido = await prisma.pedido.findUnique({
      where: { id: payload.pedidoId },
      select: { id: true },
    });

    if (!pedido) {
      throw new ErrorApi("Pedido no encontrado", 404, {
        id: payload.pedidoId,
      });
    }
  }

  const canal = payload.canal?.trim() || "WEB";
  const origenRef = payload.origenRef?.trim() || null;

  const pago = await prisma.pago.create({
    data: {
      solicitudCotizacionId: payload.solicitudCotizacionId,
      pedidoId: payload.pedidoId,
      metodo: payload.metodo,
      monto: payload.monto,
      moneda: payload.moneda ?? "CLP",
      referenciaExterna: payload.referenciaExterna,
      payload: payload.payload as Prisma.InputJsonValue | undefined,
      origen: OrigenRegistro.ECOMMERCE,
      canal,
      origenRef,
    },
    select: {
      id: true,
      estado: true,
      createdAt: true,
    },
  });

  res.status(201).json({
    ok: true,
    data: pago,
    message: "Pago registrado (placeholder)",
  });
});
