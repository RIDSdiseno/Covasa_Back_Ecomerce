"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.obtenerDireccionPrincipal = exports.crearDireccion = exports.limpiarDireccionesPrincipales = exports.buscarClientePorEmail = exports.crearUsuario = exports.buscarUsuarioPorId = exports.buscarUsuarioPorEmail = void 0;
const prisma_1 = require("../../../lib/prisma");
const db = (tx) => tx ?? prisma_1.prisma;
const buscarUsuarioPorEmail = (email, tx) => db(tx).ecommerceUsuario.findUnique({
    where: { email },
    select: {
        id: true,
        nombre: true,
        email: true,
        telefono: true,
        passwordHash: true,
        clienteId: true,
        createdAt: true,
    },
});
exports.buscarUsuarioPorEmail = buscarUsuarioPorEmail;
const buscarUsuarioPorId = (id, tx) => db(tx).ecommerceUsuario.findUnique({
    where: { id },
    select: {
        id: true,
        nombre: true,
        email: true,
        telefono: true,
        clienteId: true,
        createdAt: true,
    },
});
exports.buscarUsuarioPorId = buscarUsuarioPorId;
const crearUsuario = (data, tx) => db(tx).ecommerceUsuario.create({
    data,
    select: {
        id: true,
        nombre: true,
        email: true,
        telefono: true,
        clienteId: true,
        createdAt: true,
    },
});
exports.crearUsuario = crearUsuario;
const buscarClientePorEmail = (email, tx) => db(tx).cliente.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
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
exports.buscarClientePorEmail = buscarClientePorEmail;
const limpiarDireccionesPrincipales = (usuarioId, tx) => db(tx).ecommerceDireccion.updateMany({
    where: { usuarioId, esPrincipal: true },
    data: { esPrincipal: false },
});
exports.limpiarDireccionesPrincipales = limpiarDireccionesPrincipales;
const crearDireccion = (data, tx) => db(tx).ecommerceDireccion.create({
    data,
    select: {
        id: true,
        usuarioId: true,
        pedidoId: true,
        nombreContacto: true,
        telefono: true,
        email: true,
        direccion: true,
        comuna: true,
        ciudad: true,
        region: true,
        notas: true,
        esPrincipal: true,
        createdAt: true,
    },
});
exports.crearDireccion = crearDireccion;
const obtenerDireccionPrincipal = (usuarioId, tx) => db(tx).ecommerceDireccion.findFirst({
    where: { usuarioId, esPrincipal: true },
    orderBy: { createdAt: "desc" },
});
exports.obtenerDireccionPrincipal = obtenerDireccionPrincipal;
