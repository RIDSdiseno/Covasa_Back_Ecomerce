import { Router } from "express";
import { healthCheck } from "../controllers/healthController";
import productosRouter from "./productos";
import cotizacionesRouter from "./cotizaciones";
import pagosRouter from "./pagos";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    ok: true,
    data: {
      message: "Bienvenido a la API de Covasa",
    },
  });
});

router.get("/health", healthCheck);
router.use("/productos", productosRouter);
router.use("/cotizaciones", cotizacionesRouter);
router.use("/pagos", pagosRouter);

export default router;
