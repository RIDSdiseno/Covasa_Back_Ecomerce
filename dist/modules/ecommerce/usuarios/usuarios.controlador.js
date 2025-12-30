"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginUsuario = exports.registrarUsuario = void 0;
const manejarAsync_1 = require("../../../lib/manejarAsync");
const usuarios_esquemas_1 = require("./usuarios.esquemas");
const usuarios_servicio_1 = require("./usuarios.servicio");
// POST /api/ecommerce/usuarios/registro
// Input: { nombre, email, password, telefono? }. Output: usuario registrado.
exports.registrarUsuario = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const payload = usuarios_esquemas_1.usuarioRegistroSchema.parse(req.body);
    const resultado = await (0, usuarios_servicio_1.registrarUsuarioServicio)(payload);
    res.status(201).json({
        ok: true,
        data: resultado,
        message: "Usuario ecommerce registrado",
    });
});
// POST /api/ecommerce/usuarios/login
// Input: { email, password }. Output: usuario y direccion principal.
exports.loginUsuario = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const payload = usuarios_esquemas_1.usuarioLoginSchema.parse(req.body);
    const resultado = await (0, usuarios_servicio_1.loginUsuarioServicio)(payload);
    res.json({
        ok: true,
        data: resultado,
        message: "Login correcto",
    });
});
