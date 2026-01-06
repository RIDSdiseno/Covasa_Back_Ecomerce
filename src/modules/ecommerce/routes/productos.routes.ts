import { Router } from "express";
import { listarProductos, obtenerProducto } from "../catalogo/catalogo.controller";

const router = Router();

router.get("/", listarProductos);
router.get("/:id", obtenerProducto);

export default router;
