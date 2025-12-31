"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.obtenerPagoReciboServicio = exports.rechazarPagoServicio = exports.confirmarPagoServicio = exports.crearPagoServicio = void 0;
const client_1 = require("@prisma/client");
const errores_1 = require("../../../lib/errores");
const prisma_1 = require("../../../lib/prisma");
const ecommerce_utilidades_1 = require("../ecommerce.utilidades");
const notificaciones_servicio_1 = require("../notificaciones/notificaciones.servicio");
const pagos_repositorio_1 = require("./pagos.repositorio");
// Crea un pago PENDIENTE asociado a un pedido.
const crearPagoServicio = async (payload) => {
    const pedido = await (0, pagos_repositorio_1.buscarPedidoPorId)(payload.pedidoId);
    if (!pedido) {
        throw new errores_1.ErrorApi("Pedido no encontrado", 404, { id: payload.pedidoId });
    }
    const resultado = await prisma_1.prisma.$transaction(async (tx) => {
        const pago = await (0, pagos_repositorio_1.crearPago)({
            pedido: { connect: { id: payload.pedidoId } },
            metodo: payload.metodo,
            estado: client_1.EcommerceEstadoPago.PENDIENTE,
            monto: payload.monto,
            referencia: (0, ecommerce_utilidades_1.normalizarTexto)(payload.referencia) || undefined,
            evidenciaUrl: (0, ecommerce_utilidades_1.normalizarTexto)(payload.evidenciaUrl) || undefined,
            gatewayPayloadJson: payload.gatewayPayloadJson,
        }, tx);
        await (0, notificaciones_servicio_1.registrarNotificacion)({
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
exports.crearPagoServicio = crearPagoServicio;
// Confirma un pago y actualiza el pedido a PAGADO.
const confirmarPagoServicio = async (pagoId) => {
    const resultado = await prisma_1.prisma.$transaction(async (tx) => {
        const pago = await (0, pagos_repositorio_1.buscarPagoPorId)(pagoId, tx);
        if (!pago) {
            throw new errores_1.ErrorApi("Pago no encontrado", 404, { id: pagoId });
        }
        if (pago.estado === client_1.EcommerceEstadoPago.CONFIRMADO) {
            throw new errores_1.ErrorApi("Pago ya confirmado", 409, { id: pagoId });
        }
        if (pago.estado === client_1.EcommerceEstadoPago.RECHAZADO) {
            throw new errores_1.ErrorApi("Pago ya rechazado", 409, { id: pagoId });
        }
        const actualizado = await (0, pagos_repositorio_1.actualizarPagoEstado)(pagoId, client_1.EcommerceEstadoPago.CONFIRMADO, tx);
        await (0, pagos_repositorio_1.actualizarPedidoEstado)(pago.pedidoId, client_1.EcommerceEstadoPedido.PAGADO, tx);
        await (0, notificaciones_servicio_1.registrarNotificacion)({
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
exports.confirmarPagoServicio = confirmarPagoServicio;
// Rechaza un pago pendiente.
const rechazarPagoServicio = async (pagoId) => {
    const resultado = await prisma_1.prisma.$transaction(async (tx) => {
        const pago = await (0, pagos_repositorio_1.buscarPagoPorId)(pagoId, tx);
        if (!pago) {
            throw new errores_1.ErrorApi("Pago no encontrado", 404, { id: pagoId });
        }
        if (pago.estado === client_1.EcommerceEstadoPago.RECHAZADO) {
            throw new errores_1.ErrorApi("Pago ya rechazado", 409, { id: pagoId });
        }
        if (pago.estado === client_1.EcommerceEstadoPago.CONFIRMADO) {
            throw new errores_1.ErrorApi("Pago ya confirmado", 409, { id: pagoId });
        }
        const actualizado = await (0, pagos_repositorio_1.actualizarPagoEstado)(pagoId, client_1.EcommerceEstadoPago.RECHAZADO, tx);
        await (0, notificaciones_servicio_1.registrarNotificacion)({
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
exports.rechazarPagoServicio = rechazarPagoServicio;
const enmascararTarjeta = (valor) => {
    if (!valor) {
        return undefined;
    }
    const limpio = String(valor);
    if (limpio.length <= 4) {
        return limpio;
    }
    return `****${limpio.slice(-4)}`;
};
const extraerDatosTransbank = (payload) => {
    if (!payload || typeof payload !== "object") {
        return null;
    }
    const commit = payload.commit;
    if (!commit || typeof commit !== "object") {
        return null;
    }
    const cardDetail = commit.card_detail || {};
    return {
        buyOrder: String(commit.buy_order ?? ""),
        authorizationCode: String(commit.authorization_code ?? ""),
        paymentTypeCode: String(commit.payment_type_code ?? ""),
        installmentsNumber: commit.installments_number ?? null,
        cardNumber: enmascararTarjeta(cardDetail.card_number),
        transactionDate: commit.transaction_date ?? null,
    };
};
// Obtiene un pago con datos para boleta/recibo (sin token).
const obtenerPagoReciboServicio = async (pagoId) => {
    const pago = await (0, pagos_repositorio_1.obtenerPagoParaRecibo)(pagoId);
    if (!pago) {
        throw new errores_1.ErrorApi("Pago no encontrado", 404, { id: pagoId });
    }
    const transbank = pago.metodo === client_1.EcommerceMetodoPago.TRANSBANK ? extraerDatosTransbank(pago.gatewayPayloadJson) : null;
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
                direccion: (0, ecommerce_utilidades_1.construirDireccionLinea)(pago.pedido.direccion.calle, pago.pedido.direccion.numero, pago.pedido.direccion.depto),
                comuna: pago.pedido.direccion.comuna,
                ciudad: pago.pedido.direccion.ciudad,
                region: pago.pedido.direccion.region,
                notas: pago.pedido.direccion.notas,
            }
            : null,
        transbank,
    };
};
exports.obtenerPagoReciboServicio = obtenerPagoReciboServicio;
