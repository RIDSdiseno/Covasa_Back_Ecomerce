import { EcommerceEstadoPago, EcommerceEstadoPedido, EcommerceMetodoPago, Prisma } from "@prisma/client";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { ErrorApi } from "../../../lib/errores";
import { prisma } from "../../../lib/prisma";
import { normalizarTexto } from "../ecommerce.utilidades";
import { registrarNotificacion } from "../notificaciones/notificaciones.servicio";
import { buscarPedidoParaMercadoPago, crearPago } from "./pagos.repositorio";

type PreferenceItem = {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  currency_id: string;
};

const obtenerAccessToken = () => {
  const token = normalizarTexto(process.env.MERCADOPAGO_ACCESS_TOKEN);
  if (!token) {
    throw new ErrorApi("MERCADOPAGO_ACCESS_TOKEN requerido", 500);
  }
  return token;
};

const obtenerFrontUrlBase = () => {
  const desdeEnv = normalizarTexto(process.env.ECOMMERCE_FRONT_URL);
  return desdeEnv || "http://localhost:5173";
};

const construirBackUrls = () => {
  const base = obtenerFrontUrlBase();
  const success = new URL("/pago/mercadopago", base).toString();
  const pending = new URL("/pago/mercadopago", base).toString();
  const failure = new URL("/pago/mercadopago", base).toString();

  return { success, pending, failure };
};

const construirItems = (items: Array<{ productoId: string; descripcionSnapshot: string; cantidad: number; totalSnapshot: number; }>): PreferenceItem[] => {
  return items.map((item) => {
    if (item.cantidad <= 0) {
      throw new ErrorApi("Cantidad invalida en pedido", 409, { productoId: item.productoId });
    }

    const precioUnitario = item.totalSnapshot / item.cantidad;
    const unitPrice = Number(precioUnitario.toFixed(2));

    return {
      id: item.productoId,
      title: item.descripcionSnapshot || "Producto",
      quantity: item.cantidad,
      unit_price: unitPrice,
      currency_id: "CLP",
    };
  });
};

// Crea preferencia Mercado Pago y registra el pago pendiente.
export const crearMercadoPagoServicio = async (payload: { pedidoId: string }) => {
  const pedido = await buscarPedidoParaMercadoPago(payload.pedidoId);
  if (!pedido) {
    throw new ErrorApi("Pedido no encontrado", 404, { id: payload.pedidoId });
  }

  if (pedido.estado !== EcommerceEstadoPedido.CREADO) {
    throw new ErrorApi("Pedido no esta disponible para pago", 409, { estado: pedido.estado });
  }

  if (pedido.total <= 0) {
    throw new ErrorApi("Monto de pedido invalido", 409, { total: pedido.total });
  }

  if (pedido.items.length === 0) {
    throw new ErrorApi("Pedido sin items", 409, { id: pedido.id });
  }

  const cliente = new MercadoPagoConfig({ accessToken: obtenerAccessToken() });
  const preference = new Preference(cliente);

  let respuesta;
  try {
    respuesta = await preference.create({
      body: {
        items: construirItems(pedido.items),
        back_urls: construirBackUrls(),
        auto_return: "approved",
        external_reference: pedido.codigo || pedido.id,
        payer: pedido.despachoEmail ? { email: pedido.despachoEmail } : undefined,
      },
    });
  } catch (error) {
    throw new ErrorApi("No fue posible crear preferencia Mercado Pago", 502);
  }

  const preferenceId = normalizarTexto(respuesta?.id);
  const initPoint = normalizarTexto(respuesta?.init_point || respuesta?.sandbox_init_point);
  if (!preferenceId || !initPoint) {
    throw new ErrorApi("Respuesta Mercado Pago invalida", 502);
  }

  const preferencePayload = JSON.parse(JSON.stringify(respuesta)) as Prisma.InputJsonValue;
  const gatewayPayload = {
    proveedor: "MERCADOPAGO",
    preference: preferencePayload,
  } as Prisma.InputJsonValue;

  const pago = await prisma.$transaction(async (tx) => {
    const creado = await crearPago(
      {
        pedido: { connect: { id: pedido.id } },
        metodo: EcommerceMetodoPago.OTRO,
        estado: EcommerceEstadoPago.PENDIENTE,
        monto: pedido.total,
        referencia: preferenceId,
        gatewayPayloadJson: gatewayPayload as Prisma.InputJsonValue,
      },
      tx
    );

    await registrarNotificacion({
      tipo: "PAGO_MERCADOPAGO_CREADO",
      referenciaTabla: "EcommercePago",
      referenciaId: creado.id,
      titulo: "Pago Mercado Pago creado",
      detalle: `Pedido ${pedido.id}. Monto ${pedido.total}.`,
      tx,
    });

    return creado;
  });

  return {
    pagoId: pago.id,
    preferenceId,
    initPoint,
    redirectUrl: initPoint,
  };
};

