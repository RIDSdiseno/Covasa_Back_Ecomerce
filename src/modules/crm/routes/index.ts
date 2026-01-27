import { Router } from "express";
import cotizacionesRouter from "./cotizaciones.routes";
import productosRouter from "./productos.routes";

const router = Router();

router.use("/cotizaciones", cotizacionesRouter);
router.use("/productos", productosRouter);

export default router;
