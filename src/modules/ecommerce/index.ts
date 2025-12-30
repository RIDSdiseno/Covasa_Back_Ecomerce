import { Router } from "express";
import catalogoRouter from "./catalogo/catalogo.rutas";
import carritoRouter from "./carrito/carrito.rutas";
import clientesRouter from "./clientes/clientes.rutas";
import usuariosRouter from "./usuarios/usuarios.rutas";
import cotizacionesRouter from "./cotizaciones/cotizaciones.rutas";
import quotesRouter from "./cotizaciones/quotes.rutas";
import pedidosRouter from "./pedidos/pedidos.rutas";
import pagosRouter from "./pagos/pagos.rutas";
import notificacionesRouter from "./notificaciones/notificaciones.rutas";

const router = Router();

router.use("/productos", catalogoRouter);
router.use("/cotizaciones", cotizacionesRouter);
router.use("/quotes", quotesRouter);
router.use("/carritos", carritoRouter);
router.use("/cart", carritoRouter);
router.use("/pedidos", pedidosRouter);
router.use("/orders", pedidosRouter);
router.use("/pagos", pagosRouter);
router.use("/payments", pagosRouter);
router.use("/notificaciones", notificacionesRouter);
router.use("/clientes", clientesRouter);
router.use("/usuarios", usuariosRouter);

export default router;
