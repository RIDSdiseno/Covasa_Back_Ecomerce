import { prisma } from "../../../lib/prisma";
import { ErrorApi } from "../../../lib/errores";

/**
 * Resultado de validación de cantidad mínima
 */
export interface MinQtyValidationResult {
  valid: boolean;
  productId: string;
  productName: string;
  requestedQty: number;
  minQuantity: number;
}

/**
 * Error estandarizado para cantidad mínima no cumplida
 */
export interface MinQtyErrorDetails {
  code: "MIN_QTY";
  minQuantity: number;
  productId: string;
  productName: string;
  requestedQty: number;
}

/**
 * Valida que la cantidad solicitada cumpla con el mínimo del producto
 *
 * @param productId - ID del producto
 * @param requestedQty - Cantidad solicitada
 * @returns Resultado de validación con detalles
 */
export async function validateMinQuantity(
  productId: string,
  requestedQty: number
): Promise<MinQtyValidationResult> {
  const producto = await prisma.producto.findUnique({
    where: { id: productId },
    select: {
      id: true,
      nombre: true,
      minQuantity: true,
    },
  });

  if (!producto) {
    throw new ErrorApi("Producto no encontrado", 404, { productId });
  }

  const minQty = producto.minQuantity ?? 0;

  return {
    valid: minQty === 0 || requestedQty >= minQty,
    productId: producto.id,
    productName: producto.nombre,
    requestedQty,
    minQuantity: minQty,
  };
}

/**
 * Valida múltiples items (carrito o pedido)
 *
 * @param items - Array de items con productoId y cantidad
 * @returns Objeto con resultado de validación y lista de errores
 */
export async function validateCartMinQuantities(
  items: Array<{ productoId: string; cantidad: number }>
): Promise<{ valid: boolean; errors: MinQtyValidationResult[] }> {
  const errors: MinQtyValidationResult[] = [];

  // Obtener todos los productos en una sola query para optimizar
  const productIds = items.map((i) => i.productoId);
  const productos = await prisma.producto.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      nombre: true,
      minQuantity: true,
    },
  });

  // Crear mapa para búsqueda rápida
  const productMap = new Map(productos.map((p) => [p.id, p]));

  for (const item of items) {
    const producto = productMap.get(item.productoId);

    if (!producto) {
      // Producto no encontrado - esto se manejará en otra validación
      continue;
    }

    const minQty = producto.minQuantity ?? 0;

    if (minQty > 0 && item.cantidad < minQty) {
      errors.push({
        valid: false,
        productId: producto.id,
        productName: producto.nombre,
        requestedQty: item.cantidad,
        minQuantity: minQty,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Lanza un error estandarizado si la validación falla
 *
 * @param result - Resultado de validación fallida
 * @throws ErrorApi con código MIN_QTY
 */
export function throwMinQtyError(result: MinQtyValidationResult): never {
  const details: MinQtyErrorDetails = {
    code: "MIN_QTY",
    minQuantity: result.minQuantity,
    productId: result.productId,
    productName: result.productName,
    requestedQty: result.requestedQty,
  };

  throw new ErrorApi(
    `Este producto tiene compra mínima de ${result.minQuantity} unidades.`,
    400,
    details,
    "MIN_QTY"
  );
}

/**
 * Lanza error para múltiples productos que no cumplen el mínimo
 *
 * @param errors - Lista de resultados de validación fallidos
 * @throws ErrorApi con código MIN_QTY y lista de errores
 */
export function throwMultipleMinQtyErrors(errors: MinQtyValidationResult[]): never {
  const firstError = errors[0];

  throw new ErrorApi(
    `El producto "${firstError.productName}" tiene compra mínima de ${firstError.minQuantity} unidades.`,
    400,
    {
      code: "MIN_QTY",
      errors: errors.map((e) => ({
        productId: e.productId,
        productName: e.productName,
        minQuantity: e.minQuantity,
        requestedQty: e.requestedQty,
      })),
    },
    "MIN_QTY"
  );
}
