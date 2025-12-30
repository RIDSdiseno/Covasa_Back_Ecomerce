import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { usuarioLoginSchema, usuarioRegistroSchema } from "./usuarios.esquemas";
import { loginUsuarioServicio, registrarUsuarioServicio } from "./usuarios.servicio";

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
