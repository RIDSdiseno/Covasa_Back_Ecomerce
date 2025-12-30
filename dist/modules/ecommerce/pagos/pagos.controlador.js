"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.obtenerPagoRecibo = exports.rechazarPago = exports.confirmarPago = exports.crearPago = void 0;
const manejarAsync_1 = require("../../../lib/manejarAsync");
const pagos_esquemas_1 = require("./pagos.esquemas");
const pagos_servicio_1 = require("./pagos.servicio");
// POST /api/ecommerce/payments
// Input: { pedidoId, metodo, monto, referencia?, evidenciaUrl?, gatewayPayloadJson? }.
exports.crearPago = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const payload = pagos_esquemas_1.pagoCrearSchema.parse(req.body);
    const pago = await (0, pagos_servicio_1.crearPagoServicio)(payload);
    res.status(201).json({
        ok: true,
        data: { pagoId: pago.id, estado: pago.estado },
        message: "Pago registrado (placeholder)",
    });
});
// PATCH /api/ecommerce/payments/:id/confirm
// Output: pago confirmado + pedido PAGADO.
exports.confirmarPago = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const { id } = pagos_esquemas_1.pagoIdSchema.parse(req.params);
    const pago = await (0, pagos_servicio_1.confirmarPagoServicio)(id);
    res.json({
        ok: true,
        data: { pagoId: pago.id, estado: pago.estado },
        message: "Pago confirmado",
    });
});
// PATCH /api/ecommerce/payments/:id/reject
// Output: pago rechazado.
exports.rechazarPago = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const { id } = pagos_esquemas_1.pagoIdSchema.parse(req.params);
    const pago = await (0, pagos_servicio_1.rechazarPagoServicio)(id);
    res.json({
        ok: true,
        data: { pagoId: pago.id, estado: pago.estado },
        message: "Pago rechazado",
    });
});
// GET /api/ecommerce/payments/:id
// Output: datos para boleta/recibo.
exports.obtenerPagoRecibo = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const { id } = pagos_esquemas_1.pagoIdSchema.parse(req.params);
    const pago = await (0, pagos_servicio_1.obtenerPagoReciboServicio)(id);
    res.json({
        ok: true,
        data: pago,
    });
});
