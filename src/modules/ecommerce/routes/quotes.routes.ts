import { Router } from "express";
import { optionalAuth } from "../../../middleware/optionalAuth";
import {
  crearQuote,
  convertirCotizacionACarrito,
  eliminarCotizacion,
  obtenerCotizacion,
} from "../cotizaciones/cotizaciones.controller";

const router = Router();

// DEPRECATED: alias legacy para cotizaciones.
router.post("/", crearQuote);
router.get("/:id", obtenerCotizacion);
router.post("/:id/convert-to-cart", convertirCotizacionACarrito);
router.delete("/:id", optionalAuth, eliminarCotizacion);

export default router;
