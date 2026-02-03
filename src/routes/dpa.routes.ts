import { Router } from "express";
import { manejarAsync } from "../lib/manejarAsync";
import { ErrorApi } from "../lib/errores";
import { getComunas, getComunasByRegion, getRegiones } from "../services/chileDpa.service";

const router = Router();

const requireParam = (value: string | undefined, message: string) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new ErrorApi(message, 400);
  }
  return normalized;
};

router.get(
  "/regiones",
  manejarAsync(async (_req, res) => {
    const data = await getRegiones();
    res.json({ ok: true, data });
  })
);

router.get(
  "/comunas",
  manejarAsync(async (_req, res) => {
    const data = await getComunas();
    res.json({ ok: true, data });
  })
);

router.get(
  "/regiones/:codigo/comunas",
  manejarAsync(async (req, res) => {
    const codigo = requireParam(req.params.codigo, "Region requerida");
    const data = await getComunasByRegion(codigo);
    res.json({ ok: true, data });
  })
);

export default router;
