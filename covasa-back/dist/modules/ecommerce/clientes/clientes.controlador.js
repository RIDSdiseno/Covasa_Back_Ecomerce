"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.obtenerCliente = void 0;
const manejarAsync_1 = require("../../../lib/manejarAsync");
const clientes_esquemas_1 = require("./clientes.esquemas");
const clientes_servicio_1 = require("./clientes.servicio");
// GET /api/ecommerce/clientes/:id
// Output: datos de contacto y direccion del cliente.
exports.obtenerCliente = (0, manejarAsync_1.manejarAsync)(async (req, res) => {
    const { id } = clientes_esquemas_1.clienteIdSchema.parse(req.params);
    const cliente = await (0, clientes_servicio_1.obtenerClienteServicio)(id);
    res.json({ ok: true, data: cliente });
});
