import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../../lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

const db = (tx?: DbClient) => tx ?? prisma;

export const buscarUsuarioPorEmail = (email: string, tx?: DbClient) =>
  db(tx).ecommerceUsuario.findUnique({
    where: { email },
    select: {
      id: true,
      nombre: true,
      email: true,
      telefono: true,
      passwordHash: true,
      clienteId: true,
      createdAt: true,
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
      clienteId: true,
      createdAt: true,
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
      clienteId: true,
      createdAt: true,
    },
  });

export const buscarClientePorEmail = (email: string, tx?: DbClient) =>
  db(tx).cliente.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
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

export const limpiarDireccionesPrincipales = (usuarioId: string, tx?: DbClient) =>
  db(tx).ecommerceDireccion.updateMany({
    where: { usuarioId, esPrincipal: true },
    data: { esPrincipal: false },
  });

export const crearDireccion = (data: Prisma.EcommerceDireccionCreateInput, tx?: DbClient) =>
  db(tx).ecommerceDireccion.create({
    data,
    select: {
      id: true,
      usuarioId: true,
      pedidoId: true,
      nombreContacto: true,
      telefono: true,
      email: true,
      direccion: true,
      comuna: true,
      ciudad: true,
      region: true,
      notas: true,
      esPrincipal: true,
      createdAt: true,
    },
  });

export const obtenerDireccionPrincipal = (usuarioId: string, tx?: DbClient) =>
  db(tx).ecommerceDireccion.findFirst({
    where: { usuarioId, esPrincipal: true },
    orderBy: { createdAt: "desc" },
  });
