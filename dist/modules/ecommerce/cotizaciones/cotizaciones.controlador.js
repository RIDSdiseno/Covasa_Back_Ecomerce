"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertirCotizacionACarrito = exports.obtenerCotizacion = exports.crearQuote = exports.crearCotizacion = void 0;
const manejarAsync_1 = require("../../../lib/manejarAsync");
const cotizaciones_esquemas_1 = require("./cotizaciones.esquemas");
const cotizaciones_servicio_1 = require("./cotizaciones.servicio");
// POST /api/cotizaciones (legacy front)
// Input: { contacto, observaciones?, ocCliente?/ocNumero?, items[] }. Output: { id, codigo, total }.
exports.crearCotizacion = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const payload = cotizaciones_esquemas_1.cotizacionCrearSchema.parse(req.body);
    const resultado = await (0, cotizaciones_servicio_1.crearCotizacionServicio)({
        ecommerceClienteId: payload.ecommerceClienteId,
        contacto: {
            nombre: payload.contacto.nombre,
            email: payload.contacto.email,
            telefono: payload.contacto.telefono,
            empresa: payload.contacto.empresa,
            rut: payload.contacto.rut,
        },
        observaciones: payload.observaciones,
        ocCliente: payload.ocCliente ?? payload.ocNumero,
        extra: {
            tipoObra: payload.contacto.tipoObra,
            ubicacion: payload.contacto.ubicacion,
        },
        items: payload.items,
    });
    res.status(201).json({
        ok: true,
        data: {
            id: resultado.id,
            codigo: resultado.codigo,
            total: resultado.total,
            estado: resultado.estado,
        },
        message: "Cotizacion registrada",
    });
});
// POST /api/ecommerce/quotes
// Input: campos del formulario UI. Output: { cotizacionId, codigo, total }.
exports.crearQuote = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const payload = cotizaciones_esquemas_1.quoteCrearSchema.parse(req.body);
    const resultado = await (0, cotizaciones_servicio_1.crearCotizacionServicio)({
        contacto: {
            nombre: payload.nombreContacto,
            email: payload.email,
            telefono: payload.telefono,
            empresa: payload.empresa,
        },
        observaciones: undefined,
        ocCliente: payload.ocCliente,
        extra: {
            tipoObra: payload.tipoObra,
            comunaRegion: payload.comunaRegion,
            detalleAdicional: payload.detalleAdicional,
        },
        items: payload.items,
    });
    res.status(201).json({
        ok: true,
        data: {
            cotizacionId: resultado.id,
            codigo: resultado.codigo,
            total: resultado.total,
        },
        message: "Cotizacion registrada",
    });
});
// GET /api/ecommerce/quotes/:id
// Output: cotizacion con items.
exports.obtenerCotizacion = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const { id } = cotizaciones_esquemas_1.cotizacionIdSchema.parse(req.params);
    const cotizacion = await (0, cotizaciones_servicio_1.obtenerCotizacionServicio)(id);
    res.json({ ok: true, data: cotizacion });
});
// POST /api/ecommerce/quotes/:id/convert-to-cart
// Output: { carritoId } y actualiza estado de cotizacion.
exports.convertirCotizacionACarrito = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const { id } = cotizaciones_esquemas_1.cotizacionIdSchema.parse(req.params);
    const resultado = await (0, cotizaciones_servicio_1.convertirCotizacionACarritoServicio)(id);
    res.json({
        ok: true,
        data: { carritoId: resultado.carritoId },
        message: "Cotizacion convertida a carrito",
    });
});
