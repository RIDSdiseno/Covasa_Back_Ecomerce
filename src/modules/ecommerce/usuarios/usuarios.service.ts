import bcrypt from "bcryptjs";
import { ErrorApi } from "../../../lib/errores";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { JWTPayload } from "jose";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../../../lib/prisma";
import { construirDireccionLinea, normalizarTexto } from "../common/ecommerce.utils";
import {
  buscarClientePorEmail,
  buscarUsuarioPorEmail,
  buscarUsuarioPorId,
  buscarUsuarioPorMicrosoftSubject,
  buscarUsuarioPorGoogleSubject,
  actualizarClienteUsuario,
  actualizarUsuario,
  crearCliente,
  crearUsuario,
  obtenerDireccionPrincipal,
} from "./usuarios.repo";

const normalizarEmail = (email: string) => normalizarTexto(email).toLowerCase();

const flagHabilitada = (valor?: string) => {
  const normalizado = normalizarTexto(valor).toLowerCase();
  return normalizado === "true" || normalizado === "1" || normalizado === "yes" || normalizado === "on";
};

const resolverJwtSecret = () => {
  const secreto = normalizarTexto(process.env.JWT_SECRET);
  if (!secreto) {
    throw new ErrorApi("JWT_SECRET no configurado", 500);
  }
  return secreto;
};

const resolverMicrosoftClientId = () => {
  const clientId = normalizarTexto(process.env.MS_CLIENT_ID);
  if (!clientId) {
    throw new ErrorApi("MS_CLIENT_ID no configurado", 500);
  }
  return clientId;
};

const resolverMicrosoftTenant = () => normalizarTexto(process.env.MS_TENANT || "common") || "common";

const resolverGoogleClientId = () => {
  const clientId = normalizarTexto(process.env.GOOGLE_CLIENT_ID);
  if (!clientId) {
    throw new ErrorApi("GOOGLE_CLIENT_ID no configurado", 500);
  }
  return clientId;
};

let googleClient: OAuth2Client | null = null;

const obtenerGoogleClient = () => {
  if (!googleClient) {
    googleClient = new OAuth2Client(resolverGoogleClientId());
  }
  return googleClient;
};

let microsoftJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let microsoftTenantCache = "";

const obtenerMicrosoftJwks = (tenant: string) => {
  if (!microsoftJwks || microsoftTenantCache !== tenant) {
    microsoftTenantCache = tenant;
    microsoftJwks = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`)
    );
  }
  return microsoftJwks;
};

const issuerValido = (issuer: string | undefined, tenant: string) => {
  const valor = normalizarTexto(issuer).toLowerCase();
  if (!valor) {
    return false;
  }

  const tenantNormalizado = tenant.toLowerCase();
  if (tenantNormalizado !== "common") {
    return valor === `https://login.microsoftonline.com/${tenantNormalizado}/v2.0`;
  }

  return valor.startsWith("https://login.microsoftonline.com/") && valor.endsWith("/v2.0");
};

type MicrosoftClaims = JWTPayload & {
  oid?: string;
  preferred_username?: string;
  email?: string;
  name?: string;
};

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

type MicrosoftLoginPayload = {
  idToken: string;
};

