import { Router } from "express";
import {
  actualizarItemCarrito,
  agregarItemCarrito,
  crearCarrito,
  eliminarItemCarrito,
  obtenerCarrito,
  vaciarCarrito,
} from "../carrito/carrito.controller";

const router = Router();

router.post("/", crearCarrito);
router.get("/:id", obtenerCarrito);
router.post("/:id/items", agregarItemCarrito);
router.patch("/:id/items/:itemId", actualizarItemCarrito);
router.delete("/:id/items/:itemId", eliminarItemCarrito);
router.delete("/:id/items", vaciarCarrito);

export default router;
