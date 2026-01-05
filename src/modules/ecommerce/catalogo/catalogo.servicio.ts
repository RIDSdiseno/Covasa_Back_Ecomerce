import { ProductoTipo } from "@prisma/client";
import { ErrorApi } from "../../../lib/errores";
import { buscarProductoPorId, buscarProductos } from "./catalogo.repositorio";

type ProductoBase = {
  id: string;
  sku: string | null;
  nombre: string;
  unidadMedida: string;
  fotoUrl: string | null;
  precioGeneral: number;
  precioConDescto: number;
  tipo: ProductoTipo;
  Inventario: { stock: number } | null;
  ProductoImagen: { url: string; orden: number }[];
};

const mapearProducto = (producto: ProductoBase) => {
  const stockDisponible = producto.Inventario?.stock ?? 0;
  const precioNeto = producto.precioConDescto > 0 ? producto.precioConDescto : producto.precioGeneral;
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
    precioNeto,
    precioLista: producto.precioGeneral,
    precioGeneral: producto.precioGeneral,
    precioConDescuento: producto.precioConDescto,
    precioConDescto: producto.precioConDescto,
    stockDisponible,
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
