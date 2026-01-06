import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { usuarioLoginSchema, usuarioMicrosoftSchema, usuarioRegistroSchema } from "./usuarios.schema";
import { loginMicrosoftServicio, loginUsuarioServicio, registrarUsuarioServicio, obtenerUsuarioServicio } from "./usuarios.service";

// POST /api/ecommerce/usuarios/registro
// Input: { nombre, email, password, telefono? }. Output: usuario registrado.
export const registrarUsuario = manejarAsync(async (req: Request, res: Response) => {
  const payload = usuarioRegistroSchema.parse(req.body);
  const resultado = await registrarUsuarioServicio(payload);

  res.status(201).json({
    ok: true,
    data: resultado,
    message: "Usuario ecommerce registrado",
  });
});

// POST /api/ecommerce/usuarios/login
// Input: { email, password }. Output: usuario y direccion principal.
export const loginUsuario = manejarAsync(async (req: Request, res: Response) => {
  const payload = usuarioLoginSchema.parse(req.body);
  const resultado = await loginUsuarioServicio(payload);

  res.json({
    ok: true,
    data: resultado,
    message: "Login correcto",
  });
});

// POST /api/ecommerce/usuarios/login/microsoft
// Input: { idToken }. Output: { token, user, direccionPrincipal }.
export const loginUsuarioMicrosoft = manejarAsync(async (req: Request, res: Response) => {
  const payload = usuarioMicrosoftSchema.parse(req.body);
  const resultado = await loginMicrosoftServicio(payload);

  res.json({
    ok: true,
    data: resultado,
    message: "Login Microsoft correcto",
  });
});

// GET /api/ecommerce/usuarios/me
// Output: usuario actual (requiere JWT).
export const obtenerUsuarioActual = manejarAsync(async (req: Request, res: Response) => {
  const usuarioId = res.locals.auth?.sub as string | undefined;
  if (!usuarioId) {
    res.status(401).json({ ok: false, message: "No autorizado" });
    return;
  }

  const resultado = await obtenerUsuarioServicio(usuarioId);
  res.json({ ok: true, data: resultado });
});
