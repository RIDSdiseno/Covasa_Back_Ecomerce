"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crearMercadoPago = void 0;
const manejarAsync_1 = require("../../../lib/manejarAsync");
const mercadopago_esquemas_1 = require("./mercadopago.esquemas");
const mercadopago_servicio_1 = require("./mercadopago.servicio");
// POST /api/ecommerce/payments/mercadopago
// Input: { pedidoId }. Output: { pagoId, preferenceId, redirectUrl }.
exports.crearMercadoPago = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const payload = mercadopago_esquemas_1.mercadoPagoCrearSchema.parse(req.body);
    const resultado = await (0, mercadopago_servicio_1.crearMercadoPagoServicio)(payload);
    res.status(201).json({
        ok: true,
        data: resultado,
        message: "Preferencia Mercado Pago creada",
    });
});
