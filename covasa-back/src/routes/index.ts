import { Router } from "express";
import { healthCheck } from "../controllers/healthController";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    message: "Bienvenido a la API de Covasa",
  });
});

router.get("/health", healthCheck);

export default router;
