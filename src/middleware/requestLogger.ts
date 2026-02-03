import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { requestContext } from "../lib/requestContext";

const REQUEST_ID_HEADER = "x-request-id";

const normalizarHeader = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }
  return typeof value === "string" ? value.trim() : "";
};

const resolverRequestId = (req: Request) => {
  const recibido = normalizarHeader(req.headers[REQUEST_ID_HEADER] as string | string[] | undefined);
  return recibido || randomUUID();
};

const resolverIp = (req: Request) => {
  const forwarded = normalizarHeader(req.headers["x-forwarded-for"] as string | string[] | undefined);
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || forwarded;
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
};

const unirPath = (base: string, fragment: string) => {
  const left = base.endsWith("/") ? base.slice(0, -1) : base;
  const right = fragment.startsWith("/") ? fragment : fragment ? `/${fragment}` : "";
  const joined = `${left}${right}`;
  return joined.length === 0 ? "/" : joined;
};

const resolverRoute = (req: Request) => {
  const routePath = req.route?.path;
  if (routePath) {
    return unirPath(req.baseUrl || "", String(routePath));
  }
  return req.baseUrl || req.path || "/";
};

const resolverModulo = (req: Request) => {
  const raw = req.baseUrl || req.path || "";
  const segmentos = raw.split("/").filter(Boolean);
  if (segmentos.length === 0) return "root";
  if (segmentos[0] === "api") {
    return segmentos[1] || "root";
  }
  return segmentos[0];
};

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const requestId = resolverRequestId(req);
  res.setHeader(REQUEST_ID_HEADER, requestId);
  res.locals.requestId = requestId;

  const start = process.hrtime.bigint();
  const ip = resolverIp(req);
  const method = req.method;
  const path = req.path;
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;

  requestContext.run({ requestId }, () => {
    logger.info("request_start", {
      method,
      path,
      ip,
      origin,
    });

    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      const route = resolverRoute(req);
      const module = resolverModulo(req);
      const userId = res.locals.auth?.sub as string | undefined;

      logger.info("request_end", {
        method,
        path,
        route,
        module,
        status: res.statusCode,
        durationMs: Math.round(durationMs),
        ip,
        userId,
        origin,
      });
    });

    next();
  });
};
