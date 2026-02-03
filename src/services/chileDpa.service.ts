import { ErrorApi } from "../lib/errores";
import { logger } from "../lib/logger";

const DEFAULT_DPA_BASE_URL = "https://apis.digital.gob.cl/dpa";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora
const REQUEST_TIMEOUT_MS = 10_000;

type CacheEntry<T> = {
  expiresAt: number;
  data?: T;
  promise?: Promise<T>;
};

const cache = new Map<string, CacheEntry<unknown>>();

const getBaseUrl = () => (process.env.EXTERNAL_DPA_BASE_URL || DEFAULT_DPA_BASE_URL).replace(/\/$/, "");

const normalizeList = (data: unknown) => {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: unknown[] }).data;
  }
  return [];
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logger.warn("dpa_response_error", {
        url,
        status: response.status,
        durationMs,
        bodyPreview: body.slice(0, 200),
      });
      throw new ErrorApi("Error al consultar API DPA", 502, { status: response.status, url });
    }

    const raw = await response.text();
    try {
      const json = JSON.parse(raw) as T;
      logger.info("dpa_response_ok", { url, status: response.status, durationMs });
      return json;
    } catch (error) {
      logger.warn("dpa_response_parse_error", {
        url,
        durationMs,
        error,
        bodyPreview: raw.slice(0, 200),
      });
      throw new ErrorApi("Respuesta invalida desde API DPA", 502, { url });
    }
  } catch (error) {
    if ((error as { name?: string }).name === "AbortError") {
      logger.warn("dpa_timeout", { url, timeoutMs: REQUEST_TIMEOUT_MS });
      throw new ErrorApi("Timeout al consultar API DPA", 502, { url, timeoutMs: REQUEST_TIMEOUT_MS });
    }
    logger.warn("dpa_request_failed", { url, error });
    if (error instanceof ErrorApi) {
      throw error;
    }
    throw new ErrorApi("Error al consultar API DPA", 502, { url });
  } finally {
    clearTimeout(timeout);
  }
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

export const getRegiones = async () => {
  const baseUrl = getBaseUrl();
  return fetchWithCache("regiones", async () =>
    normalizeList(await fetchJson<unknown>(`${baseUrl}/regiones`))
  );
};

export const getProvinciasByRegion = async (regionCode: string) => {
  const baseUrl = getBaseUrl();
  const key = `regiones:${regionCode}:provincias`;
  return fetchWithCache(key, async () =>
    normalizeList(await fetchJson<unknown>(`${baseUrl}/regiones/${encodeURIComponent(regionCode)}/provincias`))
  );
};

export const getComunasByProvincia = async (provinciaCode: string) => {
  const baseUrl = getBaseUrl();
  const key = `provincias:${provinciaCode}:comunas`;
  return fetchWithCache(key, async () =>
    normalizeList(await fetchJson<unknown>(`${baseUrl}/provincias/${encodeURIComponent(provinciaCode)}/comunas`))
  );
};

export const getComunasByRegion = async (regionCode: string) => {
  const baseUrl = getBaseUrl();
  const key = `regiones:${regionCode}:comunas`;

  return fetchWithCache(key, async () => {
    try {
      return normalizeList(
        await fetchJson<unknown>(`${baseUrl}/regiones/${encodeURIComponent(regionCode)}/comunas`)
      );
    } catch (error) {
      logger.warn("dpa_regiones_comunas_fallback", { regionCode, error });
      const all = normalizeList(await fetchJson<unknown>(`${baseUrl}/comunas`));
      const prefix = regionCode.padStart(2, "0");

      return all.filter((item) => {
        if (!item || typeof item !== "object") return false;
        const record = item as Record<string, unknown>;
        const codigoComuna = String(record.codigo ?? "").trim();
        const codigoPadre = String(record.codigo_padre ?? record.codigoPadre ?? "").trim();
        return (codigoPadre && codigoPadre === regionCode) || (codigoComuna && codigoComuna.startsWith(prefix));
      });
    }
  });
};
