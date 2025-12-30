"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listarNotificaciones = void 0;
const manejarAsync_1 = require("../../../lib/manejarAsync");
const notificaciones_esquemas_1 = require("./notificaciones.esquemas");
const notificaciones_servicio_1 = require("./notificaciones.servicio");
// GET /api/ecommerce/notificaciones
// Input: leido?, limit?, offset?. Output: lista de notificaciones.
exports.listarNotificaciones = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const query = notificaciones_esquemas_1.notificacionesQuerySchema.parse(req.query);
    const notificaciones = await (0, notificaciones_servicio_1.listarNotificacionesServicio)(query);
    res.json({ ok: true, data: notificaciones });
});
