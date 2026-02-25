import { NextFunction, Request, Response, Router } from "express";
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
import { crearKlapPago, recibirKlapWebhook } from "../pagos/klap.controller";
import { requireApplePayDevEnabled } from "../../../middleware/requireApplePayDevEnabled";
import { optionalAuth } from "../../../middleware/optionalAuth";

const router = Router();
const normalizarFlag = (value?: string) => (value ?? "").trim().toLowerCase();
const klapHabilitado = () => {
  const flag = normalizarFlag(process.env.KLAP_ENABLED);
  return flag === "true" || flag === "1" || flag === "yes";
};
const requireKlapEnabled = (_req: Request, res: Response, next: NextFunction) => {
  if (!klapHabilitado()) {
    res.status(404).json({ ok: false, message: "Not found" });
    return;
  }
  next();
};

router.post("/", crearPago);
router.post("/mercadopago", crearMercadoPago);
router.post("/transbank", crearTransbankPago);
router.post("/klap", requireKlapEnabled, crearKlapPago);
router.post("/klap/webhook", requireKlapEnabled, recibirKlapWebhook);
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
