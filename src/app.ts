import express from "express";
import cors from "cors";
import routes from "./routes";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";
import path from "path";
import fs from "fs";

const app = express();

const defaultAllowedOrigins = [
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const envAllowed = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowAll = process.env.CORS_ALLOW_ALL === "true";
const allowedOrigins = [...defaultAllowedOrigins, ...envAllowed];

type RouteLayer = {
  route?: { path: string; methods?: Record<string, boolean> };
  name?: string;
  handle?: { stack?: RouteLayer[] };
  regexp?: RegExp;
  path?: string;
};

const unirPath = (base: string, fragment: string) => {
  const left = base.endsWith("/") ? base.slice(0, -1) : base;
  const right = fragment.startsWith("/") ? fragment : fragment ? `/${fragment}` : "";
  const joined = `${left}${right}`;
  return joined.length === 0 ? "/" : joined;
};

const extraerPrefijo = (layer: RouteLayer) => {
  if (typeof layer.path === "string") {
    return layer.path;
  }

  const source = layer.regexp?.source;
  if (!source) {
    return "";
  }

  let path = source
    .replace("^\\/", "/")
    .replace("\\/?(?=\\/|$)", "")
    .replace("\\/?$", "")
    .replace("\\/?", "")
    .replace(/\\\//g, "/");

  if (path === "/" || path === "/?") {
    return "";
  }

  return path;
};

const listarRutas = (appRef: typeof app) => {
  const rutas: Array<{ method: string; path: string }> = [];
  const stack = (appRef as unknown as { _router?: { stack?: RouteLayer[] } })._router?.stack ?? [];

  const walk = (layers: RouteLayer[], prefix: string) => {
    layers.forEach((layer) => {
      if (layer.route?.path) {
        const fullPath = unirPath(prefix, layer.route.path);
        const methods = Object.keys(layer.route.methods ?? {}).filter(
          (method) => layer.route?.methods?.[method]
        );
        methods.forEach((method) => rutas.push({ method: method.toUpperCase(), path: fullPath }));
        return;
      }

      if (layer.name === "router" && layer.handle?.stack) {
        const nextPrefix = unirPath(prefix, extraerPrefijo(layer));
        walk(layer.handle.stack, nextPrefix);
      }
    });
  };

  walk(stack, "");
  return rutas;
};

app.set("trust proxy", 1);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowAll) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, origin);
      }

      return callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 204,
  })
);

app.options("*", (_req, res) => {
  res.sendStatus(204);
});

app.get("/__ping", (_req, res) => {
  res.status(200).send("COVASA-BACK-OK");
});

const uploadsDir = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

app.use("/api/ecommerce/payments/stripe/webhook", express.raw({ type: "application/json" }));
app.use("/api/ecommerce/pagos/stripe/webhook", express.raw({ type: "application/json" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/api", routes);

app.get("/debug/routes", (_req, res) => {
  const rutas = listarRutas(app).sort(
    (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method)
  );
  res.json({ ok: true, data: rutas });
});

app.use(notFound);
app.use(errorHandler);

export default app;
