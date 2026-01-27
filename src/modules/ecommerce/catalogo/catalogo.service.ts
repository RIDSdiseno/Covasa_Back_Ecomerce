import { ProductoTipo } from "@prisma/client";
import { ErrorApi } from "../../../lib/errores";
import { buscarProductoPorId, buscarProductos } from "./catalogo.repo";

type VarianteBase = {
  id: string;
  atributo: string;
  valor: string;
  precio: number | null;
  stock: number;
  stockMinimo: number;
  skuVariante: string | null;
  orden: number;
};

type ProductoBase = {
  id: string;
  sku: string | null;
  nombre: string;
  unidadMedida: string;
  fotoUrl: string | null;
  precioGeneral: number;
  precioConDescto: number;
  tipo: ProductoTipo;
  activo: boolean;
  tieneVariantes?: boolean;
  precioPorVariante?: boolean;
  noControlaStock?: boolean;
  unidadVenta?: string | null;
  descripcionCorta?: string | null;
  descripcionTecnica?: string | null;
  Inventario: { stock: number } | null;
  ProductoImagen: { url: string; orden: number }[];
  ProductoVariante?: VarianteBase[];
};

const mapearProducto = (producto: ProductoBase) => {
  const variantes = producto.ProductoVariante ?? [];
  const tieneVariantes = producto.tieneVariantes === true && variantes.length > 0;

  // Calcular stock: si tiene variantes, suma de stocks de variantes; si no, stock de inventario
  let stockDisponible: number;
  if (tieneVariantes) {
    stockDisponible = variantes.reduce((sum, v) => sum + v.stock, 0);
  } else {
    stockDisponible = producto.Inventario?.stock ?? 0;
  }

  // Calcular precio neto base (sin variantes)
  const precioBase = producto.precioConDescto > 0 ? producto.precioConDescto : producto.precioGeneral;

  // Calcular precios min/max de variantes
  let precioMinimo: number | undefined;
  let precioMaximo: number | undefined;
  let precioNeto = precioBase;

  if (tieneVariantes && producto.precioPorVariante) {
    const preciosVariantes = variantes
      .map((v) => v.precio)
      .filter((p): p is number => p !== null && p > 0);

    if (preciosVariantes.length > 0) {
      precioMinimo = Math.min(...preciosVariantes);
      precioMaximo = Math.max(...preciosVariantes);
      precioNeto = precioMinimo; // Mostrar precio mínimo como referencia
    }
  }

  const imagenes = producto.ProductoImagen
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((imagen) => imagen.url);

  return {
    id: producto.id,
    sku: producto.sku,
    nombre: producto.nombre,
    descripcion: producto.nombre,
    unidad: producto.unidadMedida,
    unidadMedida: producto.unidadMedida,
    fotoUrl: producto.fotoUrl,
    imagenes,
    tipo: producto.tipo,
    activo: producto.activo,
    precioNeto,
    precioLista: producto.precioGeneral,
    precioGeneral: producto.precioGeneral,
    precioConDescuento: producto.precioConDescto,
    precioConDescto: producto.precioConDescto,
    stockDisponible,
    // Campos de variantes
    tieneVariantes,
    precioPorVariante: producto.precioPorVariante ?? false,
    noControlaStock: producto.noControlaStock ?? false,
    unidadVenta: producto.unidadVenta,
    descripcionCorta: producto.descripcionCorta,
    descripcionTecnica: producto.descripcionTecnica,
    precioMinimo,
    precioMaximo,
    variantes: tieneVariantes
      ? variantes.map((v) => ({
          id: v.id,
          atributo: v.atributo,
          valor: v.valor,
          precio: v.precio,
          stock: v.stock,
          stockMinimo: v.stockMinimo,
          skuVariante: v.skuVariante,
        }))
      : undefined,
  };
};

// Lista productos reales desde Producto.
// Inputs: filtros q/tipo/limit/offset. Output: productos con precio neto y stock disponible.
export const listarProductosCatalogo = async (filtros: {
  q?: string;
  tipo?: ProductoTipo;
  limit?: number;
  offset?: number;
}) => {
  const productos = await buscarProductos(filtros);
  return productos.map(mapearProducto);
};

// Obtiene un producto por id y valida existencia.
export const obtenerProductoCatalogo = async (id: string) => {
  const producto = await buscarProductoPorId(id);
  if (!producto) {
    throw new ErrorApi("Producto no encontrado", 404, { id });
  }
  return mapearProducto(producto);
};
