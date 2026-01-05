"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mercadoPagoCrearSchema = void 0;
const zod_1 = require("zod");
exports.mercadoPagoCrearSchema = zod_1.z.object({
    pedidoId: zod_1.z.string().min(1),
});
