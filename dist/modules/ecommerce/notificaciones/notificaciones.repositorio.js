"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listarNotificaciones = exports.crearNotificacion = void 0;
const prisma_1 = require("../../../lib/prisma");
const db = (tx) => tx ?? prisma_1.prisma;
const crearNotificacion = (datos, tx) => db(tx).ecommerceNotificacion.create({
    data: datos,
    select: {
        id: true,
        tipo: true,
        titulo: true,
        detalle: true,
        leido: true,
        createdAt: true,
    },
});
exports.crearNotificacion = crearNotificacion;
const listarNotificaciones = (filtros) => prisma_1.prisma.ecommerceNotificacion.findMany({
    where: {
        leido: typeof filtros.leido === "boolean" ? filtros.leido : undefined,
    },
    orderBy: {
        createdAt: "desc",
    },
    take: filtros.limit,
    skip: filtros.offset,
});
exports.listarNotificaciones = listarNotificaciones;
