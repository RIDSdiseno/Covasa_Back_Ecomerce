import "./lib/env";
import app from "./app";
import { logger } from "./lib/logger";

const PORT = Number(process.env.PORT) || 3001;
const HOST = (process.env.HOST || "0.0.0.0").trim() || "0.0.0.0";

app.listen(PORT, HOST, () => {
  logger.info("server_listening", {
    port: PORT,
    host: HOST,
    nodeEnv: process.env.NODE_ENV || "development",
  });
});
