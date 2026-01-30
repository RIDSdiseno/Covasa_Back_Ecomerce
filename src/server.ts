import "./lib/env";
import app from "./app";
import { logger } from "./lib/logger";

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, () => {
  logger.info("server_listening", { port: PORT });
});
