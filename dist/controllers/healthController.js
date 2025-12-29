"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheck = void 0;
const healthCheck = (_req, res) => {
    res.json({ status: "ok" });
};
exports.healthCheck = healthCheck;
