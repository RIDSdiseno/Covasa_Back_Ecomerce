"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recibirRetornoTransbank = exports.obtenerEstadoTransbank = exports.confirmarTransbankPago = exports.crearTransbankPago = void 0;
const manejarAsync_1 = require("../../../lib/manejarAsync");
const ecommerce_utilidades_1 = require("../ecommerce.utilidades");
const transbank_esquemas_1 = require("./transbank.esquemas");
const transbank_servicio_1 = require("./transbank.servicio");
const extraerToken = (req) => {
    const token = req.body?.token ??
        req.body?.token_ws ??
        req.query?.token ??
        req.query?.token_ws;
    return transbank_esquemas_1.transbankTokenSchema.parse({ token }).token;
};
const obtenerFrontUrlBase = () => {
    const desdeEnv = (0, ecommerce_utilidades_1.normalizarTexto)(process.env.ECOMMERCE_FRONT_URL);
    return desdeEnv || "http://localhost:5173";
};
const construirUrlRetornoFront = (token) => {
    const base = obtenerFrontUrlBase();
    const url = new URL("/pago/transbank", base);
    url.searchParams.set("token_ws", token);
    return url.toString();
};
// POST /api/ecommerce/payments/transbank
// Input: { pedidoId, returnUrl? }. Output: { pagoId, token, url, redirectUrl }.
exports.crearTransbankPago = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const payload = transbank_esquemas_1.transbankCrearSchema.parse(req.body);
    const resultado = await (0, transbank_servicio_1.crearTransbankPagoServicio)(payload);
    res.status(201).json({
        ok: true,
        data: resultado,
        message: "Transaccion Transbank creada",
    });
});
// POST /api/ecommerce/payments/transbank/commit
// Input: { token } o token_ws. Output: estado y respuesta Transbank.
exports.confirmarTransbankPago = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const token = extraerToken(req);
    const resultado = await (0, transbank_servicio_1.confirmarTransbankPagoServicio)(token);
    res.json({
        ok: true,
        data: {
            pagoId: resultado.pago.id,
            estado: resultado.estado,
            transbank: resultado.resultado,
        },
        message: resultado.estado === "CONFIRMADO" ? "Pago confirmado" : "Pago rechazado",
    });
});
// GET /api/ecommerce/payments/transbank/status/:token
// Output: estado remoto de Transbank.
exports.obtenerEstadoTransbank = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const token = transbank_esquemas_1.transbankTokenSchema.parse(req.params).token;
    const estado = await (0, transbank_servicio_1.obtenerEstadoTransbankServicio)(token);
    res.json({
        ok: true,
        data: estado,
    });
});
// POST|GET /api/ecommerce/payments/transbank/return
// Recibe token_ws y redirige al front para confirmar el pago.
exports.recibirRetornoTransbank = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const token = extraerToken(req);
    const redirectUrl = construirUrlRetornoFront(token);
    res.redirect(302, redirectUrl);
});
