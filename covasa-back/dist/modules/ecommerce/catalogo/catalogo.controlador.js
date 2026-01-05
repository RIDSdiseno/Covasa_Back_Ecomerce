"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.obtenerProducto = exports.listarProductos = void 0;
const manejarAsync_1 = require("../../../lib/manejarAsync");
const catalogo_esquemas_1 = require("./catalogo.esquemas");
const catalogo_servicio_1 = require("./catalogo.servicio");
// GET /api/ecommerce/productos | /api/products
// Inputs: query q/tipo/limit/offset. Output: lista de productos con precios y stock.
exports.listarProductos = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const query = catalogo_esquemas_1.catalogoQuerySchema.parse(req.query);
    const productos = await (0, catalogo_servicio_1.listarProductosCatalogo)(query);
    res.json({ ok: true, data: productos });
});
// GET /api/ecommerce/productos/:id
// Output: producto con precios y stock o 404 si no existe.
exports.obtenerProducto = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const { id } = catalogo_esquemas_1.catalogoProductoIdSchema.parse(req.params);
    const producto = await (0, catalogo_servicio_1.obtenerProductoCatalogo)(id);
    res.json({ ok: true, data: producto });
});
