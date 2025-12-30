"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.obtenerEstadoTransbankServicio = exports.confirmarTransbankPagoServicio = exports.crearTransbankPagoServicio = void 0;
const client_1 = require("@prisma/client");
const transbank_sdk_1 = require("transbank-sdk");
const errores_1 = require("../../../lib/errores");
const prisma_1 = require("../../../lib/prisma");
const ecommerce_utilidades_1 = require("../ecommerce.utilidades");
const notificaciones_servicio_1 = require("../notificaciones/notificaciones.servicio");
const pagos_repositorio_1 = require("./pagos.repositorio");
const esProduccion = () => {
    const valor = (0, ecommerce_utilidades_1.normalizarTexto)(process.env.TRANSBANK_ENV).toLowerCase();
    return valor === "production" || valor === "produccion";
};
const enmascararToken = (token) => {
    if (!token) {
        return "";
    }
    if (token.length <= 8) {
        return `${token.slice(0, 2)}****`;
    }
    return `${token.slice(0, 4)}****${token.slice(-4)}`;
};
const logTransbank = (mensaje, datos) => {
    console.log(`[Transbank] ${mensaje}`, datos);
};
const obtenerClienteTransbank = () => {
    if (esProduccion()) {
        const comercio = (0, ecommerce_utilidades_1.normalizarTexto)(process.env.TRANSBANK_COMMERCE_CODE);
        const apiKey = (0, ecommerce_utilidades_1.normalizarTexto)(process.env.TRANSBANK_API_KEY);
        if (!comercio || !apiKey) {
            throw new errores_1.ErrorApi("TRANSBANK_COMMERCE_CODE/TRANSBANK_API_KEY requeridos", 500);
        }
        return transbank_sdk_1.WebpayPlus.Transaction.buildForProduction(comercio, apiKey);
    }
    return transbank_sdk_1.WebpayPlus.Transaction.buildForIntegration(transbank_sdk_1.IntegrationCommerceCodes.WEBPAY_PLUS, transbank_sdk_1.IntegrationApiKeys.WEBPAY);
};
const resolverReturnUrl = (override) => {
    const desdePayload = (0, ecommerce_utilidades_1.normalizarTexto)(override);
    if (desdePayload) {
        return desdePayload;
    }
    const desdeEnv = (0, ecommerce_utilidades_1.normalizarTexto)(process.env.TRANSBANK_RETURN_URL);
    if (!desdeEnv) {
        throw new errores_1.ErrorApi("TRANSBANK_RETURN_URL requerido", 500);
    }
    return desdeEnv;
};
const limitarLargo = (valor, max) => (valor.length <= max ? valor : valor.slice(0, max));
const crearBuyOrder = (codigo, pedidoId) => {
    const base = (0, ecommerce_utilidades_1.normalizarTexto)(codigo) || pedidoId;
    const raw = `${base}-${Date.now()}`;
    return limitarLargo(raw, 26);
};
const crearSessionId = (pedidoId) => limitarLargo(`pedido-${pedidoId}-${Date.now()}`, 61);
const fusionarPayload = (actual, extra) => {
    if (actual && typeof actual === "object" && !Array.isArray(actual)) {
        return { ...actual, ...extra };
    }
    return extra;
};
// Crea una transaccion en Transbank y registra el pago en EcommercePago.
const crearTransbankPagoServicio = async (payload) => {
    const pedido = await (0, pagos_repositorio_1.buscarPedidoParaPago)(payload.pedidoId);
    if (!pedido) {
        throw new errores_1.ErrorApi("Pedido no encontrado", 404, { id: payload.pedidoId });
    }
    if (pedido.estado !== client_1.EcommerceEstadoPedido.CREADO) {
        throw new errores_1.ErrorApi("Pedido no esta disponible para pago", 409, { estado: pedido.estado });
    }
    if (pedido.total <= 0) {
        throw new errores_1.ErrorApi("Monto de pedido invalido", 409, { total: pedido.total });
    }
    logTransbank("init", { pedidoId: pedido.id, total: pedido.total });
    const returnUrl = resolverReturnUrl(payload.returnUrl);
    const buyOrder = crearBuyOrder(pedido.codigo, pedido.id);
    const sessionId = crearSessionId(pedido.id);
    const cliente = obtenerClienteTransbank();
    let respuesta;
    try {
        respuesta = (await cliente.create(buyOrder, sessionId, pedido.total, returnUrl));
    }
    catch (error) {
        logTransbank("create_error", { pedidoId: pedido.id, error });
        throw new errores_1.ErrorApi("No fue posible crear la transaccion Transbank", 502, { error });
    }
    if (!respuesta?.token || !respuesta?.url) {
        throw new errores_1.ErrorApi("Respuesta Transbank invalida", 502, { respuesta });
    }
    logTransbank("create_ok", {
        pedidoId: pedido.id,
        buyOrder,
        token: enmascararToken(respuesta.token),
    });
    const gatewayPayload = {
        create: {
            buyOrder,
            sessionId,
            returnUrl,
            response: respuesta,
        },
    };
    const pago = await (0, pagos_repositorio_1.crearPago)({
        pedido: { connect: { id: pedido.id } },
        metodo: client_1.EcommerceMetodoPago.TRANSBANK,
        estado: client_1.EcommerceEstadoPago.PENDIENTE,
        monto: pedido.total,
        referencia: respuesta.token,
        gatewayPayloadJson: gatewayPayload,
    });
    await (0, notificaciones_servicio_1.registrarNotificacion)({
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
exports.crearTransbankPagoServicio = crearTransbankPagoServicio;
// Confirma una transaccion Transbank y actualiza EcommercePago/Pedido.
const confirmarTransbankPagoServicio = async (token) => {
    const pago = await (0, pagos_repositorio_1.buscarPagoPorReferencia)(token);
    if (!pago) {
        throw new errores_1.ErrorApi("Pago no encontrado", 404, { token: enmascararToken(token) });
    }
    logTransbank("commit_inicio", {
        pagoId: pago.id,
        pedidoId: pago.pedidoId,
        token: enmascararToken(token),
    });
    if (pago.metodo !== client_1.EcommerceMetodoPago.TRANSBANK) {
        throw new errores_1.ErrorApi("Pago no corresponde a Transbank", 409, { id: pago.id });
    }
    if (pago.estado === client_1.EcommerceEstadoPago.CONFIRMADO) {
        throw new errores_1.ErrorApi("Pago ya confirmado", 409, { id: pago.id });
    }
    if (pago.estado === client_1.EcommerceEstadoPago.RECHAZADO) {
        throw new errores_1.ErrorApi("Pago ya rechazado", 409, { id: pago.id });
    }
    const cliente = obtenerClienteTransbank();
    let respuesta;
    try {
        respuesta = (await cliente.commit(token));
    }
    catch (error) {
        logTransbank("commit_error", {
            pagoId: pago.id,
            pedidoId: pago.pedidoId,
            token: enmascararToken(token),
            error,
        });
        throw new errores_1.ErrorApi("No fue posible confirmar la transaccion Transbank", 502, { error });
    }
    const status = String(respuesta?.status ?? "");
    const aprobado = status === "AUTHORIZED";
    const nuevoEstado = aprobado ? client_1.EcommerceEstadoPago.CONFIRMADO : client_1.EcommerceEstadoPago.RECHAZADO;
    const gatewayPayload = fusionarPayload(pago.gatewayPayloadJson, { commit: respuesta });
    const actualizado = await prisma_1.prisma.$transaction(async (tx) => {
        const pagoActualizado = await (0, pagos_repositorio_1.actualizarPagoDatos)(pago.id, {
            estado: nuevoEstado,
            gatewayPayloadJson: gatewayPayload,
        }, tx);
        if (aprobado) {
            await (0, pagos_repositorio_1.actualizarPedidoEstado)(pago.pedidoId, client_1.EcommerceEstadoPedido.PAGADO, tx);
        }
        await (0, notificaciones_servicio_1.registrarNotificacion)({
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
exports.confirmarTransbankPagoServicio = confirmarTransbankPagoServicio;
// Obtiene el estado remoto de una transaccion Transbank.
const obtenerEstadoTransbankServicio = async (token) => {
    const cliente = obtenerClienteTransbank();
    logTransbank("status_inicio", { token: enmascararToken(token) });
    try {
        return (await cliente.status(token));
    }
    catch (error) {
        logTransbank("status_error", { token: enmascararToken(token), error });
        throw new errores_1.ErrorApi("No fue posible consultar estado Transbank", 502, { error });
    }
};
exports.obtenerEstadoTransbankServicio = obtenerEstadoTransbankServicio;
