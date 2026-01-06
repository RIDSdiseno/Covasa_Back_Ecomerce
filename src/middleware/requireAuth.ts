import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ErrorApi } from "../lib/errores";

type AuthPayload = {
  sub: string;
  provider?: string;
  role?: string;
  iat?: number;
  exp?: number;
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    res.status(401).json({ ok: false, message: "No autorizado" });
    return;
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    res.status(401).json({ ok: false, message: "No autorizado" });
    return;
  }

  const secret = (process.env.JWT_SECRET ?? "").trim();
  if (!secret) {
    throw new ErrorApi("JWT_SECRET no configurado", 500);
  }

  try {
    const payload = jwt.verify(token, secret) as AuthPayload;
    res.locals.auth = payload;
    next();
  } catch {
    res.status(401).json({ ok: false, message: "Token invalido" });
  }
};
