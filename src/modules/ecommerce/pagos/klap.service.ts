import { createHash, randomUUID, timingSafeEqual } from "crypto";
import {
  EcommerceEstadoPago,
  EcommerceEstadoPedido,
  EcommerceMetodoPago,
  Prisma,
} from "@prisma/client";
import { ErrorApi } from "../../../lib/errores";
import { logger } from "../../../lib/logger";
import { prisma } from "../../../lib/prisma";
import { normalizarTexto } from "../common/ecommerce.utils";
import {
  actualizarPagoDatos,
  actualizarPedidoEstado,
  buscarPagoPendientePorPedidoMetodo,
  buscarPagoPorReferencia,
  buscarPedidoParaPago,
  crearPago,
  listarPagosPorMetodo,
} from "./pagos.repo";
import { notificarPagoConfirmadoCRM } from "./crm-notificacion";
import type { KlapCrearInput, KlapMockWebhookInput, KlapWebhookInput } from "./klap.schema";

type KlapConfig = {
  env: "sandbox" | "prod";
  mockEnabled: boolean;
  apiKey?: string;
  ordersUrl?: string;
  publicBaseUrl?: string;
  frontendBaseUrl?: string;
  webhookPath: string;
  returnPath: string;
};

type KlapCreateResult = {
  pagoId: string;
  pedidoId: string;
  orderId: string;
  redirectUrl?: string;
  raw: unknown;
  mock?: boolean;
};

type JsonRecord = Record<string, unknown>;

const normalizarFlag = (value?: string) => normalizarTexto(value).toLowerCase();
const klapEnabled = () => {
  const flag = normalizarFlag(process.env.KLAP_ENABLED);
  return flag === "true" || flag === "1" || flag === "yes";
};

const parseBooleanEnv = (key: string, defaultValue = false) => {
  const raw = normalizarFlag(process.env[key]);
  if (!raw) {
    return defaultValue;
  }
  if (["true", "1", "yes"].includes(raw)) {
    return true;
  }
  if (["false", "0", "no"].includes(raw)) {
    return false;
  }
  throw new ErrorApi(`${key} invalido`, 500, { value: process.env[key] });
};

const parseKlapEnv = () => {
  const envRaw = normalizarFlag(process.env.KLAP_ENV || "sandbox");
  if (!["sandbox", "prod", "production"].includes(envRaw)) {
    throw new ErrorApi("KLAP_ENV invalido", 500, { value: envRaw });
  }
  return envRaw === "production" ? "prod" : (envRaw as "sandbox" | "prod");
};

const isPlaceholderApiKey = (apiKeyRaw?: string) => {
  const value = normalizarTexto(apiKeyRaw);
  return !value || value.toUpperCase().includes("REEMPLAZAR");
};

export const isKlapMockEnabled = () => {
  const forced = parseBooleanEnv("KLAP_MOCK", false);
  const apiKey = normalizarTexto(process.env.KLAP_API_KEY);
  return forced || isPlaceholderApiKey(apiKey);
};

const requireEnv = (key: string) => {
  const value = normalizarTexto(process.env[key]);
  if (!value) {
    throw new ErrorApi(`${key} requerido`, 500);
  }
  return value;
};

const normalizarBaseUrl = (raw: string, envKey: string) => {
  try {
    const parsed = new URL(raw);
    return parsed.toString().replace(/\/$/, "");
  } catch {
    throw new ErrorApi(`${envKey} invalido`, 500, { value: raw });
  }
};

const normalizarBaseUrlOpcional = (raw: string | undefined, envKey: string) => {
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = new URL(raw);
    return parsed.toString().replace(/\/$/, "");
  } catch {
    logger.warn("klap_env_url_invalida", { envKey, value: raw });
    return undefined;
  }
};

const construirUrl = (base: string, pathOrUrl: string) => {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  const normalizedBase = `${base.replace(/\/$/, "")}/`;
  const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl.slice(1) : pathOrUrl;
  return new URL(normalizedPath, normalizedBase).toString();
};

