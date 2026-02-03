import { Prisma, PrismaClient, EcommerceEstadoCotizacion } from "@prisma/client";
import { prisma } from "../../../lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

const db = (tx?: DbClient) => tx ?? prisma;

export const buscarProductosPorIds = (ids: string[], tx?: DbClient) =>
  db(tx).producto.findMany({
    where: {
      id: { in: ids },
      activo: true,
      visibleEcommerce: true,
    },
  });

export const buscarClientePorId = (id: string, tx?: DbClient) =>
  db(tx).ecommerceCliente.findUnique({
    where: { id },
    select: { id: true },
  });

export const crearCotizacion = (data: Prisma.EcommerceCotizacionCreateInput, tx?: DbClient) =>
  db(tx).ecommerceCotizacion.create({
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

export const actualizarCodigoCotizacion = (id: string, codigo: string, tx?: DbClient) =>
  db(tx).ecommerceCotizacion.update({
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

export const actualizarEstadoCotizacion = (
  id: string,
  estado: EcommerceEstadoCotizacion,
  tx?: DbClient
) =>
  db(tx).ecommerceCotizacion.update({
    where: { id },
    data: { estado },
  });

export const obtenerCotizacionPorId = (id: string) =>
  prisma.ecommerceCotizacion.findUnique({
    where: { id },
    include: {
      items: true,
    },
  });

export const obtenerCotizacionConItems = (id: string, tx?: DbClient) =>
  db(tx).ecommerceCotizacion.findUnique({
    where: { id },
    include: { items: true },
  });

export const obtenerCotizacionParaEliminar = (
  id: string,
  ecommerceClienteId: string,
  tx?: DbClient
) =>
  db(tx).ecommerceCotizacion.findFirst({
    where: { id, ecommerceClienteId },
    select: {
      id: true,
      codigo: true,
      estado: true,
      ecommerceClienteId: true,
      crmCotizacionId: true,
      metadata: true,
      crmCotizacion: { select: { estado: true } },
    },
  });

export const actualizarCotizacionCancelacion = (
  id: string,
  data: { estado: EcommerceEstadoCotizacion; metadata: Prisma.InputJsonValue },
  tx?: DbClient
) =>
  db(tx).ecommerceCotizacion.update({
    where: { id },
    data,
  });

export const eliminarCotizacionItems = (cotizacionId: string, tx?: DbClient) =>
  db(tx).ecommerceCotizacionItem.deleteMany({
    where: { cotizacionId },
  });

export const eliminarCotizacion = (cotizacionId: string, tx?: DbClient) =>
  db(tx).ecommerceCotizacion.delete({
    where: { id: cotizacionId },
  });
