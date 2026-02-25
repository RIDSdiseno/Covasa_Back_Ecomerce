import { Router } from "express";
<<<<<<< HEAD
import { optionalAuth } from "../../../middleware/optionalAuth";
import {
  crearCotizacion,
  convertirCotizacionACarrito,
  eliminarCotizacion,
  listarCotizaciones,
  obtenerCotizacion,
} from "../cotizaciones/cotizaciones.controller";
=======
import { crearCotizacion, convertirCotizacionACarrito, listarCotizaciones, obtenerCotizacion } from "../cotizaciones/cotizaciones.controller";
import { requireAuth } from "../../../middleware/requireAuth";
>>>>>>> 2a33f58cd41697deea99acbc114a27a1fb18a062

const router = Router();

router.get("/", requireAuth, listarCotizaciones);
router.post("/", crearCotizacion);
router.get("/:id", obtenerCotizacion);
router.post("/:id/convert-to-cart", convertirCotizacionACarrito);
router.delete("/:id", optionalAuth, eliminarCotizacion);

export default router;
