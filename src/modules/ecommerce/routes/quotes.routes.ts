import { Router } from "express";
import { crearQuote, convertirCotizacionACarrito, obtenerCotizacion } from "../cotizaciones/cotizaciones.controller";

const router = Router();

// DEPRECATED: alias legacy para cotizaciones.
router.post("/", crearQuote);
router.get("/:id", obtenerCotizacion);
router.post("/:id/convert-to-cart", convertirCotizacionACarrito);

export default router;
