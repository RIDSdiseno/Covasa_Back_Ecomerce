import Stripe from "stripe";
import {
  EcommerceEstadoPago,
  EcommerceEstadoPedido,
  EcommerceMetodoPago,
  Prisma,
} from "@prisma/client";
import { ErrorApi } from "../../../lib/errores";
import { prisma } from "../../../lib/prisma";
import { normalizarTexto } from "../common/ecommerce.utils";
import { registrarNotificacion } from "../notificaciones/notificaciones.service";
import { buscarUsuarioPorId } from "../usuarios/usuarios.repo";
import {
  actualizarPagoDatos,
  actualizarPedidoEstado,
  buscarPagoPorReferencia,
  buscarPedidoParaPago,
  crearPago,
} from "./pagos.repo";

type StripeConfig = {
  secretKey: string;
};

type ResumenStripe = {
  pagoId: string;
  pedidoId: string | null;
  pedidoCodigo: string | null;
  cotizacionId: string | null;
  cotizacionCodigo: string | null;
  monto: number;
  moneda: string | null;
  estado: EcommerceEstadoPago;
  providerPaymentId: string | null;
  externalReference: string | null;
  stripeStatus: string | null;
  stripeStatusDetail: string | null;
  paidAt: string | null;
  lastError: string | null;
  updatedAt: Date;
};

type StripeCreateIntentPayload = {
  orderId: string;
  amount: number;
  currency: string;
  customerEmail?: string;
  metadata?: Record<string, unknown>;
};

async function obtenerEcommerceClienteIdPorUsuario(usuarioId: string): Promise<string | null> {
  const cliente = await prisma.ecommerceCliente.findUnique({
    where: { usuarioId },
    select: { id: true },
  });
  return cliente?.id ?? null;
}


type GatewayPayload = Record<string, unknown>;

