import { COMUNAS, REGIONES } from "../modules/dpa/dpa.data";

export type DpaRegionCatalogo = {
  id: string;
  codigo: string;
  nombre: string;
};

export type DpaComunaCatalogo = {
  id: string;
  codigo: string;
  nombre: string;
  codigo_padre: string;
  regionNombre: string;
};

type ResolverUbicacionInput = {
  region?: string | null;
  regionId?: string | null;
  comuna?: string | null;
  comunaId?: string | null;
};

type ResolverUbicacionOutput = {
  region: string | null;
  regionId: string | null;
  comuna: string | null;
  comunaId: string | null;
};

const MOJIBAKE_PATTERN = /(Ã.|Â.|â.|�)/;

const sanitizeText = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const decodeMojibake = (value: string) => {
  const raw = sanitizeText(value);
  if (!raw) {
    return "";
  }

  if (!MOJIBAKE_PATTERN.test(raw)) {
    return raw;
  }

  try {
    const decoded = Buffer.from(raw, "latin1").toString("utf8");
    return sanitizeText(decoded) || raw;
  } catch {
    return raw;
  }
};

const normalizeLookupKey = (value: string) =>
  decodeMojibake(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const normalizeRegionCode = (value: string) => {
  const trimmed = sanitizeText(value);
  if (!trimmed) {
    return "";
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    return trimmed;
  }

  return digits.padStart(2, "0").slice(-2);
};

const normalizeComunaCode = (value: string) => {
  const trimmed = sanitizeText(value);
  if (!trimmed) {
    return "";
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    return trimmed;
  }

  return digits.padStart(5, "0").slice(-5);
};

const REGIONES_NORMALIZADAS: DpaRegionCatalogo[] = REGIONES.map((region) => {
  const codigo = normalizeRegionCode(region.codigo);
  const nombre = decodeMojibake(region.nombre);
  return {
    id: codigo,
    codigo,
    nombre,
  };
}).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

const REGION_BY_CODE = new Map(REGIONES_NORMALIZADAS.map((region) => [region.codigo, region]));
const REGION_KEY_TO_CODE = new Map(
  REGIONES_NORMALIZADAS.map((region) => [normalizeLookupKey(region.nombre), region.codigo])
);

const COMUNAS_NORMALIZADAS: DpaComunaCatalogo[] = COMUNAS.map((comuna) => {
  const codigo = normalizeComunaCode(comuna.codigo);
  const codigoPadre = normalizeRegionCode(comuna.codigo_padre);
  const region = REGION_BY_CODE.get(codigoPadre);
  return {
    id: codigo,
    codigo,
    nombre: decodeMojibake(comuna.nombre),
    codigo_padre: codigoPadre,
    regionNombre: region?.nombre ?? "",
  };
}).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

const COMUNA_BY_CODE = new Map(COMUNAS_NORMALIZADAS.map((comuna) => [comuna.codigo, comuna]));
const COMUNAS_BY_REGION = COMUNAS_NORMALIZADAS.reduce((map, comuna) => {
  const current = map.get(comuna.codigo_padre) ?? [];
  current.push(comuna);
  map.set(comuna.codigo_padre, current);
  return map;
}, new Map<string, DpaComunaCatalogo[]>());

const resolveRegion = (regionIdOrName?: string | null): DpaRegionCatalogo | null => {
  const normalized = sanitizeText(regionIdOrName);
  if (!normalized) {
    return null;
  }

  const byCode = REGION_BY_CODE.get(normalizeRegionCode(normalized));
  if (byCode) {
    return byCode;
  }

  const key = normalizeLookupKey(normalized);
  const exactCode = REGION_KEY_TO_CODE.get(key);
  if (exactCode) {
    return REGION_BY_CODE.get(exactCode) ?? null;
  }

  const fuzzy = REGIONES_NORMALIZADAS.find((region) => {
    const regionKey = normalizeLookupKey(region.nombre);
    return regionKey.includes(key) || key.includes(regionKey);
  });

  return fuzzy ?? null;
};

const resolveComuna = (comunaIdOrName?: string | null, regionCode?: string | null): DpaComunaCatalogo | null => {
  const normalized = sanitizeText(comunaIdOrName);
  if (!normalized) {
    return null;
  }

  const region = regionCode ? resolveRegion(regionCode) : null;
  const comunasScope = region ? COMUNAS_BY_REGION.get(region.codigo) ?? [] : COMUNAS_NORMALIZADAS;

  const byCode = COMUNA_BY_CODE.get(normalizeComunaCode(normalized));
  if (byCode && (!region || byCode.codigo_padre === region.codigo)) {
    return byCode;
  }

  const key = normalizeLookupKey(normalized);
  const exact = comunasScope.find((comuna) => normalizeLookupKey(comuna.nombre) === key);
  if (exact) {
    return exact;
  }

  const fuzzy = comunasScope.find((comuna) => {
    const comunaKey = normalizeLookupKey(comuna.nombre);
    return comunaKey.includes(key) || key.includes(comunaKey);
  });

  return fuzzy ?? null;
};

export const listarRegionesCatalogo = (): DpaRegionCatalogo[] => [...REGIONES_NORMALIZADAS];

export const listarComunasCatalogo = (regionIdOrName?: string | null): DpaComunaCatalogo[] => {
  const region = resolveRegion(regionIdOrName);
  if (!region) {
    return [...COMUNAS_NORMALIZADAS];
  }
  return [...(COMUNAS_BY_REGION.get(region.codigo) ?? [])];
};

export const resolverUbicacionDireccion = (input: ResolverUbicacionInput): ResolverUbicacionOutput => {
  let region = resolveRegion(input.regionId ?? input.region ?? null);
  let comuna = resolveComuna(input.comunaId ?? input.comuna ?? null, region?.codigo ?? null);

  if (!region && comuna) {
    region = resolveRegion(comuna.codigo_padre);
  }

  if (region && comuna && comuna.codigo_padre !== region.codigo) {
    const comunaDelRegion = resolveComuna(input.comunaId ?? input.comuna ?? null, region.codigo);
    if (comunaDelRegion) {
      comuna = comunaDelRegion;
    } else {
      region = resolveRegion(comuna.codigo_padre);
    }
  }

  const regionRaw = decodeMojibake(sanitizeText(input.region));
  const comunaRaw = decodeMojibake(sanitizeText(input.comuna));

  return {
    region: region?.nombre ?? (regionRaw || null),
    regionId: region?.codigo ?? null,
    comuna: comuna?.nombre ?? (comunaRaw || null),
    comunaId: comuna?.codigo ?? null,
  };
};

