import { CrmEstadoCotizacion, EcommerceEstadoCotizacion, Prisma } from "@prisma/client";
import { ErrorApi } from "../../../lib/errores";
import { prisma } from "../../../lib/prisma";

const PAGE_SIZE = 20;

type ListadoParams = {
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
};

const normalizarEstado = (valor?: string) => (valor ?? "").trim().toUpperCase();

const parseFecha = (valor?: string, campo = "fecha") => {
  if (!valor) {
    return undefined;
  }
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    throw new ErrorApi("Fecha invalida", 400, { [campo]: valor });
  }
  return fecha;
};

const parseObservaciones = (valor?: string | null) => {
  if (!valor) {
    return {};
  }
  try {
    const parsed = JSON.parse(valor);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return { observaciones: valor };
  }
  return { observaciones: valor };
};

const leerTexto = (valor: unknown) => (typeof valor === "string" ? valor : undefined);

export const listarCrmCotizacionesServicio = async (params: ListadoParams) => {
  const status = normalizarEstado(params.status);
  const estadoEcommerce = status && Object.values(EcommerceEstadoCotizacion).includes(status as EcommerceEstadoCotizacion)
    ? (status as EcommerceEstadoCotizacion)
    : undefined;
  const estadoCrm = status && Object.values(CrmEstadoCotizacion).includes(status as CrmEstadoCotizacion)
    ? (status as CrmEstadoCotizacion)
    : undefined;

  if (params.status && !estadoEcommerce && !estadoCrm) {
    throw new ErrorApi("Estado invalido", 400, { status: params.status });
  }

  const q = (params.q ?? "").trim();
  const desde = parseFecha(params.from, "from");
  const hasta = parseFecha(params.to, "to");
  const page = params.page ?? 1;
  const skip = (page - 1) * PAGE_SIZE;

  const filtros: Prisma.EcommerceCotizacionWhereInput[] = [];

  if (estadoEcommerce) {
    filtros.push({ estado: estadoEcommerce });
  }

  if (estadoCrm) {
    filtros.push({ crmCotizacion: { estado: estadoCrm } });
  }

  if (q) {
    filtros.push({
      OR: [
        { codigo: { contains: q, mode: "insensitive" } },
        { nombreContacto: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { telefono: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (desde || hasta) {
    filtros.push({
      createdAt: {
        gte: desde,
        lte: hasta,
      },
    });
  }

  const where = filtros.length > 0 ? { AND: filtros } : {};

  const [items, total] = await prisma.$transaction([
    prisma.ecommerceCotizacion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        codigo: true,
        createdAt: true,
        nombreContacto: true,
        email: true,
        telefono: true,
        estado: true,
        crmCotizacionId: true,
        crmCotizacion: { select: { estado: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.ecommerceCotizacion.count({ where }),
  ]);

  return {
    page,
    pageSize: PAGE_SIZE,
    total,
    items: items.map((item) => ({
      id: item.id,
      crmCotizacionId: item.crmCotizacionId,
      codigo: item.codigo,
      createdAt: item.createdAt,
      nombreContacto: item.nombreContacto,
      email: item.email ?? null,
      telefono: item.telefono ?? null,
      estado: item.estado,
      estadoCrm: item.crmCotizacion?.estado ?? null,
      cantidadItems: item._count.items,
    })),
  };
};

export const obtenerCrmCotizacionServicio = async (id: string) => {
  const cotizacion = await prisma.ecommerceCotizacion.findFirst({
    where: {
      OR: [{ id }, { crmCotizacionId: id }, { codigo: id }],
    },
    include: {
      items: true,
      crmCotizacion: true,
    },
  });

  if (!cotizacion) {
    throw new ErrorApi("Cotizacion no encontrada", 404, { id });
  }

  const extras = parseObservaciones(cotizacion.observaciones);

  return {
    id: cotizacion.id,
    crmCotizacionId: cotizacion.crmCotizacionId,
    codigo: cotizacion.codigo,
    origen: cotizacion.origen,
    estado: cotizacion.estado,
    estadoCrm: cotizacion.crmCotizacion?.estado ?? null,
    createdAt: cotizacion.createdAt,
    contacto: {
      nombre: cotizacion.nombreContacto,
      email: cotizacion.email ?? null,
      telefono: cotizacion.telefono ?? null,
      empresa: cotizacion.empresa ?? null,
      rut: cotizacion.rut ?? null,
      direccion: leerTexto(extras.direccion) ?? null,
      mensaje: leerTexto(extras.mensaje) ?? null,
    },
    extra: {
      tipoObra: leerTexto(extras.tipoObra) ?? null,
      comunaRegion: leerTexto(extras.comunaRegion) ?? null,
      detalleAdicional: leerTexto(extras.detalleAdicional) ?? null,
      ubicacion: leerTexto(extras.ubicacion) ?? null,
      observaciones: leerTexto(extras.observaciones) ?? null,
    },
    totales: {
      subtotalNeto: cotizacion.subtotalNeto,
      iva: cotizacion.iva,
      total: cotizacion.total,
    },
    items: cotizacion.items.map((item) => ({
      id: item.id,
      productoId: item.productoId,
      skuSnapshot: item.skuSnapshot ?? null,
      nombreSnapshot: item.descripcionSnapshot,
      unidadSnapshot: item.unidadSnapshot ?? null,
      cantidad: item.cantidad,
      precioUnitarioNetoSnapshot: item.precioUnitarioNetoSnapshot,
      subtotalNetoSnapshot: item.subtotalNetoSnapshot,
      ivaPctSnapshot: item.ivaPctSnapshot,
      ivaMontoSnapshot: item.ivaMontoSnapshot,
      totalSnapshot: item.totalSnapshot,
      observacion: item.observacion ?? null,
    })),
    metadata: cotizacion.metadata ?? null,
  };
};
