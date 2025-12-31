"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cotizacionIdSchema = exports.quoteCrearSchema = exports.cotizacionCrearSchema = void 0;
const zod_1 = require("zod");
exports.cotizacionCrearSchema = zod_1.z.object({
    ecommerceClienteId: zod_1.z.string().min(1).optional(),
    clienteId: zod_1.z.string().min(1).optional(),
    contacto: zod_1.z.object({
        nombre: zod_1.z.string().min(1).max(200),
        email: zod_1.z.string().email(),
        telefono: zod_1.z.string().min(6).max(30),
        empresa: zod_1.z.string().max(200).optional(),
        rut: zod_1.z.string().max(30).optional(),
        tipoObra: zod_1.z.string().min(1).max(120).optional(),
        ubicacion: zod_1.z.string().min(1).max(120).optional(),
    }),
    observaciones: zod_1.z.string().max(1000).optional(),
    ocCliente: zod_1.z.string().max(100).optional(),
    ocNumero: zod_1.z.string().max(100).optional(),
    canal: zod_1.z.string().max(50).optional(),
    items: zod_1.z
        .array(zod_1.z.object({
        productoId: zod_1.z.string().min(1),
        cantidad: zod_1.z.number().int().positive(),
    }))
        .min(1),
});
exports.quoteCrearSchema = zod_1.z.object({
    nombreContacto: zod_1.z.string().min(1).max(200),
    empresa: zod_1.z.string().max(200).optional(),
    email: zod_1.z.string().email(),
    telefono: zod_1.z.string().min(6).max(30),
    tipoObra: zod_1.z.string().min(1).max(120),
    comunaRegion: zod_1.z.string().min(1).max(120),
    ocCliente: zod_1.z.string().max(100).optional(),
    detalleAdicional: zod_1.z.string().max(1000).optional(),
    items: zod_1.z
        .array(zod_1.z.object({
        productoId: zod_1.z.string().min(1),
        cantidad: zod_1.z.number().int().positive(),
    }))
        .min(1),
});
exports.cotizacionIdSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
});
