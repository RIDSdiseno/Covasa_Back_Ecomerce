import { Router } from "express";
import { listarNotificaciones } from "../notificaciones/notificaciones.controller";

const router = Router();

router.get("/", listarNotificaciones);

export default router;
