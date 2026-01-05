"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.obtenerProductoCatalogo = exports.listarProductosCatalogo = void 0;
const errores_1 = require("../../../lib/errores");
const catalogo_repositorio_1 = require("./catalogo.repositorio");
const mapearProducto = (producto) => {
    const stockDisponible = producto.Inventario.reduce((sum, item) => sum + item.stock, 0);
    const precioNeto = producto.precioConDescto > 0 ? producto.precioConDescto : producto.precioGeneral;
    const imagenes = producto.ProductoImagen
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .map((imagen) => imagen.url);
    return {
        id: producto.id,
        sku: producto.sku,
        nombre: producto.nombre,
        descripcion: producto.nombre,
        unidad: producto.unidadMedida,
        unidadMedida: producto.unidadMedida,
        fotoUrl: producto.fotoUrl,
        imagenes,
        tipo: producto.tipo,
        precioNeto,
        precioLista: producto.precioGeneral,
        precioGeneral: producto.precioGeneral,
        precioConDescuento: producto.precioConDescto,
        precioConDescto: producto.precioConDescto,
        stockDisponible,
    };
};
// Lista productos reales desde Producto.
// Inputs: filtros q/tipo/limit/offset. Output: productos con precio neto y stock disponible.
const listarProductosCatalogo = async (filtros) => {
    const productos = await (0, catalogo_repositorio_1.buscarProductos)(filtros);
    return productos.map(mapearProducto);
};
exports.listarProductosCatalogo = listarProductosCatalogo;
// Obtiene un producto por id y valida existencia.
const obtenerProductoCatalogo = async (id) => {
    const producto = await (0, catalogo_repositorio_1.buscarProductoPorId)(id);
    if (!producto) {
        throw new errores_1.ErrorApi("Producto no encontrado", 404, { id });
    }
    return mapearProducto(producto);
};
exports.obtenerProductoCatalogo = obtenerProductoCatalogo;
