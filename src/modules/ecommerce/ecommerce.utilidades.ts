import { ErrorApi } from "../../lib/errores";

type ItemCantidad = { productoId: string; cantidad: number };

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
