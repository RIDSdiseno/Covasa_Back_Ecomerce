"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.obtenerClienteServicio = void 0;
const errores_1 = require("../../../lib/errores");
const ecommerce_utilidades_1 = require("../ecommerce.utilidades");
const clientes_repositorio_1 = require("./clientes.repositorio");
const usuarios_repositorio_1 = require("../usuarios/usuarios.repositorio");
const normalizarNullable = (valor) => (0, ecommerce_utilidades_1.normalizarTexto)(valor ?? undefined);
// Obtiene datos de contacto y direccion principal del cliente registrado.
const obtenerClienteServicio = async (id) => {
    const cliente = await (0, clientes_repositorio_1.buscarClientePorId)(id);
    if (!cliente) {
        throw new errores_1.ErrorApi("Cliente no encontrado", 404, { id });
    }
    const direccion = await (0, usuarios_repositorio_1.obtenerDireccionPrincipal)(cliente.id);
    return {
        id: cliente.id,
        nombre: (0, ecommerce_utilidades_1.construirNombreCompleto)(cliente.nombres, cliente.apellidos) || (0, ecommerce_utilidades_1.normalizarTexto)(cliente.nombres),
        email: normalizarNullable(cliente.emailContacto) || undefined,
        telefono: normalizarNullable(cliente.telefono) || undefined,
        direccionPrincipal: direccion
            ? {
                id: direccion.id,
                nombreContacto: direccion.nombreRecibe,
                telefono: direccion.telefonoRecibe,
                email: direccion.email,
                direccion: (0, ecommerce_utilidades_1.construirDireccionLinea)(direccion.calle, direccion.numero, direccion.depto),
                comuna: direccion.comuna,
                ciudad: direccion.ciudad,
                region: direccion.region,
                notas: direccion.notas,
            }
            : null,
    };
};
exports.obtenerClienteServicio = obtenerClienteServicio;
