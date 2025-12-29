import { Router } from "express";
import catalogoRouter from "./catalogo/catalogo.rutas";
import carritoRouter from "./carrito/carrito.rutas";
import cotizacionesRouter from "./cotizaciones/cotizaciones.rutas";
import pedidosRouter from "./pedidos/pedidos.rutas";
import pagosRouter from "./pagos/pagos.rutas";
import notificacionesRouter from "./notificaciones/notificaciones.rutas";

const router = Router();

router.use("/productos", catalogoRouter);
router.use("/carritos", carritoRouter);
router.use("/cotizaciones", cotizacionesRouter);
router.use("/pedidos", pedidosRouter);
router.use("/pagos", pagosRouter);
router.use("/notificaciones", notificacionesRouter);

export default router;
