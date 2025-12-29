import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { ErrorApi } from "../lib/errores";

type HttpError = Error & { status?: number; code?: string; details?: unknown };

export const errorHandler = (
  err: HttpError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      ok: false,
      message: "Validacion incorrecta",
      details: err.flatten(),
    });
  }

  if (err instanceof ErrorApi) {
    return res.status(err.status).json({
      ok: false,
      message: err.message,
      details: err.details,
      code: err.code,
    });
  }

  const status = err.status || 500;
  const message = err.message || "Error interno del servidor";

  return res.status(status).json({
    ok: false,
    message,
    details: err.details,
    code: err.code,
  });
};
