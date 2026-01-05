"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.obtenerCotizacionConItems = exports.obtenerCotizacionPorId = exports.actualizarEstadoCotizacion = exports.actualizarCodigoCotizacion = exports.crearCotizacion = exports.buscarClientePorId = exports.buscarProductosPorIds = void 0;
const prisma_1 = require("../../../lib/prisma");
const db = (tx) => tx ?? prisma_1.prisma;
const buscarProductosPorIds = (ids, tx) => db(tx).producto.findMany({
    where: {
        id: { in: ids },
    },
});
exports.buscarProductosPorIds = buscarProductosPorIds;
const buscarClientePorId = (id, tx) => db(tx).ecommerceCliente.findUnique({
    where: { id },
    select: { id: true },
});
exports.buscarClientePorId = buscarClientePorId;
const crearCotizacion = (data, tx) => db(tx).ecommerceCotizacion.create({
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
exports.crearCotizacion = crearCotizacion;
const actualizarCodigoCotizacion = (id, codigo, tx) => db(tx).ecommerceCotizacion.update({
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
exports.actualizarCodigoCotizacion = actualizarCodigoCotizacion;
const actualizarEstadoCotizacion = (id, estado, tx) => db(tx).ecommerceCotizacion.update({
    where: { id },
    data: { estado },
});
exports.actualizarEstadoCotizacion = actualizarEstadoCotizacion;
const obtenerCotizacionPorId = (id) => prisma_1.prisma.ecommerceCotizacion.findUnique({
    where: { id },
    include: {
        items: true,
    },
});
exports.obtenerCotizacionPorId = obtenerCotizacionPorId;
const obtenerCotizacionConItems = (id, tx) => db(tx).ecommerceCotizacion.findUnique({
    where: { id },
    include: { items: true },
});
exports.obtenerCotizacionConItems = obtenerCotizacionConItems;
