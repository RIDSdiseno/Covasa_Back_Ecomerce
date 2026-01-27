import { prisma } from "../../../lib/prisma";
import { ErrorApi } from "../../../lib/errores";

type EstadoPayload = {
  activo?: boolean;
  visibleEcommerce?: boolean;
};

export const actualizarProductoEstadoServicio = async (id: string, payload: EstadoPayload) => {
  const data: Record<string, boolean> = {};
  if (payload.activo !== undefined) data.activo = payload.activo;
  if (payload.visibleEcommerce !== undefined) data.visibleEcommerce = payload.visibleEcommerce;

  try {
    return await prisma.producto.update({
      where: { id },
      data,
      select: { id: true, activo: true, visibleEcommerce: true },
    });
  } catch (err: any) {
    if (err?.code === "P2025") {
      throw new ErrorApi("Producto no encontrado", 404, { id });
    }
    throw err;
  }
};
