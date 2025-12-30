"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crearMercadoPagoServicio = void 0;
const client_1 = require("@prisma/client");
const mercadopago_1 = require("mercadopago");
const errores_1 = require("../../../lib/errores");
const prisma_1 = require("../../../lib/prisma");
const ecommerce_utilidades_1 = require("../ecommerce.utilidades");
const notificaciones_servicio_1 = require("../notificaciones/notificaciones.servicio");
const pagos_repositorio_1 = require("./pagos.repositorio");
const obtenerAccessToken = () => {
    const token = (0, ecommerce_utilidades_1.normalizarTexto)(process.env.MERCADOPAGO_ACCESS_TOKEN);
    if (!token) {
        throw new errores_1.ErrorApi("MERCADOPAGO_ACCESS_TOKEN requerido", 500);
    }
    return token;
};
const obtenerFrontUrlBase = () => {
    const desdeEnv = (0, ecommerce_utilidades_1.normalizarTexto)(process.env.ECOMMERCE_FRONT_URL);
    return desdeEnv || "http://localhost:5173";
};
const construirBackUrls = () => {
    const base = obtenerFrontUrlBase();
    const success = new URL("/pago/mercadopago", base).toString();
    const pending = new URL("/pago/mercadopago", base).toString();
    const failure = new URL("/pago/mercadopago", base).toString();
    return { success, pending, failure };
};
const construirItems = (items) => {
    return items.map((item) => {
        if (item.cantidad <= 0) {
            throw new errores_1.ErrorApi("Cantidad invalida en pedido", 409, { productoId: item.productoId });
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
const crearMercadoPagoServicio = async (payload) => {
    const pedido = await (0, pagos_repositorio_1.buscarPedidoParaMercadoPago)(payload.pedidoId);
    if (!pedido) {
        throw new errores_1.ErrorApi("Pedido no encontrado", 404, { id: payload.pedidoId });
    }
    if (pedido.estado !== client_1.EcommerceEstadoPedido.CREADO) {
        throw new errores_1.ErrorApi("Pedido no esta disponible para pago", 409, { estado: pedido.estado });
    }
    if (pedido.total <= 0) {
        throw new errores_1.ErrorApi("Monto de pedido invalido", 409, { total: pedido.total });
    }
    if (pedido.items.length === 0) {
        throw new errores_1.ErrorApi("Pedido sin items", 409, { id: pedido.id });
    }
    const cliente = new mercadopago_1.MercadoPagoConfig({ accessToken: obtenerAccessToken() });
    const preference = new mercadopago_1.Preference(cliente);
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
    }
    catch (error) {
        throw new errores_1.ErrorApi("No fue posible crear preferencia Mercado Pago", 502, { error });
    }
    const preferenceId = (0, ecommerce_utilidades_1.normalizarTexto)(respuesta?.id);
    const initPoint = (0, ecommerce_utilidades_1.normalizarTexto)(respuesta?.init_point || respuesta?.sandbox_init_point);
    if (!preferenceId || !initPoint) {
        throw new errores_1.ErrorApi("Respuesta Mercado Pago invalida", 502, { respuesta });
    }
    const preferencePayload = JSON.parse(JSON.stringify(respuesta));
    const gatewayPayload = {
        proveedor: "MERCADOPAGO",
        preference: preferencePayload,
    };
    const pago = await prisma_1.prisma.$transaction(async (tx) => {
        const creado = await (0, pagos_repositorio_1.crearPago)({
            pedido: { connect: { id: pedido.id } },
            metodo: client_1.EcommerceMetodoPago.OTRO,
            estado: client_1.EcommerceEstadoPago.PENDIENTE,
            monto: pedido.total,
            referencia: preferenceId,
            gatewayPayloadJson: gatewayPayload,
        }, tx);
        await (0, notificaciones_servicio_1.registrarNotificacion)({
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
exports.crearMercadoPagoServicio = crearMercadoPagoServicio;
