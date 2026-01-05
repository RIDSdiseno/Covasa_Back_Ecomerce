"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clienteIdSchema = void 0;
const zod_1 = require("zod");
exports.clienteIdSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
});
