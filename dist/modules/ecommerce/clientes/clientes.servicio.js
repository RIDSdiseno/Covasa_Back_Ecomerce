"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.obtenerClienteServicio = void 0;
const errores_1 = require("../../../lib/errores");
const ecommerce_utilidades_1 = require("../ecommerce.utilidades");
const clientes_repositorio_1 = require("./clientes.repositorio");
const normalizarNullable = (valor) => (0, ecommerce_utilidades_1.normalizarTexto)(valor ?? undefined);
// Obtiene datos de contacto y direccion del cliente registrado.
const obtenerClienteServicio = async (id) => {
    const cliente = await (0, clientes_repositorio_1.buscarClientePorId)(id);
    if (!cliente) {
        throw new errores_1.ErrorApi("Cliente no encontrado", 404, { id });
    }
    return {
        id: cliente.id,
        nombre: (0, ecommerce_utilidades_1.normalizarTexto)(cliente.nombre),
        personaContacto: normalizarNullable(cliente.personaContacto) || undefined,
        email: normalizarNullable(cliente.email) || undefined,
        telefono: normalizarNullable(cliente.telefono) || undefined,
        direccion: normalizarNullable(cliente.direccion) || undefined,
        comuna: normalizarNullable(cliente.comuna) || undefined,
        ciudad: normalizarNullable(cliente.ciudad) || undefined,
        region: normalizarNullable(cliente.region) || undefined,
    };
};
exports.obtenerClienteServicio = obtenerClienteServicio;
