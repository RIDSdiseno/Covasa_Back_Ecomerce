"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.construirObservaciones = exports.calcularTotales = exports.construirDireccionLinea = exports.construirNombreCompleto = exports.normalizarTexto = exports.agruparItems = exports.formatearCodigo = exports.obtenerIvaPct = void 0;
const errores_1 = require("../../lib/errores");
const obtenerIvaPct = () => {
    const valor = Number(process.env.IVA_PCT ?? 19);
    if (!Number.isFinite(valor) || valor <= 0 || valor > 100) {
        throw new errores_1.ErrorApi("IVA configurado invalido", 500, { ivaPct: valor });
    }
    return Math.round(valor);
};
exports.obtenerIvaPct = obtenerIvaPct;
const formatearCodigo = (prefijo, correlativo, largo = 6) => `${prefijo}-${String(correlativo).padStart(largo, "0")}`;
exports.formatearCodigo = formatearCodigo;
const agruparItems = (items) => {
    const mapa = new Map();
    items.forEach((item) => {
        const actual = mapa.get(item.productoId) ?? 0;
        mapa.set(item.productoId, actual + item.cantidad);
    });
    return Array.from(mapa.entries()).map(([productoId, cantidad]) => ({
        productoId,
        cantidad,
    }));
};
exports.agruparItems = agruparItems;
const normalizarTexto = (valor) => (valor ?? "").trim();
exports.normalizarTexto = normalizarTexto;
const construirNombreCompleto = (nombres, apellidos) => {
    const partes = [(0, exports.normalizarTexto)(nombres ?? undefined), (0, exports.normalizarTexto)(apellidos ?? undefined)].filter((valor) => valor.length > 0);
    return partes.join(" ").trim();
};
exports.construirNombreCompleto = construirNombreCompleto;
const construirDireccionLinea = (calle, numero, depto) => {
    const partes = [(0, exports.normalizarTexto)(calle ?? undefined), (0, exports.normalizarTexto)(numero ?? undefined), (0, exports.normalizarTexto)(depto ?? undefined)].filter((valor) => valor.length > 0);
    return partes.join(" ").trim();
};
exports.construirDireccionLinea = construirDireccionLinea;
const calcularTotales = (items) => {
    const acumulado = items.reduce((acc, item) => {
        acc.subtotalNeto += item.subtotalNetoSnapshot;
        acc.iva += item.ivaMontoSnapshot;
        acc.total += item.totalSnapshot;
        return acc;
    }, { subtotalNeto: 0, iva: 0, total: 0 });
    return acumulado;
};
exports.calcularTotales = calcularTotales;
const construirObservaciones = (datos) => {
    const observaciones = (0, exports.normalizarTexto)(datos.observaciones);
    const tipoObra = (0, exports.normalizarTexto)(datos.tipoObra);
    const comunaRegion = (0, exports.normalizarTexto)(datos.comunaRegion);
    const detalleAdicional = (0, exports.normalizarTexto)(datos.detalleAdicional);
    const ubicacion = (0, exports.normalizarTexto)(datos.ubicacion);
    const payload = {};
    if (observaciones)
        payload.observaciones = observaciones;
    if (tipoObra)
        payload.tipoObra = tipoObra;
    if (comunaRegion)
        payload.comunaRegion = comunaRegion;
    if (detalleAdicional)
        payload.detalleAdicional = detalleAdicional;
    if (ubicacion)
        payload.ubicacion = ubicacion;
    const tieneDatos = Object.keys(payload).length > 0;
    if (!tieneDatos) {
        return undefined;
    }
    return JSON.stringify(payload);
};
exports.construirObservaciones = construirObservaciones;
