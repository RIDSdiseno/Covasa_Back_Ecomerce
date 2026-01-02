import { Router } from "express";
import { listarCrmCotizaciones, obtenerCrmCotizacion } from "./crmCotizaciones.controlador";

const router = Router();

router.get("/", listarCrmCotizaciones);
router.get("/:id", obtenerCrmCotizacion);

export default router;