const obtenerConfigKlap = (): KlapConfig => {
  if (!klapEnabled()) {
    throw new ErrorApi("Not found", 404);
  }

  const env = parseKlapEnv();
  const mockEnabled = isKlapMockEnabled();
  const apiKeyRaw = normalizarTexto(process.env.KLAP_API_KEY);
  const webhookPath = normalizarTexto(process.env.KLAP_WEBHOOK_PATH) || "/api/ecommerce/payments/klap/webhook";
  const returnPath = normalizarTexto(process.env.KLAP_RETURN_URL) || "/pago/klap";
  const frontBaseRaw =
    normalizarTexto(process.env.PUBLIC_FRONTEND_BASE_URL) ||
    normalizarTexto(process.env.FRONTEND_BASE_URL) ||
    "";

  const apiKey = mockEnabled ? apiKeyRaw || undefined : requireEnv("KLAP_API_KEY");
  const ordersUrl = mockEnabled
    ? normalizarBaseUrlOpcional(normalizarTexto(process.env.KLAP_ORDERS_URL) || undefined, "KLAP_ORDERS_URL")
    : normalizarBaseUrl(requireEnv("KLAP_ORDERS_URL"), "KLAP_ORDERS_URL");
  const publicBaseUrl = mockEnabled
    ? normalizarBaseUrlOpcional(normalizarTexto(process.env.PUBLIC_BASE_URL) || undefined, "PUBLIC_BASE_URL")
    : normalizarBaseUrl(requireEnv("PUBLIC_BASE_URL"), "PUBLIC_BASE_URL");
  const frontendBaseUrl = normalizarBaseUrlOpcional(frontBaseRaw || publicBaseUrl, "FRONTEND_BASE_URL");

  return {
    env,
    mockEnabled,
    apiKey,
    ordersUrl,
    publicBaseUrl,
    frontendBaseUrl,
    webhookPath,
    returnPath,
  };
};

const toRecord = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
};

const toInputJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

const extraerString = (record: JsonRecord | null, key: string) => {
  if (!record) return "";
  const raw = record[key];
  return typeof raw === "string" ? normalizarTexto(raw) : "";
};

const extraerOrderId = (payload: unknown) => {
  const root = toRecord(payload);
  const data = toRecord(root?.data);
  return (
    extraerString(root, "order_id") ||
    extraerString(root, "orderId") ||
    extraerString(data, "order_id") ||
    extraerString(data, "orderId")
  );
};

const extraerRedirectUrl = (payload: unknown) => {
  const root = toRecord(payload);
  const data = toRecord(root?.data);
  const klap = toRecord(root?.klap);
  return (
    extraerString(root, "redirect_url") ||
    extraerString(root, "redirectUrl") ||
    extraerString(root, "checkout_url") ||
    extraerString(root, "checkoutUrl") ||
    extraerString(root, "payment_url") ||
    extraerString(root, "url") ||
    extraerString(data, "redirect_url") ||
    extraerString(data, "redirectUrl") ||
    extraerString(data, "checkout_url") ||
    extraerString(data, "checkoutUrl") ||
    extraerString(data, "payment_url") ||
    extraerString(data, "url") ||
    extraerString(klap, "redirectUrl")
  );
};

const extraerPayloadKlap = (gatewayPayload: unknown) => {
  const base = toRecord(gatewayPayload);
  return toRecord(base?.klap);
};

const extraerReferenceIdDesdeGateway = (gatewayPayload: unknown) =>
  extraerString(extraerPayloadKlap(gatewayPayload), "referenceId");

const extraerCreateResponseDesdeGateway = (gatewayPayload: unknown) => {
  const klap = extraerPayloadKlap(gatewayPayload);
  return klap?.createResponse;
};

const mergeGatewayPayloadKlap = (actual: unknown, extra: JsonRecord) => {
  const base = toRecord(actual) ?? {};
  const klapActual = toRecord(base.klap) ?? {};

  return {
    ...base,
    proveedor: "KLAP",
    klap: {
      ...klapActual,
      ...extra,
    },
  };
};

const appendKlapWebhookPayload = (
  actual: unknown,
  payload: KlapWebhookInput,
  firma: { recibida: string; esperada: string; valida: boolean }
) => {
  const base = toRecord(actual) ?? {};
  const klapActual = toRecord(base.klap) ?? {};
  const webhooksActuales = Array.isArray(klapActual.webhooks) ? klapActual.webhooks : [];
  const evento = {
    receivedAt: new Date().toISOString(),
    payload,
    firma,
  };

  return {
    ...base,
    proveedor: "KLAP",
    klap: {
      ...klapActual,
      lastWebhook: payload,
      lastWebhookAt: evento.receivedAt,
      webhooks: [...webhooksActuales, evento].slice(-50),
    },
  };
};

