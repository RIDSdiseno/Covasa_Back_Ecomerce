"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogoProductoIdSchema = exports.catalogoQuerySchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.catalogoQuerySchema = zod_1.z.object({
    q: zod_1.z.string().trim().min(1).optional(),
    tipo: zod_1.z.nativeEnum(client_1.ProductoTipo).optional(),
    limit: zod_1.z.coerce.number().int().positive().max(200).optional(),
    offset: zod_1.z.coerce.number().int().min(0).optional(),
});
exports.catalogoProductoIdSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
});
