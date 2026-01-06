import { Router } from "express";
import { listarCrmCotizaciones, obtenerCrmCotizacion } from "../cotizaciones/cotizaciones.controller";

const router = Router();

router.get("/", listarCrmCotizaciones);
router.get("/:id", obtenerCrmCotizacion);

export default router;