const parsearRespuestaKlap = async (response: Response) => {
  const rawText = await response.text();
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return { raw: rawText };
  }
};

const hashKlap = (referenceId: string, orderId: string, apiKey: string) =>
  createHash("sha256").update(`${referenceId}${orderId}${apiKey}`).digest("hex");

const normalizarHex = (value?: string) => {
  const normalized = normalizarTexto(value).toLowerCase();
  if (!normalized || normalized.length % 2 !== 0 || !/^[0-9a-f]+$/.test(normalized)) {
    return "";
  }
  return normalized;
};

const validarFirmaKlap = (recibida: string, esperada: string) => {
  const left = normalizarHex(recibida);
  const right = normalizarHex(esperada);
  if (!left || !right) {
    return false;
  }

  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  // timingSafeEqual evita ataques por tiempo en la comparacion de hashes.
  return timingSafeEqual(leftBuffer, rightBuffer);
};

const mapearEstadoKlap = (statusRaw?: string) => {
  const status = normalizarTexto(statusRaw).toUpperCase();

  // AJUSTAR a doc Klap: campos/valores exactos de estado.
  if (["PAID", "APPROVED", "SUCCESS", "CONFIRMED", "COMPLETED"].includes(status)) {
    return EcommerceEstadoPago.CONFIRMADO;
  }

  // AJUSTAR a doc Klap: campos/valores exactos de estado.
  if (["REFUND", "REFUNDED", "REEMBOLSADO"].includes(status)) {
    return EcommerceEstadoPago.REEMBOLSADO;
  }

  // AJUSTAR a doc Klap: campos/valores exactos de estado.
  if (["REJECTED", "FAILED", "DECLINED", "ERROR", "CANCELLED", "CANCELED"].includes(status)) {
    return EcommerceEstadoPago.RECHAZADO;
  }

  return EcommerceEstadoPago.PENDIENTE;
};

const resolverEstadoFinal = (actual: EcommerceEstadoPago, mapeado: EcommerceEstadoPago) => {
  if (actual === EcommerceEstadoPago.REEMBOLSADO && mapeado !== EcommerceEstadoPago.REEMBOLSADO) {
    return EcommerceEstadoPago.REEMBOLSADO;
  }

  if (
    actual === EcommerceEstadoPago.CONFIRMADO &&
    (mapeado === EcommerceEstadoPago.PENDIENTE || mapeado === EcommerceEstadoPago.RECHAZADO)
  ) {
    return EcommerceEstadoPago.CONFIRMADO;
  }

  return mapeado;
};

const obtenerBaseFront = (frontUrl: string | undefined, fallbackBase?: string) => {
  if (!frontUrl) {
    return fallbackBase;
  }

  try {
    return new URL(frontUrl).toString().replace(/\/$/, "");
  } catch {
    logger.warn("klap_front_url_invalida", { frontUrl });
    return fallbackBase;
  }
};

const resumirError = (error: unknown) => {
  if (error instanceof ErrorApi) {
    return { message: error.message, status: error.status, details: error.details };
  }
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { message: String(error) };
};

const construirReturnTarget = (baseUrl: string | undefined, returnPath: string) => {
  const path = normalizarTexto(returnPath) || "/pago/klap";
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  if (!baseUrl) {
    return path.startsWith("/") ? path : `/${path}`;
  }
  return construirUrl(baseUrl, path);
};

const agregarParametrosRedirect = (
  target: string,
  params: Record<string, string | undefined>,
  forceRelative = false
) => {
  if (!forceRelative && /^https?:\/\//i.test(target)) {
    const url = new URL(target);
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  const [pathPart, queryPart = ""] = target.split("?");
  const path = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  const query = new URLSearchParams(queryPart);
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }
  const encoded = query.toString();
  return encoded ? `${path}?${encoded}` : path;
};

const generarReferenciaMock = (pedidoId: string) => {
  const timestamp = Date.now();
  const token = randomUUID().replace(/-/g, "").slice(0, 10);
  return `klap_mock_${pedidoId}_${timestamp}_${token}`;
};

const buscarPagoKlapPorReferenceId = async (referenceId: string) => {
  const porId = await prisma.ecommercePago.findUnique({ where: { id: referenceId } });
  if (porId?.metodo === EcommerceMetodoPago.KLAP) {
    return porId;
  }

  const candidatos = await listarPagosPorMetodo(EcommerceMetodoPago.KLAP, 250);
  return (
    candidatos.find((item) => extraerReferenceIdDesdeGateway(item.gatewayPayloadJson) === referenceId) ?? null
  );
};

