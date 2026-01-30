import { EcommerceEstadoPago, EcommerceEstadoPedido, EcommerceMetodoPago, Prisma } from "@prisma/client";
import { IntegrationApiKeys, IntegrationCommerceCodes, WebpayPlus } from "transbank-sdk";
import { ErrorApi } from "../../../lib/errores";
import { prisma } from "../../../lib/prisma";
import { logger } from "../../../lib/logger";
import { normalizarTexto } from "../common/ecommerce.utils";

import { validarTransbankEnv } from "./transbank.env";


import { registrarNotificacion } from "../notificaciones/notificaciones.service";
import {
  actualizarPagoDatos,
  actualizarPedidoEstado,
  buscarPagoPorReferencia,
  buscarPedidoParaPago,
  crearPago,
} from "./pagos.repo";
import { notificarPagoConfirmadoCRM } from "./crm-notificacion";
 
type GatewayPayload = Record<string, unknown>;

type TransbankCreateResponse = {
  token: string;
  url: string;
};

const esProduccion = () => {
  const valor = normalizarTexto(process.env.TRANSBANK_ENV).toLowerCase();
  return valor === "production" || valor === "produccion";
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

const resumirError = (error: unknown) => {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { message: String(error) };
};

const logTransbank = (mensaje: string, datos: Record<string, unknown>) => {
  if (mensaje.includes("error")) {
    logger.error(`transbank_${mensaje}`, datos);
    return;
  }
  logger.info(`transbank_${mensaje}`, datos);
};

const obtenerClienteTransbank = () => {
    
  validarTransbankEnv();

  if (esProduccion()) {
    const comercio = normalizarTexto(process.env.TRANSBANK_COMMERCE_CODE);
    const apiKey = normalizarTexto(process.env.TRANSBANK_API_KEY);
    if (!comercio || !apiKey) {
      throw new ErrorApi("TRANSBANK_COMMERCE_CODE/TRANSBANK_API_KEY requeridos", 500);
    }
    return WebpayPlus.Transaction.buildForProduction(comercio, apiKey);
  }

  return WebpayPlus.Transaction.buildForIntegration(
    IntegrationCommerceCodes.WEBPAY_PLUS,
    IntegrationApiKeys.WEBPAY
  );
};

const resolverReturnUrl = (override?: string) => {
  const desdePayload = normalizarTexto(override);
  if (desdePayload) {
    return desdePayload;
  }

  const desdeEnv = normalizarTexto(process.env.TRANSBANK_RETURN_URL);
  if (desdeEnv) {
    return desdeEnv;
  }

  const baseEnv =
    normalizarTexto(process.env.API_URL) ||
    normalizarTexto(process.env.BASE_URL) ||
    normalizarTexto(process.env.BACKEND_URL);
  if (baseEnv) {
    return new URL("/api/ecommerce/payments/transbank/return", baseEnv).toString();
  }

  throw new ErrorApi("TRANSBANK_RETURN_URL requerido", 500);
};

const limitarLargo = (valor: string, max: number) => (valor.length <= max ? valor : valor.slice(0, max));

const crearBuyOrder = (codigo: string, pedidoId: string) => {
  const base = normalizarTexto(codigo) || pedidoId;
  const raw = `${base}-${Date.now()}`;
  return limitarLargo(raw, 26);
};

const crearSessionId = (pedidoId: string) => limitarLargo(`pedido-${pedidoId}-${Date.now()}`, 61);

const fusionarPayload = (actual: unknown, extra: GatewayPayload) => {
  if (actual && typeof actual === "object" && !Array.isArray(actual)) {
    return { ...(actual as GatewayPayload), ...extra };
  }
  return extra;
};

// Crea una transaccion en Transbank y registra el pago en EcommercePago.
export const crearTransbankPagoServicio = async (payload: { pedidoId: string; returnUrl?: string }) => {
  const pedido = await buscarPedidoParaPago(payload.pedidoId);
  if (!pedido) {
    throw new ErrorApi("Pedido no encontrado", 404, { id: payload.pedidoId });
  }

  if (pedido.estado !== EcommerceEstadoPedido.CREADO) {
    throw new ErrorApi("Pedido no esta disponible para pago", 409, { estado: pedido.estado });
  }

  if (pedido.total <= 0) {
    throw new ErrorApi("Monto de pedido invalido", 409, { total: pedido.total });
  }

  const returnUrl = resolverReturnUrl(payload.returnUrl);
  const ambiente = normalizarTexto(process.env.TRANSBANK_ENV) || "integration";

  logger.info("transbank_pago_inicio", {
    pedidoId: pedido.id,
    pagoId: null,
    monto: pedido.total,
    ambiente,
    returnUrl,
  });

  logTransbank("init", { pedidoId: pedido.id, total: pedido.total, returnUrl });
  const buyOrder = crearBuyOrder(pedido.codigo, pedido.id);
  const sessionId = crearSessionId(pedido.id);
  const cliente = obtenerClienteTransbank();

  let respuesta: TransbankCreateResponse;
  try {
    respuesta = (await cliente.create(buyOrder, sessionId, pedido.total, returnUrl)) as TransbankCreateResponse;
  } catch (error) {
    logTransbank("create_error", { pedidoId: pedido.id, error: resumirError(error) });
    throw new ErrorApi("No fue posible crear la transaccion Transbank", 502);
  }

  if (!respuesta?.token || !respuesta?.url) {
    throw new ErrorApi("Respuesta Transbank invalida", 502);
  }

  logTransbank("create_ok", {
    pedidoId: pedido.id,
    buyOrder,
    token: enmascararToken(respuesta.token),
    url: respuesta.url,
  });

  const gatewayPayload: GatewayPayload = {
    create: {
      buyOrder,
      sessionId,
      returnUrl,
      response: respuesta,
    },
  };

  const pago = await crearPago({
    pedido: { connect: { id: pedido.id } },
    metodo: EcommerceMetodoPago.TRANSBANK,
    estado: EcommerceEstadoPago.PENDIENTE,
    monto: pedido.total,
    referencia: respuesta.token,
    gatewayPayloadJson: gatewayPayload as Prisma.InputJsonValue,
  });

  logger.info("db_ecommerce_pago_create", {
    pagoId: pago.id,
    pedidoId: pedido.id,
    estado: pago.estado,
  });

  logger.info("crm_notificacion_crear", {
    pagoId: pago.id,
    pedidoId: pedido.id,
    tipo: "PAGO_TRANSBANK_CREADO",
    referenciaTabla: "EcommercePago",
  });

  await registrarNotificacion({
    tipo: "PAGO_TRANSBANK_CREADO",
    referenciaTabla: "EcommercePago",
    referenciaId: pago.id,
    titulo: "Pago Transbank creado",
    detalle: `Pedido ${pedido.id}. Monto ${pedido.total}.`,
  });

  logger.info("crm_notificacion_ok", {
    pagoId: pago.id,
    pedidoId: pedido.id,
    tipo: "PAGO_TRANSBANK_CREADO",
  });

  logTransbank("pago_registrado", {
    pedidoId: pedido.id,
    pagoId: pago.id,
    token: enmascararToken(respuesta.token),
  });

  return {
    pagoId: pago.id,
    token: respuesta.token,
    url: respuesta.url,
    monto: pago.monto,
    buyOrder,
  };
};

// Confirma una transaccion Transbank y actualiza EcommercePago/Pedido.
export const confirmarTransbankPagoServicio = async (token: string) => {
  const pago = await buscarPagoPorReferencia(token);
  if (!pago) {
    throw new ErrorApi("Pago no encontrado", 404, { token: enmascararToken(token) });
  }

  logTransbank("commit_inicio", {
    pagoId: pago.id,
    pedidoId: pago.pedidoId,
    token: enmascararToken(token),
  });

  if (pago.metodo !== EcommerceMetodoPago.TRANSBANK) {
    throw new ErrorApi("Pago no corresponde a Transbank", 409, { id: pago.id });
  }

  if (pago.estado === EcommerceEstadoPago.CONFIRMADO) {
    throw new ErrorApi("Pago ya confirmado", 409, { id: pago.id });
  }

  if (pago.estado === EcommerceEstadoPago.RECHAZADO) {
    throw new ErrorApi("Pago ya rechazado", 409, { id: pago.id });
  }

  const cliente = obtenerClienteTransbank();
  let respuesta: Record<string, unknown>;
  try {
    respuesta = (await cliente.commit(token)) as Record<string, unknown>;
  } catch (error) {
    logTransbank("commit_error", {
      pagoId: pago.id,
      pedidoId: pago.pedidoId,
      token: enmascararToken(token),
      error: resumirError(error),
    });
    throw new ErrorApi("No fue posible confirmar la transaccion Transbank", 502);
  }

  const status = String(respuesta?.status ?? "");
  const aprobado = status === "AUTHORIZED";
  const nuevoEstado = aprobado ? EcommerceEstadoPago.CONFIRMADO : EcommerceEstadoPago.RECHAZADO;
  const responseCode =
    typeof respuesta?.response_code === "number" ? (respuesta?.response_code as number) : undefined;

  const gatewayPayload = fusionarPayload(pago.gatewayPayloadJson, { commit: respuesta });

  logTransbank("commit_respuesta", {
    pagoId: pago.id,
    pedidoId: pago.pedidoId,
    status,
    responseCode,
  });

  const actualizado = await prisma.$transaction(async (tx) => {
    logger.info("db_ecommerce_pago_update_inicio", {
      pagoId: pago.id,
      pedidoId: pago.pedidoId,
      estado: nuevoEstado,
    });

    const pagoActualizado = await actualizarPagoDatos(
      pago.id,
      {
        estado: nuevoEstado,
        gatewayPayloadJson: gatewayPayload as Prisma.InputJsonValue,
      },
      tx
    );

    logger.info("db_ecommerce_pago_update_fin", {
      pagoId: pago.id,
      pedidoId: pago.pedidoId,
      estado: pagoActualizado.estado,
    });

    if (aprobado) {
      logger.info("db_ecommerce_pedido_update_inicio", {
        pagoId: pago.id,
        pedidoId: pago.pedidoId,
        estado: EcommerceEstadoPedido.PAGADO,
      });

      await actualizarPedidoEstado(pago.pedidoId, EcommerceEstadoPedido.PAGADO, tx);

      logger.info("db_ecommerce_pedido_update_fin", {
        pagoId: pago.id,
        pedidoId: pago.pedidoId,
        estado: EcommerceEstadoPedido.PAGADO,
      });
    }

    logger.info("crm_notificacion_crear", {
      pagoId: pago.id,
      pedidoId: pago.pedidoId,
      tipo: aprobado ? "PAGO_CONFIRMADO" : "PAGO_RECHAZADO",
      referenciaTabla: "EcommercePago",
    });

    await registrarNotificacion({
      tipo: aprobado ? "PAGO_CONFIRMADO" : "PAGO_RECHAZADO",
      referenciaTabla: "EcommercePago",
      referenciaId: pago.id,
      titulo: aprobado ? "Pago confirmado" : "Pago rechazado",
      detalle: `Pedido ${pago.pedidoId}. Monto ${pago.monto}. Estado ${nuevoEstado}.`,
      tx,
    });

    logger.info("crm_notificacion_ok", {
      pagoId: pago.id,
      pedidoId: pago.pedidoId,
      tipo: aprobado ? "PAGO_CONFIRMADO" : "PAGO_RECHAZADO",
    });

    return pagoActualizado;
  });

  logTransbank("commit_fin", {
    pagoId: pago.id,
    pedidoId: pago.pedidoId,
    estado: nuevoEstado,
    status,
    responseCode,
  });

  // Notificar al CRM para descontar inventario si fue aprobado
  // IMPORTANTE: El pago ya está confirmado en Transbank, no rechazamos si el CRM falla
  if (aprobado) {
    notificarPagoConfirmadoCRM(pago.pedidoId, pago.id).catch((error) => {
      logger.error("[TRANSBANK] ⚠️ Falló notificación al CRM (el pago SÍ fue confirmado)", {
        pagoId: pago.id,
        pedidoId: pago.pedidoId,
        error: error instanceof Error ? error.message : String(error),
        accion: "REQUIERE_REVISION_MANUAL - Verificar que el stock fue descontado en CRM",
      });
    });
  }

  return {
    pago: actualizado,
    resultado: respuesta,
    estado: nuevoEstado,
  };
};

// Obtiene el estado remoto de una transaccion Transbank.
export const obtenerEstadoTransbankServicio = async (token: string) => {
  const cliente = obtenerClienteTransbank();
  logTransbank("status_inicio", { token: enmascararToken(token) });
  try {
    return (await cliente.status(token)) as Record<string, unknown>;
  } catch (error) {
    logTransbank("status_error", { token: enmascararToken(token), error: resumirError(error) });
    throw new ErrorApi("No fue posible consultar estado Transbank", 502);
  }
};
