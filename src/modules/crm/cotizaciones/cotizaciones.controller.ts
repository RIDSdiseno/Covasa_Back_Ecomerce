import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { crmCotizacionIdSchema, crmCotizacionQuerySchema } from "./cotizaciones.schema";
import {
  listarCrmCotizacionesServicio,
  obtenerCrmCotizacionServicio,
} from "./cotizaciones.service";

// GET /api/crm/cotizaciones
// Output: listado paginado de cotizaciones ecommerce para CRM.
export const listarCrmCotizaciones = manejarAsync(async (req: Request, res: Response) => {
  const query = crmCotizacionQuerySchema.parse(req.query);
  const resultado = await listarCrmCotizacionesServicio(query);
  res.json({ ok: true, data: resultado });
});

// GET /api/crm/cotizaciones/:id
// Output: detalle de cotizacion ecommerce con items.
export const obtenerCrmCotizacion = manejarAsync(async (req: Request, res: Response) => {
  const { id } = crmCotizacionIdSchema.parse(req.params);
  const cotizacion = await obtenerCrmCotizacionServicio(id);
  res.json({ ok: true, data: cotizacion });
});
