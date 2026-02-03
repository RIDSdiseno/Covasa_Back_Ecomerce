import { Router } from "express";
import { optionalAuth } from "../../../middleware/optionalAuth";
import {
  crearCotizacion,
  convertirCotizacionACarrito,
  eliminarCotizacion,
  listarCotizaciones,
  obtenerCotizacion,
} from "../cotizaciones/cotizaciones.controller";

const router = Router();

router.get("/", listarCotizaciones);
router.post("/", crearCotizacion);
router.get("/:id", obtenerCotizacion);
router.post("/:id/convert-to-cart", convertirCotizacionACarrito);
router.delete("/:id", optionalAuth, eliminarCotizacion);

export default router;
