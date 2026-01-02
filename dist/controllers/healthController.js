"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthAuth = exports.healthCheck = void 0;
const manejarAsync_1 = require("../lib/manejarAsync");
const usuarios_esquemas_1 = require("../modules/ecommerce/usuarios/usuarios.esquemas");
const usuarios_servicio_1 = require("../modules/ecommerce/usuarios/usuarios.servicio");
const healthCheck = (_req, res) => {
    res.json({ ok: true, data: { status: "ok" } });
};
exports.healthCheck = healthCheck;
// POST /api/health/auth
// Input: { email, password }. Output: { usuarioId, ecommerceClienteId }.
exports.healthAuth = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const payload = usuarios_esquemas_1.usuarioLoginSchema.parse(req.body);
    const resultado = await (0, usuarios_servicio_1.loginUsuarioServicio)(payload);
    res.json({
        ok: true,
        data: {
            usuarioId: resultado.usuario.id,
            ecommerceClienteId: resultado.usuario.ecommerceClienteId ?? null,
        },
        message: "Auth OK",
    });
});
