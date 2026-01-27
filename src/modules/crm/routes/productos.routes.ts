import { Router } from "express";
import { actualizarProductoEstadoCrm } from "../productos/productos.controller";

const router = Router();

router.patch("/:id/estado", actualizarProductoEstadoCrm);

export default router;
