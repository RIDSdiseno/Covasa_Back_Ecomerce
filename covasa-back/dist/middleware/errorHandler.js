"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const zod_1 = require("zod");
const errores_1 = require("../lib/errores");
const errorHandler = (err, _req, res, _next) => {
    if (err instanceof zod_1.ZodError) {
        return res.status(400).json({
            ok: false,
            message: "Validacion incorrecta",
            details: err.flatten(),
        });
    }
    if (err instanceof errores_1.ErrorApi) {
        return res.status(err.status).json({
            ok: false,
            message: err.message,
            details: err.details,
            code: err.code,
        });
    }
    const status = err.status || 500;
    const message = err.message || "Error interno del servidor";
    return res.status(status).json({
        ok: false,
        message,
        details: err.details,
        code: err.code,
    });
};
exports.errorHandler = errorHandler;