export const crearKlapPagoServicio = async (params: KlapCrearInput): Promise<KlapCreateResult> => {
  const config = obtenerConfigKlap();
  const pedido = await buscarPedidoParaPago(params.pedidoId);

  if (!pedido) {
    throw new ErrorApi("Pedido no encontrado", 404, { id: params.pedidoId });
  }

  if (pedido.estado !== EcommerceEstadoPedido.CREADO) {
    throw new ErrorApi("Pedido no esta disponible para pago", 409, { estado: pedido.estado });
  }

  if (pedido.total <= 0) {
    throw new ErrorApi("Monto de pedido invalido", 409, { total: pedido.total });
  }

  // Idempotencia: si ya existe un pago KLAP pendiente para el mismo pedido, se reutiliza.
  const pagoPendiente = await buscarPagoPendientePorPedidoMetodo(pedido.id, EcommerceMetodoPago.KLAP);
  if (config.mockEnabled) {
    const referenciaExistente = normalizarTexto(pagoPendiente?.referencia || undefined);
    const referencia = referenciaExistente || generarReferenciaMock(pedido.id);
    const createdAt = new Date().toISOString();
    const itemsCount = await prisma.ecommercePedidoItem.count({
      where: { pedidoId: pedido.id },
    });
    const mockPayload = {
      mock: true,
      createdAt,
      pedidoId: pedido.id,
      total: pedido.total,
      itemsCount,
    };

    const frontBase = obtenerBaseFront(
      normalizarTexto(params.frontUrl) || undefined,
      config.frontendBaseUrl || config.publicBaseUrl
    );
    const returnTarget = construirReturnTarget(
      frontBase || config.frontendBaseUrl || config.publicBaseUrl,
      config.returnPath
    );
    const redirectUrl = agregarParametrosRedirect(returnTarget, {
      ref: referencia,
      mock: "1",
    });

    let gatewayPayload = mergeGatewayPayloadKlap(pagoPendiente?.gatewayPayloadJson, {
      env: config.env,
      mock: true,
      referenceId: referencia,
      frontUrl: normalizarTexto(params.frontUrl) || undefined,
      returnUrl: returnTarget,
      redirectUrl,
      mockOrder: mockPayload,
    });

    let pagoId = pagoPendiente?.id;
    if (!pagoId) {
      const pago = await crearPago({
        pedido: { connect: { id: pedido.id } },
        metodo: EcommerceMetodoPago.KLAP,
        estado: EcommerceEstadoPago.PENDIENTE,
        monto: pedido.total,
        referencia,
        gatewayPayloadJson: toInputJson(gatewayPayload),
      });
      pagoId = pago.id;
    } else {
      gatewayPayload = mergeGatewayPayloadKlap(gatewayPayload, {
        reusedPendingPagoId: pagoId,
      });

      await actualizarPagoDatos(pagoId, {
        referencia,
        gatewayPayloadJson: toInputJson(gatewayPayload),
      });
    }

    if (!pagoId) {
      throw new ErrorApi("No fue posible crear pago KLAP mock", 500);
    }

    logger.info("klap_mock_order_created", {
      event: "klap_mock_order_created",
      pedidoId: pedido.id,
      referencia,
      total: pedido.total,
    });

    return {
      pagoId,
      pedidoId: pedido.id,
      orderId: referencia,
      redirectUrl,
      raw: mockPayload,
      mock: true,
    };
  }

  if (pagoPendiente?.referencia) {
    return {
      pagoId: pagoPendiente.id,
      pedidoId: pedido.id,
      orderId: pagoPendiente.referencia,
      redirectUrl: extraerRedirectUrl(pagoPendiente.gatewayPayloadJson) || undefined,
      raw: extraerCreateResponseDesdeGateway(pagoPendiente.gatewayPayloadJson) ?? pagoPendiente.gatewayPayloadJson,
      mock: false,
    };
  }

  if (!config.publicBaseUrl || !config.ordersUrl || !config.apiKey) {
    throw new ErrorApi("Configuracion KLAP incompleta", 500, {
      hasApiKey: Boolean(config.apiKey),
      hasOrdersUrl: Boolean(config.ordersUrl),
      hasPublicBaseUrl: Boolean(config.publicBaseUrl),
    });
  }

  const publicBaseUrl = config.publicBaseUrl;
  const ordersUrl = config.ordersUrl;
  const apiKey = config.apiKey;
  const frontBase =
    obtenerBaseFront(normalizarTexto(params.frontUrl) || undefined, publicBaseUrl) || publicBaseUrl;
  const webhookUrl = construirUrl(publicBaseUrl, config.webhookPath);
  const returnUrl = construirUrl(frontBase, config.returnPath);

  let pagoId = pagoPendiente?.id;
  let gatewayPayload: unknown = pagoPendiente?.gatewayPayloadJson;
  if (!pagoId) {
    gatewayPayload = mergeGatewayPayloadKlap(undefined, {
      env: config.env,
      flow: "checkout-flex",
      createdAt: new Date().toISOString(),
      pedidoSnapshot: {
        id: pedido.id,
        codigo: pedido.codigo,
        total: pedido.total,
        estado: pedido.estado,
      },
    });

    const pago = await crearPago({
      pedido: { connect: { id: pedido.id } },
      metodo: EcommerceMetodoPago.KLAP,
      estado: EcommerceEstadoPago.PENDIENTE,
      monto: pedido.total,
      gatewayPayloadJson: toInputJson(gatewayPayload),
    });

    pagoId = pago.id;
  }

  if (!pagoId) {
    throw new ErrorApi("No fue posible crear pago KLAP", 500);
  }

  // reference_id = pago.id para resolver el webhook de forma deterministica sin crear campos extra.
  const referenceId = pagoId;
  const createRequestPayload = {
    reference_id: referenceId,
    amount: pedido.total,
    currency: "CLP",
    confirm_url: webhookUrl,
    reject_url: webhookUrl,
    return_url: returnUrl,
    // AJUSTAR a doc Klap: campos exactos request/response.
  };

  gatewayPayload = mergeGatewayPayloadKlap(gatewayPayload, {
    env: config.env,
    referenceId,
    frontUrl: normalizarTexto(params.frontUrl) || undefined,
    webhookUrl,
    returnUrl,
    createRequest: createRequestPayload,
    createRequestedAt: new Date().toISOString(),
  });

  await actualizarPagoDatos(pagoId, {
    gatewayPayloadJson: toInputJson(gatewayPayload),
  });

  let rawResponse: unknown;
  try {
    const response = await fetch(ordersUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Apikey: apiKey,
      },
      body: JSON.stringify(createRequestPayload),
    });

    rawResponse = await parsearRespuestaKlap(response);
    if (!response.ok) {
      throw new ErrorApi("No fue posible crear orden KLAP", 502, {
        status: response.status,
        body: rawResponse,
      });
    }
  } catch (error) {
    const payloadConError = mergeGatewayPayloadKlap(gatewayPayload, {
      createError: {
        at: new Date().toISOString(),
        error: resumirError(error),
      },
    });

    await actualizarPagoDatos(pagoId, {
      gatewayPayloadJson: toInputJson(payloadConError),
    }).catch(() => undefined);

    if (error instanceof ErrorApi) {
      throw error;
    }
    throw new ErrorApi("No fue posible crear orden KLAP", 502, resumirError(error));
  }

  const orderId = extraerOrderId(rawResponse);
  if (!orderId) {
    const payloadInvalido = mergeGatewayPayloadKlap(gatewayPayload, {
      createResponse: rawResponse,
      createError: {
        at: new Date().toISOString(),
        error: "Respuesta KLAP sin order_id",
      },
    });

    await actualizarPagoDatos(pagoId, {
      gatewayPayloadJson: toInputJson(payloadInvalido),
    });

    throw new ErrorApi("Respuesta KLAP invalida", 502, { body: rawResponse });
  }

  const redirectUrl = extraerRedirectUrl(rawResponse) || undefined;
  const payloadFinal = mergeGatewayPayloadKlap(gatewayPayload, {
    orderId,
    redirectUrl,
    createResponse: rawResponse,
    createCompletedAt: new Date().toISOString(),
  });

  await actualizarPagoDatos(pagoId, {
    referencia: orderId,
    gatewayPayloadJson: toInputJson(payloadFinal),
  });

  return {
    pagoId,
    pedidoId: pedido.id,
    orderId,
    redirectUrl,
    raw: rawResponse,
    mock: false,
  };
};

