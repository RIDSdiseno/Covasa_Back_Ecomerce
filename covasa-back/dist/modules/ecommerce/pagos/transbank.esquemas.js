"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transbankTokenSchema = exports.transbankCrearSchema = void 0;
const zod_1 = require("zod");
exports.transbankCrearSchema = zod_1.z.object({
    pedidoId: zod_1.z.string().min(1),
    returnUrl: zod_1.z.string().url().optional(),
});
exports.transbankTokenSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
});
