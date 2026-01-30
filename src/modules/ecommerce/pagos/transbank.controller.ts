import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { logger } from "../../../lib/logger";
import { normalizarTexto } from "../common/ecommerce.utils";
import { transbankCrearSchema, transbankTokenSchema } from "./transbank.schema";
import {
  confirmarTransbankPagoServicio,
  crearTransbankPagoServicio,
  obtenerEstadoTransbankServicio,
} from "./transbank.service";
import { buscarPagoPorReferencia } from "./pagos.repo";

const tomarToken = (valor: unknown) => {
  if (typeof valor === "string") {
    return valor;
  }
  if (Array.isArray(valor) && typeof valor[0] === "string") {
    return valor[0];
  }
  return undefined;
};

const extraerTokenRaw = (req: Request) =>
  tomarToken(req.body?.token_ws) ??
  tomarToken(req.query?.token_ws) ??
  tomarToken(req.body?.token) ??
  tomarToken(req.query?.token);

const extraerToken = (req: Request) => {
  const token = extraerTokenRaw(req);
  return transbankTokenSchema.parse({ token }).token;
};

const enmascararToken = (token?: string) => {
  if (!token) {
    return "";
  }
  if (token.length <= 8) {
    return `${token.slice(0, 2)}****`;
  }
  return `${token.slice(0, 4)}****${token.slice(-4)}`;
};

const obtenerTokenWs = (req: Request) =>
  tomarToken(req.body?.token_ws) ?? tomarToken(req.query?.token_ws);

const extraerParametrosTbk = (req: Request) => {
  const fuentes = [req.body, req.query];
  const params: Record<string, string> = {};

  for (const fuente of fuentes) {
    if (!fuente || typeof fuente !== "object") {
      continue;
    }
    for (const [key, value] of Object.entries(fuente as Record<string, unknown>)) {
      if (!/^TBK_/i.test(key)) {
        continue;
      }
      const raw = tomarToken(value);
      if (raw !== undefined) {
        params[key] = /TOKEN/i.test(key) ? enmascararToken(raw) : raw;
        continue;
      }
      if (typeof value === "number" || typeof value === "boolean") {
        params[key] = String(value);
        continue;
      }
      if (value !== null && value !== undefined) {
        params[key] = "present";
      }
    }
  }

  return Object.keys(params).length > 0 ? params : undefined;
};

const resumirError = (error: unknown) => {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { message: String(error) };
};

const mapearRespuestaTransbank = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = payload as Record<string, unknown>;
  const cardDetail = (data.card_detail as Record<string, unknown>) || {};
  const rawCard = typeof cardDetail.card_number === "string" ? cardDetail.card_number : "";
  const cardNumber = rawCard ? `****${rawCard.slice(-4)}` : undefined;

  return {
    status: typeof data.status === "string" ? data.status : undefined,
    buyOrder: typeof data.buy_order === "string" ? data.buy_order : undefined,
    authorizationCode: typeof data.authorization_code === "string" ? data.authorization_code : undefined,
    paymentTypeCode: typeof data.payment_type_code === "string" ? data.payment_type_code : undefined,
    installmentsNumber:
      typeof data.installments_number === "number" ? data.installments_number : undefined,
    responseCode: typeof data.response_code === "number" ? data.response_code : undefined,
    transactionDate: typeof data.transaction_date === "string" ? data.transaction_date : undefined,
    cardNumber,
  };
};

const defaultAllowedOrigins = [
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://covasachile.cl",
  "https://www.covasachile.cl",
];

const leerAllowedOrigins = () => {
  const envAllowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => normalizarTexto(origin).toLowerCase())
    .filter(Boolean);
  return new Set([...defaultAllowedOrigins.map((origin) => origin.toLowerCase()), ...envAllowed]);
};

const normalizarBaseUrl = (raw?: string) => {
  const valor = normalizarTexto(raw);
  if (!valor) return null;
  try {
    const parsed = new URL(valor);
    const path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname.replace(/\/$/, "") : "";
    return {
      base: `${parsed.origin}${path}`,
      origin: parsed.origin.toLowerCase(),
    };
  } catch {
    return null;
  }
};

const extraerFrontUrlSolicitud = (req: Request) => {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
  const referer = typeof req.headers.referer === "string" ? req.headers.referer : undefined;
  return origin || referer;
};

