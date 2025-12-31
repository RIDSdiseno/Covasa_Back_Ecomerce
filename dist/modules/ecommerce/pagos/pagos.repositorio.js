"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.obtenerPagoParaRecibo = exports.actualizarPedidoEstado = exports.actualizarPagoEstado = exports.actualizarPagoDatos = exports.buscarPagoPorReferencia = exports.buscarPagoPorId = exports.crearPago = exports.buscarPedidoParaMercadoPago = exports.buscarPedidoParaPago = exports.buscarPedidoPorId = void 0;
const prisma_1 = require("../../../lib/prisma");
const db = (tx) => tx ?? prisma_1.prisma;
const buscarPedidoPorId = (id, tx) => db(tx).ecommercePedido.findUnique({
    where: { id },
    select: { id: true },
});
exports.buscarPedidoPorId = buscarPedidoPorId;
const buscarPedidoParaPago = (id, tx) => db(tx).ecommercePedido.findUnique({
    where: { id },
    select: {
        id: true,
        codigo: true,
        total: true,
        estado: true,
    },
});
exports.buscarPedidoParaPago = buscarPedidoParaPago;
const buscarPedidoParaMercadoPago = (id, tx) => db(tx).ecommercePedido.findUnique({
    where: { id },
    select: {
        id: true,
        codigo: true,
        total: true,
        estado: true,
        despachoEmail: true,
        items: {
            select: {
                id: true,
                productoId: true,
                descripcionSnapshot: true,
                cantidad: true,
                totalSnapshot: true,
            },
        },
    },
});
exports.buscarPedidoParaMercadoPago = buscarPedidoParaMercadoPago;
const crearPago = (data, tx) => db(tx).ecommercePago.create({
    data,
    select: {
        id: true,
        estado: true,
        monto: true,
        createdAt: true,
    },
});
exports.crearPago = crearPago;
const buscarPagoPorId = (id, tx) => db(tx).ecommercePago.findUnique({
    where: { id },
});
exports.buscarPagoPorId = buscarPagoPorId;
const buscarPagoPorReferencia = (referencia, tx) => db(tx).ecommercePago.findFirst({
    where: { referencia },
});
exports.buscarPagoPorReferencia = buscarPagoPorReferencia;
const actualizarPagoDatos = (id, data, tx) => db(tx).ecommercePago.update({
    where: { id },
    data,
});
exports.actualizarPagoDatos = actualizarPagoDatos;
const actualizarPagoEstado = (id, estado, tx) => db(tx).ecommercePago.update({
    where: { id },
    data: { estado },
});
exports.actualizarPagoEstado = actualizarPagoEstado;
const actualizarPedidoEstado = (id, estado, tx) => db(tx).ecommercePedido.update({
    where: { id },
    data: { estado },
});
exports.actualizarPedidoEstado = actualizarPedidoEstado;
const obtenerPagoParaRecibo = (id, tx) => db(tx).ecommercePago.findUnique({
    where: { id },
    select: {
        id: true,
        metodo: true,
        estado: true,
        monto: true,
        createdAt: true,
        gatewayPayloadJson: true,
        pedido: {
            select: {
                id: true,
                codigo: true,
                total: true,
                estado: true,
                createdAt: true,
                direccion: {
                    select: {
                        nombreRecibe: true,
                        telefonoRecibe: true,
                        email: true,
                        calle: true,
                        numero: true,
                        depto: true,
                        comuna: true,
                        ciudad: true,
                        region: true,
                        codigoPostal: true,
                        notas: true,
                    },
                },
            },
        },
    },
});
exports.obtenerPagoParaRecibo = obtenerPagoParaRecibo;