type GoogleLoginPayload = {
  credential: string;
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

  if (!usuario.passwordHash) {
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

export const loginMicrosoftServicio = async (payload: MicrosoftLoginPayload) => {
  if (!flagHabilitada(process.env.AUTH_MICROSOFT_ENABLED)) {
    throw new ErrorApi("Login Microsoft deshabilitado", 403);
  }

  const tenant = resolverMicrosoftTenant();
  const clientId = resolverMicrosoftClientId();
  const jwks = obtenerMicrosoftJwks(tenant);

  let tokenPayload: JWTPayload;
  try {
    const result = await jwtVerify(payload.idToken, jwks, { audience: clientId });
    tokenPayload = result.payload;
  } catch {
    throw new ErrorApi("Token Microsoft invalido", 401);
  }

  if (!issuerValido(typeof tokenPayload.iss === "string" ? tokenPayload.iss : "", tenant)) {
    throw new ErrorApi("Token Microsoft invalido", 401);
  }

  const claims = tokenPayload as MicrosoftClaims;
  const subject = normalizarTexto(claims.oid) || normalizarTexto(claims.sub);
  if (!subject) {
    throw new ErrorApi("Token Microsoft invalido", 401);
  }

  const emailClaim = normalizarTexto(claims.email);
  const preferredUsername = normalizarTexto(claims.preferred_username);
  const emailCandidate = emailClaim || preferredUsername;
  const email = emailCandidate ? normalizarEmail(emailCandidate) : "";
  if (!email) {
    throw new ErrorApi("No se pudo obtener email Microsoft", 400);
  }

  const nombre = normalizarTexto(claims.name) || email;

  const resultado = await prisma.$transaction(async (tx) => {
    let usuario = await buscarUsuarioPorMicrosoftSubject(subject, tx);

    if (!usuario && email) {
      const usuarioPorEmail = await buscarUsuarioPorEmail(email, tx);
      if (usuarioPorEmail) {
        usuario = await actualizarUsuario(
          usuarioPorEmail.id,
          {
            microsoftSubject: subject,
            authProvider: "MICROSOFT",
            nombre,
            email,
          },
          tx
        );
      }
    }

    if (!usuario) {
      usuario = await crearUsuario(
        {
          nombre,
          email,
          passwordHash: null,
          authProvider: "MICROSOFT",
          microsoftSubject: subject,
        },
        tx
      );
    } else {
      const updates: Parameters<typeof actualizarUsuario>[1] = {};
      if (usuario.authProvider !== "MICROSOFT") {
        updates.authProvider = "MICROSOFT";
      }
      if (email && (!usuario.email || usuario.email.toLowerCase() !== email.toLowerCase())) {
        updates.email = email;
      }
      if (nombre && usuario.nombre !== nombre) {
        updates.nombre = nombre;
      }
      if (!usuario.microsoftSubject) {
        updates.microsoftSubject = subject;
      }
      if (Object.keys(updates).length > 0) {
        usuario = await actualizarUsuario(usuario.id, updates, tx);
      }
    }

    const clienteExistente = await buscarClientePorEmail(email, tx);
    let cliente = null;

    if (clienteExistente) {
      if (clienteExistente.usuarioId && clienteExistente.usuarioId !== usuario.id) {
        throw new ErrorApi("El email ya esta registrado", 409);
      }
      cliente = clienteExistente.usuarioId
        ? clienteExistente
        : await actualizarClienteUsuario(clienteExistente.id, usuario.id, tx);
    } else {
      cliente = await crearCliente(
        {
          nombres: nombre,
          emailContacto: email,
          usuario: { connect: { id: usuario.id } },
        },
        tx
      );
    }

    return { usuario, cliente };
  });

  const ecommerceClienteId = resultado.cliente?.id ?? resultado.usuario.cliente?.id ?? null;
  const direccion = ecommerceClienteId ? await obtenerDireccionPrincipal(ecommerceClienteId) : null;
  const direccionLinea = direccion
    ? construirDireccionLinea(direccion.calle, direccion.numero, direccion.depto)
    : "";

  const token = jwt.sign(
    {
      sub: resultado.usuario.id,
      provider: "MICROSOFT",
      role: "CLIENTE_ECOMMERCE",
    },
    resolverJwtSecret(),
    { expiresIn: "7d" }
  );

  return {
    token,
    user: {
      id: resultado.usuario.id,
      nombre: resultado.usuario.nombre,
      email: resultado.usuario.email ?? email,
      telefono: resultado.usuario.telefono,
      ecommerceClienteId,
      createdAt: resultado.usuario.createdAt,
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

export const obtenerUsuarioServicio = async (usuarioId: string) => {
  const usuario = await buscarUsuarioPorId(usuarioId);
  if (!usuario) {
    throw new ErrorApi("Usuario no encontrado", 404);
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

export const loginGoogleServicio = async (payload: GoogleLoginPayload) => {
  if (!flagHabilitada(process.env.AUTH_GOOGLE_ENABLED)) {
    throw new ErrorApi("Login Google deshabilitado", 403);
  }

  const client = obtenerGoogleClient();

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken: payload.credential,
      audience: resolverGoogleClientId(),
    });
  } catch {
    throw new ErrorApi("Token Google invalido", 401);
  }

  const googlePayload = ticket.getPayload();
  if (!googlePayload) {
    throw new ErrorApi("Token Google invalido", 401);
  }

  const subject = normalizarTexto(googlePayload.sub);
  if (!subject) {
    throw new ErrorApi("Token Google invalido", 401);
  }

  const email = googlePayload.email ? normalizarEmail(googlePayload.email) : "";
  if (!email) {
    throw new ErrorApi("No se pudo obtener email de Google", 400);
  }

  const nombre = normalizarTexto(googlePayload.name) || email;

  const resultado = await prisma.$transaction(async (tx) => {
    let usuario = await buscarUsuarioPorGoogleSubject(subject, tx);

    if (!usuario && email) {
      const usuarioPorEmail = await buscarUsuarioPorEmail(email, tx);
      if (usuarioPorEmail) {
        usuario = await actualizarUsuario(
          usuarioPorEmail.id,
          {
            googleSubject: subject,
            authProvider: "GOOGLE",
            nombre,
            email,
          },
          tx
        );
      }
    }

    if (!usuario) {
      usuario = await crearUsuario(
        {
          nombre,
          email,
          passwordHash: null,
          authProvider: "GOOGLE",
          googleSubject: subject,
        },
        tx
      );
    } else {
      const updates: Parameters<typeof actualizarUsuario>[1] = {};
      if (usuario.authProvider !== "GOOGLE") {
        updates.authProvider = "GOOGLE";
      }
      if (email && (!usuario.email || usuario.email.toLowerCase() !== email.toLowerCase())) {
        updates.email = email;
      }
      if (nombre && usuario.nombre !== nombre) {
        updates.nombre = nombre;
      }
      if (!usuario.googleSubject) {
        updates.googleSubject = subject;
      }
      if (Object.keys(updates).length > 0) {
        usuario = await actualizarUsuario(usuario.id, updates, tx);
      }
    }

    const clienteExistente = await buscarClientePorEmail(email, tx);
    let cliente = null;

    if (clienteExistente) {
      if (clienteExistente.usuarioId && clienteExistente.usuarioId !== usuario.id) {
        throw new ErrorApi("El email ya esta registrado", 409);
      }
      cliente = clienteExistente.usuarioId
        ? clienteExistente
        : await actualizarClienteUsuario(clienteExistente.id, usuario.id, tx);
    } else {
      cliente = await crearCliente(
        {
          nombres: nombre,
          emailContacto: email,
          usuario: { connect: { id: usuario.id } },
        },
        tx
      );
    }

    return { usuario, cliente };
  });

  const ecommerceClienteId = resultado.cliente?.id ?? resultado.usuario.cliente?.id ?? null;
  const direccion = ecommerceClienteId ? await obtenerDireccionPrincipal(ecommerceClienteId) : null;
  const direccionLinea = direccion
    ? construirDireccionLinea(direccion.calle, direccion.numero, direccion.depto)
    : "";

  const token = jwt.sign(
    {
      sub: resultado.usuario.id,
      provider: "GOOGLE",
      role: "CLIENTE_ECOMMERCE",
    },
    resolverJwtSecret(),
    { expiresIn: "7d" }
  );

  return {
    token,
    user: {
      id: resultado.usuario.id,
      nombre: resultado.usuario.nombre,
      email: resultado.usuario.email ?? email,
      telefono: resultado.usuario.telefono,
      ecommerceClienteId,
      createdAt: resultado.usuario.createdAt,
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
