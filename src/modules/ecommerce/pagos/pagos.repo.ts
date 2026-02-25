import {
  EcommerceEstadoPago,
  EcommerceEstadoPedido,
  EcommerceMetodoPago,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { prisma } from "../../../lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

const db = (tx?: DbClient) => tx ?? prisma;

export const buscarPedidoPorId = (id: string, tx?: DbClient) =>
  db(tx).ecommercePedido.findUnique({
    where: { id },
    select: { id: true },
  });

export const buscarPedidoParaPago = (id: string, tx?: DbClient) =>
  db(tx).ecommercePedido.findUnique({
    where: { id },
    select: {
      id: true,
      codigo: true,
      total: true,
      estado: true,
      ecommerceClienteId: true,
    },
  });

export const buscarPedidoParaMercadoPago = (id: string, tx?: DbClient) =>
  db(tx).ecommercePedido.findUnique({
    where: { id },
    select: {
      id: true,
      codigo: true,
      total: true,
      estado: true,
      despachoEmail: true,
      items: {
        select: {
          id: true,
          productoId: true,
          descripcionSnapshot: true,
          cantidad: true,
          totalSnapshot: true,
        },
      },
    },
  });

export const crearPago = (data: Prisma.EcommercePagoCreateInput, tx?: DbClient) =>
  db(tx).ecommercePago.create({
    data,
    select: {
      id: true,
      estado: true,
      monto: true,
      createdAt: true,
    },
  });

export const buscarPagoPorId = (id: string, tx?: DbClient) =>
  db(tx).ecommercePago.findUnique({
    where: { id },
  });

export const buscarPagoPorReferencia = (referencia: string, tx?: DbClient) =>
  db(tx).ecommercePago.findFirst({
    where: { referencia },
  });

export const buscarPagoPendientePorPedidoMetodo = (
  pedidoId: string,
  metodo: EcommerceMetodoPago,
  tx?: DbClient
) =>
  db(tx).ecommercePago.findFirst({
    where: {
      pedidoId,
      metodo,
      estado: EcommerceEstadoPago.PENDIENTE,
    },
    orderBy: { createdAt: "desc" },
  });

export const listarPagosPorMetodo = (
  metodo: EcommerceMetodoPago,
  limit = 200,
  tx?: DbClient
) =>
  db(tx).ecommercePago.findMany({
    where: { metodo },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

export const actualizarPagoDatos = (
  id: string,
  data: Prisma.EcommercePagoUpdateInput,
  tx?: DbClient
) =>
  db(tx).ecommercePago.update({
    where: { id },
    data,
  });

export const actualizarPagoEstado = (
  id: string,
  estado: EcommerceEstadoPago,
  tx?: DbClient
) =>
  db(tx).ecommercePago.update({
    where: { id },
    data: { estado },
  });

export const actualizarPedidoEstado = (
  id: string,
  estado: EcommerceEstadoPedido,
  tx?: DbClient
) =>
  db(tx).ecommercePedido.update({
    where: { id },
    data: { estado },
  });


export const obtenerPagoParaRecibo = (id: string, tx?: DbClient) =>
  db(tx).ecommercePago.findUnique({
    where: { id },
    select: {
      id: true,
      metodo: true,
      estado: true,
      monto: true,
      createdAt: true,
      gatewayPayloadJson: true,
      pedido: {
        select: {
          id: true,
          codigo: true,
          total: true,
          estado: true,
          createdAt: true,
          direccion: {
            select: {
              nombreRecibe: true,
              telefonoRecibe: true,
              email: true,
              calle: true,
              numero: true,
              depto: true,
              comuna: true,
              ciudad: true,
              region: true,
              codigoPostal: true,
              notas: true,
            },
          },
        },
      },
    },
  });

export const listarPagosPorUsuario = (usuarioId: string, email?: string, tx?: DbClient) =>
  db(tx).ecommercePago.findMany({
    where: {
      pedido: {
        OR: [
          {
            ecommerceCliente: {
              is: {
                usuarioId,
              },
            },
          },
          ...(email ? [{ despachoEmail: email }] : []),
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      metodo: true,
      estado: true,
      monto: true,
      referencia: true,
      gatewayPayloadJson: true,
      createdAt: true,
      updatedAt: true,
      pedido: {
        select: {
          id: true,
          codigo: true,
          total: true,
          estado: true,
          createdAt: true,
        },
      },
    },
  });

export const obtenerPagoDetallePorUsuario = (
  id: string,
  usuarioId: string,
  email?: string,
  tx?: DbClient
) =>
  db(tx).ecommercePago.findFirst({
    where: {
      id,
      pedido: {
        OR: [
          {
            ecommerceCliente: {
              is: {
                usuarioId,
              },
            },
          },
          ...(email ? [{ despachoEmail: email }] : []),
        ],
      },
    },
    select: {
      id: true,
      metodo: true,
      estado: true,
      monto: true,
      referencia: true,
      gatewayPayloadJson: true,
      createdAt: true,
      updatedAt: true,
      pedido: {
        select: {
          id: true,
          codigo: true,
          total: true,
          subtotalNeto: true,
          iva: true,
          estado: true,
          createdAt: true,
          direccion: {
            select: {
              nombreRecibe: true,
              telefonoRecibe: true,
              email: true,
              calle: true,
              numero: true,
              depto: true,
              comuna: true,
              ciudad: true,
              region: true,
              codigoPostal: true,
              notas: true,
            },
          },
          ecommerceCliente: {
            select: {
              nombres: true,
              apellidos: true,
              emailContacto: true,
              telefono: true,
            },
          },
          items: {
            select: {
              descripcionSnapshot: true,
              cantidad: true,
              precioUnitarioNetoSnapshot: true,
              subtotalNetoSnapshot: true,
              ivaPctSnapshot: true,
              ivaMontoSnapshot: true,
              totalSnapshot: true,
            },
          },
        },
      },
    },
  });

export const listarPagosParaIntegracion = (
  params: { since?: Date; estado?: EcommerceEstadoPago; limit: number },
  tx?: DbClient
) =>
  db(tx).ecommercePago.findMany({
    where: {
      ...(params.estado ? { estado: params.estado } : {}),
      ...(params.since ? { updatedAt: { gte: params.since } } : {}),
    },
    orderBy: { updatedAt: "asc" },
    take: params.limit,
    select: {
      id: true,
      pedidoId: true,
      metodo: true,
      estado: true,
      monto: true,
      referencia: true,
      createdAt: true,
      updatedAt: true,
      pedido: {
        select: {
          id: true,
          correlativo: true,
          codigo: true,
          ecommerceClienteId: true,
          clienteId: true,
          despachoNombre: true,
          despachoTelefono: true,
          despachoEmail: true,
          despachoDireccion: true,
          despachoComuna: true,
          despachoCiudad: true,
          despachoRegion: true,
          subtotalNeto: true,
          iva: true,
          total: true,
          estado: true,
          createdAt: true,
          updatedAt: true,
          crmCotizacionId: true,
          crmCotizacion: {
            select: {
              vendedorId: true,
            },
          },
        },
      },
    },
  });
