import { Router, type Response } from "express";
import { ErrorApi } from "../lib/errores";
import { logger } from "../lib/logger";
import {
  DPA_UNAVAILABLE_MESSAGE,
  getComunas,
  getComunasByRegion,
  getRegiones,
} from "../services/chileDpa.service";

const router = Router();

const requireParam = (value: string | undefined, message: string) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new ErrorApi(message, 400);
  }
  return normalized;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const sendDpaError = (res: Response, error: unknown) => {
  if (error instanceof ErrorApi && error.status < 500) {
    return res.status(error.status).json({ ok: false, message: error.message });
  }

  return res.status(503).json({ ok: false, message: DPA_UNAVAILABLE_MESSAGE });
};

router.get("/regiones", async (_req, res) => {
  try {
    const data = await getRegiones();
    return res.json({ ok: true, data });
  } catch (error) {
    logger.warn(`[DPA] Route /regiones FAIL: ${getErrorMessage(error)}`);
    return sendDpaError(res, error);
  }
});

router.get("/comunas", async (_req, res) => {
  try {
    const data = await getComunas();
    return res.json({ ok: true, data });
  } catch (error) {
    logger.warn(`[DPA] Route /comunas FAIL: ${getErrorMessage(error)}`);
    return sendDpaError(res, error);
  }
});

router.get("/regiones/:codigo/comunas", async (req, res) => {
  try {
    const codigo = requireParam(req.params.codigo, "Region requerida");
    const data = await getComunasByRegion(codigo);
    return res.json({ ok: true, data });
  } catch (error) {
    logger.warn(`[DPA] Route /regiones/:codigo/comunas FAIL: ${getErrorMessage(error)}`);
    return sendDpaError(res, error);
  }
});

export default router;