const extraerFrontUrlGateway = (gatewayPayload: unknown) => {
  if (!gatewayPayload || typeof gatewayPayload !== "object") {
    return undefined;
  }
  const payload = gatewayPayload as { front?: unknown };
  if (!payload.front || typeof payload.front !== "object") {
    return undefined;
  }
  const url = (payload.front as { url?: unknown }).url;
  return typeof url === "string" ? url : undefined;
};

const obtenerFrontUrlBase = (override?: string) => {
  const allowlist = leerAllowedOrigins();
  const overrideParsed = normalizarBaseUrl(override);

  if (overrideParsed) {
    if (allowlist.has(overrideParsed.origin)) {
      return overrideParsed.base;
    }
    logger.warn("transbank_front_url_rejected", {
      origin: overrideParsed.origin,
      override: overrideParsed.base,
    });
  }

  const envUrl = normalizarTexto(process.env.ECOMMERCE_FRONT_URL || process.env.FRONT_URL);
  const envParsed = normalizarBaseUrl(envUrl);
  if (envParsed) return envParsed.base;

  if (process.env.NODE_ENV === "production") {
    logger.error("transbank_front_url_missing", {
      requiredEnv: "ECOMMERCE_FRONT_URL",
    });
    throw new Error("ECOMMERCE_FRONT_URL no esta definida en produccion");
  }

  logger.warn("transbank_front_url_fallback_dev", {
    fallback: "http://localhost:5173",
  });

  return "http://localhost:5173";
};


const construirUrlResultadoFront = (
  payload: {
    pagoId?: string;
    pedidoId?: string;
    estado?: string;
    status: "success" | "failed";
    tbkStatus?: string;
  },
  frontOverride?: string
) => {
  const base = obtenerFrontUrlBase(frontOverride);
  const url = new URL("/pago/transbank", base);

  if (payload.pagoId) {
    url.searchParams.set("pagoId", payload.pagoId);
  }
  if (payload.pedidoId) {
    url.searchParams.set("pedidoId", payload.pedidoId);
  }
  if (payload.estado) {
    url.searchParams.set("estado", payload.estado);
  }
  url.searchParams.set("status", payload.status);
  if (payload.tbkStatus) {
    url.searchParams.set("tbkStatus", payload.tbkStatus);
  }

  return url.toString();
};

const construirFormularioTransbank = (url: string, token: string) => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Cache-Control" content="no-store" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Redirigiendo a Webpay</title>
</head>
<body>
  <p>Redirigiendo a Webpay...</p>
  <form id="tbk-form" action="${url}" method="POST">
    <input type="hidden" name="token_ws" value="${token}" />
  </form>
  <script>
    document.getElementById('tbk-form').submit();
  </script>
