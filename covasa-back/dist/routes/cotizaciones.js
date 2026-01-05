"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cotizacionesController_1 = require("../controllers/cotizacionesController");
const router = (0, express_1.Router)();
router.post("/", cotizacionesController_1.crearCotizacion);
exports.default = router;
