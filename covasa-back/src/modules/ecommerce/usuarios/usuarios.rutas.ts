import { Router } from "express";
import { loginUsuario, registrarUsuario } from "./usuarios.controlador";

const router = Router();

router.post("/registro", registrarUsuario);
router.post("/login", loginUsuario);

export default router;
