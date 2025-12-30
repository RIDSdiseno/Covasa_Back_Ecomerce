"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.manejarAsync = void 0;
const manejarAsync = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
exports.manejarAsync = manejarAsync;
