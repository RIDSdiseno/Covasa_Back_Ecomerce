import { Router } from "express";
import { confirmarPago, crearPago, rechazarPago, obtenerPagoRecibo } from "./pagos.controlador";
import {
  confirmarTransbankPago,
  crearTransbankPago,
  obtenerEstadoTransbank,
  recibirRetornoTransbank,
} from "./transbank.controlador";
import { crearMercadoPago } from "./mercadopago.controlador";
import { crearApplePayDevIntent } from "./applePayDev.controlador";
import { requireApplePayDevEnabled } from "../../../middleware/requireApplePayDevEnabled";

const router = Router();

router.post("/", crearPago);
router.post("/mercadopago", crearMercadoPago);
router.post("/transbank", crearTransbankPago);
router.post("/applepay-dev/create-intent", requireApplePayDevEnabled, crearApplePayDevIntent);
router.get("/:id", obtenerPagoRecibo);
router.post("/transbank/return", recibirRetornoTransbank);
router.get("/transbank/return", recibirRetornoTransbank);
router.post("/transbank/commit", confirmarTransbankPago);
router.get("/transbank/status/:token", obtenerEstadoTransbank);
router.patch("/:id/confirm", confirmarPago);
router.patch("/:id/reject", rechazarPago);

export default router;
