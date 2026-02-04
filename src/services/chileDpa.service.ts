import { ErrorApi } from "../lib/errores";
import { logger } from "../lib/logger";

const DATASET_URL =
  "https://gist.githubusercontent.com/juanbrujo/0fd2f4d126b3ce5a95a7dd1f28b3d8dd/raw/b8575eb82dce974fd2647f46819a7568278396bd/comunas-regiones.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
const REQUEST_TIMEOUT_MS = 8_000;
export const DPA_UNAVAILABLE_MESSAGE = "Servicio de regiones/comunas no disponible";

type DatasetRegion = {
  region: string;
  comunas: string[];
};

type DatasetCacheData = {
  regiones: DatasetRegion[];
  comunasByRegion: Map<string, string[]>;
};

type DatasetCacheState = {
  expiresAt: number;
  data?: DatasetCacheData;
  promise?: Promise<DatasetCacheData>;
};

const cache: DatasetCacheState = {
  expiresAt: 0,
};

const normalizeKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

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

const dpaUnavailableError = (reason: string, extra?: Record<string, unknown>) =>
  new ErrorApi(DPA_UNAVAILABLE_MESSAGE, 503, { reason, ...(extra ?? {}) }, "DPA_UNAVAILABLE");

const uniqueStrings = (values: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    result.push(trimmed);
  });

  return result;
};

const normalizeDataset = (payload: unknown): DatasetCacheData => {
  if (!payload || typeof payload !== "object") {
    throw dpaUnavailableError("invalid_payload");
  }

  const regionesRaw = (payload as { regiones?: unknown }).regiones;
  if (!Array.isArray(regionesRaw)) {
    throw dpaUnavailableError("invalid_regiones_array");
  }

  const regiones: DatasetRegion[] = [];

  regionesRaw.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }

    const region = String((entry as { region?: unknown }).region ?? "").trim();
    const comunasRaw = (entry as { comunas?: unknown }).comunas;
    if (!region || !Array.isArray(comunasRaw)) {
      return;
    }

    const comunas = uniqueStrings(
      comunasRaw.map((value) => String(value ?? "")).filter((value) => value.trim().length > 0)
    );

    regiones.push({ region, comunas });
  });

  const comunasByRegion = new Map<string, string[]>();
  regiones.forEach((entry) => {
    comunasByRegion.set(normalizeKey(entry.region), entry.comunas);
  });

  return { regiones, comunasByRegion };
};

const fetchDatasetFromUpstream = async (): Promise<DatasetCacheData> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(DATASET_URL, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw dpaUnavailableError("upstream_status", { status: response.status, url: DATASET_URL });
    }

    const payload = (await response.json()) as unknown;
    const data = normalizeDataset(payload);
    const durationMs = Date.now() - startedAt;

    logger.info("[DPA] Fetch dataset OK", {
      durationMs,
      regionesCount: data.regiones.length,
      url: DATASET_URL,
    });

    return data;
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    if ((error as { name?: string }).name === "AbortError") {
      const timeoutError = dpaUnavailableError("timeout", {
        timeoutMs: REQUEST_TIMEOUT_MS,
        url: DATASET_URL,
      });
      logger.warn(`[DPA] Fetch dataset FAIL: ${timeoutError.message}`, {
        reason: "timeout",
        durationMs,
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
      throw timeoutError;
    }

    const wrapped =
      error instanceof ErrorApi ? error : dpaUnavailableError("request_failed", { error: getErrorMessage(error) });

    logger.warn(`[DPA] Fetch dataset FAIL: ${wrapped.message}`, {
      reason: wrapped.details,
      durationMs,
      error: getErrorMessage(error),
    });

    throw wrapped;
  } finally {
    clearTimeout(timeout);
  }
};

const getDataset = async (): Promise<DatasetCacheData> => {
  const now = Date.now();

  if (cache.data && cache.expiresAt > now) {
    return cache.data;
  }

  if (cache.promise) {
    return cache.promise;
  }

  const staleData = cache.data;

  cache.promise = fetchDatasetFromUpstream()
    .then((data) => {
      cache.data = data;
      cache.expiresAt = Date.now() + CACHE_TTL_MS;
      return data;
    })
    .catch((error) => {
      if (staleData) {
        logger.warn("[DPA] Using stale cache", {
          regionesCount: staleData.regiones.length,
          reason: getErrorMessage(error),
        });

        cache.data = staleData;
        return staleData;
      }

      throw error;
    })
    .finally(() => {
      cache.promise = undefined;
    });

  return cache.promise;
};

export const getRegiones = async (): Promise<string[]> => {
  const data = await getDataset();
  return data.regiones.map((entry) => entry.region);
};

export const getComunas = async (regionName?: string): Promise<string[]> => {
  const region = String(regionName ?? "").trim();
  if (!region) {
    return [];
  }

  const data = await getDataset();
  const comunas = data.comunasByRegion.get(normalizeKey(region)) ?? [];
  return [...comunas];
};

export const getComunasByRegion = async (regionName: string): Promise<string[]> => {
  return getComunas(regionName);
};

export const getProvinciasByRegion = async (_regionName: string): Promise<string[]> => {
  return [];
};

export const getComunasByProvincia = async (_provinciaName: string): Promise<string[]> => {
  return [];
};
