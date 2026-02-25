import { Request, Response } from "express";
import { manejarAsync } from "../../../lib/manejarAsync";
import { ErrorApi } from "../../../lib/errores";
import { normalizarTexto } from "../common/ecommerce.utils";
import {
  cotizacionCrearSchema,
  cotizacionEliminarSchema,
  cotizacionIdSchema,
  cotizacionQuerySchema,
  quoteCrearSchema,
} from "./cotizaciones.schema";
import {
  convertirCotizacionACarritoServicio,
  crearCotizacionServicio,
  eliminarCotizacionServicio,
  listarCotizacionesServicio,
  obtenerCotizacionServicio,
} from "./cotizaciones.service";

const obtenerUsuarioId = (req: Request, res: Response) => {
  const authUserId = res.locals.auth?.sub as string | undefined;
  if (authUserId) {
    return authUserId;
  }

  const headerValue = req.headers["x-usuario-id"] ?? req.headers["x-user-id"];
  const headerId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const queryValue = req.query.usuarioId ?? req.query.userId;
  const queryId = Array.isArray(queryValue) ? queryValue[0] : queryValue;

  const usuarioId = normalizarTexto(typeof headerId === "string" ? headerId : "") ||
    normalizarTexto(typeof queryId === "string" ? queryId : "");

  if (!usuarioId) {
    throw new ErrorApi("usuarioId requerido", 401);
  }

  return usuarioId;
};

const obtenerTenantId = (req: Request, res: Response) => {
  const authTenant = (res.locals.auth as { tenantId?: string } | undefined)?.tenantId;
  if (authTenant) {
    const tenantNormalizado = normalizarTexto(authTenant);
    if (tenantNormalizado) {
      return tenantNormalizado;
    }
  }

  const headerValue = req.headers["x-tenant-id"] ?? req.headers["x-tenant"];
  const headerId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const queryValue = req.query.tenantId;
  const queryId = Array.isArray(queryValue) ? queryValue[0] : queryValue;

  return (
    normalizarTexto(typeof headerId === "string" ? headerId : "") ||
    normalizarTexto(typeof queryId === "string" ? queryId : "") ||
    null
  );
};

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
      region: payload.contacto.region ?? undefined,
      comuna: payload.contacto.comuna ?? undefined,
      mensaje: payload.contacto.mensaje ?? undefined,
    },
    observaciones: payload.observaciones,
    ocCliente: payload.ocCliente ?? payload.ocNumero,
    origen: payload.origen,
    metadata: payload.metadata ?? undefined,
    extra: {
      tipoObra: payload.contacto.tipoObra ?? undefined,
      ubicacion: payload.contacto.ubicacion ?? undefined,
      region: payload.contacto.region ?? undefined,
      comuna: payload.contacto.comuna ?? undefined,
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

// DELETE /api/ecommerce/cotizaciones/:id
// Input: { motivo? }. Output: { action, cotizacionId, estado }.
export const eliminarCotizacion = manejarAsync(async (req: Request, res: Response) => {
  const { id } = cotizacionIdSchema.parse(req.params);
  const payload = cotizacionEliminarSchema.parse(req.body ?? {});
  const usuarioId = obtenerUsuarioId(req, res);
  const tenantId = obtenerTenantId(req, res);

  const resultado = await eliminarCotizacionServicio({
    id,
    usuarioId,
    motivo: payload.motivo ?? undefined,
  });

  console.info("[EcommerceCotizacion] eliminar", {
    cotizacionId: id,
    usuarioId,
    tenantId,
    resultado: resultado.action,
    pedidoId: resultado.pedidoId,
    pagoCount: resultado.pagoCount,
  });

  res.json({
    ok: true,
    data: resultado,
    message: resultado.action === "deleted" ? "Cotizacion eliminada" : "Cotizacion cancelada",
  });
});
