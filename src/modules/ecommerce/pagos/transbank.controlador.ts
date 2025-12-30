import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { normalizarTexto } from "../ecommerce.utilidades";
import { transbankCrearSchema, transbankTokenSchema } from "./transbank.esquemas";
import {
  confirmarTransbankPagoServicio,
  crearTransbankPagoServicio,
  obtenerEstadoTransbankServicio,
} from "./transbank.servicio";

const extraerToken = (req: Request) => {
  const token =
    (req.body?.token as string | undefined) ??
    (req.body?.token_ws as string | undefined) ??
    (req.query?.token as string | undefined) ??
    (req.query?.token_ws as string | undefined);

  return transbankTokenSchema.parse({ token }).token;
};

const obtenerFrontUrlBase = () => {
  const desdeEnv = normalizarTexto(process.env.ECOMMERCE_FRONT_URL);
  return desdeEnv || "http://localhost:5173";
};

const construirUrlRetornoFront = (token: string) => {
  const base = obtenerFrontUrlBase();
  const url = new URL("/pago/transbank", base);
  url.searchParams.set("token_ws", token);
  return url.toString();
};

// POST /api/ecommerce/payments/transbank
// Input: { pedidoId, returnUrl? }. Output: { pagoId, token, url, redirectUrl }.
export const crearTransbankPago = manejarAsync(async (req: Request, res: Response) => {
  const payload = transbankCrearSchema.parse(req.body);
  const resultado = await crearTransbankPagoServicio(payload);

  res.status(201).json({
    ok: true,
    data: resultado,
    message: "Transaccion Transbank creada",
  });
});

// POST /api/ecommerce/payments/transbank/commit
// Input: { token } o token_ws. Output: estado y respuesta Transbank.
export const confirmarTransbankPago = manejarAsync(async (req: Request, res: Response) => {
  const token = extraerToken(req);
  const resultado = await confirmarTransbankPagoServicio(token);

  res.json({
    ok: true,
    data: {
      pagoId: resultado.pago.id,
      estado: resultado.estado,
      transbank: resultado.resultado,
    },
    message: resultado.estado === "CONFIRMADO" ? "Pago confirmado" : "Pago rechazado",
  });
});

// GET /api/ecommerce/payments/transbank/status/:token
// Output: estado remoto de Transbank.
export const obtenerEstadoTransbank = manejarAsync(async (req: Request, res: Response) => {
  const token = transbankTokenSchema.parse(req.params).token;
  const estado = await obtenerEstadoTransbankServicio(token);

  res.json({
    ok: true,
    data: estado,
  });
});

// POST|GET /api/ecommerce/payments/transbank/return
// Recibe token_ws y redirige al front para confirmar el pago.
export const recibirRetornoTransbank = manejarAsync(async (req: Request, res: Response) => {
  const token = extraerToken(req);
  const redirectUrl = construirUrlRetornoFront(token);
  res.redirect(302, redirectUrl);
});
