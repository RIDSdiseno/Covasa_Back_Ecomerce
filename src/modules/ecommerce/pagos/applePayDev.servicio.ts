import Stripe from "stripe";
import { EcommerceEstadoPago, EcommerceEstadoPedido, EcommerceMetodoPago, Prisma } from "@prisma/client";
import { ErrorApi } from "../../../lib/errores";
import { normalizarTexto } from "../ecommerce.utilidades";
import { buscarUsuarioPorId } from "../usuarios/usuarios.repositorio";
import { buscarPedidoParaPago, crearPago } from "./pagos.repositorio";

type StripeConfig = {
  secretKey: string;
};

const normalizarFlag = (value?: string) => normalizarTexto(value).toLowerCase();
const limpiarClaveStripe = (value?: string) => normalizarTexto(value).replace(/^['"]|['"]$/g, "");
const applePayDevHabilitado = () => {
  const flag = normalizarFlag(process.env.APPLEPAY_DEV_ENABLED);
  return process.env.NODE_ENV !== "production" && (flag === "true" || flag === "1" || flag === "yes");
};

let stripeCliente: Stripe | null = null;

const obtenerConfigStripe = (): StripeConfig => {
  if (!applePayDevHabilitado()) {
    throw new ErrorApi("Apple Pay DEV no disponible", 404);
  }

  const secretKey = limpiarClaveStripe(
    process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY
  );
  if (!secretKey) {
    throw new ErrorApi("STRIPE_SECRET_KEY_TEST requerido", 500);
  }
  if (!secretKey.startsWith("sk_test_")) {
    throw new ErrorApi("STRIPE_SECRET_KEY_TEST debe ser una llave test", 500);
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

const normalizarMoneda = (valor?: string) => {
  const moneda = normalizarTexto(valor || "clp").toLowerCase();
  return moneda || "clp";
};

export const crearApplePayDevIntentServicio = async (payload: { orderId: string; usuarioId: string }) => {
  const pedido = await buscarPedidoParaPago(payload.orderId);
  if (!pedido) {
    throw new ErrorApi("Pedido no encontrado", 404, { id: payload.orderId });
  }

  if (pedido.estado !== EcommerceEstadoPedido.CREADO) {
    throw new ErrorApi("Pedido no esta disponible para pago", 409, { estado: pedido.estado });
  }

  if (pedido.total <= 0) {
    throw new ErrorApi("Monto de pedido invalido", 409, { total: pedido.total });
  }

  const usuario = await buscarUsuarioPorId(payload.usuarioId);
  if (!usuario) {
    throw new ErrorApi("Usuario no encontrado", 401, { id: payload.usuarioId });
  }

  const ecommerceClienteId = usuario.cliente?.id ?? null;
  if (pedido.ecommerceClienteId && ecommerceClienteId && pedido.ecommerceClienteId !== ecommerceClienteId) {
    throw new ErrorApi("Pedido no pertenece al cliente", 403, { pedidoId: pedido.id });
  }

  const stripe = obtenerStripe();
  const descripcion = normalizarTexto(pedido.codigo) ? `Pedido ${pedido.codigo}` : `Pedido ${pedido.id}`;

  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create({
      amount: pedido.total,
      currency: normalizarMoneda(process.env.ECOMMERCE_CURRENCY || "clp"),
      description: descripcion,
      metadata: { pedidoId: pedido.id, codigo: pedido.codigo },
      payment_method_types: ["card"],
    });
  } catch {
    throw new ErrorApi("No fue posible crear el PaymentIntent", 502);
  }

  if (!intent.client_secret) {
    throw new ErrorApi("PaymentIntent sin client secret", 502);
  }

  await crearPago({
    pedido: { connect: { id: pedido.id } },
    metodo: EcommerceMetodoPago.APPLEPAY_DEV,
    estado: EcommerceEstadoPago.PENDIENTE,
    monto: pedido.total,
    referencia: intent.id,
    gatewayPayloadJson: { stripe: { intentId: intent.id, status: intent.status } } as Prisma.InputJsonValue,
  });

  return { clientSecret: intent.client_secret };
};
