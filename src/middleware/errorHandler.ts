import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { ErrorApi } from "../lib/errores";
import { logger } from "../lib/logger";

type HttpError = Error & { status?: number; code?: string; details?: unknown };

export const errorHandler = (
  err: HttpError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof ZodError) {
    logger.warn("request_validation_error", {
      method: req.method,
      path: req.path,
      status: 400,
      error: {
        name: err.name,
        message: err.message,
      },
    });
    return res.status(400).json({
      ok: false,
      message: "Validacion incorrecta",
      details: err.flatten(),
    });
  }

  if (err instanceof ErrorApi) {
    logger.warn("request_error", {
      method: req.method,
      path: req.path,
      status: err.status,
      code: err.code,
      error: {
        name: err.name,
        message: err.message,
      },
    });
    return res.status(err.status).json({
      ok: false,
      message: err.message,
      details: err.details,
      code: err.code,
    });
  }

  const status = err.status || 500;
  const message = err.message || "Error interno del servidor";

  logger.error("request_error", {
    method: req.method,
    path: req.path,
    status,
    code: err.code,
    error: {
      name: err.name,
      message,
      stack: err.stack,
    },
  });
  return res.status(status).json({
    ok: false,
    message,
    details: err.details,
    code: err.code,
  });
};
