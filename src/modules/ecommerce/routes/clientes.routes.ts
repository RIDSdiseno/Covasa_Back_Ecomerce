import { Router } from "express";
import { obtenerCliente } from "../clientes/clientes.controller";

const router = Router();

router.get("/:id", obtenerCliente);

export default router;
