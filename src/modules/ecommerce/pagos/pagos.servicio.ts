import { Prisma, EcommerceEstadoPago, EcommerceMetodoPago } from "@prisma/client";
import { ErrorApi } from "../../../lib/errores";
import { prisma } from "../../../lib/prisma";
import { normalizarTexto } from "../ecommerce.utilidades";
import { registrarNotificacion } from "../notificaciones/notificaciones.servicio";
import { buscarPedidoPorId, crearPago } from "./pagos.repositorio";

export const crearPagoServicio = async (payload: {
  pedidoId: string;
  metodo: EcommerceMetodoPago;
  monto: number;
  referencia?: string;
  evidenciaUrl?: string;
  gatewayPayloadJson?: unknown;
  estado?: EcommerceEstadoPago;
}) => {
  const pedido = await buscarPedidoPorId(payload.pedidoId);
  if (!pedido) {
    throw new ErrorApi("Pedido no encontrado", 404, { id: payload.pedidoId });
  }

  const estado = payload.estado ?? EcommerceEstadoPago.PENDIENTE;

  const resultado = await prisma.$transaction(async (tx) => {
    const pago = await crearPago(
      {
        pedido: { connect: { id: payload.pedidoId } },
        metodo: payload.metodo,
        estado,
        monto: payload.monto,
        referencia: normalizarTexto(payload.referencia) || undefined,
        evidenciaUrl: normalizarTexto(payload.evidenciaUrl) || undefined,
        gatewayPayloadJson: payload.gatewayPayloadJson as Prisma.InputJsonValue | undefined,
      },
      tx
    );

    const tipo =
      estado === EcommerceEstadoPago.CONFIRMADO
        ? "PAGO_CONFIRMADO"
        : estado === EcommerceEstadoPago.RECHAZADO
          ? "PAGO_RECHAZADO"
          : "PAGO_REGISTRADO";

    await registrarNotificacion({
      tipo,
      referenciaTabla: "EcommercePago",
      referenciaId: pago.id,
      titulo: "Pago ecommerce",
      detalle: `Pedido ${payload.pedidoId}. Monto ${payload.monto}. Estado ${estado}.`,
      tx,
    });

    return pago;
  });

  return resultado;
};
