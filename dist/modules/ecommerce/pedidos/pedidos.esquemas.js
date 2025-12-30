"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pedidoCarritoIdSchema = exports.pedidoIdSchema = exports.pedidoDesdeCarritoSchema = exports.pedidoCrearSchema = void 0;
const zod_1 = require("zod");
exports.pedidoCrearSchema = zod_1.z.object({
    clienteId: zod_1.z.string().min(1).optional(),
    usuarioId: zod_1.z.string().min(1).optional(),
    despacho: zod_1.z
        .object({
        nombre: zod_1.z.string().max(200).optional(),
        telefono: zod_1.z.string().max(30).optional(),
        email: zod_1.z.string().email().optional(),
        direccion: zod_1.z.string().max(200).optional(),
        comuna: zod_1.z.string().max(100).optional(),
        ciudad: zod_1.z.string().max(100).optional(),
        region: zod_1.z.string().max(100).optional(),
        notas: zod_1.z.string().max(500).optional(),
    })
        .optional(),
    items: zod_1.z
        .array(zod_1.z.object({
        productoId: zod_1.z.string().min(1),
        cantidad: zod_1.z.number().int().positive(),
    }))
        .min(1),
});
exports.pedidoDesdeCarritoSchema = zod_1.z.object({
    usuarioId: zod_1.z.string().min(1).optional(),
    despacho: zod_1.z
        .object({
        nombre: zod_1.z.string().max(200).optional(),
        telefono: zod_1.z.string().max(30).optional(),
        email: zod_1.z.string().email().optional(),
        direccion: zod_1.z.string().max(200).optional(),
        comuna: zod_1.z.string().max(100).optional(),
        ciudad: zod_1.z.string().max(100).optional(),
        region: zod_1.z.string().max(100).optional(),
        notas: zod_1.z.string().max(500).optional(),
    })
        .optional(),
});
exports.pedidoIdSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
});
exports.pedidoCarritoIdSchema = zod_1.z.object({
    cartId: zod_1.z.string().min(1),
});
