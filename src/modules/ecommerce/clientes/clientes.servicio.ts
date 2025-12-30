import { ErrorApi } from "../../../lib/errores";
import { normalizarTexto } from "../ecommerce.utilidades";
import { buscarClientePorId } from "./clientes.repositorio";

const normalizarNullable = (valor?: string | null) => normalizarTexto(valor ?? undefined);

// Obtiene datos de contacto y direccion del cliente registrado.
export const obtenerClienteServicio = async (id: string) => {
  const cliente = await buscarClientePorId(id);
  if (!cliente) {
    throw new ErrorApi("Cliente no encontrado", 404, { id });
  }

  return {
    id: cliente.id,
    nombre: normalizarTexto(cliente.nombre),
    personaContacto: normalizarNullable(cliente.personaContacto) || undefined,
    email: normalizarNullable(cliente.email) || undefined,
    telefono: normalizarNullable(cliente.telefono) || undefined,
    direccion: normalizarNullable(cliente.direccion) || undefined,
    comuna: normalizarNullable(cliente.comuna) || undefined,
    ciudad: normalizarNullable(cliente.ciudad) || undefined,
    region: normalizarNullable(cliente.region) || undefined,
  };
};
