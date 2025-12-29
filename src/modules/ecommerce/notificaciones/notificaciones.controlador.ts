import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { notificacionesQuerySchema } from "./notificaciones.esquemas";
import { listarNotificacionesServicio } from "./notificaciones.servicio";

export const listarNotificaciones = manejarAsync(async (req: Request, res: Response) => {
  const query = notificacionesQuerySchema.parse(req.query);
  const notificaciones = await listarNotificacionesServicio(query);
  res.json({ ok: true, data: notificaciones });
});
