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
  Inventario: { stock: number }[];
};

const mapearProducto = (producto: ProductoBase) => {
  const stockDisponible = producto.Inventario.reduce((sum, item) => sum + item.stock, 0);
  const precioNeto = producto.precioConDescto > 0 ? producto.precioConDescto : producto.precioGeneral;

  return {
    id: producto.id,
    sku: producto.sku,
    nombre: producto.nombre,
    descripcion: producto.nombre,
    unidad: producto.unidadMedida,
    fotoUrl: producto.fotoUrl,
    tipo: producto.tipo,
    precioNeto,
    precioLista: producto.precioGeneral,
    precioConDescuento: producto.precioConDescto,
    stockDisponible,
  };
};

export const listarProductosCatalogo = async (filtros: {
  q?: string;
  tipo?: ProductoTipo;
  limit?: number;
  offset?: number;
}) => {
  const productos = await buscarProductos(filtros);
  return productos.map(mapearProducto);
};

export const obtenerProductoCatalogo = async (id: string) => {
  const producto = await buscarProductoPorId(id);
  if (!producto) {
    throw new ErrorApi("Producto no encontrado", 404, { id });
  }
  return mapearProducto(producto);
};
