import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import {
  usuarioLoginSchema,
  usuarioMicrosoftSchema,
  usuarioGoogleSchema,
  usuarioRegistroSchema,
} from "./usuarios.schema";
import {
  loginMicrosoftServicio,
  loginGoogleServicio,
  loginUsuarioServicio,
  registrarUsuarioServicio,
  obtenerUsuarioServicio,
} from "./usuarios.service";

/**
 * POST /api/ecommerce/usuarios/registro
 * Body: { nombre, email, password, telefono? }
 * Respuesta: { ok, data: { usuario, ecommerceClienteId }, message }
 */
export const registrarUsuario = manejarAsync(async (req: Request, res: Response) => {
  // 1) Validación con Zod
  const payload = usuarioRegistroSchema.parse(req.body);

  // 2) Lógica de negocio (service)
  const resultado = await registrarUsuarioServicio(payload);

  // 3) Respuesta consistente
  res.status(201).json({
    ok: true,
    data: resultado,
    message: "Usuario ecommerce registrado",
  });
});

/**
 * POST /api/ecommerce/usuarios/login
 * Body: { email, password }
 * Respuesta: { ok, data: { usuario, direccionPrincipal }, message }
 */
export const loginUsuario = manejarAsync(async (req: Request, res: Response) => {
  // 1) Validación con Zod
  const payload = usuarioLoginSchema.parse(req.body);

  // 2) Lógica de negocio (service)
  const resultado = await loginUsuarioServicio(payload);

  // 3) Respuesta
  res.json({
    ok: true,
    data: resultado,
    message: "Login correcto",
  });
});

/**
 * POST /api/ecommerce/usuarios/login/microsoft
 * Body: { idToken }
 *
 * Importante:
 * - El FRONT (MSAL) obtiene idToken en loginPopup
 * - Luego llama a este endpoint con { idToken }
 *
 * Respuesta: { ok, data: { token, user, direccionPrincipal }, message }
 */
export const loginUsuarioMicrosoft = manejarAsync(async (req: Request, res: Response) => {
  // 1) Validación con Zod
  const payload = usuarioMicrosoftSchema.parse(req.body);

  // 2) Lógica de negocio (service) - aquí se verifica el token con JWKS
  const resultado = await loginMicrosoftServicio(payload);

  // 3) Respuesta
  res.json({
    ok: true,
    data: resultado,
    message: "Login Microsoft correcto",
  });
});

/**
 * POST /api/ecommerce/usuarios/login/google
 * Body: { credential }
 *
 * Importante:
 * - El FRONT (@react-oauth/google) obtiene credential del botón de Google
 * - Luego llama a este endpoint con { credential }
 *
 * Respuesta: { ok, data: { token, user, direccionPrincipal }, message }
 */
export const loginUsuarioGoogle = manejarAsync(async (req: Request, res: Response) => {
  // 1) Validación con Zod
  const payload = usuarioGoogleSchema.parse(req.body);

  // 2) Lógica de negocio (service) - aquí se verifica el token con Google Auth Library
  const resultado = await loginGoogleServicio(payload);

  // 3) Respuesta
  res.json({
    ok: true,
    data: resultado,
    message: "Login Google correcto",
  });
});

/**
 * GET /api/ecommerce/usuarios/me
 * Requiere middleware JWT que setee: res.locals.auth.sub
 * Respuesta: { ok, data: { usuario, direccionPrincipal } }
 */
export const obtenerUsuarioActual = manejarAsync(async (req: Request, res: Response) => {
  const usuarioId = res.locals.auth?.sub as string | undefined;

  // Si no hay auth, no permitimos
  if (!usuarioId) {
    res.status(401).json({ ok: false, message: "No autorizado" });
    return;
  }

  const resultado = await obtenerUsuarioServicio(usuarioId);
  res.json({ ok: true, data: resultado });
});
