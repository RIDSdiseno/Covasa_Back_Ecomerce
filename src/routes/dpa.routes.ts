import { Router } from "express";
import { logger } from "../lib/logger";
import { listarComunasCatalogo, listarRegionesCatalogo } from "../services/dpaCatalog.service";

const router = Router();
const mxCache = new Map<string, { valido: boolean; expiresAt: number }>();
const MX_CACHE_TTL = 24 * 60 * 60 * 1000;

const getQueryString = (value: unknown) => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0].trim();
  }

  return "";
};

const verificarMxDominio = async (dominio: string): Promise<boolean> => {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(dominio)}&type=MX`;
  const response = await fetch(url, {
    headers: { Accept: "application/dns-json" },
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    return false;
  }

  const data = (await response.json()) as { Answer?: Array<{ type: number }> };
  return Array.isArray(data.Answer) && data.Answer.some((record) => record.type === 15);
};

router.get("/regiones", (_req, res) => {
  const data = listarRegionesCatalogo();
  return res.json({ ok: true, data });
});

router.get("/comunas", (req, res) => {
  const regionId =
    getQueryString(req.query.regionId) ||
    getQueryString(req.query.region) ||
    getQueryString(req.query.codigoRegion);

  const data = listarComunasCatalogo(regionId || undefined);
  return res.json({ ok: true, data });
});

router.get("/regiones/:codigo/comunas", (req, res) => {
  const codigo = getQueryString(req.params.codigo);
  if (!codigo) {
    return res.status(400).json({ ok: false, message: "Region requerida" });
  }

  const data = listarComunasCatalogo(codigo);
  return res.json({ ok: true, data });
});

router.get("/verificar-email", async (req, res) => {
  const dominio = getQueryString(req.query.dominio).toLowerCase();

  if (!dominio || dominio.length > 253 || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(dominio)) {
    return res.json({ valido: false, motivo: "dominio_invalido" });
  }

  const cached = mxCache.get(dominio);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json({ valido: cached.valido, dominio, cache: true });
  }

  try {
    const valido = await verificarMxDominio(dominio);
    mxCache.set(dominio, { valido, expiresAt: Date.now() + MX_CACHE_TTL });
    return res.json({ valido, dominio });
  } catch (error) {
    logger.warn("[DPA] verificar-email fallo", {
      dominio,
      error: error instanceof Error ? error.message : String(error),
    });

    mxCache.set(dominio, { valido: false, expiresAt: Date.now() + MX_CACHE_TTL });
    return res.json({ valido: false, dominio, motivo: "sin_mx" });
  }
});

export default router;
