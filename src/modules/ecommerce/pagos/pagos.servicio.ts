import { EcommerceEstadoPago, EcommerceEstadoPedido, EcommerceMetodoPago, Prisma } from "@prisma/client";
import { ErrorApi } from "../../../lib/errores";
import { prisma } from "../../../lib/prisma";
import { normalizarTexto } from "../ecommerce.utilidades";
import { registrarNotificacion } from "../notificaciones/notificaciones.servicio";
import {
  actualizarPagoEstado,
  actualizarPedidoEstado,
  buscarPagoPorId,
  buscarPedidoPorId,
  crearPago,
} from "./pagos.repositorio";

// Crea un pago PENDIENTE asociado a un pedido.
export const crearPagoServicio = async (payload: {
  pedidoId: string;
  metodo: EcommerceMetodoPago;
  monto: number;
  referencia?: string;
  evidenciaUrl?: string;
  gatewayPayloadJson?: unknown;
}) => {
  const pedido = await buscarPedidoPorId(payload.pedidoId);
  if (!pedido) {
    throw new ErrorApi("Pedido no encontrado", 404, { id: payload.pedidoId });
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const pago = await crearPago(
      {
        pedido: { connect: { id: payload.pedidoId } },
        metodo: payload.metodo,
        estado: EcommerceEstadoPago.PENDIENTE,
        monto: payload.monto,
        referencia: normalizarTexto(payload.referencia) || undefined,
        evidenciaUrl: normalizarTexto(payload.evidenciaUrl) || undefined,
        gatewayPayloadJson: payload.gatewayPayloadJson as Prisma.InputJsonValue | undefined,
      },
      tx
    );

    await registrarNotificacion({
      tipo: "PAGO_REGISTRADO",
      referenciaTabla: "EcommercePago",
      referenciaId: pago.id,
      titulo: "Pago ecommerce",
      detalle: `Pedido ${payload.pedidoId}. Monto ${payload.monto}. Estado ${pago.estado}.`,
      tx,
    });

    return pago;
  });

  return resultado;
};

// Confirma un pago y actualiza el pedido a PAGADO.
export const confirmarPagoServicio = async (pagoId: string) => {
  const resultado = await prisma.$transaction(async (tx) => {
    const pago = await buscarPagoPorId(pagoId, tx);
    if (!pago) {
      throw new ErrorApi("Pago no encontrado", 404, { id: pagoId });
    }

    if (pago.estado === EcommerceEstadoPago.CONFIRMADO) {
      throw new ErrorApi("Pago ya confirmado", 409, { id: pagoId });
    }

    if (pago.estado === EcommerceEstadoPago.RECHAZADO) {
      throw new ErrorApi("Pago ya rechazado", 409, { id: pagoId });
    }

    const actualizado = await actualizarPagoEstado(pagoId, EcommerceEstadoPago.CONFIRMADO, tx);
    await actualizarPedidoEstado(pago.pedidoId, EcommerceEstadoPedido.PAGADO, tx);

    await registrarNotificacion({
      tipo: "PAGO_CONFIRMADO",
      referenciaTabla: "EcommercePago",
      referenciaId: pagoId,
      titulo: "Pago confirmado",
      detalle: `Pedido ${pago.pedidoId}. Monto ${pago.monto}.`,
      tx,
    });

    return actualizado;
  });

  return resultado;
};

// Rechaza un pago pendiente.
export const rechazarPagoServicio = async (pagoId: string) => {
  const resultado = await prisma.$transaction(async (tx) => {
    const pago = await buscarPagoPorId(pagoId, tx);
    if (!pago) {
      throw new ErrorApi("Pago no encontrado", 404, { id: pagoId });
    }

    if (pago.estado === EcommerceEstadoPago.RECHAZADO) {
      throw new ErrorApi("Pago ya rechazado", 409, { id: pagoId });
    }

    if (pago.estado === EcommerceEstadoPago.CONFIRMADO) {
      throw new ErrorApi("Pago ya confirmado", 409, { id: pagoId });
    }

    const actualizado = await actualizarPagoEstado(pagoId, EcommerceEstadoPago.RECHAZADO, tx);

    await registrarNotificacion({
      tipo: "PAGO_RECHAZADO",
      referenciaTabla: "EcommercePago",
      referenciaId: pagoId,
      titulo: "Pago rechazado",
      detalle: `Pedido ${pago.pedidoId}. Monto ${pago.monto}.`,
      tx,
    });

    return actualizado;
  });

  return resultado;
};