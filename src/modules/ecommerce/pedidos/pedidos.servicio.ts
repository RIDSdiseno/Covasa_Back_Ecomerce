import { randomUUID } from "crypto";
import { EcommerceEstadoCarrito, EcommerceEstadoPedido } from "@prisma/client";
import { ErrorApi } from "../../../lib/errores";
import { prisma } from "../../../lib/prisma";
import {
  agruparItems,
  calcularTotales,
  formatearCodigo,
  normalizarTexto,
  obtenerIvaPct,
} from "../ecommerce.utilidades";
import { registrarNotificacion } from "../notificaciones/notificaciones.servicio";
import {
  buscarUsuarioPorId,
  crearDireccion,
  limpiarDireccionesPrincipales,
} from "../usuarios/usuarios.repositorio";
import {
  actualizarCarritoEstado,
  actualizarCodigoPedido,
  actualizarEstadoPedido,
  buscarClientePorId,
  buscarProductosPorIds,
  crearPedido,
  obtenerCarritoPorId,
  obtenerPedidoPorId,
} from "./pedidos.repositorio";

type ItemSolicitud = { productoId: string; cantidad: number };

type DespachoPayload = {
  nombre?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  comuna?: string;
  ciudad?: string;
  region?: string;
  notas?: string;
};

type ClienteDespacho = {
  id: string;
  nombre: string;
  personaContacto: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  comuna: string | null;
  ciudad: string | null;
  region: string | null;
};

type UsuarioEcommerce = {
  id: string;
  clienteId: string | null;
};

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

const resolverDespacho = (despacho?: DespachoPayload, cliente?: ClienteDespacho | null) => {
  const nombreCliente = normalizarNullable(cliente?.personaContacto) || normalizarNullable(cliente?.nombre);

  return {
    nombre: normalizarTexto(despacho?.nombre) || nombreCliente || undefined,
    telefono: normalizarTexto(despacho?.telefono) || normalizarNullable(cliente?.telefono) || undefined,
    email: normalizarTexto(despacho?.email) || normalizarNullable(cliente?.email) || undefined,
    direccion: normalizarTexto(despacho?.direccion) || normalizarNullable(cliente?.direccion) || undefined,
    comuna: normalizarTexto(despacho?.comuna) || normalizarNullable(cliente?.comuna) || undefined,
    ciudad: normalizarTexto(despacho?.ciudad) || normalizarNullable(cliente?.ciudad) || undefined,
    region: normalizarTexto(despacho?.region) || normalizarNullable(cliente?.region) || undefined,
    notas: normalizarTexto(despacho?.notas) || undefined,
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

  return {
    id: usuario.id,
    clienteId: usuario.clienteId ?? null,
  };
};

const registrarDireccionPedido = async (datos: {
  pedidoId: string;
  usuarioId?: string;
  despacho: DespachoPayload;
  tx: Parameters<typeof crearDireccion>[1];
}) => {
  if (datos.usuarioId) {
    await limpiarDireccionesPrincipales(datos.usuarioId, datos.tx);
  }

  return crearDireccion(
    {
      pedido: { connect: { id: datos.pedidoId } },
      usuario: datos.usuarioId ? { connect: { id: datos.usuarioId } } : undefined,
      nombreContacto: datos.despacho.nombre ?? "",
      telefono: datos.despacho.telefono ?? "",
      email: datos.despacho.email ?? "",
      direccion: datos.despacho.direccion ?? "",
      comuna: datos.despacho.comuna ?? "",
      ciudad: datos.despacho.ciudad ?? undefined,
      region: datos.despacho.region ?? "",
      notas: datos.despacho.notas ?? undefined,
      esPrincipal: Boolean(datos.usuarioId),
    },
    datos.tx
  );
};

// Crea pedido desde items directos, calcula snapshots y notifica.
export const crearPedidoServicio = async (payload: {
  clienteId?: string;
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

  const usuario = await resolverUsuarioEcommerce(payload.usuarioId);
  const clienteIdFinal = payload.clienteId || usuario?.clienteId || undefined;

  let cliente: ClienteDespacho | null = null;
  if (clienteIdFinal) {
    const encontrado = await buscarClientePorId(clienteIdFinal);
    if (!encontrado) {
      throw new ErrorApi("Cliente no encontrado", 404, { id: clienteIdFinal });
    }
    cliente = encontrado as ClienteDespacho;
  }

  await validarStockDisponible(itemsAgrupados);

  let subtotalNeto = 0;
  let ivaTotal = 0;
  const itemsCrear = itemsAgrupados.map((item) => {
    const producto = productosPorId.get(item.productoId);
    if (!producto) {
      throw new ErrorApi("Producto no encontrado", 404, { id: item.productoId });
    }

    const precioNeto = producto.precioConDescto > 0 ? producto.precioConDescto : producto.precioGeneral;
    const subtotal = precioNeto * item.cantidad;
    const ivaMonto = Math.round((subtotal * ivaPct) / 100);
    const total = subtotal + ivaMonto;

    subtotalNeto += subtotal;
    ivaTotal += ivaMonto;

    return {
      producto: { connect: { id: item.productoId } },
      descripcionSnapshot: producto.nombre,
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
  const despachoFinal = resolverDespacho(payload.despacho, cliente);

  validarDespachoCompleto(despachoFinal);

  const resultado = await prisma.$transaction(async (tx) => {
    const creado = await crearPedido(
      {
        codigo: codigoTemporal,
        cliente: clienteIdFinal ? { connect: { id: clienteIdFinal } } : undefined,
        despachoNombre: despachoFinal.nombre,
        despachoTelefono: despachoFinal.telefono,
        despachoEmail: despachoFinal.email,
        despachoDireccion: despachoFinal.direccion,
        despachoComuna: despachoFinal.comuna,
        despachoCiudad: despachoFinal.ciudad,
        despachoRegion: despachoFinal.region,
        despachoNotas: despachoFinal.notas,
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
      usuarioId: payload.usuarioId,
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
  const clienteIdFinal = carrito.clienteId || usuario?.clienteId || undefined;
  const cliente = clienteIdFinal ? ((await buscarClientePorId(clienteIdFinal)) as ClienteDespacho | null) : null;
  const despachoFinal = resolverDespacho(despacho, cliente);

  validarDespachoCompleto(despachoFinal);

  const resultado = await prisma.$transaction(async (tx) => {
    const creado = await crearPedido(
      {
        codigo: codigoTemporal,
        cliente: clienteIdFinal ? { connect: { id: clienteIdFinal } } : undefined,
        despachoNombre: despachoFinal.nombre,
        despachoTelefono: despachoFinal.telefono,
        despachoEmail: despachoFinal.email,
        despachoDireccion: despachoFinal.direccion,
        despachoComuna: despachoFinal.comuna,
        despachoCiudad: despachoFinal.ciudad,
        despachoRegion: despachoFinal.region,
        despachoNotas: despachoFinal.notas,
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
      usuarioId,
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
