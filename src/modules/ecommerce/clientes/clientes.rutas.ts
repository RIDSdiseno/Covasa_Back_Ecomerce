import { Router } from "express";
import { obtenerCliente } from "./clientes.controlador";

const router = Router();

router.get("/:id", obtenerCliente);

export default router;
