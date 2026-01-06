import { ErrorApi } from "../../../lib/errores";

type ItemCantidad = { productoId: string; cantidad: number };

type ItemTotales = {
  subtotalNetoSnapshot: number;
  ivaMontoSnapshot: number;
  totalSnapshot: number;
};

export const obtenerIvaPct = () => {
  const valor = Number(process.env.IVA_PCT ?? 19);
  if (!Number.isFinite(valor) || valor <= 0 || valor > 100) {
    throw new ErrorApi("IVA configurado invalido", 500, { ivaPct: valor });
  }
  return Math.round(valor);
};

export const formatearCodigo = (prefijo: string, correlativo: number, largo = 6) =>
  `${prefijo}-${String(correlativo).padStart(largo, "0")}`;

export const agruparItems = (items: ItemCantidad[]) => {
  const mapa = new Map<string, number>();
  items.forEach((item) => {
    const actual = mapa.get(item.productoId) ?? 0;
    mapa.set(item.productoId, actual + item.cantidad);
  });

  return Array.from(mapa.entries()).map(([productoId, cantidad]) => ({
    productoId,
    cantidad,
  }));
};

export const normalizarTexto = (valor?: string) => (valor ?? "").trim();

export const construirNombreCompleto = (nombres?: string | null, apellidos?: string | null) => {
  const partes = [normalizarTexto(nombres ?? undefined), normalizarTexto(apellidos ?? undefined)].filter(
    (valor) => valor.length > 0
  );
  return partes.join(" ").trim();
};

export const construirDireccionLinea = (
  calle?: string | null,
  numero?: string | null,
  depto?: string | null
) => {
  const partes = [normalizarTexto(calle ?? undefined), normalizarTexto(numero ?? undefined), normalizarTexto(depto ?? undefined)].filter(
    (valor) => valor.length > 0
  );
  return partes.join(" ").trim();
};

export const calcularTotales = (items: ItemTotales[]) => {
  const acumulado = items.reduce(
    (acc, item) => {
      acc.subtotalNeto += item.subtotalNetoSnapshot;
      acc.iva += item.ivaMontoSnapshot;
      acc.total += item.totalSnapshot;
      return acc;
    },
    { subtotalNeto: 0, iva: 0, total: 0 }
  );

  return acumulado;
};

export const construirObservaciones = (datos: {
  observaciones?: string;
  direccion?: string;
  mensaje?: string;
  tipoObra?: string;
  comunaRegion?: string;
  detalleAdicional?: string;
  ubicacion?: string;
}) => {
  const observaciones = normalizarTexto(datos.observaciones);
  const direccion = normalizarTexto(datos.direccion);
  const mensaje = normalizarTexto(datos.mensaje);
  const tipoObra = normalizarTexto(datos.tipoObra);
  const comunaRegion = normalizarTexto(datos.comunaRegion);
  const detalleAdicional = normalizarTexto(datos.detalleAdicional);
  const ubicacion = normalizarTexto(datos.ubicacion);

  const payload: Record<string, string> = {};

  if (observaciones) payload.observaciones = observaciones;
  if (direccion) payload.direccion = direccion;
  if (mensaje) payload.mensaje = mensaje;
  if (tipoObra) payload.tipoObra = tipoObra;
  if (comunaRegion) payload.comunaRegion = comunaRegion;
  if (detalleAdicional) payload.detalleAdicional = detalleAdicional;
  if (ubicacion) payload.ubicacion = ubicacion;

  const tieneDatos = Object.keys(payload).length > 0;
  if (!tieneDatos) {
    return undefined;
  }

  return JSON.stringify(payload);
};
