import { Router } from "express";
import {
  registrarUsuario,
  loginUsuario,
  loginUsuarioMicrosoft,
  loginUsuarioGoogle,
  obtenerUsuarioActual,
} from "./usuarios.controller";
// import { authMiddleware } from "../../middleware/auth"; // ajusta si tienes uno

const router = Router();

// Auth local
router.post("/registro", registrarUsuario);
router.post("/login", loginUsuario);

// Auth Microsoft (MSAL idToken -> backend)
router.post("/login/microsoft", loginUsuarioMicrosoft);

// Auth Google (@react-oauth/google credential -> backend)
router.post("/login/google", loginUsuarioGoogle);

// Usuario actual (protegido)
// router.get("/me", authMiddleware, obtenerUsuarioActual);
router.get("/me", obtenerUsuarioActual); // si aún no tienes middleware, déjalo así por ahora

export default router;
