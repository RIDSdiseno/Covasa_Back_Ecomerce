import { Router } from "express";
import { requireAuth } from "../../../middleware/requireAuth";
import { loginUsuario, loginUsuarioMicrosoft, loginUsuarioGoogle, obtenerUsuarioActual, registrarUsuario } from "../usuarios/usuarios.controller";

const router = Router();

router.post("/registro", registrarUsuario);
router.post("/login", loginUsuario);
router.post("/login/microsoft", loginUsuarioMicrosoft);
router.post("/login/google", loginUsuarioGoogle);
router.get("/me", requireAuth, obtenerUsuarioActual);

export default router;
