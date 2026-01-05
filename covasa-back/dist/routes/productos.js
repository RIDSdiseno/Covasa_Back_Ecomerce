"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const productosController_1 = require("../controllers/productosController");
const router = (0, express_1.Router)();
router.get("/", productosController_1.listarProductos);
router.get("/:id", productosController_1.obtenerProducto);
exports.default = router;
