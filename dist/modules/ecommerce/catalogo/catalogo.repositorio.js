"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buscarProductoPorId = exports.buscarProductos = void 0;
const prisma_1 = require("../../../lib/prisma");
const buscarProductos = (filtros) => prisma_1.prisma.producto.findMany({
    where: {
        nombre: filtros.q ? { contains: filtros.q, mode: "insensitive" } : undefined,
        tipo: filtros.tipo,
    },
    include: {
        Inventario: {
            select: {
                stock: true,
            },
        },
        ProductoImagen: {
            select: {
                url: true,
                orden: true,
            },
        },
    },
    orderBy: {
        nombre: "asc",
    },
    take: filtros.limit,
    skip: filtros.offset,
});
exports.buscarProductos = buscarProductos;
const buscarProductoPorId = (id) => prisma_1.prisma.producto.findUnique({
    where: { id },
    include: {
        Inventario: {
            select: {
                stock: true,
            },
        },
        ProductoImagen: {
            select: {
                url: true,
                orden: true,
            },
        },
    },
});
exports.buscarProductoPorId = buscarProductoPorId;
