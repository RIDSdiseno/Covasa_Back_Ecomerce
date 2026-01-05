"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vaciarCarrito = exports.eliminarItemCarrito = exports.actualizarItemCarrito = exports.agregarItemCarrito = exports.obtenerCarrito = exports.crearCarrito = void 0;
const manejarAsync_1 = require("../../../lib/manejarAsync");
const carrito_esquemas_1 = require("./carrito.esquemas");
const carrito_servicio_1 = require("./carrito.servicio");
// POST /api/ecommerce/cart
// Input: { ecommerceClienteId? }. Output: { carritoId, estado }.
exports.crearCarrito = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const payload = carrito_esquemas_1.carritoCrearSchema.parse(req.body);
    const carrito = await (0, carrito_servicio_1.crearCarritoServicio)(payload);
    res.status(201).json({
        ok: true,
        data: {
            carritoId: carrito.id,
            estado: carrito.estado,
        },
        message: "Carrito listo",
    });
});
// GET /api/ecommerce/cart/:id
// Output: carrito con items y totales.
exports.obtenerCarrito = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const { id } = carrito_esquemas_1.carritoIdSchema.parse(req.params);
    const carrito = await (0, carrito_servicio_1.obtenerCarritoServicio)(id);
    res.json({ ok: true, data: carrito });
});
// POST /api/ecommerce/cart/:id/items
// Input: { productoId, cantidad }. Reglas: UPSERT + merge cantidades, snapshots desde Producto.
exports.agregarItemCarrito = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const { id } = carrito_esquemas_1.carritoIdSchema.parse(req.params);
    const payload = carrito_esquemas_1.carritoItemAgregarSchema.parse(req.body);
    const carrito = await (0, carrito_servicio_1.agregarItemCarritoServicio)(id, payload);
    res.status(201).json({
        ok: true,
        data: carrito,
        message: "Item agregado al carrito",
    });
});
// PATCH /api/ecommerce/cart/:id/items/:itemId
// Input: { cantidad }. Recalcula snapshots y totales.
exports.actualizarItemCarrito = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const { id, itemId } = carrito_esquemas_1.carritoItemParamSchema.parse(req.params);
    const payload = carrito_esquemas_1.carritoItemActualizarSchema.parse(req.body);
    const carrito = await (0, carrito_servicio_1.actualizarCantidadItemCarritoServicio)(id, itemId, payload);
    res.json({
        ok: true,
        data: carrito,
        message: "Item actualizado",
    });
});
// DELETE /api/ecommerce/cart/:id/items/:itemId
// Output: carrito actualizado sin el item.
exports.eliminarItemCarrito = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const { id, itemId } = carrito_esquemas_1.carritoItemParamSchema.parse(req.params);
    const carrito = await (0, carrito_servicio_1.eliminarItemCarritoServicio)(id, itemId);
    res.json({
        ok: true,
        data: carrito,
        message: "Item eliminado",
    });
});
// DELETE /api/ecommerce/cart/:id/items
// Output: carrito vacio.
exports.vaciarCarrito = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const { id } = carrito_esquemas_1.carritoIdSchema.parse(req.params);
    const carrito = await (0, carrito_servicio_1.vaciarCarritoServicio)(id);
    res.json({
        ok: true,
        data: carrito,
        message: "Carrito vaciado",
    });
});
