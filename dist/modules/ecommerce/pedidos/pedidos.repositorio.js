"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.actualizarCarritoEstado = exports.obtenerCarritoPorId = exports.obtenerPedidoPorId = exports.actualizarEstadoPedido = exports.actualizarCodigoPedido = exports.crearPedido = exports.buscarClientePorId = exports.buscarProductosPorIds = void 0;
const prisma_1 = require("../../../lib/prisma");
const db = (tx) => tx ?? prisma_1.prisma;
const buscarProductosPorIds = (ids, tx) => db(tx).producto.findMany({
    where: { id: { in: ids } },
});
exports.buscarProductosPorIds = buscarProductosPorIds;
const buscarClientePorId = (id, tx) => db(tx).cliente.findUnique({
    where: { id },
    select: {
        id: true,
        nombre: true,
        personaContacto: true,
        email: true,
        telefono: true,
        direccion: true,
        comuna: true,
        ciudad: true,
        region: true,
    },
});
exports.buscarClientePorId = buscarClientePorId;
const crearPedido = (data, tx) => db(tx).ecommercePedido.create({
    data,
    select: {
        id: true,
        correlativo: true,
        codigo: true,
        estado: true,
        subtotalNeto: true,
        iva: true,
        total: true,
        createdAt: true,
    },
});
exports.crearPedido = crearPedido;
const actualizarCodigoPedido = (id, codigo, tx) => db(tx).ecommercePedido.update({
    where: { id },
    data: { codigo },
    select: {
        id: true,
        codigo: true,
        estado: true,
        subtotalNeto: true,
        iva: true,
        total: true,
        createdAt: true,
    },
});
exports.actualizarCodigoPedido = actualizarCodigoPedido;
const actualizarEstadoPedido = (id, estado, tx) => db(tx).ecommercePedido.update({
    where: { id },
    data: { estado },
});
exports.actualizarEstadoPedido = actualizarEstadoPedido;
const obtenerPedidoPorId = (id) => prisma_1.prisma.ecommercePedido.findUnique({
    where: { id },
    include: { items: true, pagos: true, direccion: true },
});
exports.obtenerPedidoPorId = obtenerPedidoPorId;
const obtenerCarritoPorId = (id, tx) => db(tx).ecommerceCarrito.findUnique({
    where: { id },
    include: { items: true },
});
exports.obtenerCarritoPorId = obtenerCarritoPorId;
const actualizarCarritoEstado = (id, estado, tx) => db(tx).ecommerceCarrito.update({
    where: { id },
    data: { estado },
});
exports.actualizarCarritoEstado = actualizarCarritoEstado;
