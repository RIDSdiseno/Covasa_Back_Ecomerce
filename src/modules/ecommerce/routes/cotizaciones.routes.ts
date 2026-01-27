import { Router } from "express";
import { crearCotizacion, convertirCotizacionACarrito, listarCotizaciones, obtenerCotizacion } from "../cotizaciones/cotizaciones.controller";

const router = Router();

router.get("/", listarCotizaciones);
router.post("/", crearCotizacion);
router.get("/:id", obtenerCotizacion);
router.post("/:id/convert-to-cart", convertirCotizacionACarrito);

export default router;
