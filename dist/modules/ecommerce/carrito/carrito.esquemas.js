"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.carritoItemParamSchema = exports.carritoItemActualizarSchema = exports.carritoItemAgregarSchema = exports.carritoIdSchema = exports.carritoCrearSchema = void 0;
const zod_1 = require("zod");
exports.carritoCrearSchema = zod_1.z.object({
    ecommerceClienteId: zod_1.z.string().min(1).optional(),
    clienteId: zod_1.z.string().min(1).optional(),
});
exports.carritoIdSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
});
exports.carritoItemAgregarSchema = zod_1.z.object({
    productoId: zod_1.z.string().min(1),
    cantidad: zod_1.z.number().int().positive(),
});
exports.carritoItemActualizarSchema = zod_1.z.object({
    cantidad: zod_1.z.number().int().positive(),
});
exports.carritoItemParamSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    itemId: zod_1.z.string().min(1),
});
