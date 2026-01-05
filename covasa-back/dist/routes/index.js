"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const healthController_1 = require("../controllers/healthController");
const productos_1 = __importDefault(require("./productos"));
const cotizaciones_1 = __importDefault(require("./cotizaciones"));
const pagos_1 = __importDefault(require("./pagos"));
const ecommerce_1 = __importDefault(require("../modules/ecommerce"));
const router = (0, express_1.Router)();
router.get("/", (_req, res) => {
    res.json({
        ok: true,
        data: {
            message: "Bienvenido a la API de Covasa",
        },
    });
});
router.get("/health", healthController_1.healthCheck);
router.use("/productos", productos_1.default);
router.use("/products", productos_1.default);
router.use("/cotizaciones", cotizaciones_1.default);
router.use("/pagos", pagos_1.default);
router.use("/ecommerce", ecommerce_1.default);
exports.default = router;
