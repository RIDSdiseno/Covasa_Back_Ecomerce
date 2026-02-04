import { ErrorApi } from "../lib/errores";
import { logger } from "../lib/logger";

const DEFAULT_DPA_BASE_URL = "https://apis.digital.gob.cl/dpa";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas
const REQUEST_TIMEOUT_MS = 8_000;
export const DPA_UNAVAILABLE_MESSAGE = "Servicio de regiones/comunas no disponible";

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

const dpaUnavailableError = (url: string, reason: string, extra?: Record<string, unknown>) =>
  new ErrorApi(DPA_UNAVAILABLE_MESSAGE, 503, { url, reason, ...(extra ?? {}) }, "DPA_UNAVAILABLE");

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
      logger.warn("[DPA] External fetch FAIL", {
        url,
        status: response.status,
        durationMs,
        bodyPreview: body.slice(0, 200),
      });
      throw dpaUnavailableError(url, "upstream_status", { status: response.status });
    }

    const raw = await response.text();
    try {
      const parsed = JSON.parse(raw) as T;
      logger.debug("[DPA] External fetch OK", { url, durationMs });
      return parsed;
    } catch (error) {
      logger.warn("[DPA] External parse FAIL", {
        url,
        durationMs,
        bodyPreview: raw.slice(0, 200),
        error: getErrorMessage(error),
      });
      throw dpaUnavailableError(url, "invalid_json");
    }
  } catch (error) {
    if ((error as { name?: string }).name === "AbortError") {
      logger.warn("[DPA] External fetch TIMEOUT", { url, timeoutMs: REQUEST_TIMEOUT_MS });
      throw dpaUnavailableError(url, "timeout", { timeoutMs: REQUEST_TIMEOUT_MS });
    }

    if (error instanceof ErrorApi) {
      throw error;
    }

    logger.warn("[DPA] External fetch FAIL", { url, error: getErrorMessage(error) });
    throw dpaUnavailableError(url, "network_error", { error: getErrorMessage(error) });
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

  const staleData = existing?.data;

  const promise = fetcher()
    .then((data) => {
      cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      return data;
    })
    .catch((error) => {
      if (staleData !== undefined) {
        logger.warn("[DPA] Using stale cache after fetch failure", {
          key,
          error: getErrorMessage(error),
        });
        cache.set(key, { data: staleData, expiresAt: Date.now() + CACHE_TTL_MS });
        return staleData;
      }

      cache.delete(key);
      throw error;
    });

  cache.set(key, { promise, expiresAt: now + CACHE_TTL_MS, data: staleData });
  return promise;
};

const withFetchLog = async <T>(resource: string, fetcher: () => Promise<T>): Promise<T> => {
  try {
    const data = await fetcher();
    logger.info(`[DPA] Fetch ${resource} OK`);
    return data;
  } catch (error) {
    logger.warn(`[DPA] Fetch ${resource} FAIL: ${getErrorMessage(error)}`);

    if (error instanceof ErrorApi) {
      throw error.status === 503
        ? error
        : new ErrorApi(DPA_UNAVAILABLE_MESSAGE, 503, error.details, "DPA_UNAVAILABLE");
    }

    throw dpaUnavailableError(resource, "unexpected_error", { error: getErrorMessage(error) });
  }
};

export const getRegiones = async () => {
  const baseUrl = getBaseUrl();
  return withFetchLog("regiones", () =>
    fetchWithCache("regiones", async () =>
      normalizeList(await fetchJson<unknown>(`${baseUrl}/regiones`))
    )
  );
};

export const getComunas = async () => {
  const baseUrl = getBaseUrl();
  return withFetchLog("comunas", () =>
    fetchWithCache("comunas", async () =>
      normalizeList(await fetchJson<unknown>(`${baseUrl}/comunas`))
    )
  );
};

export const getProvinciasByRegion = async (regionCode: string) => {
  const baseUrl = getBaseUrl();
  const regionCodeNormalized = String(regionCode ?? "").trim();
  const key = `regiones:${regionCodeNormalized}:provincias`;

  return withFetchLog(`provincias region ${regionCodeNormalized}`, () =>
    fetchWithCache(key, async () =>
      normalizeList(
        await fetchJson<unknown>(`${baseUrl}/regiones/${encodeURIComponent(regionCodeNormalized)}/provincias`)
      )
    )
  );
};

export const getComunasByProvincia = async (provinciaCode: string) => {
  const baseUrl = getBaseUrl();
  const provinciaCodeNormalized = String(provinciaCode ?? "").trim();
  const key = `provincias:${provinciaCodeNormalized}:comunas`;

  return withFetchLog(`comunas provincia ${provinciaCodeNormalized}`, () =>
    fetchWithCache(key, async () =>
      normalizeList(
        await fetchJson<unknown>(`${baseUrl}/provincias/${encodeURIComponent(provinciaCodeNormalized)}/comunas`)
      )
    )
  );
};

export const getComunasByRegion = async (regionCode: string) => {
  const baseUrl = getBaseUrl();
  const regionCodeNormalized = String(regionCode ?? "").trim();
  const key = `regiones:${regionCodeNormalized}:comunas`;

  return withFetchLog(`comunas region ${regionCodeNormalized}`, () =>
    fetchWithCache(key, async () => {
      try {
        return normalizeList(
          await fetchJson<unknown>(`${baseUrl}/regiones/${encodeURIComponent(regionCodeNormalized)}/comunas`)
        );
      } catch (error) {
        logger.warn("[DPA] Region comunas endpoint fallback", {
          regionCode: regionCodeNormalized,
          error: getErrorMessage(error),
        });

        const all = normalizeList(await fetchJson<unknown>(`${baseUrl}/comunas`));
        const prefix = regionCodeNormalized.padStart(2, "0");

        return all.filter((item) => {
          if (!item || typeof item !== "object") return false;
          const record = item as Record<string, unknown>;
          const codigoComuna = String(record.codigo ?? "").trim();
          const codigoPadre = String(record.codigo_padre ?? record.codigoPadre ?? "").trim();
          return (
            (codigoPadre && codigoPadre === regionCodeNormalized) ||
            (codigoComuna && codigoComuna.startsWith(prefix))
          );
        });
      }
    })
  );
};
