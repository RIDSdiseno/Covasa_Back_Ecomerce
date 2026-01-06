import { Request, Response } from "express";
import { manejarAsync } from "../../lib/manejarAsync";
import { usuarioLoginSchema } from "../ecommerce/usuarios/usuarios.schema";
import { loginUsuarioServicio } from "../ecommerce/usuarios/usuarios.service";

export const healthCheck = (_req: Request, res: Response) => {
  res.json({ ok: true, data: { status: "ok" } });
};

// POST /api/health/auth
// Input: { email, password }. Output: { usuarioId, ecommerceClienteId }.
export const healthAuth = manejarAsync(async (req: Request, res: Response) => {
  const payload = usuarioLoginSchema.parse(req.body);
  const resultado = await loginUsuarioServicio(payload);

  res.json({
    ok: true,
    data: {
      usuarioId: resultado.usuario.id,
      ecommerceClienteId: resultado.usuario.ecommerceClienteId ?? null,
    },
    message: "Auth OK",
  });
});
