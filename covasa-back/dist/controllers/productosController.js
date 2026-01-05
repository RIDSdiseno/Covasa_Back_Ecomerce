"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.obtenerProducto = exports.listarProductos = void 0;
// Reexporta controladores ecommerce para mantener /api/productos.
var catalogo_controlador_1 = require("../modules/ecommerce/catalogo/catalogo.controlador");
Object.defineProperty(exports, "listarProductos", { enumerable: true, get: function () { return catalogo_controlador_1.listarProductos; } });
Object.defineProperty(exports, "obtenerProducto", { enumerable: true, get: function () { return catalogo_controlador_1.obtenerProducto; } });
