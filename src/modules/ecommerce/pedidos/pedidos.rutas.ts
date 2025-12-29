import { Router } from "express";
import { crearPedido, obtenerPedido } from "./pedidos.controlador";

const router = Router();

router.post("/", crearPedido);
router.get("/:id", obtenerPedido);

export default router;