const limpiarClaveStripe = (value?: string) => normalizarTexto(value).replace(/^['"]|['"]$/g, "");

let stripeCliente: Stripe | null = null;

const obtenerConfigStripe = (): StripeConfig => {
  const secretKey = limpiarClaveStripe(
    process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY_TEST
  );
  if (!secretKey) {
    throw new ErrorApi("STRIPE_SECRET_KEY requerido", 500);
  }

  return { secretKey };
};

const obtenerStripe = () => {
  if (stripeCliente) {
    return stripeCliente;
  }

  const { secretKey } = obtenerConfigStripe();
  stripeCliente = new Stripe(secretKey);
  return stripeCliente;
};

const obtenerWebhookSecret = () => {
  const secreto = limpiarClaveStripe(
    process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET_TEST
  );
  if (!secreto) {
    throw new ErrorApi("STRIPE_WEBHOOK_SECRET requerido", 500);
  }
  return secreto;
};



const normalizarMoneda = (valor?: string) => {
  const moneda = normalizarTexto(valor || "clp").toLowerCase();
  return moneda || "clp";
};

const normalizarMetadataStripe = (metadata?: Record<string, unknown>) => {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  const entries = Object.entries(metadata).reduce<Record<string, string>>((acc, [key, value]) => {
    if (!key) {
      return acc;
    }
    if (value === null || value === undefined) {
      return acc;
    }
    if (typeof value === "string") {
      acc[key] = value;
      return acc;
    }
    acc[key] = JSON.stringify(value);
    return acc;
  }, {});

  return Object.keys(entries).length > 0 ? entries : undefined;
};

const STRIPE_STATUS_TIMEOUT_MS = 7000;

const extraerUltimoErrorStripe = (intent: Stripe.PaymentIntent) => {
  const lastError = intent.last_payment_error;
  if (!lastError) {
    return null;
  }

  const message = typeof lastError.message === "string" ? lastError.message : "";
  const code = typeof lastError.code === "string" ? lastError.code : "";
  const decline = typeof lastError.decline_code === "string" ? lastError.decline_code : "";

  return message || code || decline || null;
};

const extraerFechaPagoStripe = (intent: Stripe.PaymentIntent) => {
  if (intent.status !== "succeeded") {
    return null;
  }

  const latestCharge = intent.latest_charge;
  if (latestCharge && typeof latestCharge === "object" && "created" in latestCharge) {
    const created = latestCharge.created;
    if (typeof created === "number") {
      return new Date(created * 1000).toISOString();
    }
  }

  const created = intent.created;
  if (typeof created === "number") {
    return new Date(created * 1000).toISOString();
  }

  return null;
};

const mapearEstadoStripe = (status?: string) => {
  const valor = normalizarTexto(status).toLowerCase();

  if (valor === "succeeded") {
    return { pagoEstado: EcommerceEstadoPago.CONFIRMADO, aprobado: true };
  }

  if (["processing", "requires_action", "requires_confirmation", "requires_capture"].includes(valor)) {
    return { pagoEstado: EcommerceEstadoPago.PENDIENTE, aprobado: false };
  }

  if (["requires_payment_method", "canceled", "payment_failed"].includes(valor)) {
    return { pagoEstado: EcommerceEstadoPago.RECHAZADO, aprobado: false };
  }

  return { pagoEstado: EcommerceEstadoPago.PENDIENTE, aprobado: false };
};

const fusionarPayload = (actual: unknown, extra: Record<string, unknown>) => {
  if (actual && typeof actual === "object" && !Array.isArray(actual)) {
    return { ...(actual as Record<string, unknown>), ...extra };
  }
  return extra;
};

const extraerStripeData = (payload?: Prisma.InputJsonValue | null) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const record = payload as GatewayPayload;
  const stripe = record.stripe;
  if (!stripe || typeof stripe !== "object" || Array.isArray(stripe)) {
    return null;
  }
  return stripe as GatewayPayload;
};

const esPayloadStripe = (payload?: Prisma.InputJsonValue | null) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }
  const record = payload as GatewayPayload;
  if (record.proveedor === "STRIPE") {
    return true;
  }
  return Boolean(record.stripe);
};

