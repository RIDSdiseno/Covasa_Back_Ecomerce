import bcrypt from "bcryptjs";
import { ErrorApi } from "../../../lib/errores";
import { normalizarTexto } from "../ecommerce.utilidades";
import {
  buscarClientePorEmail,
  buscarUsuarioPorEmail,
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

  const cliente = await buscarClientePorEmail(email);
  const passwordHash = await bcrypt.hash(payload.password, resolverSaltRounds());

  const usuario = await crearUsuario({
    nombre,
    email,
    telefono: telefono || undefined,
    passwordHash,
    cliente: cliente ? { connect: { id: cliente.id } } : undefined,
  });

  return {
    usuario,
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

  const direccion = await obtenerDireccionPrincipal(usuario.id);

  return {
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      telefono: usuario.telefono,
      clienteId: usuario.clienteId,
      createdAt: usuario.createdAt,
    },
    direccionPrincipal: direccion
      ? {
          id: direccion.id,
          nombreContacto: direccion.nombreContacto,
          telefono: direccion.telefono,
          email: direccion.email,
          direccion: direccion.direccion,
          comuna: direccion.comuna,
          ciudad: direccion.ciudad,
          region: direccion.region,
          notas: direccion.notas,
        }
      : null,
  };
};