</body>
</html>`;

const enviarFormularioTransbank = (res: Response, url: string, token: string) => {
  logger.info("transbank_form_post", {
    tokenWsPresente: Boolean(token),
    token: enmascararToken(token),
    url,
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(construirFormularioTransbank(url, token));
};

// POST /api/ecommerce/payments/transbank
// Input: { pedidoId, returnUrl?, frontUrl? }. Output: redireccion a Webpay (HTML) o JSON si se solicita.
export const crearTransbankPago = manejarAsync(async (req: Request, res: Response) => {
  const payload = transbankCrearSchema.parse(req.body);
  const frontUrl = normalizarTexto(payload.frontUrl) || normalizarTexto(extraerFrontUrlSolicitud(req));
  logger.info("transbank_create_inicio", {
    pedidoId: payload.pedidoId,
    returnUrl: payload.returnUrl ?? null,
    frontUrl: frontUrl || null,
  });
  const resultado = await crearTransbankPagoServicio({
    pedidoId: payload.pedidoId,
    returnUrl: payload.returnUrl,
    frontUrl,
  });
  const aceptaHtml = (req.headers.accept || "").includes("text/html");

  logger.info("transbank_create_respuesta", {
    pedidoId: payload.pedidoId,
    pagoId: resultado.pagoId,
    url: resultado.url,
    token: enmascararToken(resultado.token),
  });

  if (aceptaHtml) {
    enviarFormularioTransbank(res, resultado.url, resultado.token);
    return;
  }

  res.status(201).json({
    ok: true,
    data: {
      pagoId: resultado.pagoId,
      url: resultado.url,
      monto: resultado.monto,
    },
    message: "Transaccion Transbank creada",
  });
});

// POST /api/ecommerce/payments/transbank/commit
// Input: { token } o token_ws. Output: estado y resumen Transbank (sin token).
export const confirmarTransbankPago = manejarAsync(async (req: Request, res: Response) => {
  const token = extraerToken(req);
  const requestId = typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : undefined;
  logger.info("transbank_commit_request", {
    metodo: req.method,
    token: enmascararToken(token),
    requestId,
  });
  const resultado = await confirmarTransbankPagoServicio(token);
  const transbank = mapearRespuestaTransbank(resultado.resultado);

  logger.info("transbank_commit_response", {
    pagoId: resultado.pago.id,
    pedidoId: resultado.pago.pedidoId,
    estado: resultado.estado,
    status: transbank?.status,
    responseCode: transbank?.responseCode,
    requestId,
  });

  res.json({
    ok: true,
    data: {
      pagoId: resultado.pago.id,
      estado: resultado.estado,
      transbank,
    },
    message: resultado.estado === "CONFIRMADO" ? "Pago confirmado" : "Pago rechazado",
  });
});

// GET /api/ecommerce/payments/transbank/status/:token
// Output: estado remoto de Transbank.
export const obtenerEstadoTransbank = manejarAsync(async (req: Request, res: Response) => {
  const token = transbankTokenSchema.parse(req.params).token;
  logger.info("transbank_status_request", { token: enmascararToken(token) });
  const estado = await obtenerEstadoTransbankServicio(token);
  const resumen = mapearRespuestaTransbank(estado);

  logger.info("transbank_status_response", {
    token: enmascararToken(token),
    status: resumen?.status,
    responseCode: resumen?.responseCode,
  });

  res.json({
    ok: true,
    data: resumen,
  });
});

// POST|GET /api/ecommerce/payments/transbank/return
// Recibe token_ws y redirige al front con el resultado (sin exponer token).
export const recibirRetornoTransbank = manejarAsync(async (req: Request, res: Response) => {
  const token = extraerTokenRaw(req);
  const tokenWs = obtenerTokenWs(req);
  const tbkParams = extraerParametrosTbk(req);
  const requestId = typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : undefined;

  logger.info("transbank_return_recepcion", {
    metodo: req.method,
    tokenWsPresente: Boolean(tokenWs && String(tokenWs).trim().length > 0),
    token: enmascararToken(token),
    tbkParams,
    requestId,
  });

  if (!token || token.trim().length === 0) {
    logger.warn("transbank_return_token_invalido", { token: enmascararToken(token) });
    const redirectUrl = construirUrlResultadoFront({
      estado: "ERROR",
      status: "failed",
    });
    const destino = `${redirectUrl}&reason=missing_token`;
    logger.info("transbank_return_redirect", {
      destino,
      requestId,
      params: { estado: "ERROR", status: "failed", reason: "missing_token" },
    });
    res.redirect(302, destino);
    return;
  }

  try {
    const resultado = await confirmarTransbankPagoServicio(token);
    const transbank = mapearRespuestaTransbank(resultado.resultado);
    const status = resultado.estado === "CONFIRMADO" ? "success" : "failed";
    const frontOverride = extraerFrontUrlGateway(resultado.pago.gatewayPayloadJson);
    const redirectUrl = construirUrlResultadoFront(
      {
        pagoId: resultado.pago.id,
        pedidoId: resultado.pago.pedidoId,
        estado: resultado.estado,
        status,
        tbkStatus: transbank?.status,
      },
      frontOverride
    );

    logger.info("transbank_return_redirect", {
      destino: redirectUrl,
      requestId,
      params: {
        pagoId: resultado.pago.id,
        pedidoId: resultado.pago.pedidoId,
        estado: resultado.estado,
        status,
        tbkStatus: transbank?.status,
      },
      frontUrl: frontOverride || null,
    });

    res.redirect(302, redirectUrl);
    return;
  } catch (error) {
    logger.error("transbank_return_error", {
      token: enmascararToken(token),
      error: resumirError(error),
    });
    const pago = await buscarPagoPorReferencia(token).catch(() => null);
    const frontOverride = extraerFrontUrlGateway(pago?.gatewayPayloadJson);
    const redirectUrl = construirUrlResultadoFront(
      {
        pagoId: pago?.id,
        pedidoId: pago?.pedidoId,
        estado: "ERROR",
        status: "failed",
      },
      frontOverride
    );
    logger.info("transbank_return_redirect", {
      destino: redirectUrl,
      requestId,
      params: {
        pagoId: pago?.id,
        pedidoId: pago?.pedidoId,
        estado: "ERROR",
        status: "failed",
        reason: "exception",
      },
      frontUrl: frontOverride || null,
    });
    res.redirect(302, redirectUrl);
  }
});
