"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertirCotizacionACarritoServicio = exports.obtenerCotizacionServicio = exports.crearCotizacionServicio = void 0;
const crypto_1 = require("crypto");
const client_1 = require("@prisma/client");
const errores_1 = require("../../../lib/errores");
const prisma_1 = require("../../../lib/prisma");
const ecommerce_utilidades_1 = require("../ecommerce.utilidades");
const cotizaciones_repositorio_1 = require("./cotizaciones.repositorio");
const carrito_repositorio_1 = require("../carrito/carrito.repositorio");
const notificaciones_servicio_1 = require("../notificaciones/notificaciones.servicio");
// Crea una cotizacion Ecommerce con snapshots calculados y notificacion.
const crearCotizacionServicio = async (payload) => {
    const ivaPct = (0, ecommerce_utilidades_1.obtenerIvaPct)();
    const itemsAgrupados = payload.items;
    const ids = itemsAgrupados.map((item) => item.productoId);
    const productos = await (0, cotizaciones_repositorio_1.buscarProductosPorIds)(ids);
    const productosPorId = new Map(productos.map((producto) => [producto.id, producto]));
    const faltantes = ids.filter((id) => !productosPorId.has(id));
    if (faltantes.length > 0) {
        throw new errores_1.ErrorApi("Productos no encontrados", 404, { productos: faltantes });
    }
    const ecommerceClienteId = payload.ecommerceClienteId;
    if (ecommerceClienteId) {
        const cliente = await (0, cotizaciones_repositorio_1.buscarClientePorId)(ecommerceClienteId);
        if (!cliente) {
            throw new errores_1.ErrorApi("Cliente no encontrado", 404, { id: ecommerceClienteId });
        }
    }
    let subtotalNeto = 0;
    let ivaTotal = 0;
    const itemsCrear = itemsAgrupados.map((item) => {
        const producto = productosPorId.get(item.productoId);
        if (!producto) {
            throw new errores_1.ErrorApi("Producto no encontrado", 404, { id: item.productoId });
        }
        const precioNeto = producto.precioConDescto > 0 ? producto.precioConDescto : producto.precioGeneral;
        const subtotal = precioNeto * item.cantidad;
        const ivaMonto = Math.round((subtotal * ivaPct) / 100);
        const total = subtotal + ivaMonto;
        subtotalNeto += subtotal;
        ivaTotal += ivaMonto;
        return {
            producto: { connect: { id: item.productoId } },
            descripcionSnapshot: producto.nombre,
            cantidad: item.cantidad,
            precioUnitarioNetoSnapshot: precioNeto,
            subtotalNetoSnapshot: subtotal,
            ivaPctSnapshot: ivaPct,
            ivaMontoSnapshot: ivaMonto,
            totalSnapshot: total,
        };
    });
    const total = subtotalNeto + ivaTotal;
    const codigoTemporal = `ECQ-TMP-${(0, crypto_1.randomUUID)()}`;
    const observaciones = (0, ecommerce_utilidades_1.construirObservaciones)({
        observaciones: payload.observaciones,
        tipoObra: payload.extra?.tipoObra,
        comunaRegion: payload.extra?.comunaRegion,
        detalleAdicional: payload.extra?.detalleAdicional,
        ubicacion: payload.extra?.ubicacion,
    });
    const resultado = await prisma_1.prisma.$transaction(async (tx) => {
        const crmCotizacion = await tx.crmCotizacion.create({
            data: {
                clienteNombreSnapshot: (0, ecommerce_utilidades_1.normalizarTexto)(payload.contacto.nombre),
                clienteRutSnapshot: (0, ecommerce_utilidades_1.normalizarTexto)(payload.contacto.rut) || undefined,
                clienteEmailSnapshot: (0, ecommerce_utilidades_1.normalizarTexto)(payload.contacto.email).toLowerCase(),
                clienteTelefonoSnapshot: (0, ecommerce_utilidades_1.normalizarTexto)(payload.contacto.telefono) || undefined,
                nombreObra: (0, ecommerce_utilidades_1.normalizarTexto)(payload.extra?.tipoObra) || undefined,
                numeroOC: (0, ecommerce_utilidades_1.normalizarTexto)(payload.ocCliente) || undefined,
                observaciones,
                subtotalNeto,
                iva: ivaTotal,
                total,
                estado: client_1.CrmEstadoCotizacion.NUEVA,
                origenCliente: client_1.OrigenCliente.CLIENTE_ECOMMERCE,
            },
            select: { id: true },
        });
        const creada = await (0, cotizaciones_repositorio_1.crearCotizacion)({
            codigo: codigoTemporal,
            ecommerceCliente: ecommerceClienteId
                ? { connect: { id: ecommerceClienteId } }
                : undefined,
            nombreContacto: (0, ecommerce_utilidades_1.normalizarTexto)(payload.contacto.nombre),
            email: (0, ecommerce_utilidades_1.normalizarTexto)(payload.contacto.email).toLowerCase(),
            telefono: (0, ecommerce_utilidades_1.normalizarTexto)(payload.contacto.telefono),
            empresa: (0, ecommerce_utilidades_1.normalizarTexto)(payload.contacto.empresa) || undefined,
            rut: (0, ecommerce_utilidades_1.normalizarTexto)(payload.contacto.rut) || undefined,
            observaciones,
            ocCliente: (0, ecommerce_utilidades_1.normalizarTexto)(payload.ocCliente) || undefined,
            subtotalNeto,
            iva: ivaTotal,
            total,
            crmCotizacion: { connect: { id: crmCotizacion.id } },
            items: {
                create: itemsCrear,
            },
        }, tx);
        const codigoFinal = (0, ecommerce_utilidades_1.formatearCodigo)("ECQ", creada.correlativo);
        const actualizada = await (0, cotizaciones_repositorio_1.actualizarCodigoCotizacion)(creada.id, codigoFinal, tx);
        await (0, notificaciones_servicio_1.registrarNotificacion)({
            tipo: "NUEVA_COTIZACION",
            referenciaTabla: "EcommerceCotizacion",
            referenciaId: creada.id,
            titulo: "Nueva cotizacion ecommerce",
            detalle: `Contacto ${(0, ecommerce_utilidades_1.normalizarTexto)(payload.contacto.nombre)} (${(0, ecommerce_utilidades_1.normalizarTexto)(payload.contacto.email)}). Items ${itemsCrear.length}. Total ${total}.`,
            tx,
        });
        return actualizada;
    });
    return resultado;
};
exports.crearCotizacionServicio = crearCotizacionServicio;
// Obtiene una cotizacion con items.
const obtenerCotizacionServicio = async (id) => {
    const cotizacion = await (0, cotizaciones_repositorio_1.obtenerCotizacionPorId)(id);
    if (!cotizacion) {
        throw new errores_1.ErrorApi("Cotizacion no encontrada", 404, { id });
    }
    return cotizacion;
};
exports.obtenerCotizacionServicio = obtenerCotizacionServicio;
// Convierte una cotizacion a carrito ACTIVO usando snapshots de la cotizacion.
const convertirCotizacionACarritoServicio = async (id) => {
    const resultado = await prisma_1.prisma.$transaction(async (tx) => {
        const cotizacion = await (0, cotizaciones_repositorio_1.obtenerCotizacionConItems)(id, tx);
        if (!cotizacion) {
            throw new errores_1.ErrorApi("Cotizacion no encontrada", 404, { id });
        }
        let carritoId = null;
        if (cotizacion.ecommerceClienteId) {
            const activo = await (0, carrito_repositorio_1.buscarCarritoActivoPorCliente)(cotizacion.ecommerceClienteId, tx);
            carritoId = activo?.id ?? null;
        }
        if (!carritoId) {
            const creado = await (0, carrito_repositorio_1.crearCarrito)({
                ecommerceCliente: cotizacion.ecommerceClienteId
                    ? { connect: { id: cotizacion.ecommerceClienteId } }
                    : undefined,
            }, tx);
            carritoId = creado.id;
        }
        for (const item of cotizacion.items) {
            await (0, carrito_repositorio_1.upsertCarritoItem)({
                carritoId,
                productoId: item.productoId,
                cantidad: item.cantidad,
                precioUnitarioNetoSnapshot: item.precioUnitarioNetoSnapshot,
                subtotalNetoSnapshot: item.subtotalNetoSnapshot,
                ivaPctSnapshot: item.ivaPctSnapshot,
                ivaMontoSnapshot: item.ivaMontoSnapshot,
                totalSnapshot: item.totalSnapshot,
            }, tx);
        }
        await (0, carrito_repositorio_1.actualizarCarritoTimestamp)(carritoId, tx);
        await (0, cotizaciones_repositorio_1.actualizarEstadoCotizacion)(id, client_1.EcommerceEstadoCotizacion.EN_REVISION, tx);
        await (0, notificaciones_servicio_1.registrarNotificacion)({
            tipo: "COTIZACION_CONVERTIDA_A_CARRITO",
            referenciaTabla: "EcommerceCotizacion",
            referenciaId: cotizacion.id,
            titulo: "Cotizacion convertida a carrito",
            detalle: `Carrito ${carritoId} con ${cotizacion.items.length} items.`,
            tx,
        });
        return { carritoId, cotizacionId: cotizacion.id };
    });
    return resultado;
};
exports.convertirCotizacionACarritoServicio = convertirCotizacionACarritoServicio;
