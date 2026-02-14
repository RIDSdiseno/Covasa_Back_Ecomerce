import { randomUUID } from "crypto";
import {
  CrmEstadoCotizacion,
  CrmTipoCierre,
  EcommerceEstadoCarrito,
  EcommerceEstadoPedido,
  OrigenCliente,
} from "@prisma/client";
import { ErrorApi } from "../../../lib/errores";
import { prisma } from "../../../lib/prisma";
import {
  agruparItems,
  calcularTotales,
  construirDireccionLinea,
  construirNombreCompleto,
  formatearCodigo,
  normalizarTexto,
  obtenerIvaPct,
} from "../common/ecommerce.utils";
import { registrarNotificacion } from "../notificaciones/notificaciones.service";
import {
  buscarUsuarioPorId,
  crearDireccion,
  limpiarDireccionesPrincipales,
  obtenerDireccionPrincipal,
} from "../usuarios/usuarios.repo";
import {
  actualizarCarritoEstado,
  actualizarCodigoPedido,
  actualizarEstadoPedido,
  buscarClientePorId,
  buscarProductosPorIds,
  buscarVariantesPorIds,
  crearPedido,
  obtenerCarritoPorId,
  obtenerPedidoPorId,
} from "./pedidos.repo";
import {
  validateCartMinQuantities,
  throwMultipleMinQtyErrors,
} from "../common/minQuantity.validator";

type ItemSolicitud = { productoId: string; varianteId?: string; cantidad: number };

type DespachoPayload = {
  nombre?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  comuna?: string;
  ciudad?: string;
  region?: string;
  notas?: string;
  rut?: string;
};

type ClienteDespacho = {
  id: string;
  nombres: string | null;
  apellidos: string | null;
  emailContacto: string | null;
  telefono: string | null;
};

type UsuarioEcommerce = {
  id: string;
  ecommerceClienteId: string | null;
};

type DireccionDespacho = {
  nombreRecibe: string;
  telefonoRecibe: string;
  email: string;
  calle: string;
  numero: string | null;
  depto: string | null;
  comuna: string;
  ciudad: string | null;
  region: string;
  notas: string | null;
};

async function obtenerEcommerceClienteIdPorUsuario(usuarioId: string): Promise<string | null> {
  const cliente = await prisma.ecommerceCliente.findUnique({
    where: { usuarioId },
    select: { id: true },
  });
  return cliente?.id ?? null;
}


const validarStockConfigurado = () => process.env.ECOMMERCE_VALIDAR_STOCK === "true";

const normalizarNullable = (valor?: string | null) => normalizarTexto(valor ?? undefined);

const validarStockDisponible = async (items: ItemSolicitud[]) => {
  if (!validarStockConfigurado()) {
    return;
  }

  const ids = items.map((item) => item.productoId);
  const stockRows = await prisma.inventario.groupBy({
    by: ["productoId"],
    where: { productoId: { in: ids } },
    _sum: { stock: true },
  });

  const stockPorId = new Map(stockRows.map((row) => [row.productoId, row._sum.stock ?? 0]));
  const sinStock = items.filter((item) => (stockPorId.get(item.productoId) ?? 0) < item.cantidad);

  if (sinStock.length > 0) {
    throw new ErrorApi("Stock insuficiente", 409, {
      productos: sinStock.map((item) => ({
        productoId: item.productoId,
        solicitado: item.cantidad,
        disponible: stockPorId.get(item.productoId) ?? 0,
      })),
    });
  }
};

