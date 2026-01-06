import { Router } from "express";
import cotizacionesRouter from "./cotizaciones.routes";

const router = Router();

router.use("/cotizaciones", cotizacionesRouter);

export default router;
