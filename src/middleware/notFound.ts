import { Request, Response, NextFunction } from "express";

export const notFound = (req: Request, res: Response, _next: NextFunction) => {
  res.status(404).json({
    ok: false,
    message: "Ruta no encontrada",
    details: {
      path: req.originalUrl,
    },
  });
};