const resolverDespacho = (
  despacho?: DespachoPayload,
  cliente?: ClienteDespacho | null,
  direccionPrincipal?: DireccionDespacho | null
) => {
  const nombreCliente = construirNombreCompleto(cliente?.nombres, cliente?.apellidos);
  const direccionPrincipalLinea = direccionPrincipal
    ? construirDireccionLinea(direccionPrincipal.calle, direccionPrincipal.numero, direccionPrincipal.depto)
    : "";

  return {
    nombre:
      normalizarTexto(despacho?.nombre) ||
      normalizarNullable(direccionPrincipal?.nombreRecibe) ||
      nombreCliente ||
      undefined,
    telefono:
      normalizarTexto(despacho?.telefono) ||
      normalizarNullable(direccionPrincipal?.telefonoRecibe) ||
      normalizarNullable(cliente?.telefono) ||
      undefined,
    email:
      normalizarTexto(despacho?.email) ||
      normalizarNullable(direccionPrincipal?.email) ||
      normalizarNullable(cliente?.emailContacto) ||
      undefined,
    direccion:
      normalizarTexto(despacho?.direccion) ||
      normalizarNullable(direccionPrincipalLinea) ||
      undefined,
    comuna:
      normalizarTexto(despacho?.comuna) ||
      normalizarNullable(direccionPrincipal?.comuna) ||
      undefined,
    ciudad:
      normalizarTexto(despacho?.ciudad) ||
      normalizarNullable(direccionPrincipal?.ciudad) ||
      undefined,
    region:
      normalizarTexto(despacho?.region) ||
      normalizarNullable(direccionPrincipal?.region) ||
      undefined,
    notas: normalizarTexto(despacho?.notas) || normalizarNullable(direccionPrincipal?.notas) || undefined,
    rut: normalizarTexto(despacho?.rut) || undefined,
  };
};

const validarDespachoCompleto = (despacho: DespachoPayload) => {
  const faltantes: string[] = [];

  if (!despacho.nombre) faltantes.push("nombre");
  if (!despacho.telefono) faltantes.push("telefono");
  if (!despacho.email) faltantes.push("email");
  if (!despacho.direccion) faltantes.push("direccion");
  if (!despacho.comuna) faltantes.push("comuna");
  if (!despacho.region) faltantes.push("region");

  if (faltantes.length > 0) {
    throw new ErrorApi("Datos de despacho incompletos", 400, { campos: faltantes });
  }
};

const resolverUsuarioEcommerce = async (usuarioId?: string): Promise<UsuarioEcommerce | null> => {
  if (!usuarioId) {
    return null;
  }

  const usuario = await buscarUsuarioPorId(usuarioId);
  if (!usuario) {
    throw new ErrorApi("Usuario ecommerce no encontrado", 404, { id: usuarioId });
  }

  const ecommerceClienteId = await obtenerEcommerceClienteIdPorUsuario(usuario.id);

  return {
    id: usuario.id,
    ecommerceClienteId,
  };

};

const registrarDireccionPedido = async (datos: {
  pedidoId: string;
  ecommerceClienteId?: string;
  despacho: DespachoPayload;
  tx: Parameters<typeof crearDireccion>[1];
}) => {
  if (datos.ecommerceClienteId) {
    await limpiarDireccionesPrincipales(datos.ecommerceClienteId, datos.tx);
  }

  return crearDireccion(
    {
      pedido: { connect: { id: datos.pedidoId } },
      ecommerceCliente: datos.ecommerceClienteId
        ? { connect: { id: datos.ecommerceClienteId } }
        : undefined,
      nombreRecibe: datos.despacho.nombre ?? "",
      telefonoRecibe: datos.despacho.telefono ?? "",
      email: datos.despacho.email ?? "",
      calle: datos.despacho.direccion ?? "",
      comuna: datos.despacho.comuna ?? "",
      ciudad: datos.despacho.ciudad ?? undefined,
      region: datos.despacho.region ?? "",
      notas: datos.despacho.notas ?? undefined,
      principal: Boolean(datos.ecommerceClienteId),
    },
    datos.tx
  );
};