const buscarPagoStripePorPedido = async (pedidoId: string) => {
  const pagos = await prisma.ecommercePago.findMany({
    where: { pedidoId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return pagos.find((pago) => esPayloadStripe(pago.gatewayPayloadJson)) ?? null;
};

const construirResumenStripe = async (pago: {
  id: string;
  pedidoId: string;
  monto: number;
  estado: EcommerceEstadoPago;
  referencia?: string | null;
  updatedAt: Date;
  gatewayPayloadJson?: Prisma.InputJsonValue | null;
}) => {
  const pedido = await prisma.ecommercePedido.findUnique({
    where: { id: pago.pedidoId },
    select: { codigo: true },
  });

  const stripeData = extraerStripeData(pago.gatewayPayloadJson);
  const providerPaymentIdRaw =
    typeof stripeData?.intentId === "string" ? stripeData.intentId : pago.referencia || "";
  const providerPaymentId = normalizarTexto(providerPaymentIdRaw) || null;
  const moneda = typeof stripeData?.currency === "string" ? String(stripeData.currency) : null;
  const stripeStatus = typeof stripeData?.status === "string" ? String(stripeData.status) : null;
  const stripeStatusDetail =
    typeof stripeData?.status_detail === "string" ? String(stripeData.status_detail) : null;
  const paidAtRaw =
    typeof stripeData?.paid_at === "string"
      ? stripeData.paid_at
      : typeof stripeData?.paidAt === "string"
        ? stripeData.paidAt
        : null;
  const lastErrorRaw =
    typeof stripeData?.last_error === "string"
      ? stripeData.last_error
      : typeof stripeData?.lastError === "string"
        ? stripeData.lastError
        : null;

  return {
    pagoId: pago.id,
    pedidoId: pago.pedidoId,
    pedidoCodigo: pedido?.codigo ?? null,
    cotizacionId: null,
    cotizacionCodigo: null,
    monto: pago.monto,
    moneda,
    estado: pago.estado,
    providerPaymentId,
    externalReference: pago.pedidoId ?? null,
    stripeStatus,
    stripeStatusDetail,
    paidAt: paidAtRaw,
    lastError: lastErrorRaw,
    updatedAt: pago.updatedAt,
  } satisfies ResumenStripe;
};

const actualizarPagoStripeDesdeIntent = async (
  intent: Stripe.PaymentIntent,
  origen?: string
): Promise<ResumenStripe> => {
  const paymentId = normalizarTexto(intent.id);
  const pedidoRef = normalizarTexto(intent.metadata?.pedidoId || intent.metadata?.orderId || "");
  const estadoMap = mapearEstadoStripe(intent.status);
  const paidAt = extraerFechaPagoStripe(intent);
  const lastError = extraerUltimoErrorStripe(intent);

  let pago = await buscarPagoPorReferencia(paymentId);
  if (!pago && pedidoRef) {
    pago = await buscarPagoStripePorPedido(pedidoRef);
  }

  if (!pago) {
    throw new ErrorApi("Pago ecommerce no encontrado", 404, {
      paymentId,
      pedidoId: pedidoRef || null,
    });
  }

  const statusDetail =
    (intent as unknown as { status_detail?: string | null }).status_detail ?? null;
  const stripePayload: Record<string, unknown> = {
    intentId: intent.id,
    status: intent.status,
    status_detail: statusDetail,
    amount: intent.amount,
    currency: intent.currency,
    origen: origen || "stripe",
    last_error: lastError,
  };
  if (paidAt) {
    stripePayload.paid_at = paidAt;
  }
  const gatewayPayload = fusionarPayload(pago.gatewayPayloadJson, {
    proveedor: "STRIPE",
    stripe: stripePayload,
  });
  const referencia = pago.referencia || paymentId;

  const actualizado = await prisma.$transaction(async (tx) => {
    const pagoActualizado = await actualizarPagoDatos(
      pago.id,
      {
        estado: estadoMap.pagoEstado,
        referencia,
        gatewayPayloadJson: gatewayPayload as Prisma.InputJsonValue,
      },
      tx
    );

    if (estadoMap.aprobado) {
      await actualizarPedidoEstado(pago.pedidoId, EcommerceEstadoPedido.PAGADO, tx);
    }

    await registrarNotificacion({
      tipo: "PAGO_STRIPE_ACTUALIZADO",
      referenciaTabla: "EcommercePago",
      referenciaId: pago.id,
      titulo: estadoMap.aprobado ? "Pago Stripe confirmado" : "Pago Stripe actualizado",
      detalle: `Pedido ${pago.pedidoId}. Estado ${estadoMap.pagoEstado}.`,
      tx,
    });

    return pagoActualizado;
  });

  return construirResumenStripe(actualizado);
};

export const crearStripeIntentServicio = async (payload: { pedidoId: string; usuarioId?: string }) => {
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

  if (payload.usuarioId) {
    const usuario = await buscarUsuarioPorId(payload.usuarioId);
    if (!usuario) {
      throw new ErrorApi("Usuario no encontrado", 401, { id: payload.usuarioId });
    }

    const ecommerceClienteId = await obtenerEcommerceClienteIdPorUsuario(usuario.id);
    if (
      pedido.ecommerceClienteId &&
      ecommerceClienteId &&
      pedido.ecommerceClienteId !== ecommerceClienteId
    ) {
      throw new ErrorApi("Pedido no pertenece al cliente", 403, {
        pedidoId: pedido.id,
        pedidoClienteId: pedido.ecommerceClienteId,
        usuarioClienteId: ecommerceClienteId,
      });
    }


  }

  const stripe = obtenerStripe();
  const descripcion = normalizarTexto(pedido.codigo) ? `Pedido ${pedido.codigo}` : `Pedido ${pedido.id}`;
  const currency = normalizarMoneda(process.env.ECOMMERCE_CURRENCY || "clp");

  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create({
      amount: pedido.total,
      currency,
      description: descripcion,
      metadata: { pedidoId: pedido.id, pedidoCodigo: pedido.codigo },
      automatic_payment_methods: { enabled: true },
    });
  } catch {
    throw new ErrorApi("No fue posible crear el PaymentIntent", 502);
  }

  if (!intent.client_secret) {
    throw new ErrorApi("PaymentIntent sin client secret", 502);
  }

  const gatewayPayload = {
    proveedor: "STRIPE",
    stripe: { intentId: intent.id, status: intent.status, amount: intent.amount, currency },
  } as Prisma.InputJsonValue;

  const pago = await prisma.$transaction(async (tx) => {
    const creado = await crearPago(
      {
        pedido: { connect: { id: pedido.id } },
        metodo: EcommerceMetodoPago.STRIPE,
        estado: EcommerceEstadoPago.PENDIENTE,
        monto: pedido.total,
        referencia: intent.id,
        gatewayPayloadJson: gatewayPayload,
      },
      tx
    );

    await registrarNotificacion({
      tipo: "PAGO_STRIPE_CREADO",
      referenciaTabla: "EcommercePago",
      referenciaId: creado.id,
      titulo: "Pago Stripe creado",
      detalle: `Pedido ${pedido.id}. Monto ${pedido.total}.`,
      tx,
    });

    return creado;
  });

  return {
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
    pagoId: pago.id,
  };
};

export const crearStripeIntentEcommerceServicio = async (payload: StripeCreateIntentPayload) => {
  const orderId = normalizarTexto(payload.orderId);
  if (!orderId) {
    throw new ErrorApi("orderId requerido", 400);
  }

  if (!Number.isInteger(payload.amount) || payload.amount < 1) {
    throw new ErrorApi("Monto invalido", 400, { amount: payload.amount });
  }

  const pedido = await buscarPedidoParaPago(orderId);
  if (!pedido) {
    throw new ErrorApi("Pedido no encontrado", 404, { id: orderId });
  }

  if (pedido.estado !== EcommerceEstadoPedido.CREADO) {
    throw new ErrorApi("Pedido no esta disponible para pago", 409, { estado: pedido.estado });
  }

  if (pedido.total <= 0) {
    throw new ErrorApi("Monto de pedido invalido", 409, { total: pedido.total });
  }

  if (pedido.total !== payload.amount) {
    throw new ErrorApi("Monto no coincide con pedido", 409, { total: pedido.total });
  }

  const currency = normalizarMoneda(payload.currency || process.env.ECOMMERCE_CURRENCY || "clp");
  const metadataExtra = normalizarMetadataStripe(payload.metadata);
  const descripcion = normalizarTexto(pedido.codigo) ? `Pedido ${pedido.codigo}` : `Pedido ${pedido.id}`;
  const email = normalizarTexto(payload.customerEmail || "") || undefined;

  const metadata: Record<string, string> = {
    ...(metadataExtra ?? {}),
    pedidoId: pedido.id,
  };
  if (pedido.codigo) {
    metadata.pedidoCodigo = pedido.codigo;
  }

  const stripe = obtenerStripe();
  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create({
      amount: payload.amount,
      currency,
      description: descripcion,
      metadata,
      automatic_payment_methods: { enabled: true },
      receipt_email: email || undefined,
    });
  } catch {
    throw new ErrorApi("No fue posible crear el PaymentIntent", 502);
  }

  if (!intent.client_secret) {
    throw new ErrorApi("PaymentIntent sin client secret", 502);
  }

  const gatewayPayload = {
    proveedor: "STRIPE",
    stripe: { intentId: intent.id, status: intent.status, amount: intent.amount, currency },
  } as Prisma.InputJsonValue;

  const pago = await prisma.$transaction(async (tx) => {
    const creado = await crearPago(
      {
        pedido: { connect: { id: pedido.id } },
        metodo: EcommerceMetodoPago.STRIPE,
        estado: EcommerceEstadoPago.PENDIENTE,
        monto: payload.amount,
        referencia: intent.id,
        gatewayPayloadJson: gatewayPayload,
      },
      tx
    );

    await registrarNotificacion({
      tipo: "PAGO_STRIPE_CREADO",
      referenciaTabla: "EcommercePago",
      referenciaId: creado.id,
      titulo: "Pago Stripe creado",
      detalle: `Pedido ${pedido.id}. Monto ${payload.amount}.`,
      tx,
    });

    return creado;
  });

  return {
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
    pagoId: pago.id,
  };
};

export const procesarStripeWebhook = async (payload: Buffer, signature?: string) => {
  if (!signature) {
    throw new ErrorApi("Stripe signature requerida", 400);
  }

  const stripe = obtenerStripe();
  const secret = obtenerWebhookSecret();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch {
    throw new ErrorApi("Firma Stripe invalida", 400);
  }

  if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as Stripe.PaymentIntent;
    await actualizarPagoStripeDesdeIntent(intent, event.type);
  }

  return { received: true };
};

