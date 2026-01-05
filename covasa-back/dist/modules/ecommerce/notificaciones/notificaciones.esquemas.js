"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificacionesQuerySchema = void 0;
const zod_1 = require("zod");
const leidoSchema = zod_1.z.preprocess((valor) => {
    if (typeof valor === "string") {
        const normalizado = valor.toLowerCase();
        if (normalizado === "true")
            return true;
        if (normalizado === "false")
            return false;
    }
    return valor;
}, zod_1.z.boolean().optional());
exports.notificacionesQuerySchema = zod_1.z.object({
    leido: leidoSchema,
    limit: zod_1.z.coerce.number().int().positive().max(200).optional(),
    offset: zod_1.z.coerce.number().int().min(0).optional(),
});
