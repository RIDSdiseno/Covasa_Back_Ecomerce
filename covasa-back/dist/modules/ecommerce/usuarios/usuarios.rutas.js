"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const usuarios_controlador_1 = require("./usuarios.controlador");
const router = (0, express_1.Router)();
router.post("/registro", usuarios_controlador_1.registrarUsuario);
router.post("/login", usuarios_controlador_1.loginUsuario);
exports.default = router;
