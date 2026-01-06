import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { notificacionesQuerySchema } from "./notificaciones.schema";
import { listarNotificacionesServicio } from "./notificaciones.service";

// GET /api/ecommerce/notificaciones
// Input: leido?, limit?, offset?. Output: lista de notificaciones.
export const listarNotificaciones = manejarAsync(async (req: Request, res: Response) => {
  const query = notificacionesQuerySchema.parse(req.query);
  const notificaciones = await listarNotificacionesServicio(query);
  res.json({ ok: true, data: notificaciones });
});