const procesarKlapWebhookInterno = async (params: {
  config: KlapConfig;
  payload: KlapWebhookInput;
  apikeyHeader?: string;
  omitirValidacionFirma?: boolean;
}) => {
  const config = params.config;
  const referenceId = normalizarTexto(params.payload.reference_id);
  const orderId = normalizarTexto(params.payload.order_id);
  const firmaRecibida = normalizarTexto(params.apikeyHeader);
  const firmaEsperada = config.apiKey ? hashKlap(referenceId, orderId, config.apiKey) : "";
  const omitirFirma = Boolean(params.omitirValidacionFirma);

  // Validacion de firma: sha256(reference_id + order_id + apiKey) con comparacion segura.
  if (!omitirFirma && !validarFirmaKlap(firmaRecibida, firmaEsperada)) {
    throw new ErrorApi("Firma KLAP invalida", 401);
  }

  let pago = await buscarPagoPorReferencia(orderId);
  if ((!pago || pago.metodo !== EcommerceMetodoPago.KLAP) && referenceId) {
    pago = await buscarPagoKlapPorReferenceId(referenceId);
  }

  if (!pago || pago.metodo !== EcommerceMetodoPago.KLAP) {
    throw new ErrorApi("Pago KLAP no encontrado", 404, { orderId, referenceId });
  }

  const estadoMapeado = mapearEstadoKlap(params.payload.status);
  const estadoFinal = resolverEstadoFinal(pago.estado, estadoMapeado);
  const payloadWebhook = appendKlapWebhookPayload(pago.gatewayPayloadJson, params.payload, {
    recibida: firmaRecibida || (omitirFirma ? "mock" : ""),
    esperada: firmaEsperada || (omitirFirma ? "mock" : ""),
    valida: true,
  });

  const pagoActualizado = await prisma.$transaction(async (tx) => {
    const actualizado = await actualizarPagoDatos(
      pago.id,
      {
        estado: estadoFinal,
        referencia: orderId || pago.referencia || undefined,
        gatewayPayloadJson: toInputJson(payloadWebhook),
      },
      tx
    );

    if (estadoFinal === EcommerceEstadoPago.CONFIRMADO && pago.estado !== EcommerceEstadoPago.CONFIRMADO) {
      await actualizarPedidoEstado(pago.pedidoId, EcommerceEstadoPedido.PAGADO, tx);
    }

    return actualizado;
  });

  // Responder webhook rapido: CRM se ejecuta async para no bloquear el 200 del proveedor.
  if (estadoFinal === EcommerceEstadoPago.CONFIRMADO && pago.estado !== EcommerceEstadoPago.CONFIRMADO) {
    notificarPagoConfirmadoCRM(pago.pedidoId, pago.id).catch((error) => {
      logger.error("klap_crm_notify_error", {
        pagoId: pago.id,
        pedidoId: pago.pedidoId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  logger.info("klap_webhook_procesado", {
    pagoId: pagoActualizado.id,
    pedidoId: pagoActualizado.pedidoId,
    referencia: pagoActualizado.referencia,
    estado: pagoActualizado.estado,
  });

  return {
    pagoId: pagoActualizado.id,
    pedidoId: pagoActualizado.pedidoId,
    estado: pagoActualizado.estado,
  };
};

export const procesarKlapWebhookServicio = async (params: {
  payload: KlapWebhookInput;
  apikeyHeader?: string;
}) => {
  const config = obtenerConfigKlap();
  return procesarKlapWebhookInterno({
    config,
    payload: params.payload,
    apikeyHeader: params.apikeyHeader,
  });
};

export const procesarKlapMockWebhookServicio = async (payload: KlapMockWebhookInput) => {
  const config = obtenerConfigKlap();
  if (!config.mockEnabled && config.env !== "sandbox") {
    throw new ErrorApi("Klap mock webhook no habilitado", 403);
  }

  const referencia = normalizarTexto(payload.referencia);
  const estadoSolicitado = payload.estado;
  const webhookPayload: KlapWebhookInput = {
    reference_id: referencia,
    order_id: referencia,
    status: estadoSolicitado === "CONFIRMADO" ? "CONFIRMED" : "REJECTED",
  };

  logger.info("klap_mock_webhook", {
    event: "klap_mock_webhook",
    referencia,
    estado: estadoSolicitado,
  });

  const resultado = await procesarKlapWebhookInterno({
    config,
    payload: webhookPayload,
    apikeyHeader: "mock",
    omitirValidacionFirma: true,
  });

  return {
    referencia,
    estadoFinal: resultado.estado,
  };
};
