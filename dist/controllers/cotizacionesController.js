"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.obtenerCotizacion = exports.crearCotizacion = void 0;
// Reexporta controlador ecommerce para mantener /api/cotizaciones.
var cotizaciones_controlador_1 = require("../modules/ecommerce/cotizaciones/cotizaciones.controlador");
Object.defineProperty(exports, "crearCotizacion", { enumerable: true, get: function () { return cotizaciones_controlador_1.crearCotizacion; } });
Object.defineProperty(exports, "obtenerCotizacion", { enumerable: true, get: function () { return cotizaciones_controlador_1.obtenerCotizacion; } });
