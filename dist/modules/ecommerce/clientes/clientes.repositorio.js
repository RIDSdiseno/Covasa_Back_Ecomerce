"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buscarClientePorId = void 0;
const prisma_1 = require("../../../lib/prisma");
const db = (tx) => tx ?? prisma_1.prisma;
const buscarClientePorId = (id, tx) => db(tx).ecommerceCliente.findUnique({
    where: { id },
    select: {
        id: true,
        nombres: true,
        apellidos: true,
        emailContacto: true,
        telefono: true,
    },
});
exports.buscarClientePorId = buscarClientePorId;
