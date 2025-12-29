import { Request, Response } from "express";

export const healthCheck = (_req: Request, res: Response) => {
  res.json({ ok: true, data: { status: "ok" } });
};