// Crea pedido desde items directos, calcula snapshots y notifica.
export const crearPedidoServicio = async (payload: {
  ecommerceClienteId?: string;
  usuarioId?: string;
  despacho?: DespachoPayload;
  items: ItemSolicitud[];
}) => {
  const ivaPct = obtenerIvaPct();
  const itemsAgrupados = agruparItems(payload.items);
  const ids = itemsAgrupados.map((item) => item.productoId);
  const productos = await buscarProductosPorIds(ids);
  const productosPorId = new Map(productos.map((producto) => [producto.id, producto]));

  const faltantes = ids.filter((id) => !productosPorId.has(id));
  if (faltantes.length > 0) {
    throw new ErrorApi("Productos no encontrados", 404, { productos: faltantes });
  }

  // Buscar variantes si hay items con varianteId
  const varianteIds = itemsAgrupados
    .map((item) => item.varianteId)
    .filter((id): id is string => Boolean(id));
  const variantes = varianteIds.length > 0 ? await buscarVariantesPorIds(varianteIds) : [];
  const variantesPorId = new Map(variantes.map((v) => [v.id, v]));

  const usuario = await resolverUsuarioEcommerce(payload.usuarioId);
  const ecommerceClienteId = payload.ecommerceClienteId ?? usuario?.ecommerceClienteId ?? undefined;

  let cliente: ClienteDespacho | null = null;
  let direccionPrincipal: DireccionDespacho | null = null;
  if (ecommerceClienteId) {
    const encontrado = await buscarClientePorId(ecommerceClienteId);
    if (!encontrado) {
      throw new ErrorApi("Cliente no encontrado", 404, { id: ecommerceClienteId });
    }
    cliente = encontrado as ClienteDespacho;
    direccionPrincipal = await obtenerDireccionPrincipal(ecommerceClienteId);
  }

  await validarStockDisponible(itemsAgrupados);

  // Validar cantidades mínimas de compra
  const minQtyValidation = await validateCartMinQuantities(itemsAgrupados);
  if (!minQtyValidation.valid) {
    throwMultipleMinQtyErrors(minQtyValidation.errors);
  }

  let subtotalNeto = 0;
  let ivaTotal = 0;
  const itemsCrear = itemsAgrupados.map((item) => {
    const producto = productosPorId.get(item.productoId);
    if (!producto) {
      throw new ErrorApi("Producto no encontrado", 404, { id: item.productoId });
    }

    // Obtener variante si existe
    const variante = item.varianteId ? variantesPorId.get(item.varianteId) : null;

    // Usar precio de variante si existe y tiene precio, sino precio del producto
    let precioNeto: number;
    if (variante && variante.precio !== null) {
      precioNeto = variante.precio;
    } else {
      // Prioridad: precioWeb > precioConDescto > precioGeneral
      precioNeto = producto.precioWeb > 0
        ? producto.precioWeb
        : (producto.precioConDescto > 0 ? producto.precioConDescto : producto.precioGeneral);
    }

    const subtotal = precioNeto * item.cantidad;
    const ivaMonto = Math.round((subtotal * ivaPct) / 100);
    const total = subtotal + ivaMonto;

    subtotalNeto += subtotal;
    ivaTotal += ivaMonto;

    // Agregar info de variante a la descripción si existe
    const descripcion = variante
      ? `${producto.nombre} - ${variante.atributo}: ${variante.valor}`
      : producto.nombre;

    return {
      producto: { connect: { id: item.productoId } },
      descripcionSnapshot: descripcion,
      cantidad: item.cantidad,
      precioUnitarioNetoSnapshot: precioNeto,
      subtotalNetoSnapshot: subtotal,
      ivaPctSnapshot: ivaPct,
      ivaMontoSnapshot: ivaMonto,
      totalSnapshot: total,
    };
  });

  const total = subtotalNeto + ivaTotal;
  const codigoTemporal = `ECP-TMP-${randomUUID()}`;
  const despachoFinal = resolverDespacho(payload.despacho, cliente, direccionPrincipal);

  validarDespachoCompleto(despachoFinal);

  const resultado = await prisma.$transaction(async (tx) => {
    const crmCotizacion = await tx.crmCotizacion.create({
      data: {
        clienteNombreSnapshot: normalizarTexto(despachoFinal.nombre),
        clienteEmailSnapshot: normalizarTexto(despachoFinal.email) || undefined,
        clienteTelefonoSnapshot: normalizarTexto(despachoFinal.telefono) || undefined,
        observaciones: normalizarTexto(despachoFinal.notas) || undefined,
        subtotalNeto,
        iva: ivaTotal,
        total,
        estado: CrmEstadoCotizacion.GANADA,
        tipoCierre: CrmTipoCierre.COMPRA,
        origenCliente: OrigenCliente.CLIENTE_ECOMMERCE,
      },
      select: { id: true },
    });

    const creado = await crearPedido(
      {
        codigo: codigoTemporal,
        ecommerceCliente: ecommerceClienteId ? { connect: { id: ecommerceClienteId } } : undefined,
        crmCotizacion: { connect: { id: crmCotizacion.id } },
        despachoNombre: despachoFinal.nombre,
        despachoTelefono: despachoFinal.telefono,
        despachoEmail: despachoFinal.email,
        despachoDireccion: despachoFinal.direccion,
        despachoComuna: despachoFinal.comuna,
        despachoCiudad: despachoFinal.ciudad,
        despachoRegion: despachoFinal.region,
        despachoNotas: despachoFinal.notas,
        despachoRut: despachoFinal.rut,
        subtotalNeto,
        iva: ivaTotal,
        total,
        items: { create: itemsCrear },
      },
      tx
    );

    const codigoFinal = formatearCodigo("ECP", creado.correlativo);
    const actualizado = await actualizarCodigoPedido(creado.id, codigoFinal, tx);

    await registrarDireccionPedido({
      pedidoId: creado.id,
      ecommerceClienteId,
      despacho: despachoFinal,
      tx,
    });

    await registrarNotificacion({
      tipo: "NUEVO_PEDIDO",
      referenciaTabla: "EcommercePedido",
      referenciaId: creado.id,
      titulo: "Nuevo pedido ecommerce",
      detalle: `Items ${itemsCrear.length}. Total ${total}.`,
      tx,
    });

    return actualizado;
  });

  return resultado;
};

