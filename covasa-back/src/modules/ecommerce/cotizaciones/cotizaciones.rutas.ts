import { Router } from "express";
import { crearCotizacion, convertirCotizacionACarrito, obtenerCotizacion } from "./cotizaciones.controlador";

const router = Router();

router.post("/", crearCotizacion);
router.get("/:id", obtenerCotizacion);
router.post("/:id/convert-to-cart", convertirCotizacionACarrito);

export default router;