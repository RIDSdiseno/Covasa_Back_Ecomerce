"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.obtenerDireccionPrincipal = exports.crearDireccion = exports.limpiarDireccionesPrincipales = exports.actualizarClienteUsuario = exports.crearCliente = exports.buscarClientePorEmail = exports.crearUsuario = exports.buscarUsuarioPorId = exports.buscarUsuarioPorEmail = void 0;
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
        createdAt: true,
        cliente: { select: { id: true } },
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
        createdAt: true,
        cliente: { select: { id: true } },
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
        createdAt: true,
        cliente: { select: { id: true } },
    },
});
exports.crearUsuario = crearUsuario;
const buscarClientePorEmail = (email, tx) => db(tx).ecommerceCliente.findFirst({
    where: {
        OR: [
            { emailContacto: { equals: email, mode: "insensitive" } },
            { usuario: { email: { equals: email, mode: "insensitive" } } },
        ],
    },
    select: {
        id: true,
        usuarioId: true,
        nombres: true,
        apellidos: true,
        emailContacto: true,
        telefono: true,
    },
});
exports.buscarClientePorEmail = buscarClientePorEmail;
const crearCliente = (data, tx) => db(tx).ecommerceCliente.create({
    data,
    select: {
        id: true,
        usuarioId: true,
        nombres: true,
        apellidos: true,
        emailContacto: true,
        telefono: true,
        createdAt: true,
    },
});
exports.crearCliente = crearCliente;
const actualizarClienteUsuario = (id, usuarioId, tx) => db(tx).ecommerceCliente.update({
    where: { id },
    data: { usuario: { connect: { id: usuarioId } } },
    select: {
        id: true,
        usuarioId: true,
        nombres: true,
        apellidos: true,
        emailContacto: true,
        telefono: true,
        createdAt: true,
    },
});
exports.actualizarClienteUsuario = actualizarClienteUsuario;
const limpiarDireccionesPrincipales = (ecommerceClienteId, tx) => db(tx).ecommerceDireccion.updateMany({
    where: { ecommerceClienteId, principal: true },
    data: { principal: false },
});
exports.limpiarDireccionesPrincipales = limpiarDireccionesPrincipales;
const crearDireccion = (data, tx) => db(tx).ecommerceDireccion.create({
    data,
    select: {
        id: true,
        ecommerceClienteId: true,
        pedidoId: true,
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
        principal: true,
        createdAt: true,
    },
});
exports.crearDireccion = crearDireccion;
const obtenerDireccionPrincipal = (ecommerceClienteId, tx) => db(tx).ecommerceDireccion.findFirst({
    where: { ecommerceClienteId, principal: true },
    orderBy: { createdAt: "desc" },
});
exports.obtenerDireccionPrincipal = obtenerDireccionPrincipal;
