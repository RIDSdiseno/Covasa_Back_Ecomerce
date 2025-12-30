import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { normalizarTexto } from "../ecommerce.utilidades";
import { transbankCrearSchema, transbankTokenSchema } from "./transbank.esquemas";
import {
  confirmarTransbankPagoServicio,
  crearTransbankPagoServicio,
  obtenerEstadoTransbankServicio,
} from "./transbank.servicio";
import { buscarPagoPorReferencia } from "./pagos.repositorio";

const extraerToken = (req: Request) => {
  const token =
    (req.body?.token as string | undefined) ??
    (req.body?.token_ws as string | undefined) ??
    (req.query?.token as string | undefined) ??
    (req.query?.token_ws as string | undefined);

  return transbankTokenSchema.parse({ token }).token;
};

const enmascararToken = (token?: string) => {
  if (!token) {
    return "";
  }
  if (token.length <= 8) {
    return `${token.slice(0, 2)}****`;
  }
  return `${token.slice(0, 4)}****${token.slice(-4)}`;
};

const obtenerFrontUrlBase = () => {
  const desdeEnv = normalizarTexto(process.env.ECOMMERCE_FRONT_URL);
  return desdeEnv || "http://localhost:5173";
};

const construirUrlResultadoFront = (payload: { pagoId?: string; pedidoId?: string; estado: string }) => {
  const base = obtenerFrontUrlBase();
  const url = new URL("/pago/transbank", base);

  if (payload.pagoId) {
    url.searchParams.set("pagoId", payload.pagoId);
  }
  if (payload.pedidoId) {
    url.searchParams.set("pedidoId", payload.pedidoId);
  }
  url.searchParams.set("estado", payload.estado);

  return url.toString();
};

const construirFormularioTransbank = (url: string, token: string) => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Cache-Control" content="no-store" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Redirigiendo a Webpay</title>
</head>
<body>
  <p>Redirigiendo a Webpay...</p>
  <form id="tbk-form" action="${url}" method="POST">
    <input type="hidden" name="token_ws" value="${token}" />
  </form>
  <script>
    document.getElementById('tbk-form').submit();
  </script>
</body>
</html>`;

const enviarFormularioTransbank = (res: Response, url: string, token: string) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(construirFormularioTransbank(url, token));
};

// POST /api/ecommerce/payments/transbank
// Input: { pedidoId, returnUrl? }. Output: redireccion a Webpay (HTML) o JSON si se solicita.
export const crearTransbankPago = manejarAsync(async (req: Request, res: Response) => {
  const payload = transbankCrearSchema.parse(req.body);
  const resultado = await crearTransbankPagoServicio(payload);
  const aceptaHtml = (req.headers.accept || "").includes("text/html");

  if (aceptaHtml) {
    enviarFormularioTransbank(res, resultado.url, resultado.token);
    return;
  }

  res.status(201).json({
    ok: true,
    data: {
      pagoId: resultado.pagoId,
      url: resultado.url,
      monto: resultado.monto,
    },
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
// Recibe token_ws y redirige al front con el resultado (sin exponer token).
export const recibirRetornoTransbank = manejarAsync(async (req: Request, res: Response) => {
  let token = "";

  try {
    token = extraerToken(req);
  } catch (error) {
    console.log("[Transbank] return_token_invalido", { error });
    const redirectUrl = construirUrlResultadoFront({ estado: "ERROR" });
    res.redirect(302, redirectUrl);
    return;
  }

  try {
    const resultado = await confirmarTransbankPagoServicio(token);
    const redirectUrl = construirUrlResultadoFront({
      pagoId: resultado.pago.id,
      pedidoId: resultado.pago.pedidoId,
      estado: resultado.estado,
    });

    res.redirect(302, redirectUrl);
    return;
  } catch (error) {
    console.log("[Transbank] return_error", { token: enmascararToken(token), error });
    const pago = await buscarPagoPorReferencia(token).catch(() => null);
    const redirectUrl = construirUrlResultadoFront({
      pagoId: pago?.id,
      pedidoId: pago?.pedidoId,
      estado: "ERROR",
    });
    res.redirect(302, redirectUrl);
  }
});
