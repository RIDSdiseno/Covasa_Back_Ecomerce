import { Router } from "express";
import { healthAuth, healthCheck } from "../modules/system/health.controller";
import legacyRouter from "./legacy.routes";
import dpaRouter from "./dpa.routes";
import chileDpaRouter from "./chileDpa.routes";
import ecommerceRouter from "../modules/ecommerce";
import crmRouter from "../modules/crm";
import dpaModuleRouter from "../modules/dpa/dpa.routes";

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
router.use("/dpa", dpaRouter);
router.use("/chile", chileDpaRouter);
// DEPRECATED: rutas legacy de compatibilidad.
router.use(legacyRouter);
router.use("/dpa", dpaModuleRouter);
router.use("/ecommerce", ecommerceRouter);
router.use("/crm", crmRouter);

export default router;
