import { Router } from "express";
import { healthAuth, healthCheck } from "../modules/system/health.controller";
import legacyRouter from "./legacy.routes";
import ecommerceRouter from "../modules/ecommerce";
import crmRouter from "../modules/crm";
import dpaRouter from "../modules/dpa/dpa.routes";

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
router.post("/health/auth", healthAuth);
// DEPRECATED: rutas legacy de compatibilidad.
router.use(legacyRouter);
router.use("/dpa", dpaRouter);
router.use("/ecommerce", ecommerceRouter);
router.use("/crm", crmRouter);

export default router;
