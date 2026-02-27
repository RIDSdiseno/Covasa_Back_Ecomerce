import { Request, Response, Router } from "express";
import {
  confirmarPago,
  crearPago,
  descargarPagoPdf,
  listarMisPagos,
  listarPagosIntegracion,
  obtenerPagoDetalle,
  obtenerPagoRecibo,
  rechazarPago,
} from "../pagos/pagos.controller";
import {
  confirmarTransbankPago,
  crearTransbankPago,
  obtenerEstadoTransbank,
  recibirRetornoTransbank,
} from "../pagos/transbank.controller";
import { crearMercadoPago } from "../pagos/mercadopago.controller";
import { crearApplePayDevIntent } from "../pagos/applePayDev.controller";
import {
  crearStripeCreateIntent,
  crearStripeIntent,
  obtenerEstadoStripe,
  recibirStripeWebhook,
} from "../pagos/stripe.controller";
import { requireApplePayDevEnabled } from "../../../middleware/requireApplePayDevEnabled";
import { optionalAuth } from "../../../middleware/optionalAuth";
import { logger } from "../../../lib/logger";

const router = Router();
const normalizarTexto = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const obtenerRequestId = (req: Request, res: Response) => {
  const fromLocals = normalizarTexto(res.locals.requestId);
  if (fromLocals) {
    return fromLocals;
  }
  const header = req.headers["x-request-id"];
  return normalizarTexto(Array.isArray(header) ? header[0] : header);
};
const obtenerUsuarioId = (req: Request, res: Response) => {
  const authUserId = normalizarTexto(res.locals.auth?.sub);
  if (authUserId) {
    return authUserId;
  }

  const headerValue = req.headers["x-usuario-id"] ?? req.headers["x-user-id"];
  const headerId = normalizarTexto(Array.isArray(headerValue) ? headerValue[0] : headerValue);
  if (headerId) {
    return headerId;
  }

  const queryValue = req.query.usuarioId ?? req.query.userId;
  return normalizarTexto(Array.isArray(queryValue) ? queryValue[0] : queryValue);
};
const responderKlapDeprecado = (req: Request, res: Response) => {
  const requestId = obtenerRequestId(req, res) || null;
  const userId = obtenerUsuarioId(req, res) || null;

  logger.warn("klap_deprecated_attempt", {
    event: "klap_deprecated_attempt",
    requestId,
    userId,
    method: req.method,
    path: req.originalUrl,
  });

  res.status(410).json({
    ok: false,
    code: "KLAP_DEPRECATED",
    errorCode: "PAYMENT_METHOD_DEPRECATED",
    message: "Klap is no longer supported",
  });
};

router.post("/", crearPago);
router.post("/mercadopago", crearMercadoPago);
router.post("/transbank", crearTransbankPago);
router.all("/klap", responderKlapDeprecado);
router.all("/klap/webhook", responderKlapDeprecado);
router.all("/klap/mock-webhook", responderKlapDeprecado);
router.post("/applepay-dev/create-intent", requireApplePayDevEnabled, crearApplePayDevIntent);
router.post("/stripe/intent", crearStripeIntent);
router.post("/stripe/create-intent", crearStripeCreateIntent);
router.get("/stripe/__stripe_ping", (_req, res) => {
  res.status(200).send("STRIPE-ROUTER-OK");
});
router.get("/stripe/status", obtenerEstadoStripe);
router.post("/stripe/webhook", recibirStripeWebhook);
router.get("/integracion/confirmados", listarPagosIntegracion);
router.get("/mis-pagos", optionalAuth, listarMisPagos);
router.get("/mis-pagos/:id/recibo.pdf", optionalAuth, descargarPagoPdf);
router.get("/mis-pagos/:id", optionalAuth, obtenerPagoDetalle);
router.get("/:id", obtenerPagoRecibo);
router.post("/transbank/return", recibirRetornoTransbank);
router.get("/transbank/return", recibirRetornoTransbank);
router.post("/transbank/commit", confirmarTransbankPago);
router.get("/transbank/status/:token", obtenerEstadoTransbank);
router.patch("/:id/confirm", confirmarPago);
router.patch("/:id/reject", rechazarPago);

export default router;
