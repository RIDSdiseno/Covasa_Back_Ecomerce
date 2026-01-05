import { ErrorApi } from "../../../lib/errores";
import { construirDireccionLinea, construirNombreCompleto, normalizarTexto } from "../ecommerce.utilidades";
import { buscarClientePorId } from "./clientes.repositorio";
import { obtenerDireccionPrincipal } from "../usuarios/usuarios.repositorio";

const normalizarNullable = (valor?: string | null) => normalizarTexto(valor ?? undefined);

// Obtiene datos de contacto y direccion principal del cliente registrado.
export const obtenerClienteServicio = async (id: string) => {
  const cliente = await buscarClientePorId(id);
  if (!cliente) {
    throw new ErrorApi("Cliente no encontrado", 404, { id });
  }

  const direccion = await obtenerDireccionPrincipal(cliente.id);

  return {
    id: cliente.id,
    nombre: construirNombreCompleto(cliente.nombres, cliente.apellidos) || normalizarTexto(cliente.nombres),
    email: normalizarNullable(cliente.emailContacto) || undefined,
    telefono: normalizarNullable(cliente.telefono) || undefined,
    direccionPrincipal: direccion
      ? {
          id: direccion.id,
          nombreContacto: direccion.nombreRecibe,
          telefono: direccion.telefonoRecibe,
          email: direccion.email,
          direccion: construirDireccionLinea(direccion.calle, direccion.numero, direccion.depto),
          comuna: direccion.comuna,
          ciudad: direccion.ciudad,
          region: direccion.region,
          notas: direccion.notas,
        }
      : null,
  };
};
