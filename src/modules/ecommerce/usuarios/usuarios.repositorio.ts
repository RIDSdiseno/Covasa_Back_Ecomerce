import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../../lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

const db = (tx?: DbClient) => tx ?? prisma;

export const buscarUsuarioPorEmail = (email: string, tx?: DbClient) =>
  db(tx).ecommerceUsuario.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: {
      id: true,
      nombre: true,
      email: true,
      telefono: true,
      passwordHash: true,
      createdAt: true,
      cliente: { select: { id: true } },
    },
  });

export const buscarUsuarioPorId = (id: string, tx?: DbClient) =>
  db(tx).ecommerceUsuario.findUnique({
    where: { id },
    select: {
      id: true,
      nombre: true,
      email: true,
      telefono: true,
      createdAt: true,
      cliente: { select: { id: true } },
    },
  });

export const crearUsuario = (data: Prisma.EcommerceUsuarioCreateInput, tx?: DbClient) =>
  db(tx).ecommerceUsuario.create({
    data,
    select: {
      id: true,
      nombre: true,
      email: true,
      telefono: true,
      createdAt: true,
      cliente: { select: { id: true } },
    },
  });

export const buscarClientePorEmail = (email: string, tx?: DbClient) =>
  db(tx).ecommerceCliente.findFirst({
    where: {
      OR: [
        { emailContacto: { equals: email, mode: "insensitive" } },
        { usuario: { email: { equals: email, mode: "insensitive" } } },
      ],
    },
    select: {
      id: true,
      usuarioId: true,
      nombres: true,
      apellidos: true,
      emailContacto: true,
      telefono: true,
    },
  });

export const crearCliente = (data: Prisma.EcommerceClienteCreateInput, tx?: DbClient) =>
  db(tx).ecommerceCliente.create({
    data,
    select: {
      id: true,
      usuarioId: true,
      nombres: true,
      apellidos: true,
      emailContacto: true,
      telefono: true,
      createdAt: true,
    },
  });

export const actualizarClienteUsuario = (id: string, usuarioId: string, tx?: DbClient) =>
  db(tx).ecommerceCliente.update({
    where: { id },
    data: { usuario: { connect: { id: usuarioId } } },
    select: {
      id: true,
      usuarioId: true,
      nombres: true,
      apellidos: true,
      emailContacto: true,
      telefono: true,
      createdAt: true,
    },
  });

export const limpiarDireccionesPrincipales = (ecommerceClienteId: string, tx?: DbClient) =>
  db(tx).ecommerceDireccion.updateMany({
    where: { ecommerceClienteId, principal: true },
    data: { principal: false },
  });

export const crearDireccion = (data: Prisma.EcommerceDireccionCreateInput, tx?: DbClient) =>
  db(tx).ecommerceDireccion.create({
    data,
    select: {
      id: true,
      ecommerceClienteId: true,
      pedidoId: true,
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
      principal: true,
      createdAt: true,
    },
  });

export const obtenerDireccionPrincipal = (ecommerceClienteId: string, tx?: DbClient) =>
  db(tx).ecommerceDireccion.findFirst({
    where: { ecommerceClienteId, principal: true },
    orderBy: { createdAt: "desc" },
  });
