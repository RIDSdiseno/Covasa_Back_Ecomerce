"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.actualizarEstadoPedidoServicio = exports.obtenerPedidoServicio = exports.crearPedidoDesdeCarritoServicio = exports.crearPedidoServicio = void 0;
const crypto_1 = require("crypto");
const client_1 = require("@prisma/client");
const errores_1 = require("../../../lib/errores");
const prisma_1 = require("../../../lib/prisma");
const ecommerce_utilidades_1 = require("../ecommerce.utilidades");
const notificaciones_servicio_1 = require("../notificaciones/notificaciones.servicio");
const pedidos_repositorio_1 = require("./pedidos.repositorio");
const validarStockConfigurado = () => process.env.ECOMMERCE_VALIDAR_STOCK === "true";
const normalizarNullable = (valor) => (0, ecommerce_utilidades_1.normalizarTexto)(valor ?? undefined);
const validarStockDisponible = async (items) => {
    if (!validarStockConfigurado()) {
        return;
    }
    const ids = items.map((item) => item.productoId);
    const stockRows = await prisma_1.prisma.inventario.groupBy({
        by: ["productoId"],
        where: { productoId: { in: ids } },
        _sum: { stock: true },
    });
    const stockPorId = new Map(stockRows.map((row) => [row.productoId, row._sum.stock ?? 0]));
    const sinStock = items.filter((item) => (stockPorId.get(item.productoId) ?? 0) < item.cantidad);
    if (sinStock.length > 0) {
        throw new errores_1.ErrorApi("Stock insuficiente", 409, {
            productos: sinStock.map((item) => ({
                productoId: item.productoId,
                solicitado: item.cantidad,
                disponible: stockPorId.get(item.productoId) ?? 0,
            })),
        });
    }
};
const resolverDespacho = (despacho, cliente) => {
    const nombreCliente = normalizarNullable(cliente?.personaContacto) || normalizarNullable(cliente?.nombre);
    return {
        nombre: (0, ecommerce_utilidades_1.normalizarTexto)(despacho?.nombre) || nombreCliente || undefined,
        telefono: (0, ecommerce_utilidades_1.normalizarTexto)(despacho?.telefono) || normalizarNullable(cliente?.telefono) || undefined,
        email: (0, ecommerce_utilidades_1.normalizarTexto)(despacho?.email) || normalizarNullable(cliente?.email) || undefined,
        direccion: (0, ecommerce_utilidades_1.normalizarTexto)(despacho?.direccion) || normalizarNullable(cliente?.direccion) || undefined,
        comuna: (0, ecommerce_utilidades_1.normalizarTexto)(despacho?.comuna) || normalizarNullable(cliente?.comuna) || undefined,
        ciudad: (0, ecommerce_utilidades_1.normalizarTexto)(despacho?.ciudad) || normalizarNullable(cliente?.ciudad) || undefined,
        region: (0, ecommerce_utilidades_1.normalizarTexto)(despacho?.region) || normalizarNullable(cliente?.region) || undefined,
        notas: (0, ecommerce_utilidades_1.normalizarTexto)(despacho?.notas) || undefined,
    };
};
// Crea pedido desde items directos, calcula snapshots y notifica.
const crearPedidoServicio = async (payload) => {
    const ivaPct = (0, ecommerce_utilidades_1.obtenerIvaPct)();
    const itemsAgrupados = (0, ecommerce_utilidades_1.agruparItems)(payload.items);
    const ids = itemsAgrupados.map((item) => item.productoId);
    const productos = await (0, pedidos_repositorio_1.buscarProductosPorIds)(ids);
    const productosPorId = new Map(productos.map((producto) => [producto.id, producto]));
    const faltantes = ids.filter((id) => !productosPorId.has(id));
    if (faltantes.length > 0) {
        throw new errores_1.ErrorApi("Productos no encontrados", 404, { productos: faltantes });
    }
    let cliente = null;
    if (payload.clienteId) {
        const encontrado = await (0, pedidos_repositorio_1.buscarClientePorId)(payload.clienteId);
        if (!encontrado) {
            throw new errores_1.ErrorApi("Cliente no encontrado", 404, { id: payload.clienteId });
        }
        cliente = encontrado;
    }
    await validarStockDisponible(itemsAgrupados);
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
    const codigoTemporal = `ECP-TMP-${(0, crypto_1.randomUUID)()}`;
    const despachoFinal = resolverDespacho(payload.despacho, cliente);
    const resultado = await prisma_1.prisma.$transaction(async (tx) => {
        const creado = await (0, pedidos_repositorio_1.crearPedido)({
            codigo: codigoTemporal,
            cliente: payload.clienteId ? { connect: { id: payload.clienteId } } : undefined,
            despachoNombre: despachoFinal.nombre,
            despachoTelefono: despachoFinal.telefono,
            despachoEmail: despachoFinal.email,
            despachoDireccion: despachoFinal.direccion,
            despachoComuna: despachoFinal.comuna,
            despachoCiudad: despachoFinal.ciudad,
            despachoRegion: despachoFinal.region,
            despachoNotas: despachoFinal.notas,
            subtotalNeto,
            iva: ivaTotal,
            total,
            items: { create: itemsCrear },
        }, tx);
        const codigoFinal = (0, ecommerce_utilidades_1.formatearCodigo)("ECP", creado.correlativo);
        const actualizado = await (0, pedidos_repositorio_1.actualizarCodigoPedido)(creado.id, codigoFinal, tx);
        await (0, notificaciones_servicio_1.registrarNotificacion)({
            tipo: "NUEVO_PEDIDO",
            referenciaTabla: "EcommercePedido",
            referenciaId: creado.id,
            titulo: "Nuevo pedido ecommerce",
            detalle: `Items ${itemsCrear.length}. Total ${total}.`,
            tx,
        });
        return actualizado;
    });
    return resultado;
};
exports.crearPedidoServicio = crearPedidoServicio;
// Crea pedido desde un carrito existente y marca el carrito como CONVERTIDO.
const crearPedidoDesdeCarritoServicio = async (cartId, despacho) => {
    const carrito = await (0, pedidos_repositorio_1.obtenerCarritoPorId)(cartId);
    if (!carrito) {
        throw new errores_1.ErrorApi("Carrito no encontrado", 404, { id: cartId });
    }
    if (carrito.items.length === 0) {
        throw new errores_1.ErrorApi("Carrito sin items", 400, { id: cartId });
    }
    const itemsSolicitud = carrito.items.map((item) => ({
        productoId: item.productoId,
        cantidad: item.cantidad,
    }));
    await validarStockDisponible(itemsSolicitud);
    const productos = await (0, pedidos_repositorio_1.buscarProductosPorIds)(itemsSolicitud.map((item) => item.productoId));
    const productosPorId = new Map(productos.map((producto) => [producto.id, producto]));
    const itemsCrear = carrito.items.map((item) => {
        const producto = productosPorId.get(item.productoId);
        if (!producto) {
            throw new errores_1.ErrorApi("Producto no encontrado", 404, { id: item.productoId });
        }
        return {
            producto: { connect: { id: item.productoId } },
            descripcionSnapshot: producto.nombre,
            cantidad: item.cantidad,
            precioUnitarioNetoSnapshot: item.precioUnitarioNetoSnapshot,
            subtotalNetoSnapshot: item.subtotalNetoSnapshot,
            ivaPctSnapshot: item.ivaPctSnapshot,
            ivaMontoSnapshot: item.ivaMontoSnapshot,
            totalSnapshot: item.totalSnapshot,
        };
    });
    const totales = (0, ecommerce_utilidades_1.calcularTotales)(carrito.items);
    const codigoTemporal = `ECP-TMP-${(0, crypto_1.randomUUID)()}`;
    const cliente = carrito.clienteId ? (await (0, pedidos_repositorio_1.buscarClientePorId)(carrito.clienteId)) : null;
    const despachoFinal = resolverDespacho(despacho, cliente);
    const resultado = await prisma_1.prisma.$transaction(async (tx) => {
        const creado = await (0, pedidos_repositorio_1.crearPedido)({
            codigo: codigoTemporal,
            cliente: carrito.clienteId ? { connect: { id: carrito.clienteId } } : undefined,
            despachoNombre: despachoFinal.nombre,
            despachoTelefono: despachoFinal.telefono,
            despachoEmail: despachoFinal.email,
            despachoDireccion: despachoFinal.direccion,
            despachoComuna: despachoFinal.comuna,
            despachoCiudad: despachoFinal.ciudad,
            despachoRegion: despachoFinal.region,
            despachoNotas: despachoFinal.notas,
            subtotalNeto: totales.subtotalNeto,
            iva: totales.iva,
            total: totales.total,
            items: { create: itemsCrear },
        }, tx);
        const codigoFinal = (0, ecommerce_utilidades_1.formatearCodigo)("ECP", creado.correlativo);
        const actualizado = await (0, pedidos_repositorio_1.actualizarCodigoPedido)(creado.id, codigoFinal, tx);
        await (0, pedidos_repositorio_1.actualizarCarritoEstado)(cartId, client_1.EcommerceEstadoCarrito.CONVERTIDO, tx);
        await (0, notificaciones_servicio_1.registrarNotificacion)({
            tipo: "NUEVO_PEDIDO",
            referenciaTabla: "EcommercePedido",
            referenciaId: creado.id,
            titulo: "Nuevo pedido ecommerce",
            detalle: `Pedido desde carrito ${cartId}. Total ${totales.total}.`,
            tx,
        });
        return actualizado;
    });
    return resultado;
};
exports.crearPedidoDesdeCarritoServicio = crearPedidoDesdeCarritoServicio;
// Obtiene pedido con items y pagos.
const obtenerPedidoServicio = async (id) => {
    const pedido = await (0, pedidos_repositorio_1.obtenerPedidoPorId)(id);
    if (!pedido) {
        throw new errores_1.ErrorApi("Pedido no encontrado", 404, { id });
    }
    return pedido;
};
exports.obtenerPedidoServicio = obtenerPedidoServicio;
// Actualiza estado de un pedido (uso interno con pagos).
const actualizarEstadoPedidoServicio = async (id, estado) => {
    const pedido = await (0, pedidos_repositorio_1.obtenerPedidoPorId)(id);
    if (!pedido) {
        throw new errores_1.ErrorApi("Pedido no encontrado", 404, { id });
    }
    await (0, pedidos_repositorio_1.actualizarEstadoPedido)(id, estado);
    return { id, estado };
};
exports.actualizarEstadoPedidoServicio = actualizarEstadoPedidoServicio;
