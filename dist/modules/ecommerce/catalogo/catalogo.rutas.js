"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const catalogo_controlador_1 = require("./catalogo.controlador");
const router = (0, express_1.Router)();
router.get("/", catalogo_controlador_1.listarProductos);
router.get("/:id", catalogo_controlador_1.obtenerProducto);
exports.default = router;
