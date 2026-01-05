"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.obtenerPedido = exports.crearPedidoDesdeCarrito = exports.crearPedido = void 0;
const manejarAsync_1 = require("../../../lib/manejarAsync");
const pedidos_esquemas_1 = require("./pedidos.esquemas");
const pedidos_servicio_1 = require("./pedidos.servicio");
// POST /api/ecommerce/orders
// Input: despacho + items. Output: { pedidoId, codigo, total }.
exports.crearPedido = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const payload = pedidos_esquemas_1.pedidoCrearSchema.parse(req.body);
    const pedido = await (0, pedidos_servicio_1.crearPedidoServicio)(payload);
    res.status(201).json({
        ok: true,
        data: {
            pedidoId: pedido.id,
            codigo: pedido.codigo,
            total: pedido.total,
        },
        message: "Pedido creado",
    });
});
// POST /api/ecommerce/orders/from-cart/:cartId
// Input: despacho opcional. Output: { pedidoId, codigo, total }.
exports.crearPedidoDesdeCarrito = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const { cartId } = pedidos_esquemas_1.pedidoCarritoIdSchema.parse(req.params);
    const payload = pedidos_esquemas_1.pedidoDesdeCarritoSchema.parse(req.body ?? {});
    const pedido = await (0, pedidos_servicio_1.crearPedidoDesdeCarritoServicio)(cartId, payload.despacho, payload.usuarioId);
    res.status(201).json({
        ok: true,
        data: {
            pedidoId: pedido.id,
            codigo: pedido.codigo,
            total: pedido.total,
        },
        message: "Pedido creado desde carrito",
    });
});
// GET /api/ecommerce/orders/:id
// Output: pedido con items y pagos.
exports.obtenerPedido = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const { id } = pedidos_esquemas_1.pedidoIdSchema.parse(req.params);
    const pedido = await (0, pedidos_servicio_1.obtenerPedidoServicio)(id);
    res.json({ ok: true, data: pedido });
});
