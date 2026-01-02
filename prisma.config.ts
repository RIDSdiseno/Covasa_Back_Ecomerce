import path from "path";
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({
  path: path.resolve(__dirname, ".env"),
  override: process.env.NODE_ENV !== "production",
});

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});

