import { EcommerceEstadoPago, EcommerceEstadoPedido, EcommerceMetodoPago, Prisma } from "@prisma/client";
import { IntegrationApiKeys, IntegrationCommerceCodes, WebpayPlus } from "transbank-sdk";
import { ErrorApi } from "../../../lib/errores";
import { prisma } from "../../../lib/prisma";
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
  console.log(`[Transbank] ${mensaje}`, datos);
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
  if (!desdeEnv) {
    throw new ErrorApi("TRANSBANK_RETURN_URL requerido", 500);
  }

  return desdeEnv;
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

  logTransbank("init", { pedidoId: pedido.id, total: pedido.total });

  const returnUrl = resolverReturnUrl(payload.returnUrl);
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

  await registrarNotificacion({
    tipo: "PAGO_TRANSBANK_CREADO",
    referenciaTabla: "EcommercePago",
    referenciaId: pago.id,
    titulo: "Pago Transbank creado",
    detalle: `Pedido ${pedido.id}. Monto ${pedido.total}.`,
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

  const gatewayPayload = fusionarPayload(pago.gatewayPayloadJson, { commit: respuesta });

  const actualizado = await prisma.$transaction(async (tx) => {
    const pagoActualizado = await actualizarPagoDatos(
      pago.id,
      {
        estado: nuevoEstado,
        gatewayPayloadJson: gatewayPayload as Prisma.InputJsonValue,
      },
      tx
    );

    if (aprobado) {
      await actualizarPedidoEstado(pago.pedidoId, EcommerceEstadoPedido.PAGADO, tx);
    }

    await registrarNotificacion({
      tipo: aprobado ? "PAGO_CONFIRMADO" : "PAGO_RECHAZADO",
      referenciaTabla: "EcommercePago",
      referenciaId: pago.id,
      titulo: aprobado ? "Pago confirmado" : "Pago rechazado",
      detalle: `Pedido ${pago.pedidoId}. Monto ${pago.monto}. Estado ${nuevoEstado}.`,
      tx,
    });

    return pagoActualizado;
  });

  logTransbank("commit_fin", {
    pagoId: pago.id,
    pedidoId: pago.pedidoId,
    estado: nuevoEstado,
    status,
  });

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
