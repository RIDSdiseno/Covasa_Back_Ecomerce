import { Router } from "express";
import { listarProductos, obtenerProducto } from "../controllers/productosController";

const router = Router();

router.get("/", listarProductos);
router.get("/:id", obtenerProducto);

export default router;
