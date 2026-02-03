import { Request, Response } from "express";
import { manejarAsync } from "../lib/manejarAsync";
import { ErrorApi } from "../lib/errores";
import {
  getComunasByProvincia,
  getComunasByRegion,
  getProvinciasByRegion,
  getRegiones,
} from "../services/chileDpa.service";

const requireParam = (value: string | undefined, message: string) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new ErrorApi(message, 400);
  }
  return normalized;
};

export const listarRegiones = manejarAsync(async (_req: Request, res: Response) => {
  const data = await getRegiones();
  res.json({ ok: true, data });
});

export const listarProvinciasPorRegion = manejarAsync(async (req: Request, res: Response) => {
  const regionCode = requireParam(req.params.regionCode, "Region requerida");
  const data = await getProvinciasByRegion(regionCode);
  res.json({ ok: true, data });
});

export const listarComunasPorProvincia = manejarAsync(async (req: Request, res: Response) => {
  const provinciaCode = requireParam(req.params.provinciaCode, "Provincia requerida");
  const data = await getComunasByProvincia(provinciaCode);
  res.json({ ok: true, data });
});

export const listarComunasPorRegion = manejarAsync(async (req: Request, res: Response) => {
  const regionCode = requireParam(req.params.regionCode, "Region requerida");
  const data = await getComunasByRegion(regionCode);
  res.json({ ok: true, data });
});
