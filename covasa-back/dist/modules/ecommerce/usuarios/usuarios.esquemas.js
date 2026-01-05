"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usuarioIdSchema = exports.usuarioLoginSchema = exports.usuarioRegistroSchema = void 0;
const zod_1 = require("zod");
exports.usuarioRegistroSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(1).max(200),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6).max(100),
    telefono: zod_1.z.string().max(30).optional(),
});
exports.usuarioLoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6).max(100),
});
exports.usuarioIdSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
});
