"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pagoIdSchema = exports.pagoCrearSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.pagoCrearSchema = zod_1.z.object({
    pedidoId: zod_1.z.string().min(1),
    metodo: zod_1.z.nativeEnum(client_1.EcommerceMetodoPago),
    monto: zod_1.z.number().int().positive(),
    referencia: zod_1.z.string().max(200).optional(),
    evidenciaUrl: zod_1.z.string().url().max(500).optional(),
    gatewayPayloadJson: zod_1.z.unknown().optional(),
});
exports.pagoIdSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
});
