"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const globalForPrisma = global;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
}
exports.prisma = globalForPrisma.prisma ??
    new client_1.PrismaClient({
        log: ["error", "warn"],
        adapter: new adapter_pg_1.PrismaPg({ connectionString }),
    });
if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = exports.prisma;
