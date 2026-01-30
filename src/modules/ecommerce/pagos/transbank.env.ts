import { ErrorApi } from "../../../lib/errores";
import { logger } from "../../../lib/logger";
import { normalizarTexto } from "../common/ecommerce.utils";

const mask = (v?: string) => {
  const s = normalizarTexto(v);
  if (!s) return "";
  if (s.length <= 8) return `${s.slice(0, 2)}****`;
  return `${s.slice(0, 4)}****${s.slice(-4)}`;
};

const esProd = () => {
  const v = normalizarTexto(process.env.TRANSBANK_ENV).toLowerCase();
  return v === "production" || v === "produccion" || v === "prod";
};

export function validarTransbankEnv() {
  const prod = esProd();

  const returnUrl = normalizarTexto(process.env.TRANSBANK_RETURN_URL);
  const commerceCode = normalizarTexto(process.env.TRANSBANK_COMMERCE_CODE);

  // Tu código usa TRANSBANK_API_KEY (secret). Si tú usas TBK_API_KEY_SECRET, lo aceptamos igual:
  const apiKeySecret =
    normalizarTexto(process.env.TRANSBANK_API_KEY) ||
    normalizarTexto(process.env.TBK_API_KEY_SECRET);

  const faltan: string[] = [];
  if (!returnUrl) faltan.push("TRANSBANK_RETURN_URL");

  if (prod) {
    if (!commerceCode) faltan.push("TRANSBANK_COMMERCE_CODE");
    if (!apiKeySecret) faltan.push("TRANSBANK_API_KEY (o TBK_API_KEY_SECRET)");
    if (returnUrl && !returnUrl.startsWith("https://")) {
      throw new ErrorApi("En producción TRANSBANK_RETURN_URL debe ser HTTPS público (no localhost).", 500);
    }
  }

  if (faltan.length) {
    throw new ErrorApi(`Faltan variables ENV para Transbank: ${faltan.join(", ")}`, 500);
  }

  logger.info("transbank_env_ok", {
    env: prod ? "production" : "integration",
    commerceCode: commerceCode || "(SDK integration default)",
    apiKey: mask(apiKeySecret),
    returnUrl,
  });

  return { prod, returnUrl: returnUrl!, commerceCode, apiKeySecret };
}
