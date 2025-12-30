"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cotizaciones_controlador_1 = require("./cotizaciones.controlador");
const router = (0, express_1.Router)();
router.post("/", cotizaciones_controlador_1.crearQuote);
router.get("/:id", cotizaciones_controlador_1.obtenerCotizacion);
router.post("/:id/convert-to-cart", cotizaciones_controlador_1.convertirCotizacionACarrito);
exports.default = router;
