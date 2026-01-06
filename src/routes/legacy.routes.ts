import { Router } from "express";
import { listarProductos, obtenerProducto } from "../modules/ecommerce/catalogo/catalogo.controller";
import { crearCotizacion } from "../modules/ecommerce/cotizaciones/cotizaciones.controller";
import { crearPago } from "../modules/ecommerce/pagos/pagos.controller";

const router = Router();

// DEPRECATED: mantener compatibilidad con integraciones antiguas.
router.get("/productos", listarProductos);
router.get("/productos/:id", obtenerProducto);
router.get("/products", listarProductos);
router.get("/products/:id", obtenerProducto);
router.post("/cotizaciones", crearCotizacion);
router.post("/pagos", crearPago);

export default router;
