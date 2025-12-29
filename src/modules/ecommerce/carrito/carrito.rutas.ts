import { Router } from "express";
import { agregarItemCarrito, crearCarrito, obtenerCarrito } from "./carrito.controlador";

const router = Router();

router.post("/", crearCarrito);
router.get("/:id", obtenerCarrito);
router.post("/:id/items", agregarItemCarrito);

export default router;
