"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buscarClientePorId = void 0;
const prisma_1 = require("../../../lib/prisma");
const db = (tx) => tx ?? prisma_1.prisma;
const buscarClientePorId = (id, tx) => db(tx).cliente.findUnique({
    where: { id },
    select: {
        id: true,
        nombre: true,
        personaContacto: true,
        email: true,
        telefono: true,
        direccion: true,
        comuna: true,
        ciudad: true,
        region: true,
    },
});
exports.buscarClientePorId = buscarClientePorId;
