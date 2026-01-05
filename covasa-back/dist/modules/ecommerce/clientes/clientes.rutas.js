"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const clientes_controlador_1 = require("./clientes.controlador");
const router = (0, express_1.Router)();
router.get("/:id", clientes_controlador_1.obtenerCliente);
exports.default = router;
