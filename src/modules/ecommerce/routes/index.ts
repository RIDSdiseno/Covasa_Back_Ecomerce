import { Router } from "express";
import usuariosRouter from "./usuarios.routes";
import productosRouter from "./productos.routes";
import cotizacionesRouter from "./cotizaciones.routes";
import legacyQuotesRouter from "./quotes.routes";
import carritoRouter from "./carrito.routes";
import pedidosRouter from "./pedidos.routes";
import pagosRouter from "./pagos.routes";
import notificacionesRouter from "./notificaciones.routes";
import clientesRouter from "./clientes.routes";

const router = Router();

router.use("/usuarios", usuariosRouter);
router.use("/clientes", clientesRouter);
router.use("/productos", productosRouter);
router.use("/cotizaciones", cotizacionesRouter);

// DEPRECATED: mantener compatibilidad con rutas legacy.
router.use("/quotes", legacyQuotesRouter);

router.use("/carritos", carritoRouter);
// DEPRECATED: alias legacy.
router.use("/cart", carritoRouter);

router.use("/orders", pedidosRouter);
// DEPRECATED: alias legacy.
router.use("/pedidos", pedidosRouter);

router.use("/payments", pagosRouter);
// DEPRECATED: alias legacy.
router.use("/pagos", pagosRouter);

router.use("/notificaciones", notificacionesRouter);

export default router;
