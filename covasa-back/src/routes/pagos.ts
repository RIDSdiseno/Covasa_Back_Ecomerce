import { Router } from "express";
import { crearPago } from "../controllers/pagosController";

const router = Router();

router.post("/", crearPago);

export default router;
