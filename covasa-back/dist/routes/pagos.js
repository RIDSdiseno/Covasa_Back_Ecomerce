"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pagosController_1 = require("../controllers/pagosController");
const router = (0, express_1.Router)();
router.post("/", pagosController_1.crearPago);
exports.default = router;
