import { Prisma } from "@prisma/client";
import { normalizarTexto } from "../ecommerce.utilidades";
import { crearNotificacion, listarNotificaciones } from "./notificaciones.repositorio";

export const registrarNotificacion = async (datos: {
  tipo: string;
  referenciaTabla: string;
  referenciaId: string;
  titulo: string;
  detalle: string;
  tx?: Prisma.TransactionClient;
}) => {
  return crearNotificacion({
    tipo: normalizarTexto(datos.tipo),
    referenciaTabla: normalizarTexto(datos.referenciaTabla),
    referenciaId: normalizarTexto(datos.referenciaId),
    titulo: normalizarTexto(datos.titulo),
    detalle: normalizarTexto(datos.detalle),
  }, datos.tx);
};

export const listarNotificacionesServicio = async (filtros: {
  leido?: boolean;
  limit?: number;
  offset?: number;
}) => listarNotificaciones(filtros);
