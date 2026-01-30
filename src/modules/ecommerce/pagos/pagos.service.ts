import { EcommerceEstadoPago, EcommerceEstadoPedido, EcommerceMetodoPago, Prisma } from "@prisma/client";
import PDFDocument from "pdfkit";
import { ErrorApi } from "../../../lib/errores";
import { prisma } from "../../../lib/prisma";
import { logger } from "../../../lib/logger";
import { construirDireccionLinea, normalizarTexto } from "../common/ecommerce.utils";
import { registrarNotificacion } from "../notificaciones/notificaciones.service";
import {
  actualizarPagoEstado,
  actualizarPedidoEstado,
  buscarPagoPorId,
  buscarPedidoPorId,
  crearPago,
  listarPagosPorUsuario,
  listarPagosParaIntegracion,
  obtenerPagoDetallePorUsuario,
  obtenerPagoParaRecibo,
} from "./pagos.repo";
import { buscarUsuarioPorId } from "../usuarios/usuarios.repo";
import { notificarPagoConfirmadoCRM } from "./crm-notificacion";

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

  logger.info("pago_creado", {
    pagoId: resultado.id,
    pedidoId: payload.pedidoId,
    metodo: payload.metodo,
    monto: payload.monto,
    estado: resultado.estado,
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

  logger.info("pago_confirmado", {
    pagoId: resultado.id,
    pedidoId: resultado.pedidoId,
    estado: resultado.estado,
  });

  // Notificar al CRM para descontar inventario (async, no bloquea el flujo del pago)
  // IMPORTANTE: El pago ya está confirmado, no rechazamos la transacción si el CRM falla
  notificarPagoConfirmadoCRM(resultado.pedidoId, resultado.id).catch((error) => {
    logger.error("[PAGO_CONFIRMADO] ⚠️ Falló notificación al CRM (el pago SÍ fue confirmado)", {
      pagoId: resultado.id,
      pedidoId: resultado.pedidoId,
      error: error instanceof Error ? error.message : String(error),
      accion: "REQUIERE_REVISION_MANUAL - Verificar que el stock fue descontado en CRM",
    });
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

  logger.info("pago_rechazado", {
    pagoId: resultado.id,
    pedidoId: resultado.pedidoId,
    estado: resultado.estado,
  });

  return resultado;
};

const enmascararTarjeta = (valor?: string | null) => {
  if (!valor) {
    return undefined;
  }
  const limpio = String(valor);
  if (limpio.length <= 4) {
    return limpio;
  }
  return `****${limpio.slice(-4)}`;
};

const extraerDatosTransbank = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const commit = (payload as { commit?: Record<string, unknown> }).commit;
  if (!commit || typeof commit !== "object") {
    return null;
  }

  const cardDetail = (commit as { card_detail?: Record<string, unknown> }).card_detail || {};

  return {
    buyOrder: String((commit as { buy_order?: string }).buy_order ?? ""),
    authorizationCode: String((commit as { authorization_code?: string }).authorization_code ?? ""),
    paymentTypeCode: String((commit as { payment_type_code?: string }).payment_type_code ?? ""),
    installmentsNumber: (commit as { installments_number?: number }).installments_number ?? null,
    cardNumber: enmascararTarjeta((cardDetail as { card_number?: string }).card_number),
    transactionDate: (commit as { transaction_date?: string }).transaction_date ?? null,
  };
};

const extraerStripePayload = (payload: unknown) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const stripe = (payload as { stripe?: Record<string, unknown> }).stripe;
  if (!stripe || typeof stripe !== "object" || Array.isArray(stripe)) {
    return null;
  }
  return stripe;
};

const extraerMonedaPago = (payload: unknown) => {
  const stripe = extraerStripePayload(payload);
  if (!stripe) {
    return null;
  }
  const currency = stripe.currency;
  return typeof currency === "string" ? currency : null;
};

const construirProveedorPago = (pago: {
  metodo: EcommerceMetodoPago;
  referencia?: string | null;
  gatewayPayloadJson?: unknown;
}) => {
  const stripe = extraerStripePayload(pago.gatewayPayloadJson);
  const referenciaStripe = typeof stripe?.intentId === "string" ? stripe.intentId : null;
  const referencia = normalizarTexto(pago.referencia || "") || referenciaStripe || null;
  const transbank =
    pago.metodo === EcommerceMetodoPago.TRANSBANK ? extraerDatosTransbank(pago.gatewayPayloadJson) : null;

  return {
    metodo: pago.metodo,
    referencia,
    transbank,
  };
};

const formatCurrency = (value: number) => `CLP ${value.toLocaleString("es-CL")}`;

const formatDateIso = (value: Date | string | null | undefined) => {
  if (!value) {
    return "";
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString();
};

export const listarPagosIntegracionServicio = async (params: {
  since?: Date;
  estado?: EcommerceEstadoPago;
  limit: number;
}) => {
  const pagos = await listarPagosParaIntegracion(params);

  return pagos.map((pago) => ({
    pago: {
      id: pago.id,
      pedidoId: pago.pedidoId,
      metodo: pago.metodo,
      estado: pago.estado,
      monto: pago.monto,
      referencia: pago.referencia,
      createdAt: pago.createdAt,
      updatedAt: pago.updatedAt,
    },
    pedido: pago.pedido
      ? {
          id: pago.pedido.id,
          correlativo: pago.pedido.correlativo,
          codigo: pago.pedido.codigo,
          ecommerceClienteId: pago.pedido.ecommerceClienteId,
          clienteId: pago.pedido.clienteId,
          despachoNombre: pago.pedido.despachoNombre,
          despachoTelefono: pago.pedido.despachoTelefono,
          despachoEmail: pago.pedido.despachoEmail,
          despachoDireccion: pago.pedido.despachoDireccion,
          despachoComuna: pago.pedido.despachoComuna,
          despachoCiudad: pago.pedido.despachoCiudad,
          despachoRegion: pago.pedido.despachoRegion,
          subtotalNeto: pago.pedido.subtotalNeto,
          iva: pago.pedido.iva,
          total: pago.pedido.total,
          estado: pago.pedido.estado,
          createdAt: pago.pedido.createdAt,
          updatedAt: pago.pedido.updatedAt,
          crmCotizacionId: pago.pedido.crmCotizacionId,
          vendedorId: pago.pedido.crmCotizacion?.vendedorId ?? null,
        }
      : null,
  }));
};

// Obtiene un pago con datos para boleta/recibo (sin token).
export const obtenerPagoReciboServicio = async (pagoId: string) => {
  const pago = await obtenerPagoParaRecibo(pagoId);
  if (!pago) {
    throw new ErrorApi("Pago no encontrado", 404, { id: pagoId });
  }

  const transbank =
    pago.metodo === EcommerceMetodoPago.TRANSBANK ? extraerDatosTransbank(pago.gatewayPayloadJson) : null;

  return {
    pagoId: pago.id,
    metodo: pago.metodo,
    estado: pago.estado,
    monto: pago.monto,
    createdAt: pago.createdAt,
    pedido: {
      id: pago.pedido.id,
      codigo: pago.pedido.codigo,
      total: pago.pedido.total,
      estado: pago.pedido.estado,
      createdAt: pago.pedido.createdAt,
    },
    direccion: pago.pedido.direccion
      ? {
          nombreContacto: pago.pedido.direccion.nombreRecibe,
          telefono: pago.pedido.direccion.telefonoRecibe,
          email: pago.pedido.direccion.email,
          direccion: construirDireccionLinea(
            pago.pedido.direccion.calle,
            pago.pedido.direccion.numero,
            pago.pedido.direccion.depto
          ),
          comuna: pago.pedido.direccion.comuna,
          ciudad: pago.pedido.direccion.ciudad,
          region: pago.pedido.direccion.region,
          notas: pago.pedido.direccion.notas,
        }
      : null,
    transbank,
  };
};

const resolverUsuarioPago = async (usuarioId: string) => {
  const usuario = await buscarUsuarioPorId(usuarioId);
  if (!usuario) {
    throw new ErrorApi("Usuario no encontrado", 404, { id: usuarioId });
  }

  const email = normalizarTexto(usuario.email ?? "");
  return { usuarioId: usuario.id, email };
};

export const listarMisPagosServicio = async (usuarioId: string) => {
  const { email } = await resolverUsuarioPago(usuarioId);
  const pagos = await listarPagosPorUsuario(usuarioId, email || undefined);

  return pagos.map((pago) => {
    const moneda = extraerMonedaPago(pago.gatewayPayloadJson);

    return {
      pagoId: pago.id,
      metodo: pago.metodo,
      estado: pago.estado,
      monto: pago.monto,
      moneda,
      createdAt: pago.createdAt,
      updatedAt: pago.updatedAt,
      pedido: pago.pedido
        ? {
            id: pago.pedido.id,
            codigo: pago.pedido.codigo,
            total: pago.pedido.total,
            estado: pago.pedido.estado,
            createdAt: pago.pedido.createdAt,
          }
        : null,
      cotizacion: null,
      proveedor: construirProveedorPago(pago),
    };
  });
};

export const obtenerPagoDetalleUsuarioServicio = async (usuarioId: string, pagoId: string) => {
  const { email } = await resolverUsuarioPago(usuarioId);
  const pago = await obtenerPagoDetallePorUsuario(pagoId, usuarioId, email || undefined);
  if (!pago) {
    throw new ErrorApi("Pago no encontrado", 404, { id: pagoId });
  }

  const moneda = extraerMonedaPago(pago.gatewayPayloadJson);
  const direccion = pago.pedido.direccion
    ? {
        nombreContacto: pago.pedido.direccion.nombreRecibe,
        telefono: pago.pedido.direccion.telefonoRecibe,
        email: pago.pedido.direccion.email,
        direccion: construirDireccionLinea(
          pago.pedido.direccion.calle,
          pago.pedido.direccion.numero,
          pago.pedido.direccion.depto
        ),
        comuna: pago.pedido.direccion.comuna,
        ciudad: pago.pedido.direccion.ciudad,
        region: pago.pedido.direccion.region,
        notas: pago.pedido.direccion.notas,
      }
    : null;

  return {
    pagoId: pago.id,
    metodo: pago.metodo,
    estado: pago.estado,
    monto: pago.monto,
    moneda,
    createdAt: pago.createdAt,
    updatedAt: pago.updatedAt,
    proveedor: construirProveedorPago(pago),
    pedido: {
      id: pago.pedido.id,
      codigo: pago.pedido.codigo,
      total: pago.pedido.total,
      subtotalNeto: pago.pedido.subtotalNeto,
      iva: pago.pedido.iva,
      estado: pago.pedido.estado,
      createdAt: pago.pedido.createdAt,
      direccion,
      items: pago.pedido.items.map((item) => ({
        descripcionSnapshot: item.descripcionSnapshot,
        cantidad: item.cantidad,
        precioUnitarioNetoSnapshot: item.precioUnitarioNetoSnapshot,
        subtotalNetoSnapshot: item.subtotalNetoSnapshot,
        ivaPctSnapshot: item.ivaPctSnapshot,
        ivaMontoSnapshot: item.ivaMontoSnapshot,
        totalSnapshot: item.totalSnapshot,
      })),
    },
    cotizacion: null,
  };
};

export const generarPagoPdfServicio = async (usuarioId: string, pagoId: string) => {
  const { email } = await resolverUsuarioPago(usuarioId);
  const pago = await obtenerPagoDetallePorUsuario(pagoId, usuarioId, email || undefined);
  if (!pago) {
    throw new ErrorApi("Pago no encontrado", 404, { id: pagoId });
  }

  const moneda = extraerMonedaPago(pago.gatewayPayloadJson);
  const proveedor = construirProveedorPago(pago);
  const nombreCliente = [pago.pedido.ecommerceCliente?.nombres, pago.pedido.ecommerceCliente?.apellidos]
    .filter(Boolean)
    .join(" ");

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (error) => reject(error));

    doc.fontSize(20).text("COVASA", { align: "left" });
    doc.fontSize(12).text("Comprobante de pago");
    doc.moveDown(0.5);

    doc.fontSize(10).text(`Pago ID: ${pago.id}`);
    doc.text(`Pedido: ${pago.pedido.codigo || pago.pedido.id}`);
    doc.text(`Estado pago: ${pago.estado}`);
    doc.text(`Metodo: ${pago.metodo}`);
    if (proveedor.referencia) {
      doc.text(`Referencia: ${proveedor.referencia}`);
    }
    doc.text(`Fecha pago: ${formatDateIso(pago.createdAt)}`);
    doc.text(`Ultima actualizacion: ${formatDateIso(pago.updatedAt)}`);
    doc.moveDown(0.5);

    if (nombreCliente) {
      doc.text(`Cliente: ${nombreCliente}`);
    }
    if (pago.pedido.ecommerceCliente?.emailContacto) {
      doc.text(`Email: ${pago.pedido.ecommerceCliente.emailContacto}`);
    }
    if (pago.pedido.ecommerceCliente?.telefono) {
      doc.text(`Telefono: ${pago.pedido.ecommerceCliente.telefono}`);
    }
    doc.moveDown(0.5);

    if (pago.pedido.direccion) {
      const direccion = construirDireccionLinea(
        pago.pedido.direccion.calle,
        pago.pedido.direccion.numero,
        pago.pedido.direccion.depto
      );
      doc.text("Direccion de despacho:");
      doc.text(`${pago.pedido.direccion.nombreRecibe || ""}`.trim());
      if (direccion) doc.text(direccion);
      if (pago.pedido.direccion.comuna || pago.pedido.direccion.ciudad) {
        doc.text(
          `${pago.pedido.direccion.comuna || ""}${pago.pedido.direccion.ciudad ? `, ${pago.pedido.direccion.ciudad}` : ""}`.trim()
        );
      }
      if (pago.pedido.direccion.region) {
        doc.text(pago.pedido.direccion.region);
      }
      doc.moveDown(0.5);
    }

    doc.fontSize(11).text("Resumen pedido");
    doc.fontSize(10).text(`Subtotal neto: ${formatCurrency(pago.pedido.subtotalNeto)}`);
    doc.text(`IVA: ${formatCurrency(pago.pedido.iva)}`);
    doc.text(`Total: ${formatCurrency(pago.pedido.total)}`);
    if (moneda) {
      doc.text(`Moneda: ${moneda.toUpperCase()}`);
    }
    doc.moveDown(0.5);

    if (pago.pedido.items.length > 0) {
      doc.fontSize(11).text("Items");
      doc.moveDown(0.2);
      pago.pedido.items.forEach((item, index) => {
        doc
          .fontSize(9)
          .text(
            `${index + 1}. ${item.descripcionSnapshot} x${item.cantidad} - ${formatCurrency(item.totalSnapshot)}`
          );
      });
    }

    doc.end();
  });

  return {
    buffer,
    fileName: `recibo-${pago.id}.pdf`,
  };
};