// Crea pedido desde un carrito existente y marca el carrito como CONVERTIDO.
export const crearPedidoDesdeCarritoServicio = async (
  cartId: string,
  despacho?: DespachoPayload,
  usuarioId?: string
) => {
  const carrito = await obtenerCarritoPorId(cartId);
  if (!carrito) {
    throw new ErrorApi("Carrito no encontrado", 404, { id: cartId });
  }

  if (carrito.items.length === 0) {
    throw new ErrorApi("Carrito sin items", 400, { id: cartId });
  }

  const itemsSolicitud = carrito.items.map((item) => ({
    productoId: item.productoId,
    cantidad: item.cantidad,
  }));

  await validarStockDisponible(itemsSolicitud);

  // Validar cantidades mínimas de compra
  const minQtyValidation = await validateCartMinQuantities(itemsSolicitud);
  if (!minQtyValidation.valid) {
    throwMultipleMinQtyErrors(minQtyValidation.errors);
  }

  const productos = await buscarProductosPorIds(itemsSolicitud.map((item) => item.productoId));
  const productosPorId = new Map(productos.map((producto) => [producto.id, producto]));

  const itemsCrear = carrito.items.map((item) => {
    const producto = productosPorId.get(item.productoId);
    if (!producto) {
      throw new ErrorApi("Producto no encontrado", 404, { id: item.productoId });
    }

    return {
      producto: { connect: { id: item.productoId } },
      descripcionSnapshot: producto.nombre,
      cantidad: item.cantidad,
      precioUnitarioNetoSnapshot: item.precioUnitarioNetoSnapshot,
      subtotalNetoSnapshot: item.subtotalNetoSnapshot,
      ivaPctSnapshot: item.ivaPctSnapshot,
      ivaMontoSnapshot: item.ivaMontoSnapshot,
      totalSnapshot: item.totalSnapshot,
    };
  });

  const totales = calcularTotales(carrito.items);
  const codigoTemporal = `ECP-TMP-${randomUUID()}`;
  const usuario = await resolverUsuarioEcommerce(usuarioId);
  const ecommerceClienteId = carrito.ecommerceClienteId || usuario?.ecommerceClienteId || undefined;
  const cliente = ecommerceClienteId
    ? ((await buscarClientePorId(ecommerceClienteId)) as ClienteDespacho | null)
    : null;
  const direccionPrincipal = ecommerceClienteId
    ? ((await obtenerDireccionPrincipal(ecommerceClienteId)) as DireccionDespacho | null)
    : null;
  const despachoFinal = resolverDespacho(despacho, cliente, direccionPrincipal);

  validarDespachoCompleto(despachoFinal);

  const resultado = await prisma.$transaction(async (tx) => {
    const crmCotizacion = await tx.crmCotizacion.create({
      data: {
        clienteNombreSnapshot: normalizarTexto(despachoFinal.nombre),
        clienteEmailSnapshot: normalizarTexto(despachoFinal.email) || undefined,
        clienteTelefonoSnapshot: normalizarTexto(despachoFinal.telefono) || undefined,
        observaciones: normalizarTexto(despachoFinal.notas) || undefined,
        subtotalNeto: totales.subtotalNeto,
        iva: totales.iva,
        total: totales.total,
        estado: CrmEstadoCotizacion.GANADA,
        tipoCierre: CrmTipoCierre.COMPRA,
        origenCliente: OrigenCliente.CLIENTE_ECOMMERCE,
      },
      select: { id: true },
    });

    const creado = await crearPedido(
      {
        codigo: codigoTemporal,
        ecommerceCliente: ecommerceClienteId
          ? { connect: { id: ecommerceClienteId } }
          : undefined,
        crmCotizacion: { connect: { id: crmCotizacion.id } },
        despachoNombre: despachoFinal.nombre,
        despachoTelefono: despachoFinal.telefono,
        despachoEmail: despachoFinal.email,
        despachoDireccion: despachoFinal.direccion,
        despachoComuna: despachoFinal.comuna,
        despachoCiudad: despachoFinal.ciudad,
        despachoRegion: despachoFinal.region,
        despachoNotas: despachoFinal.notas,
        despachoRut: despachoFinal.rut,
        subtotalNeto: totales.subtotalNeto,
        iva: totales.iva,
        total: totales.total,
        items: { create: itemsCrear },
      },
      tx
    );

    const codigoFinal = formatearCodigo("ECP", creado.correlativo);
    const actualizado = await actualizarCodigoPedido(creado.id, codigoFinal, tx);

    await registrarDireccionPedido({
      pedidoId: creado.id,
      ecommerceClienteId,
      despacho: despachoFinal,
      tx,
    });

    await actualizarCarritoEstado(cartId, EcommerceEstadoCarrito.CONVERTIDO, tx);

    await registrarNotificacion({
      tipo: "NUEVO_PEDIDO",
      referenciaTabla: "EcommercePedido",
      referenciaId: creado.id,
      titulo: "Nuevo pedido ecommerce",
      detalle: `Pedido desde carrito ${cartId}. Total ${totales.total}.`,
      tx,
    });

    return actualizado;
  });

  return resultado;
};

// Obtiene pedido con items y pagos.
export const obtenerPedidoServicio = async (id: string) => {
  const pedido = await obtenerPedidoPorId(id);
  if (!pedido) {
    throw new ErrorApi("Pedido no encontrado", 404, { id });
  }
  return pedido;
};

// Actualiza estado de un pedido (uso interno con pagos).
export const actualizarEstadoPedidoServicio = async (id: string, estado: EcommerceEstadoPedido) => {
  const pedido = await obtenerPedidoPorId(id);
  if (!pedido) {
    throw new ErrorApi("Pedido no encontrado", 404, { id });
  }
  await actualizarEstadoPedido(id, estado);
  return { id, estado };
};
