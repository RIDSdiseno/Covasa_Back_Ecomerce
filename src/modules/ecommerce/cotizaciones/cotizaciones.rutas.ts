import { Router } from "express";
import { crearCotizacion, obtenerCotizacion } from "./cotizaciones.controlador";

const router = Router();

router.post("/", crearCotizacion);
router.get("/:id", obtenerCotizacion);

export default router;
