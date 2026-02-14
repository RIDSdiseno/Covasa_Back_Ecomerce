import { Request, Response } from "express";
import { manejarAsync } from "../../lib/manejarAsync";
import { REGIONES, COMUNAS } from "./dpa.data";

const mxCache = new Map<string, { valido: boolean; expiresAt: number }>();
const MX_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

// Verificar MX via DNS-over-HTTPS (Cloudflare) para evitar problemas con puerto 53
const verificarMxDominio = async (dominio: string): Promise<boolean> => {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(dominio)}&type=MX`;
  const res = await fetch(url, {
    headers: { Accept: "application/dns-json" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { Answer?: { type: number }[] };
  return Array.isArray(data.Answer) && data.Answer.some((r) => r.type === 15);
};

// GET /api/dpa/regiones
export const listarRegiones = manejarAsync(async (_req: Request, res: Response) => {
  res.json(REGIONES);
});

// GET /api/dpa/regiones/:codigo/comunas
export const listarComunasPorRegion = manejarAsync(async (req: Request, res: Response) => {
  const { codigo } = req.params;
  const codigoPadre = codigo.padStart(2, "0");
  const comunas = COMUNAS.filter((c) => c.codigo_padre === codigoPadre);
  res.json(comunas);
});

// GET /api/dpa/comunas
export const listarComunas = manejarAsync(async (_req: Request, res: Response) => {
  res.json(COMUNAS);
});

// GET /api/dpa/verificar-email?dominio=ejemplo.com
export const verificarEmailDominio = manejarAsync(async (req: Request, res: Response) => {
  const dominio = String(req.query.dominio ?? "").trim().toLowerCase();

  if (!dominio || dominio.length > 253 || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(dominio)) {
    res.json({ valido: false, motivo: "dominio_invalido" });
    return;
  }

  const cached = mxCache.get(dominio);
  if (cached && cached.expiresAt > Date.now()) {
    res.json({ valido: cached.valido, dominio, cache: true });
    return;
  }

  try {
    const valido = await verificarMxDominio(dominio);
    mxCache.set(dominio, { valido, expiresAt: Date.now() + MX_CACHE_TTL });
    res.json({ valido, dominio });
  } catch {
    mxCache.set(dominio, { valido: false, expiresAt: Date.now() + MX_CACHE_TTL });
    res.json({ valido: false, dominio, motivo: "sin_mx" });
  }
});
