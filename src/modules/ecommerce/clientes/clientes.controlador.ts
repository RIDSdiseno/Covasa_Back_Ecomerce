import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { clienteIdSchema } from "./clientes.esquemas";
import { obtenerClienteServicio } from "./clientes.servicio";

// GET /api/ecommerce/clientes/:id
// Output: datos de contacto y direccion del cliente.
export const obtenerCliente = manejarAsync(async (req: Request, res: Response) => {
  const { id } = clienteIdSchema.parse(req.params);
  const cliente = await obtenerClienteServicio(id);
  res.json({ ok: true, data: cliente });
});
