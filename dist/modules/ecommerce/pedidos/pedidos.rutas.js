"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pedidos_controlador_1 = require("./pedidos.controlador");
const router = (0, express_1.Router)();
router.post("/", pedidos_controlador_1.crearPedido);
router.post("/from-cart/:cartId", pedidos_controlador_1.crearPedidoDesdeCarrito);
router.get("/:id", pedidos_controlador_1.obtenerPedido);
exports.default = router;
