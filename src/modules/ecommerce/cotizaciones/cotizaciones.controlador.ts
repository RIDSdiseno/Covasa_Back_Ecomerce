import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { cotizacionCrearSchema, cotizacionIdSchema } from "./cotizaciones.esquemas";
import { crearCotizacionServicio, obtenerCotizacionServicio } from "./cotizaciones.servicio";

export const crearCotizacion = manejarAsync(async (req: Request, res: Response) => {
  const payload = cotizacionCrearSchema.parse(req.body);
  const resultado = await crearCotizacionServicio(payload);

  res.status(201).json({
    ok: true,
    data: resultado,
    message: "Cotizacion registrada",
  });
});

export const obtenerCotizacion = manejarAsync(async (req: Request, res: Response) => {
  const { id } = cotizacionIdSchema.parse(req.params);
  const cotizacion = await obtenerCotizacionServicio(id);
  res.json({ ok: true, data: cotizacion });
});
