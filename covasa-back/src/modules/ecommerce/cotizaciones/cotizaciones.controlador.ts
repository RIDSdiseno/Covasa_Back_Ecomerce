import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { cotizacionCrearSchema, cotizacionIdSchema, quoteCrearSchema } from "./cotizaciones.esquemas";
import {
  convertirCotizacionACarritoServicio,
  crearCotizacionServicio,
  obtenerCotizacionServicio,
} from "./cotizaciones.servicio";

// POST /api/cotizaciones (legacy front)
// Input: { contacto, observaciones?, ocCliente?/ocNumero?, items[] }. Output: { id, codigo, total }.
export const crearCotizacion = manejarAsync(async (req: Request, res: Response) => {
  const payload = cotizacionCrearSchema.parse(req.body);

  const resultado = await crearCotizacionServicio({
    ecommerceClienteId: payload.ecommerceClienteId,
    contacto: {
      nombre: payload.contacto.nombre,
      email: payload.contacto.email,
      telefono: payload.contacto.telefono,
      empresa: payload.contacto.empresa,
      rut: payload.contacto.rut,
    },
    observaciones: payload.observaciones,
    ocCliente: payload.ocCliente ?? payload.ocNumero,
    extra: {
      tipoObra: payload.contacto.tipoObra,
      ubicacion: payload.contacto.ubicacion,
    },
    items: payload.items,
  });

  res.status(201).json({
    ok: true,
    data: {
      id: resultado.id,
      codigo: resultado.codigo,
      total: resultado.total,
      estado: resultado.estado,
    },
    message: "Cotizacion registrada",
  });
});

// POST /api/ecommerce/quotes
// Input: campos del formulario UI. Output: { cotizacionId, codigo, total }.
export const crearQuote = manejarAsync(async (req: Request, res: Response) => {
  const payload = quoteCrearSchema.parse(req.body);

  const resultado = await crearCotizacionServicio({
    contacto: {
      nombre: payload.nombreContacto,
      email: payload.email,
      telefono: payload.telefono,
      empresa: payload.empresa,
    },
    observaciones: undefined,
    ocCliente: payload.ocCliente,
    extra: {
      tipoObra: payload.tipoObra,
      comunaRegion: payload.comunaRegion,
      detalleAdicional: payload.detalleAdicional,
    },
    items: payload.items,
  });

  res.status(201).json({
    ok: true,
    data: {
      cotizacionId: resultado.id,
      codigo: resultado.codigo,
      total: resultado.total,
    },
    message: "Cotizacion registrada",
  });
});

// GET /api/ecommerce/quotes/:id
// Output: cotizacion con items.
export const obtenerCotizacion = manejarAsync(async (req: Request, res: Response) => {
  const { id } = cotizacionIdSchema.parse(req.params);
  const cotizacion = await obtenerCotizacionServicio(id);
  res.json({ ok: true, data: cotizacion });
});

// POST /api/ecommerce/quotes/:id/convert-to-cart
// Output: { carritoId } y actualiza estado de cotizacion.
export const convertirCotizacionACarrito = manejarAsync(async (req: Request, res: Response) => {
  const { id } = cotizacionIdSchema.parse(req.params);
  const resultado = await convertirCotizacionACarritoServicio(id);

  res.json({
    ok: true,
    data: { carritoId: resultado.carritoId },
    message: "Cotizacion convertida a carrito",
  });
});
