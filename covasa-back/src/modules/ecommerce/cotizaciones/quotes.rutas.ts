import { Router } from "express";
import { crearQuote, convertirCotizacionACarrito, obtenerCotizacion } from "./cotizaciones.controlador";

const router = Router();

router.post("/", crearQuote);
router.get("/:id", obtenerCotizacion);
router.post("/:id/convert-to-cart", convertirCotizacionACarrito);

export default router;