export const obtenerEstadoStripeServicio = async (params: {
  pedidoId?: string;
  paymentIntentId?: string;
}) => {
  const paymentIntentId = normalizarTexto(params.paymentIntentId || "") || null;
  const pedidoId = normalizarTexto(params.pedidoId || "") || null;

  const buscarPagoLocal = async () => {
    if (paymentIntentId) {
      const pagoPorReferencia = await buscarPagoPorReferencia(paymentIntentId);
      if (pagoPorReferencia) {
        return pagoPorReferencia;
      }
    }
    if (pedidoId) {
      return buscarPagoStripePorPedido(pedidoId);
    }
    return null;
  };

  if (paymentIntentId) {
    const stripe = obtenerStripe();
    let intent: Stripe.PaymentIntent;
    try {
      intent = await Promise.race<Stripe.PaymentIntent>([
        stripe.paymentIntents.retrieve(paymentIntentId),
        new Promise<Stripe.PaymentIntent>((_resolve, reject) => {
          setTimeout(() => reject(new Error("Stripe timeout")), STRIPE_STATUS_TIMEOUT_MS);
        }),
      ]);
    } catch {
      const pagoLocal = await buscarPagoLocal();
      if (pagoLocal) {
        return construirResumenStripe(pagoLocal);
      }
      throw new ErrorApi("No fue posible consultar el PaymentIntent", 502);
    }

    try {
      return await actualizarPagoStripeDesdeIntent(intent, "status");
    } catch (error) {
      const pagoLocal = await buscarPagoLocal();
      if (pagoLocal) {
        return construirResumenStripe(pagoLocal);
      }
      throw error;
    }
  }

  if (!pedidoId) {
    throw new ErrorApi("pedidoId requerido", 400);
  }

  const pago = await buscarPagoStripePorPedido(pedidoId);
  if (!pago) {
    throw new ErrorApi("Pago ecommerce no encontrado", 404, { pedidoId });
  }

  const stripeData = extraerStripeData(pago.gatewayPayloadJson);
  const intentIdRaw =
    typeof stripeData?.intentId === "string" ? stripeData.intentId : pago.referencia || "";
  const intentId = normalizarTexto(intentIdRaw);
  if (!intentId) {
    return construirResumenStripe(pago);
  }

  const stripe = obtenerStripe();
  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.retrieve(intentId);
  } catch {
    throw new ErrorApi("No fue posible consultar el PaymentIntent", 502);
  }

  return actualizarPagoStripeDesdeIntent(intent, "status");
};
