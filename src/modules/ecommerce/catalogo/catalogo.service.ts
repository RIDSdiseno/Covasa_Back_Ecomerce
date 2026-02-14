import { EcommerceEstadoPedido, ProductoTipo } from "@prisma/client";
import { ErrorApi } from "../../../lib/errores";
import { prisma } from "../../../lib/prisma";
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
  precioWeb: number;
  tipo: ProductoTipo;
  activo: boolean;
  tieneVariantes?: boolean;
  precioPorVariante?: boolean;
  noControlaStock?: boolean;
  unidadVenta?: string | null;
  descripcionCorta?: string | null;
  descripcionTecnica?: string | null;
  minQuantity?: number;  // Cantidad mínima de compra
  categoria?: {
    id: string;
    nombre: string;
    slug: string;
  } | null;
  inventarios: { stock: number } | null;
  imagenes: { url: string; orden: number }[];
  variantes?: VarianteBase[];
};

const mapearProducto = (producto: ProductoBase) => {
  const variantes = producto.variantes ?? [];
  const tieneVariantes = producto.tieneVariantes === true && variantes.length > 0;

  // Calcular stock: si tiene variantes, suma de stocks de variantes; si no, stock de inventario
  let stockDisponible: number;
  if (tieneVariantes) {
    stockDisponible = variantes.reduce((sum, v) => sum + v.stock, 0);
  } else {
    stockDisponible = producto.inventarios?.stock ?? 0;
  }

  // Calcular precio neto base para ecommerce
  // Prioridad: precioWeb > precioConDescto > precioGeneral
  const precioBase = producto.precioWeb > 0
    ? producto.precioWeb
    : (producto.precioConDescto > 0 ? producto.precioConDescto : producto.precioGeneral);

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

  const imagenes = producto.imagenes
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
    precioWeb: producto.precioWeb,
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
    categoria: producto.categoria
      ? {
          id: producto.categoria.id,
          nombre: producto.categoria.nombre,
          slug: producto.categoria.slug,
        }
      : null,
    ranking: null as number | null,
    precioMinimo,
    precioMaximo,
    minQuantity: producto.minQuantity ?? 0,  // Cantidad mínima de compra
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

const construirRankingPorProducto = async (productoIds: string[]) => {
  if (productoIds.length === 0) {
    return new Map<string, number>();
  }

  const ventas = await prisma.ecommercePedidoItem.groupBy({
    by: ["productoId"],
    where: {
      productoId: { in: productoIds },
      pedido: {
        estado: { not: EcommerceEstadoPedido.CANCELADO },
      },
    },
    _sum: {
      cantidad: true,
    },
  });

  const ordenados = ventas
    .map((venta) => ({
      productoId: venta.productoId,
      cantidadVendida: venta._sum.cantidad ?? 0,
    }))
    .sort((a, b) => b.cantidadVendida - a.cantidadVendida);

  const rankingMap = new Map<string, number>();
  ordenados.forEach((venta, index) => {
    rankingMap.set(venta.productoId, index + 1);
  });

  return rankingMap;
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
  const rankingPorProducto = await construirRankingPorProducto(productos.map((producto) => producto.id));

  return productos.map((producto) => ({
    ...mapearProducto(producto),
    ranking: rankingPorProducto.get(producto.id) ?? null,
  }));
};

// Obtiene un producto por id y valida existencia.
export const obtenerProductoCatalogo = async (id: string) => {
  const producto = await buscarProductoPorId(id);
  if (!producto) {
    throw new ErrorApi("Producto no encontrado", 404, { id });
  }
  return mapearProducto(producto);
};
