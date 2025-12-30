import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { pagoCrearSchema, pagoIdSchema } from "./pagos.esquemas";
import { confirmarPagoServicio, crearPagoServicio, rechazarPagoServicio } from "./pagos.servicio";

// POST /api/ecommerce/payments
// Input: { pedidoId, metodo, monto, referencia?, evidenciaUrl?, gatewayPayloadJson? }.
export const crearPago = manejarAsync(async (req: Request, res: Response) => {
  const payload = pagoCrearSchema.parse(req.body);
  const pago = await crearPagoServicio(payload);

  res.status(201).json({
    ok: true,
    data: { pagoId: pago.id, estado: pago.estado },
    message: "Pago registrado (placeholder)",
  });
});

// PATCH /api/ecommerce/payments/:id/confirm
// Output: pago confirmado + pedido PAGADO.
export const confirmarPago = manejarAsync(async (req: Request, res: Response) => {
  const { id } = pagoIdSchema.parse(req.params);
  const pago = await confirmarPagoServicio(id);

  res.json({
    ok: true,
    data: { pagoId: pago.id, estado: pago.estado },
    message: "Pago confirmado",
  });
});

// PATCH /api/ecommerce/payments/:id/reject
// Output: pago rechazado.
export const rechazarPago = manejarAsync(async (req: Request, res: Response) => {
  const { id } = pagoIdSchema.parse(req.params);
  const pago = await rechazarPagoServicio(id);

  res.json({
    ok: true,
    data: { pagoId: pago.id, estado: pago.estado },
    message: "Pago rechazado",
  });
});