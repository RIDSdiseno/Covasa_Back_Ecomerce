"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notificaciones_controlador_1 = require("./notificaciones.controlador");
const router = (0, express_1.Router)();
router.get("/", notificaciones_controlador_1.listarNotificaciones);
exports.default = router;
