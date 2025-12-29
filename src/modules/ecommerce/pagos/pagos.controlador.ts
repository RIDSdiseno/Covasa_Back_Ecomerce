import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { pagoCrearSchema } from "./pagos.esquemas";
import { crearPagoServicio } from "./pagos.servicio";

export const crearPago = manejarAsync(async (req: Request, res: Response) => {
  const payload = pagoCrearSchema.parse(req.body);
  const pago = await crearPagoServicio(payload);

  res.status(201).json({
    ok: true,
    data: pago,
    message: "Pago registrado (placeholder)",
  });
});
