import bcrypt from "bcryptjs";
import { ErrorApi } from "../../../lib/errores";
import { prisma } from "../../../lib/prisma";
import { construirDireccionLinea, normalizarTexto } from "../ecommerce.utilidades";
import {
  buscarClientePorEmail,
  buscarUsuarioPorEmail,
  actualizarClienteUsuario,
  crearCliente,
  crearUsuario,
  obtenerDireccionPrincipal,
} from "./usuarios.repositorio";

const normalizarEmail = (email: string) => normalizarTexto(email).toLowerCase();

const resolverSaltRounds = () => {
  const valor = Number(process.env.ECOMMERCE_SALT_ROUNDS ?? 10);
  if (!Number.isFinite(valor) || valor < 6 || valor > 15) {
    return 10;
  }
  return Math.floor(valor);
};

type RegistroPayload = {
  nombre: string;
  email: string;
  password: string;
  telefono?: string;
};

type LoginPayload = {
  email: string;
  password: string;
};

export const registrarUsuarioServicio = async (payload: RegistroPayload) => {
  const nombre = normalizarTexto(payload.nombre);
  const email = normalizarEmail(payload.email);
  const telefono = normalizarTexto(payload.telefono);

  if (!nombre || !email) {
    throw new ErrorApi("Nombre y email son obligatorios", 400);
  }

  const existente = await buscarUsuarioPorEmail(email);
  if (existente) {
    throw new ErrorApi("El email ya esta registrado", 409);
  }

  const passwordHash = await bcrypt.hash(payload.password, resolverSaltRounds());

  const resultado = await prisma.$transaction(async (tx) => {
    const usuario = await crearUsuario(
      {
        nombre,
        email,
        telefono: telefono || undefined,
        passwordHash,
      },
      tx
    );

    const clienteExistente = await buscarClientePorEmail(email, tx);
    if (clienteExistente && clienteExistente.usuarioId && clienteExistente.usuarioId !== usuario.id) {
      throw new ErrorApi("El email ya esta registrado", 409);
    }

    const cliente = clienteExistente
      ? await actualizarClienteUsuario(clienteExistente.id, usuario.id, tx)
      : await crearCliente(
          {
            nombres: nombre,
            emailContacto: email,
            telefono: telefono || undefined,
            usuario: { connect: { id: usuario.id } },
          },
          tx
        );

    return { usuario, cliente };
  });

  return {
    usuario: {
      ...resultado.usuario,
      ecommerceClienteId: resultado.cliente.id,
    },
    ecommerceClienteId: resultado.cliente.id,
  };
};

export const loginUsuarioServicio = async (payload: LoginPayload) => {
  const email = normalizarEmail(payload.email);
  const usuario = await buscarUsuarioPorEmail(email);
  if (!usuario) {
    throw new ErrorApi("Credenciales invalidas", 401);
  }

  const valido = await bcrypt.compare(payload.password, usuario.passwordHash);
  if (!valido) {
    throw new ErrorApi("Credenciales invalidas", 401);
  }

  const ecommerceClienteId = usuario.cliente?.id ?? null;
  const direccion = ecommerceClienteId ? await obtenerDireccionPrincipal(ecommerceClienteId) : null;

  const direccionLinea = direccion
    ? construirDireccionLinea(direccion.calle, direccion.numero, direccion.depto)
    : "";

  return {
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      telefono: usuario.telefono,
      ecommerceClienteId,
      createdAt: usuario.createdAt,
    },
    direccionPrincipal: direccion
      ? {
          id: direccion.id,
          nombreContacto: direccion.nombreRecibe,
          telefono: direccion.telefonoRecibe,
          email: direccion.email,
          direccion: direccionLinea,
          comuna: direccion.comuna,
          ciudad: direccion.ciudad,
          region: direccion.region,
          notas: direccion.notas,
        }
      : null,
  };
};
