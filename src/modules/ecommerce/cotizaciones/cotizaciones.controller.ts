import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { cotizacionCrearSchema, cotizacionIdSchema, cotizacionQuerySchema, quoteCrearSchema } from "./cotizaciones.schema";
import {
  convertirCotizacionACarritoServicio,
  crearCotizacionServicio,
  listarCotizacionesServicio,
  obtenerCotizacionServicio,
} from "./cotizaciones.service";

// GET /api/ecommerce/cotizaciones
// Output: listado paginado de cotizaciones del usuario autenticado.
export const listarCotizaciones = manejarAsync(async (req: Request, res: Response) => {
  const usuarioId = res.locals.auth?.sub as string;
  const query = cotizacionQuerySchema.parse(req.query);
  const resultado = await listarCotizacionesServicio({ ...query, usuarioId });
  res.json({
    ok: true,
    data: resultado.items,
    page: resultado.page,
    pageSize: resultado.pageSize,
    total: resultado.total,
    totalPages: resultado.totalPages,
  });
});

// POST /api/ecommerce/cotizaciones (principal) y /api/cotizaciones (legacy)
// Input: { contacto, observaciones?, ocCliente?/ocNumero?, items[] }. Output: { id, codigo, total }.
export const crearCotizacion = manejarAsync(async (req: Request, res: Response) => {
  const payload = cotizacionCrearSchema.parse(req.body);

  const resultado = await crearCotizacionServicio({
    ecommerceClienteId: payload.ecommerceClienteId,
    contacto: {
      nombre: payload.contacto.nombre,
      email: payload.contacto.email ?? undefined,
      telefono: payload.contacto.telefono ?? undefined,
      empresa: payload.contacto.empresa ?? undefined,
      rut: payload.contacto.rut ?? undefined,
      direccion: payload.contacto.direccion ?? undefined,
      mensaje: payload.contacto.mensaje ?? undefined,
    },
    observaciones: payload.observaciones,
    ocCliente: payload.ocCliente ?? payload.ocNumero,
    origen: payload.origen,
    metadata: payload.metadata ?? undefined,
    extra: {
      tipoObra: payload.contacto.tipoObra ?? undefined,
      ubicacion: payload.contacto.ubicacion ?? undefined,
      region: payload.contacto.region,
      comuna: payload.contacto.comuna,
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
