"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.obtenerCarritoServicio = exports.vaciarCarritoServicio = exports.eliminarItemCarritoServicio = exports.actualizarCantidadItemCarritoServicio = exports.agregarItemCarritoServicio = exports.crearCarritoServicio = void 0;
const errores_1 = require("../../../lib/errores");
const prisma_1 = require("../../../lib/prisma");
const ecommerce_utilidades_1 = require("../ecommerce.utilidades");
const carrito_repositorio_1 = require("./carrito.repositorio");
const mapearCarritoConTotales = (carrito) => {
    const totales = (0, ecommerce_utilidades_1.calcularTotales)(carrito.items);
    return {
        ...carrito,
        totales,
    };
};
// Crea un carrito ACTIVO o devuelve el activo existente para el cliente.
const crearCarritoServicio = async (payload) => {
    const ecommerceClienteId = payload.ecommerceClienteId;
    if (ecommerceClienteId) {
        const cliente = await prisma_1.prisma.ecommerceCliente.findUnique({
            where: { id: ecommerceClienteId },
            select: { id: true },
        });
        if (!cliente) {
            throw new errores_1.ErrorApi("Cliente no encontrado", 404, { id: ecommerceClienteId });
        }
        const activo = await (0, carrito_repositorio_1.buscarCarritoActivoPorCliente)(ecommerceClienteId);
        if (activo) {
            return activo;
        }
    }
    return (0, carrito_repositorio_1.crearCarrito)({
        ecommerceCliente: ecommerceClienteId ? { connect: { id: ecommerceClienteId } } : undefined,
    });
};
exports.crearCarritoServicio = crearCarritoServicio;
// Agrega item por UPSERT y mergea cantidad si ya existe el producto.
const agregarItemCarritoServicio = async (carritoId, payload) => {
    const ivaPct = (0, ecommerce_utilidades_1.obtenerIvaPct)();
    await prisma_1.prisma.$transaction(async (tx) => {
        const carrito = await (0, carrito_repositorio_1.buscarCarritoPorId)(carritoId, tx);
        if (!carrito) {
            throw new errores_1.ErrorApi("Carrito no encontrado", 404, { id: carritoId });
        }
        const producto = await (0, carrito_repositorio_1.buscarProductoPorId)(payload.productoId, tx);
        if (!producto) {
            throw new errores_1.ErrorApi("Producto no encontrado", 404, { id: payload.productoId });
        }
        const existente = await (0, carrito_repositorio_1.buscarItemPorCarritoProducto)(carritoId, payload.productoId, tx);
        const cantidadFinal = (existente?.cantidad ?? 0) + payload.cantidad;
        const precioNeto = producto.precioConDescto > 0 ? producto.precioConDescto : producto.precioGeneral;
        const subtotal = precioNeto * cantidadFinal;
        const ivaMonto = Math.round((subtotal * ivaPct) / 100);
        const total = subtotal + ivaMonto;
        await (0, carrito_repositorio_1.upsertCarritoItem)({
            carritoId,
            productoId: payload.productoId,
            cantidad: cantidadFinal,
            precioUnitarioNetoSnapshot: precioNeto,
            subtotalNetoSnapshot: subtotal,
            ivaPctSnapshot: ivaPct,
            ivaMontoSnapshot: ivaMonto,
            totalSnapshot: total,
        }, tx);
        await (0, carrito_repositorio_1.actualizarCarritoTimestamp)(carritoId, tx);
    });
    return (0, exports.obtenerCarritoServicio)(carritoId);
};
exports.agregarItemCarritoServicio = agregarItemCarritoServicio;
// Actualiza cantidad de un item existente y recalcula snapshots.
const actualizarCantidadItemCarritoServicio = async (carritoId, itemId, payload) => {
    const ivaPct = (0, ecommerce_utilidades_1.obtenerIvaPct)();
    await prisma_1.prisma.$transaction(async (tx) => {
        const item = await (0, carrito_repositorio_1.buscarItemPorId)(carritoId, itemId, tx);
        if (!item) {
            throw new errores_1.ErrorApi("Item no encontrado", 404, { id: itemId });
        }
        const producto = await (0, carrito_repositorio_1.buscarProductoPorId)(item.productoId, tx);
        if (!producto) {
            throw new errores_1.ErrorApi("Producto no encontrado", 404, { id: item.productoId });
        }
        const precioNeto = producto.precioConDescto > 0 ? producto.precioConDescto : producto.precioGeneral;
        const subtotal = precioNeto * payload.cantidad;
        const ivaMonto = Math.round((subtotal * ivaPct) / 100);
        const total = subtotal + ivaMonto;
        await (0, carrito_repositorio_1.actualizarCarritoItem)(item.id, {
            cantidad: payload.cantidad,
            precioUnitarioNetoSnapshot: precioNeto,
            subtotalNetoSnapshot: subtotal,
            ivaPctSnapshot: ivaPct,
            ivaMontoSnapshot: ivaMonto,
            totalSnapshot: total,
        }, tx);
        await (0, carrito_repositorio_1.actualizarCarritoTimestamp)(carritoId, tx);
    });
    return (0, exports.obtenerCarritoServicio)(carritoId);
};
exports.actualizarCantidadItemCarritoServicio = actualizarCantidadItemCarritoServicio;
// Elimina un item del carrito.
const eliminarItemCarritoServicio = async (carritoId, itemId) => {
    await prisma_1.prisma.$transaction(async (tx) => {
        const item = await (0, carrito_repositorio_1.buscarItemPorId)(carritoId, itemId, tx);
        if (!item) {
            throw new errores_1.ErrorApi("Item no encontrado", 404, { id: itemId });
        }
        await (0, carrito_repositorio_1.eliminarCarritoItem)(item.id, tx);
        await (0, carrito_repositorio_1.actualizarCarritoTimestamp)(carritoId, tx);
    });
    return (0, exports.obtenerCarritoServicio)(carritoId);
};
exports.eliminarItemCarritoServicio = eliminarItemCarritoServicio;
// Vacia un carrito completo (borra items).
const vaciarCarritoServicio = async (carritoId) => {
    await prisma_1.prisma.$transaction(async (tx) => {
        const carrito = await (0, carrito_repositorio_1.buscarCarritoPorId)(carritoId, tx);
        if (!carrito) {
            throw new errores_1.ErrorApi("Carrito no encontrado", 404, { id: carritoId });
        }
        await (0, carrito_repositorio_1.eliminarItemsCarrito)(carritoId, tx);
        await (0, carrito_repositorio_1.actualizarCarritoTimestamp)(carritoId, tx);
    });
    return (0, exports.obtenerCarritoServicio)(carritoId);
};
exports.vaciarCarritoServicio = vaciarCarritoServicio;
// Obtiene carrito con items y totales recalculados.
const obtenerCarritoServicio = async (id) => {
    const carrito = await (0, carrito_repositorio_1.obtenerCarritoPorId)(id);
    if (!carrito) {
        throw new errores_1.ErrorApi("Carrito no encontrado", 404, { id });
    }
    return mapearCarritoConTotales(carrito);
};
exports.obtenerCarritoServicio = obtenerCarritoServicio;
