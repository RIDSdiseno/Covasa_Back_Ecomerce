import { Request, Response } from "express";
import { ErrorApi } from "../../../lib/errores";
import { manejarAsync } from "../../../lib/manejarAsync";
import { normalizarTexto } from "../common/ecommerce.utils";
import { pagoCrearSchema, pagoIdSchema } from "./pagos.schema";
import {
  confirmarPagoServicio,
  crearPagoServicio,
  generarPagoPdfServicio,
  listarMisPagosServicio,
  obtenerPagoDetalleUsuarioServicio,
  obtenerPagoReciboServicio,
  rechazarPagoServicio,
} from "./pagos.service";

const obtenerUsuarioId = (req: Request, res: Response) => {
  const authUserId = res.locals.auth?.sub as string | undefined;
  if (authUserId) {
    return authUserId;
  }

  const headerValue = req.headers["x-usuario-id"] ?? req.headers["x-user-id"];
  const headerId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const queryValue = req.query.usuarioId ?? req.query.userId;
  const queryId = Array.isArray(queryValue) ? queryValue[0] : queryValue;

  const usuarioId = normalizarTexto(typeof headerId === "string" ? headerId : "") ||
    normalizarTexto(typeof queryId === "string" ? queryId : "");

  if (!usuarioId) {
    throw new ErrorApi("usuarioId requerido", 401);
  }

  return usuarioId;
};

// POST /api/ecommerce/payments
// Input: { pedidoId, metodo, monto, referencia?, evidenciaUrl?, gatewayPayloadJson? }.
export const crearPago = manejarAsync(async (req: Request, res: Response) => {
  const payload = pagoCrearSchema.parse(req.body);
  const pago = await crearPagoServicio(payload);

  res.status(201).json({
    ok: true,
    data: { pagoId: pago.id, estado: pago.estado },
    message: "Pago registrado (placeholder)",
  });
});

// PATCH /api/ecommerce/payments/:id/confirm
// Output: pago confirmado + pedido PAGADO.
export const confirmarPago = manejarAsync(async (req: Request, res: Response) => {
  const { id } = pagoIdSchema.parse(req.params);
  const pago = await confirmarPagoServicio(id);

  res.json({
    ok: true,
    data: { pagoId: pago.id, estado: pago.estado },
    message: "Pago confirmado",
  });
});

// PATCH /api/ecommerce/payments/:id/reject
// Output: pago rechazado.
export const rechazarPago = manejarAsync(async (req: Request, res: Response) => {
  const { id } = pagoIdSchema.parse(req.params);
  const pago = await rechazarPagoServicio(id);

  res.json({
    ok: true,
    data: { pagoId: pago.id, estado: pago.estado },
    message: "Pago rechazado",
  });
});

// GET /api/ecommerce/payments/:id
// Output: datos para boleta/recibo.
export const obtenerPagoRecibo = manejarAsync(async (req: Request, res: Response) => {
  const { id } = pagoIdSchema.parse(req.params);
  const pago = await obtenerPagoReciboServicio(id);

  res.json({
    ok: true,
    data: pago,
  });
});

// GET /api/ecommerce/pagos/mis-pagos
export const listarMisPagos = manejarAsync(async (req: Request, res: Response) => {
  const usuarioId = obtenerUsuarioId(req, res);
  const pagos = await listarMisPagosServicio(usuarioId);

  res.json({
    ok: true,
    data: pagos,
  });
});

// GET /api/ecommerce/pagos/mis-pagos/:id
export const obtenerPagoDetalle = manejarAsync(async (req: Request, res: Response) => {
  const usuarioId = obtenerUsuarioId(req, res);
  const { id } = pagoIdSchema.parse(req.params);
  const pago = await obtenerPagoDetalleUsuarioServicio(usuarioId, id);

  res.json({
    ok: true,
    data: pago,
  });
});

// GET /api/ecommerce/pagos/mis-pagos/:id/recibo.pdf
export const descargarPagoPdf = manejarAsync(async (req: Request, res: Response) => {
  const usuarioId = obtenerUsuarioId(req, res);
  const { id } = pagoIdSchema.parse(req.params);
  const resultado = await generarPagoPdfServicio(usuarioId, id);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${resultado.fileName}"`);
  res.send(resultado.buffer);
});
