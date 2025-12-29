import { Router } from "express";
import { crearCotizacion } from "../controllers/cotizacionesController";

const router = Router();

router.post("/", crearCotizacion);

export default router;
