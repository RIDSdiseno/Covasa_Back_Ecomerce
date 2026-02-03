import { Router } from "express";
import { manejarAsync } from "../lib/manejarAsync";
import { ErrorApi } from "../lib/errores";
import { logger } from "../lib/logger";

const router = Router();

const DPA_BASE_URL = "https://apis.digital.gob.cl/dpa";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

type CacheEntry<T> = {
  expiresAt: number;
  data?: T;
  promise?: Promise<T>;
};

const cache = new Map<string, CacheEntry<unknown>>();

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new ErrorApi("No se pudo obtener datos de la DPA", 502, {
      status: response.status,
      url,
    });
  }
  return response.json() as Promise<T>;
};

const fetchWithCache = async <T>(key: string, fetcher: () => Promise<T>): Promise<T> => {
  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;

  if (existing?.data && existing.expiresAt > now) {
    return existing.data;
  }

  if (existing?.promise) {
    return existing.promise;
  }

  const promise = fetcher()
    .then((data) => {
      cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      return data;
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });

  cache.set(key, { promise, expiresAt: now + CACHE_TTL_MS });
  return promise;
};

const normalizeList = (data: unknown) => (Array.isArray(data) ? data : []);

router.get(
  "/regiones",
  manejarAsync(async (_req, res) => {
    const data = await fetchWithCache("regiones", async () =>
      normalizeList(await fetchJson<unknown>(`${DPA_BASE_URL}/regiones`))
    );
    res.json({ ok: true, data });
  })
);

router.get(
  "/comunas",
  manejarAsync(async (_req, res) => {
    const data = await fetchWithCache("comunas", async () =>
      normalizeList(await fetchJson<unknown>(`${DPA_BASE_URL}/comunas`))
    );
    res.json({ ok: true, data });
  })
);

router.get(
  "/regiones/:codigo/comunas",
  manejarAsync(async (req, res) => {
    const codigo = String(req.params.codigo ?? "").trim();
    if (!codigo) {
      throw new ErrorApi("Region requerida", 400);
    }

    const cacheKey = `comunas:${codigo}`;
    const data = await fetchWithCache(cacheKey, async () => {
      try {
        return normalizeList(
          await fetchJson<unknown>(`${DPA_BASE_URL}/regiones/${encodeURIComponent(codigo)}/comunas`)
        );
      } catch (error) {
        logger.warn("dpa_comunas_endpoint_failed", { region: codigo, error });
        const all = normalizeList(await fetchJson<unknown>(`${DPA_BASE_URL}/comunas`));
        const prefix = codigo.padStart(2, "0");

        return all.filter((item) => {
          if (!item || typeof item !== "object") {
            return false;
          }
          const record = item as Record<string, unknown>;
          const codigoComuna = String(record.codigo ?? "").trim();
          const codigoPadre = String(record.codigo_padre ?? record.codigoPadre ?? "").trim();

          return (codigoPadre && codigoPadre === codigo) || (codigoComuna && codigoComuna.startsWith(prefix));
        });
      }
    });

    res.json({ ok: true, data });
  })
);

export default router;
