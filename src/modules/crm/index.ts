import { Router } from "express";
import cotizacionesRouter from "./cotizaciones/crmCotizaciones.rutas";

const router = Router();

router.use("/cotizaciones", cotizacionesRouter);

export default router;
