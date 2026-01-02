import { Request, Response, NextFunction } from "express";

const normalizarFlag = (value?: string) => (value ?? "").trim().toLowerCase();
const applePayDevHabilitado = () => {
  const flag = normalizarFlag(process.env.APPLEPAY_DEV_ENABLED);
  return process.env.NODE_ENV !== "production" && (flag === "true" || flag === "1" || flag === "yes");
};

export const requireApplePayDevEnabled = (_req: Request, res: Response, next: NextFunction) => {
  if (!applePayDevHabilitado()) {
    res.status(404).json({ ok: false, message: "Not found" });
    return;
  }

  next();
};
