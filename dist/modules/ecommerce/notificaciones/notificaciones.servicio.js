"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listarNotificacionesServicio = exports.registrarNotificacion = void 0;
const ecommerce_utilidades_1 = require("../ecommerce.utilidades");
const notificaciones_repositorio_1 = require("./notificaciones.repositorio");
// Registra notificacion Ecommerce para CRM/operacion.
const registrarNotificacion = async (datos) => {
    return (0, notificaciones_repositorio_1.crearNotificacion)({
        tipo: (0, ecommerce_utilidades_1.normalizarTexto)(datos.tipo),
        referenciaTabla: (0, ecommerce_utilidades_1.normalizarTexto)(datos.referenciaTabla),
        referenciaId: (0, ecommerce_utilidades_1.normalizarTexto)(datos.referenciaId),
        titulo: (0, ecommerce_utilidades_1.normalizarTexto)(datos.titulo),
        detalle: (0, ecommerce_utilidades_1.normalizarTexto)(datos.detalle),
    }, datos.tx);
};
exports.registrarNotificacion = registrarNotificacion;
// Lista notificaciones con paginacion basica.
const listarNotificacionesServicio = async (filtros) => (0, notificaciones_repositorio_1.listarNotificaciones)(filtros);
exports.listarNotificacionesServicio = listarNotificacionesServicio;
