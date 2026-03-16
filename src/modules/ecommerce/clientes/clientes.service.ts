import { ErrorApi } from "../../../lib/errores";
import { resolverUbicacionDireccion } from "../../../services/dpaCatalog.service";
import { construirDireccionLinea, construirNombreCompleto, normalizarTexto } from "../common/ecommerce.utils";
import { buscarClientePorId } from "./clientes.repo";
import { obtenerDireccionPrincipal } from "../usuarios/usuarios.repo";

const normalizarNullable = (valor?: string | null) => normalizarTexto(valor ?? undefined);

// Obtiene datos de contacto y direccion principal del cliente registrado.
export const obtenerClienteServicio = async (id: string) => {
  const cliente = await buscarClientePorId(id);
  if (!cliente) {
    throw new ErrorApi("Cliente no encontrado", 404, { id });
  }

  const direccion = await obtenerDireccionPrincipal(cliente.id);
  const ubicacion = resolverUbicacionDireccion({
    region: direccion?.region,
    comuna: direccion?.comuna,
  });

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
          comuna: ubicacion.comuna ?? direccion.comuna,
          comunaId: ubicacion.comunaId,
          ciudad: direccion.ciudad,
          region: ubicacion.region ?? direccion.region,
          regionId: ubicacion.regionId,
          notas: direccion.notas,
        }
      : null,
  };
};
