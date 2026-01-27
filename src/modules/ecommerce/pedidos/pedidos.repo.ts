import {
  EcommerceEstadoCarrito,
  EcommerceEstadoPedido,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { prisma } from "../../../lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

const db = (tx?: DbClient) => tx ?? prisma;

export const buscarProductosPorIds = (ids: string[], tx?: DbClient) =>
  db(tx).producto.findMany({
    where: { id: { in: ids }, activo: true, visibleEcommerce: true },
    include: {
      ProductoVariante: {
        where: { activa: true },
        select: {
          id: true,
          atributo: true,
          valor: true,
          precio: true,
          stock: true,
          skuVariante: true,
        },
      },
    },
  });

export const buscarVariantesPorIds = (ids: string[], tx?: DbClient) =>
  db(tx).productoVariante.findMany({
    where: { id: { in: ids }, activa: true },
    select: {
      id: true,
      productoId: true,
      atributo: true,
      valor: true,
      precio: true,
      stock: true,
      skuVariante: true,
    },
  });

export const buscarClientePorId = (id: string, tx?: DbClient) =>
  db(tx).ecommerceCliente.findUnique({
    where: { id },
    select: {
      id: true,
      nombres: true,
      apellidos: true,
      emailContacto: true,
      telefono: true,
    },
  });

export const crearPedido = (data: Prisma.EcommercePedidoCreateInput, tx?: DbClient) =>
  db(tx).ecommercePedido.create({
    data,
    select: {
      id: true,
      correlativo: true,
      codigo: true,
      estado: true,
      subtotalNeto: true,
      iva: true,
      total: true,
      createdAt: true,
    },
  });

export const actualizarCodigoPedido = (id: string, codigo: string, tx?: DbClient) =>
  db(tx).ecommercePedido.update({
    where: { id },
    data: { codigo },
    select: {
      id: true,
      codigo: true,
      estado: true,
      subtotalNeto: true,
      iva: true,
      total: true,
      createdAt: true,
    },
  });

export const actualizarEstadoPedido = (
  id: string,
  estado: EcommerceEstadoPedido,
  tx?: DbClient
) =>
  db(tx).ecommercePedido.update({
    where: { id },
    data: { estado },
  });

export const obtenerPedidoPorId = (id: string) =>
  prisma.ecommercePedido.findUnique({
    where: { id },
    include: { items: true, pagos: true, direccion: true },
  });

export const obtenerCarritoPorId = (id: string, tx?: DbClient) =>
  db(tx).ecommerceCarrito.findUnique({
    where: { id },
    include: { items: true },
  });

export const actualizarCarritoEstado = (
  id: string,
  estado: EcommerceEstadoCarrito,
  tx?: DbClient
) =>
  db(tx).ecommerceCarrito.update({
    where: { id },
    data: { estado },
  });
