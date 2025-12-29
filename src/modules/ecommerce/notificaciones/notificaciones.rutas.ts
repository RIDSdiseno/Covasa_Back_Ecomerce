import { Router } from "express";
import { listarNotificaciones } from "./notificaciones.controlador";

const router = Router();

router.get("/", listarNotificaciones);

export default router;
