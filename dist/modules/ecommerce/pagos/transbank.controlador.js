"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recibirRetornoTransbank = exports.obtenerEstadoTransbank = exports.confirmarTransbankPago = exports.crearTransbankPago = void 0;
const manejarAsync_1 = require("../../../lib/manejarAsync");
const ecommerce_utilidades_1 = require("../ecommerce.utilidades");
const transbank_esquemas_1 = require("./transbank.esquemas");
const transbank_servicio_1 = require("./transbank.servicio");
const pagos_repositorio_1 = require("./pagos.repositorio");
const extraerToken = (req) => {
    const token = req.body?.token ??
        req.body?.token_ws ??
        req.query?.token ??
        req.query?.token_ws;
    return transbank_esquemas_1.transbankTokenSchema.parse({ token }).token;
};
const enmascararToken = (token) => {
    if (!token) {
        return "";
    }
    if (token.length <= 8) {
        return `${token.slice(0, 2)}****`;
    }
    return `${token.slice(0, 4)}****${token.slice(-4)}`;
};
const resumirError = (error) => {
    if (error instanceof Error) {
        return { name: error.name, message: error.message };
    }
    return { message: String(error) };
};
const mapearRespuestaTransbank = (payload) => {
    if (!payload || typeof payload !== "object") {
        return null;
    }
    const data = payload;
    const cardDetail = data.card_detail || {};
    const rawCard = typeof cardDetail.card_number === "string" ? cardDetail.card_number : "";
    const cardNumber = rawCard ? `****${rawCard.slice(-4)}` : undefined;
    return {
        status: typeof data.status === "string" ? data.status : undefined,
        buyOrder: typeof data.buy_order === "string" ? data.buy_order : undefined,
        authorizationCode: typeof data.authorization_code === "string" ? data.authorization_code : undefined,
        paymentTypeCode: typeof data.payment_type_code === "string" ? data.payment_type_code : undefined,
        installmentsNumber: typeof data.installments_number === "number" ? data.installments_number : undefined,
        responseCode: typeof data.response_code === "number" ? data.response_code : undefined,
        transactionDate: typeof data.transaction_date === "string" ? data.transaction_date : undefined,
        cardNumber,
    };
};
const obtenerFrontUrlBase = () => {
    const desdeEnv = (0, ecommerce_utilidades_1.normalizarTexto)(process.env.ECOMMERCE_FRONT_URL);
    return desdeEnv || "http://localhost:5173";
};
const construirUrlResultadoFront = (payload) => {
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
const construirFormularioTransbank = (url, token) => `<!doctype html>
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
const enviarFormularioTransbank = (res, url, token) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(construirFormularioTransbank(url, token));
};
// POST /api/ecommerce/payments/transbank
// Input: { pedidoId, returnUrl? }. Output: redireccion a Webpay (HTML) o JSON si se solicita.
exports.crearTransbankPago = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const payload = transbank_esquemas_1.transbankCrearSchema.parse(req.body);
    const resultado = await (0, transbank_servicio_1.crearTransbankPagoServicio)(payload);
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
// Input: { token } o token_ws. Output: estado y resumen Transbank (sin token).
exports.confirmarTransbankPago = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const token = extraerToken(req);
    const resultado = await (0, transbank_servicio_1.confirmarTransbankPagoServicio)(token);
    const transbank = mapearRespuestaTransbank(resultado.resultado);
    res.json({
        ok: true,
        data: {
            pagoId: resultado.pago.id,
            estado: resultado.estado,
            transbank,
        },
        message: resultado.estado === "CONFIRMADO" ? "Pago confirmado" : "Pago rechazado",
    });
});
// GET /api/ecommerce/payments/transbank/status/:token
// Output: estado remoto de Transbank.
exports.obtenerEstadoTransbank = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const token = transbank_esquemas_1.transbankTokenSchema.parse(req.params).token;
    const estado = await (0, transbank_servicio_1.obtenerEstadoTransbankServicio)(token);
    res.json({
        ok: true,
        data: mapearRespuestaTransbank(estado),
    });
});
// POST|GET /api/ecommerce/payments/transbank/return
// Recibe token_ws y redirige al front con el resultado (sin exponer token).
exports.recibirRetornoTransbank = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    let token = "";
    try {
        token = extraerToken(req);
    }
    catch (error) {
        console.log("[Transbank] return_token_invalido", { error: resumirError(error) });
        const redirectUrl = construirUrlResultadoFront({ estado: "ERROR" });
        res.redirect(302, redirectUrl);
        return;
    }
    try {
        const resultado = await (0, transbank_servicio_1.confirmarTransbankPagoServicio)(token);
        const redirectUrl = construirUrlResultadoFront({
            pagoId: resultado.pago.id,
            pedidoId: resultado.pago.pedidoId,
            estado: resultado.estado,
        });
        res.redirect(302, redirectUrl);
        return;
    }
    catch (error) {
        console.log("[Transbank] return_error", { token: enmascararToken(token), error: resumirError(error) });
        const pago = await (0, pagos_repositorio_1.buscarPagoPorReferencia)(token).catch(() => null);
        const redirectUrl = construirUrlResultadoFront({
            pagoId: pago?.id,
            pedidoId: pago?.pedidoId,
            estado: "ERROR",
        });
        res.redirect(302, redirectUrl);
    }
});
