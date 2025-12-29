import { Request, Response, NextFunction } from "express";

type HttpError = Error & { status?: number; code?: string };

export const errorHandler = (
  err: HttpError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const status = err.status || 500;
  const message = err.message || "Error interno del servidor";

  res.status(status).json({
    message,
    code: err.code,
  });
};
