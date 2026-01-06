import { Router } from "express";
import { crearPedido, crearPedidoDesdeCarrito, obtenerPedido } from "../pedidos/pedidos.controller";

const router = Router();

router.post("/", crearPedido);
router.post("/from-cart/:cartId", crearPedidoDesdeCarrito);
router.get("/:id", obtenerPedido);

export default router;
