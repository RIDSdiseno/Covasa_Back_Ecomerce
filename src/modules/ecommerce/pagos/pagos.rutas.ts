import { Router } from "express";
import { crearPago } from "./pagos.controlador";

const router = Router();

router.post("/", crearPago);

export default router;
