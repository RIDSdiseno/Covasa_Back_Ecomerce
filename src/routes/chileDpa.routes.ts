import { Router } from "express";
import {
  listarComunasPorProvincia,
  listarComunasPorRegion,
  listarProvinciasPorRegion,
  listarRegiones,
} from "../controllers/chileDpa.controller";

const router = Router();

router.get("/regiones", listarRegiones);
router.get("/regiones/:regionCode/provincias", listarProvinciasPorRegion);
router.get("/provincias/:provinciaCode/comunas", listarComunasPorProvincia);
router.get("/regiones/:regionCode/comunas", listarComunasPorRegion);

export default router;
