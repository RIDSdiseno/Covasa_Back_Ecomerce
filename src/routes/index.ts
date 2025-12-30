import { Router } from "express";
import { healthCheck } from "../controllers/healthController";
import productosRouter from "./productos";
import cotizacionesRouter from "./cotizaciones";
import pagosRouter from "./pagos";
import ecommerceRouter from "../modules/ecommerce";

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
router.use("/products", productosRouter);
router.use("/cotizaciones", cotizacionesRouter);
router.use("/pagos", pagosRouter);
router.use("/ecommerce", ecommerceRouter);

export default router;