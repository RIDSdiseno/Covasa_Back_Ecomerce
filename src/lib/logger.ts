import { requestContext } from "./requestContext";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogPayload = Record<string, unknown>;

const MAX_DEPTH = 6;
const REDACT_KEYS = new Set([
  "authorization",
  "token",
  "token_ws",
  "apiKey",
  "apiKeySecret",
  "secret",
  "password",
  "cardNumber",
  "card_number",
  "jwt",
]);

const sanitize = (value: unknown, depth: number, seen: WeakSet<object>): unknown => {
  if (depth > MAX_DEPTH) {
    return "[Truncated]";
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, depth + 1, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);
    const output: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (REDACT_KEYS.has(key)) {
        output[key] = "[REDACTED]";
        continue;
      }
      output[key] = sanitize(raw, depth + 1, seen);
    }
    return output;
  }

  return String(value);
};

const buildEntry = (level: LogLevel, msg: string, data?: LogPayload) => {
  const context = requestContext.get();
  const base: LogPayload = {
    ts: new Date().toISOString(),
    level,
    msg,
    app: "covasa-back",
  };
  if (context?.requestId) {
    base.requestId = context.requestId;
  }

  const sanitized = data ? sanitize(data, 0, new WeakSet()) : {};
  if (sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)) {
    return { ...base, ...(sanitized as LogPayload) };
  }
  return { ...base, data: sanitized };
};

const write = (level: LogLevel, msg: string, data?: LogPayload) => {
  const payload = buildEntry(level, msg, data);
  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  if (level === "debug") {
    console.debug(line);
    return;
  }
  console.log(line);
};

export const logger = {
  debug: (msg: string, data?: LogPayload) => write("debug", msg, data),
  info: (msg: string, data?: LogPayload) => write("info", msg, data),
  warn: (msg: string, data?: LogPayload) => write("warn", msg, data),
  error: (msg: string, data?: LogPayload) => write("error", msg, data),
};
