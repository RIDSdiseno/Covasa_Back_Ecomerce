"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eliminarItemsCarrito = exports.eliminarCarritoItem = exports.actualizarCarritoItem = exports.upsertCarritoItem = exports.buscarItemPorId = exports.buscarItemPorCarritoProducto = exports.buscarProductoPorId = exports.actualizarCarritoTimestamp = exports.actualizarCarritoEstado = exports.buscarCarritoActivoPorCliente = exports.buscarCarritoPorId = exports.obtenerCarritoPorId = exports.crearCarrito = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../../lib/prisma");
const db = (tx) => tx ?? prisma_1.prisma;
const crearCarrito = (data, tx) => db(tx).ecommerceCarrito.create({
    data,
    select: {
        id: true,
        estado: true,
        createdAt: true,
    },
});
exports.crearCarrito = crearCarrito;
const obtenerCarritoPorId = (id) => prisma_1.prisma.ecommerceCarrito.findUnique({
    where: { id },
    include: {
        items: true,
    },
});
exports.obtenerCarritoPorId = obtenerCarritoPorId;
const buscarCarritoPorId = (id, tx) => db(tx).ecommerceCarrito.findUnique({
    where: { id },
    select: { id: true, estado: true, ecommerceClienteId: true },
});
exports.buscarCarritoPorId = buscarCarritoPorId;
const buscarCarritoActivoPorCliente = (ecommerceClienteId, tx) => db(tx).ecommerceCarrito.findFirst({
    where: {
        ecommerceClienteId,
        estado: client_1.EcommerceEstadoCarrito.ACTIVO,
    },
    select: { id: true, estado: true, ecommerceClienteId: true },
});
exports.buscarCarritoActivoPorCliente = buscarCarritoActivoPorCliente;
const actualizarCarritoEstado = (id, estado, tx) => db(tx).ecommerceCarrito.update({
    where: { id },
    data: { estado },
});
exports.actualizarCarritoEstado = actualizarCarritoEstado;
const actualizarCarritoTimestamp = (id, tx) => db(tx).ecommerceCarrito.update({
    where: { id },
    data: { updatedAt: new Date() },
});
exports.actualizarCarritoTimestamp = actualizarCarritoTimestamp;
const buscarProductoPorId = (id, tx) => db(tx).producto.findUnique({
    where: { id },
});
exports.buscarProductoPorId = buscarProductoPorId;
const buscarItemPorCarritoProducto = (carritoId, productoId, tx) => db(tx).ecommerceCarritoItem.findUnique({
    where: {
        carritoId_productoId: {
            carritoId,
            productoId,
        },
    },
});
exports.buscarItemPorCarritoProducto = buscarItemPorCarritoProducto;
const buscarItemPorId = (carritoId, itemId, tx) => db(tx).ecommerceCarritoItem.findFirst({
    where: {
        id: itemId,
        carritoId,
    },
});
exports.buscarItemPorId = buscarItemPorId;
const upsertCarritoItem = (data, tx) => db(tx).ecommerceCarritoItem.upsert({
    where: {
        carritoId_productoId: {
            carritoId: data.carritoId,
            productoId: data.productoId,
        },
    },
    create: data,
    update: {
        cantidad: data.cantidad,
        precioUnitarioNetoSnapshot: data.precioUnitarioNetoSnapshot,
        subtotalNetoSnapshot: data.subtotalNetoSnapshot,
        ivaPctSnapshot: data.ivaPctSnapshot,
        ivaMontoSnapshot: data.ivaMontoSnapshot,
        totalSnapshot: data.totalSnapshot,
    },
});
exports.upsertCarritoItem = upsertCarritoItem;
const actualizarCarritoItem = (itemId, data, tx) => db(tx).ecommerceCarritoItem.update({
    where: { id: itemId },
    data,
});
exports.actualizarCarritoItem = actualizarCarritoItem;
const eliminarCarritoItem = (itemId, tx) => db(tx).ecommerceCarritoItem.delete({
    where: { id: itemId },
});
exports.eliminarCarritoItem = eliminarCarritoItem;
const eliminarItemsCarrito = (carritoId, tx) => db(tx).ecommerceCarritoItem.deleteMany({
    where: { carritoId },
});
exports.eliminarItemsCarrito = eliminarItemsCarrito;
