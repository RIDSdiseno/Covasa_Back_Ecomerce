import { Router } from "express";
import { listarRegiones, listarComunasPorRegion, listarComunas, verificarEmailDominio } from "./dpa.controller";

const router = Router();

router.get("/regiones", listarRegiones);
router.get("/regiones/:codigo/comunas", listarComunasPorRegion);
router.get("/comunas", listarComunas);
router.get("/verificar-email", verificarEmailDominio);

export default router;
