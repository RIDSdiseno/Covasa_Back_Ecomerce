import { EcommerceMetodoPago } from "@prisma/client";
import { ErrorApi } from "../../../lib/errores";

export const SUPPORTED_PAYMENT_METHODS = [
  EcommerceMetodoPago.TRANSBANK,
  EcommerceMetodoPago.APPLE_PAY,
  EcommerceMetodoPago.STRIPE,
  EcommerceMetodoPago.TRANSFERENCIA,
  EcommerceMetodoPago.OTRO,
  EcommerceMetodoPago.APPLEPAY_DEV,
] as const;

const SUPPORTED_PAYMENT_METHOD_SET = new Set<EcommerceMetodoPago>(SUPPORTED_PAYMENT_METHODS);

const normalizarMetodoPago = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toUpperCase();
};

const crearErrorMetodoNoSoportado = (method: string, source: "body" | "query") =>
  new ErrorApi(
    "Metodo de pago no soportado",
    400,
    {
      source,
      metodoRecibido: method || null,
      metodosSoportados: SUPPORTED_PAYMENT_METHODS,
    },
    "UNSUPPORTED_PAYMENT_METHOD"
  );

export const parseMetodoPagoSoportado = (
  value: unknown,
  source: "body" | "query"
): EcommerceMetodoPago => {
  const method = normalizarMetodoPago(value);
  if (!SUPPORTED_PAYMENT_METHOD_SET.has(method as EcommerceMetodoPago)) {
    throw crearErrorMetodoNoSoportado(method, source);
  }
  return method as EcommerceMetodoPago;
};

export const parseMetodoPagoSoportadoOpcional = (
  value: unknown,
  source: "body" | "query"
): EcommerceMetodoPago | undefined => {
  const method = normalizarMetodoPago(value);
  if (!method) {
    return undefined;
  }
  if (!SUPPORTED_PAYMENT_METHOD_SET.has(method as EcommerceMetodoPago)) {
    throw crearErrorMetodoNoSoportado(method, source);
  }
  return method as EcommerceMetodoPago;
};
