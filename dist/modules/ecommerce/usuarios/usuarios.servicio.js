"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginUsuarioServicio = exports.registrarUsuarioServicio = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const errores_1 = require("../../../lib/errores");
const prisma_1 = require("../../../lib/prisma");
const ecommerce_utilidades_1 = require("../ecommerce.utilidades");
const usuarios_repositorio_1 = require("./usuarios.repositorio");
const normalizarEmail = (email) => (0, ecommerce_utilidades_1.normalizarTexto)(email).toLowerCase();
const resolverSaltRounds = () => {
    const valor = Number(process.env.ECOMMERCE_SALT_ROUNDS ?? 10);
    if (!Number.isFinite(valor) || valor < 6 || valor > 15) {
        return 10;
    }
    return Math.floor(valor);
};
const registrarUsuarioServicio = async (payload) => {
    const nombre = (0, ecommerce_utilidades_1.normalizarTexto)(payload.nombre);
    const email = normalizarEmail(payload.email);
    const telefono = (0, ecommerce_utilidades_1.normalizarTexto)(payload.telefono);
    if (!nombre || !email) {
        throw new errores_1.ErrorApi("Nombre y email son obligatorios", 400);
    }
    const existente = await (0, usuarios_repositorio_1.buscarUsuarioPorEmail)(email);
    if (existente) {
        throw new errores_1.ErrorApi("El email ya esta registrado", 409);
    }
    const passwordHash = await bcryptjs_1.default.hash(payload.password, resolverSaltRounds());
    const resultado = await prisma_1.prisma.$transaction(async (tx) => {
        const usuario = await (0, usuarios_repositorio_1.crearUsuario)({
            nombre,
            email,
            telefono: telefono || undefined,
            passwordHash,
        }, tx);
        const clienteExistente = await (0, usuarios_repositorio_1.buscarClientePorEmail)(email, tx);
        if (clienteExistente && clienteExistente.usuarioId && clienteExistente.usuarioId !== usuario.id) {
            throw new errores_1.ErrorApi("El email ya esta registrado", 409);
        }
        const cliente = clienteExistente
            ? await (0, usuarios_repositorio_1.actualizarClienteUsuario)(clienteExistente.id, usuario.id, tx)
            : await (0, usuarios_repositorio_1.crearCliente)({
                nombres: nombre,
                emailContacto: email,
                telefono: telefono || undefined,
                usuario: { connect: { id: usuario.id } },
            }, tx);
        return { usuario, cliente };
    });
    return {
        usuario: resultado.usuario,
        ecommerceClienteId: resultado.cliente.id,
    };
};
exports.registrarUsuarioServicio = registrarUsuarioServicio;
const loginUsuarioServicio = async (payload) => {
    const email = normalizarEmail(payload.email);
    const usuario = await (0, usuarios_repositorio_1.buscarUsuarioPorEmail)(email);
    if (!usuario) {
        throw new errores_1.ErrorApi("Credenciales invalidas", 401);
    }
    const valido = await bcryptjs_1.default.compare(payload.password, usuario.passwordHash);
    if (!valido) {
        throw new errores_1.ErrorApi("Credenciales invalidas", 401);
    }
    const ecommerceClienteId = usuario.cliente?.id ?? null;
    const direccion = ecommerceClienteId ? await (0, usuarios_repositorio_1.obtenerDireccionPrincipal)(ecommerceClienteId) : null;
    const direccionLinea = direccion
        ? (0, ecommerce_utilidades_1.construirDireccionLinea)(direccion.calle, direccion.numero, direccion.depto)
        : "";
    return {
        usuario: {
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            telefono: usuario.telefono,
            ecommerceClienteId,
            createdAt: usuario.createdAt,
        },
        direccionPrincipal: direccion
            ? {
                id: direccion.id,
                nombreContacto: direccion.nombreRecibe,
                telefono: direccion.telefonoRecibe,
                email: direccion.email,
                direccion: direccionLinea,
                comuna: direccion.comuna,
                ciudad: direccion.ciudad,
                region: direccion.region,
                notas: direccion.notas,
            }
            : null,
    };
};
exports.loginUsuarioServicio = loginUsuarioServicio;
