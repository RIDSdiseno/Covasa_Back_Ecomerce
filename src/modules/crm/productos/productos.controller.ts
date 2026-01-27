import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { ErrorApi } from "../../../lib/errores";
import { crmProductoEstadoSchema, crmProductoIdSchema } from "./productos.schema";
import { actualizarProductoEstadoServicio } from "./productos.service";

const obtenerTokenIntegracion = (req: Request) => {
  const headerValue = req.headers["x-integration-token"];
  return Array.isArray(headerValue) ? headerValue[0] : headerValue || "";
};

const validarTokenIntegracion = (req: Request) => {
  const tokenEsperado = (process.env.ECOMMERCE_INTEGRATION_TOKEN || "").trim();
  if (!tokenEsperado) return true;
  const tokenRecibido = obtenerTokenIntegracion(req).trim();
  return tokenRecibido === tokenEsperado;
};

// PATCH /api/crm/productos/:id/estado
// Body: { activo?: boolean, visibleEcommerce?: boolean }
export const actualizarProductoEstadoCrm = manejarAsync(async (req: Request, res: Response) => {
  if (!validarTokenIntegracion(req)) {
    throw new ErrorApi("Token de integracion invalido", 401);
  }

  const { id } = crmProductoIdSchema.parse(req.params);
  const payload = crmProductoEstadoSchema.parse(req.body);
  const actualizado = await actualizarProductoEstadoServicio(id, payload);
  res.json({ ok: true, data: actualizado });
});
