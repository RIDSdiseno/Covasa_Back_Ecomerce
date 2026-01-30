import { EcommerceEstadoPago, EcommerceEstadoPedido, EcommerceMetodoPago, Prisma } from "@prisma/client";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { ErrorApi } from "../../../lib/errores";
import { prisma } from "../../../lib/prisma";
import { logger } from "../../../lib/logger";
import { construirDireccionLinea, normalizarTexto } from "../common/ecommerce.utils";
import { registrarNotificacion } from "../notificaciones/notificaciones.service";
import {
  actualizarPagoEstado,
  actualizarPedidoEstado,
  buscarPagoPorId,
  buscarPedidoPorId,
  crearPago,
  listarPagosPorUsuario,
  listarPagosParaIntegracion,
  obtenerPagoDetallePorUsuario,
  obtenerPagoParaRecibo,
} from "./pagos.repo";
import { buscarUsuarioPorId } from "../usuarios/usuarios.repo";

// Crea un pago PENDIENTE asociado a un pedido.
export const crearPagoServicio = async (payload: {
  pedidoId: string;
  metodo: EcommerceMetodoPago;
  monto: number;
  referencia?: string;
  evidenciaUrl?: string;
  gatewayPayloadJson?: unknown;
}) => {
  const pedido = await buscarPedidoPorId(payload.pedidoId);
  if (!pedido) {
    throw new ErrorApi("Pedido no encontrado", 404, { id: payload.pedidoId });
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const pago = await crearPago(
      {
        pedido: { connect: { id: payload.pedidoId } },
        metodo: payload.metodo,
        estado: EcommerceEstadoPago.PENDIENTE,
        monto: payload.monto,
        referencia: normalizarTexto(payload.referencia) || undefined,
        evidenciaUrl: normalizarTexto(payload.evidenciaUrl) || undefined,
        gatewayPayloadJson: payload.gatewayPayloadJson as Prisma.InputJsonValue | undefined,
      },
      tx
    );

    await registrarNotificacion({
      tipo: "PAGO_REGISTRADO",
      referenciaTabla: "EcommercePago",
      referenciaId: pago.id,
      titulo: "Pago ecommerce",
      detalle: `Pedido ${payload.pedidoId}. Monto ${payload.monto}. Estado ${pago.estado}.`,
      tx,
    });

    return pago;
  });

  logger.info("pago_creado", {
    pagoId: resultado.id,
    pedidoId: payload.pedidoId,
    metodo: payload.metodo,
    monto: payload.monto,
    estado: resultado.estado,
  });

  return resultado;
};

// Confirma un pago y actualiza el pedido a PAGADO.
export const confirmarPagoServicio = async (pagoId: string) => {
  const resultado = await prisma.$transaction(async (tx) => {
    const pago = await buscarPagoPorId(pagoId, tx);
    if (!pago) {
      throw new ErrorApi("Pago no encontrado", 404, { id: pagoId });
    }

    if (pago.estado === EcommerceEstadoPago.CONFIRMADO) {
      throw new ErrorApi("Pago ya confirmado", 409, { id: pagoId });
    }

    if (pago.estado === EcommerceEstadoPago.RECHAZADO) {
      throw new ErrorApi("Pago ya rechazado", 409, { id: pagoId });
    }

    const actualizado = await actualizarPagoEstado(pagoId, EcommerceEstadoPago.CONFIRMADO, tx);
    await actualizarPedidoEstado(pago.pedidoId, EcommerceEstadoPedido.PAGADO, tx);

    await registrarNotificacion({
      tipo: "PAGO_CONFIRMADO",
      referenciaTabla: "EcommercePago",
      referenciaId: pagoId,
      titulo: "Pago confirmado",
      detalle: `Pedido ${pago.pedidoId}. Monto ${pago.monto}.`,
      tx,
    });

    return actualizado;
  });

  logger.info("pago_confirmado", {
    pagoId: resultado.id,
    pedidoId: resultado.pedidoId,
    estado: resultado.estado,
  });

  return resultado;
};

// Rechaza un pago pendiente.
export const rechazarPagoServicio = async (pagoId: string) => {
  const resultado = await prisma.$transaction(async (tx) => {
    const pago = await buscarPagoPorId(pagoId, tx);
    if (!pago) {
      throw new ErrorApi("Pago no encontrado", 404, { id: pagoId });
    }

    if (pago.estado === EcommerceEstadoPago.RECHAZADO) {
      throw new ErrorApi("Pago ya rechazado", 409, { id: pagoId });
    }

    if (pago.estado === EcommerceEstadoPago.CONFIRMADO) {
      throw new ErrorApi("Pago ya confirmado", 409, { id: pagoId });
    }

    const actualizado = await actualizarPagoEstado(pagoId, EcommerceEstadoPago.RECHAZADO, tx);

    await registrarNotificacion({
      tipo: "PAGO_RECHAZADO",
      referenciaTabla: "EcommercePago",
      referenciaId: pagoId,
      titulo: "Pago rechazado",
      detalle: `Pedido ${pago.pedidoId}. Monto ${pago.monto}.`,
      tx,
    });

    return actualizado;
  });

  logger.info("pago_rechazado", {
    pagoId: resultado.id,
    pedidoId: resultado.pedidoId,
    estado: resultado.estado,
  });

  return resultado;
};

const enmascararTarjeta = (valor?: string | null) => {
  if (!valor) {
    return undefined;
  }
  const limpio = String(valor);
  if (limpio.length <= 4) {
    return limpio;
  }
  return `****${limpio.slice(-4)}`;
};

const extraerDatosTransbank = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const commit = (payload as { commit?: Record<string, unknown> }).commit;
  if (!commit || typeof commit !== "object") {
    return null;
  }

  const cardDetail = (commit as { card_detail?: Record<string, unknown> }).card_detail || {};

  return {
    buyOrder: String((commit as { buy_order?: string }).buy_order ?? ""),
    authorizationCode: String((commit as { authorization_code?: string }).authorization_code ?? ""),
    paymentTypeCode: String((commit as { payment_type_code?: string }).payment_type_code ?? ""),
    installmentsNumber: (commit as { installments_number?: number }).installments_number ?? null,
    cardNumber: enmascararTarjeta((cardDetail as { card_number?: string }).card_number),
    transactionDate: (commit as { transaction_date?: string }).transaction_date ?? null,
  };
};

const extraerStripePayload = (payload: unknown) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const stripe = (payload as { stripe?: Record<string, unknown> }).stripe;
  if (!stripe || typeof stripe !== "object" || Array.isArray(stripe)) {
    return null;
  }
  return stripe;
};

const extraerMonedaPago = (payload: unknown) => {
  const stripe = extraerStripePayload(payload);
  if (!stripe) {
    return null;
  }
  const currency = stripe.currency;
  return typeof currency === "string" ? currency : null;
};

const construirProveedorPago = (pago: {
  metodo: EcommerceMetodoPago;
  referencia?: string | null;
  gatewayPayloadJson?: unknown;
}) => {
  const stripe = extraerStripePayload(pago.gatewayPayloadJson);
  const referenciaStripe = typeof stripe?.intentId === "string" ? stripe.intentId : null;
  const referencia = normalizarTexto(pago.referencia || "") || referenciaStripe || null;
  const transbank =
    pago.metodo === EcommerceMetodoPago.TRANSBANK ? extraerDatosTransbank(pago.gatewayPayloadJson) : null;

  return {
    metodo: pago.metodo,
    referencia,
    transbank,
  };
};

const PDF_PRIMARY_COLOR = "#B01010";
const PDF_TEXT_COLOR = "#1F2933";
const PDF_MUTED_COLOR = "#6B7280";
const PDF_LINE_COLOR = "#E5E7EB";
const PDF_HEADER_FILL = "#F7F7F7";
const PDF_LOGO_MAX_BYTES = 2 * 1024 * 1024;

const PDF_COMPANY = {
  name: (process.env.PDF_COMPANY_NAME || "COVASA").trim(),
  rut: (process.env.PDF_COMPANY_RUT || "").trim(),
  address: (process.env.PDF_COMPANY_ADDRESS || "").trim(),
  phone: (process.env.PDF_COMPANY_PHONE || "").trim(),
  email: (process.env.PDF_COMPANY_EMAIL || "").trim(),
  website: (process.env.PDF_COMPANY_WEBSITE || "").trim(),
};
const PDF_RECEIPT_NOTES = (process.env.PDF_RECEIPT_NOTES || "").trim();

let logoCache: Buffer | null = null;
let logoPromise: Promise<Buffer | null> | null = null;

const readFileSafe = (filePath: string) => {
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    return null;
  }
  return fs.readFileSync(resolved);
};

const fetchLogoFromUrl = async (url: string) => {
  if (typeof fetch !== "function") {
    return null;
  }
  try {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) {
      return null;
    }
    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > PDF_LOGO_MAX_BYTES) {
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > PDF_LOGO_MAX_BYTES) {
      return null;
    }
    return buffer;
  } catch {
    return null;
  }
};

const resolveLogoBuffer = async () => {
  if (logoCache) {
    return logoCache;
  }
  if (logoPromise) {
    return logoPromise;
  }

  const logoPathEnv = (process.env.PDF_LOGO_PATH || "").trim();
  const logoUrlEnv = (process.env.PDF_LOGO_URL || "").trim();
  const fallbackPath = path.resolve(process.cwd(), "assets", "covasa_chile.png");

  const promise = (async () => {
    if (logoPathEnv) {
      const file = readFileSafe(logoPathEnv);
      if (file) return file;
    }

    if (logoUrlEnv) {
      const remote = await fetchLogoFromUrl(logoUrlEnv);
      if (remote) return remote;
    }

    const fallback = readFileSafe(fallbackPath);
    if (fallback) return fallback;

    return null;
  })();

  logoPromise = promise;
  try {
    const resolved = await promise;
    if (resolved) {
      logoCache = resolved;
    }
    return resolved;
  } finally {
    if (logoPromise === promise) {
      logoPromise = null;
    }
  }
};

const formatCurrency = (value: number) => `CLP ${Math.round(value).toLocaleString("es-CL")}`;

const formatDateCl = (value: Date | string | null | undefined) => {
  if (!value) {
    return "";
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

export const listarPagosIntegracionServicio = async (params: {
  since?: Date;
  estado?: EcommerceEstadoPago;
  limit: number;
}) => {
  const pagos = await listarPagosParaIntegracion(params);

  return pagos.map((pago) => ({
    pago: {
      id: pago.id,
      pedidoId: pago.pedidoId,
      metodo: pago.metodo,
      estado: pago.estado,
      monto: pago.monto,
      referencia: pago.referencia,
      createdAt: pago.createdAt,
      updatedAt: pago.updatedAt,
    },
    pedido: pago.pedido
      ? {
          id: pago.pedido.id,
          correlativo: pago.pedido.correlativo,
          codigo: pago.pedido.codigo,
          ecommerceClienteId: pago.pedido.ecommerceClienteId,
          clienteId: pago.pedido.clienteId,
          despachoNombre: pago.pedido.despachoNombre,
          despachoTelefono: pago.pedido.despachoTelefono,
          despachoEmail: pago.pedido.despachoEmail,
          despachoDireccion: pago.pedido.despachoDireccion,
          despachoComuna: pago.pedido.despachoComuna,
          despachoCiudad: pago.pedido.despachoCiudad,
          despachoRegion: pago.pedido.despachoRegion,
          subtotalNeto: pago.pedido.subtotalNeto,
          iva: pago.pedido.iva,
          total: pago.pedido.total,
          estado: pago.pedido.estado,
          createdAt: pago.pedido.createdAt,
          updatedAt: pago.pedido.updatedAt,
          crmCotizacionId: pago.pedido.crmCotizacionId,
          vendedorId: pago.pedido.crmCotizacion?.vendedorId ?? null,
        }
      : null,
  }));
};

// Obtiene un pago con datos para boleta/recibo (sin token).
export const obtenerPagoReciboServicio = async (pagoId: string) => {
  const pago = await obtenerPagoParaRecibo(pagoId);
  if (!pago) {
    throw new ErrorApi("Pago no encontrado", 404, { id: pagoId });
  }

  const transbank =
    pago.metodo === EcommerceMetodoPago.TRANSBANK ? extraerDatosTransbank(pago.gatewayPayloadJson) : null;

  return {
    pagoId: pago.id,
    metodo: pago.metodo,
    estado: pago.estado,
    monto: pago.monto,
    createdAt: pago.createdAt,
    pedido: {
      id: pago.pedido.id,
      codigo: pago.pedido.codigo,
      total: pago.pedido.total,
      estado: pago.pedido.estado,
      createdAt: pago.pedido.createdAt,
    },
    direccion: pago.pedido.direccion
      ? {
          nombreContacto: pago.pedido.direccion.nombreRecibe,
          telefono: pago.pedido.direccion.telefonoRecibe,
          email: pago.pedido.direccion.email,
          direccion: construirDireccionLinea(
            pago.pedido.direccion.calle,
            pago.pedido.direccion.numero,
            pago.pedido.direccion.depto
          ),
          comuna: pago.pedido.direccion.comuna,
          ciudad: pago.pedido.direccion.ciudad,
          region: pago.pedido.direccion.region,
          notas: pago.pedido.direccion.notas,
        }
      : null,
    transbank,
  };
};

const resolverUsuarioPago = async (usuarioId: string) => {
  const usuario = await buscarUsuarioPorId(usuarioId);
  if (!usuario) {
    throw new ErrorApi("Usuario no encontrado", 404, { id: usuarioId });
  }

  const email = normalizarTexto(usuario.email ?? "");
  return { usuarioId: usuario.id, email };
};

export const listarMisPagosServicio = async (usuarioId: string) => {
  const { email } = await resolverUsuarioPago(usuarioId);
  const pagos = await listarPagosPorUsuario(usuarioId, email || undefined);

  return pagos.map((pago) => {
    const moneda = extraerMonedaPago(pago.gatewayPayloadJson);

    return {
      pagoId: pago.id,
      metodo: pago.metodo,
      estado: pago.estado,
      monto: pago.monto,
      moneda,
      createdAt: pago.createdAt,
      updatedAt: pago.updatedAt,
      pedido: pago.pedido
        ? {
            id: pago.pedido.id,
            codigo: pago.pedido.codigo,
            total: pago.pedido.total,
            estado: pago.pedido.estado,
            createdAt: pago.pedido.createdAt,
          }
        : null,
      cotizacion: null,
      proveedor: construirProveedorPago(pago),
    };
  });
};

export const obtenerPagoDetalleUsuarioServicio = async (usuarioId: string, pagoId: string) => {
  const { email } = await resolverUsuarioPago(usuarioId);
  const pago = await obtenerPagoDetallePorUsuario(pagoId, usuarioId, email || undefined);
  if (!pago) {
    throw new ErrorApi("Pago no encontrado", 404, { id: pagoId });
  }

  const moneda = extraerMonedaPago(pago.gatewayPayloadJson);
  const direccion = pago.pedido.direccion
    ? {
        nombreContacto: pago.pedido.direccion.nombreRecibe,
        telefono: pago.pedido.direccion.telefonoRecibe,
        email: pago.pedido.direccion.email,
        direccion: construirDireccionLinea(
          pago.pedido.direccion.calle,
          pago.pedido.direccion.numero,
          pago.pedido.direccion.depto
        ),
        comuna: pago.pedido.direccion.comuna,
        ciudad: pago.pedido.direccion.ciudad,
        region: pago.pedido.direccion.region,
        notas: pago.pedido.direccion.notas,
      }
    : null;

  return {
    pagoId: pago.id,
    metodo: pago.metodo,
    estado: pago.estado,
    monto: pago.monto,
    moneda,
    createdAt: pago.createdAt,
    updatedAt: pago.updatedAt,
    proveedor: construirProveedorPago(pago),
    pedido: {
      id: pago.pedido.id,
      codigo: pago.pedido.codigo,
      total: pago.pedido.total,
      subtotalNeto: pago.pedido.subtotalNeto,
      iva: pago.pedido.iva,
      estado: pago.pedido.estado,
      createdAt: pago.pedido.createdAt,
      direccion,
      items: pago.pedido.items.map((item) => ({
        descripcionSnapshot: item.descripcionSnapshot,
        cantidad: item.cantidad,
        precioUnitarioNetoSnapshot: item.precioUnitarioNetoSnapshot,
        subtotalNetoSnapshot: item.subtotalNetoSnapshot,
        ivaPctSnapshot: item.ivaPctSnapshot,
        ivaMontoSnapshot: item.ivaMontoSnapshot,
        totalSnapshot: item.totalSnapshot,
      })),
    },
    cotizacion: null,
  };
};

export const generarPagoPdfServicio = async (usuarioId: string, pagoId: string) => {
  const { email } = await resolverUsuarioPago(usuarioId);
  const pago = await obtenerPagoDetallePorUsuario(pagoId, usuarioId, email || undefined);
  if (!pago) {
    throw new ErrorApi("Pago no encontrado", 404, { id: pagoId });
  }

  const moneda = extraerMonedaPago(pago.gatewayPayloadJson);
  const proveedor = construirProveedorPago(pago);
  const nombreCliente = [pago.pedido.ecommerceCliente?.nombres, pago.pedido.ecommerceCliente?.apellidos]
    .filter(Boolean)
    .join(" ");

  const logoBuffer = await resolveLogoBuffer();

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 32 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (error) => reject(error));

    const margin = 32;
    const headerHeight = 72;
    const footerHeight = 60;
    let pageNumber = 1;
    let cursorY = 0;

    const pageWidth = () => doc.page.width;
    const pageHeight = () => doc.page.height;
    const contentWidth = () => pageWidth() - margin * 2;
    const contentTop = () => margin + headerHeight;
    const contentBottom = () => pageHeight() - margin - footerHeight;

    const setTextStyle = (font: "Helvetica" | "Helvetica-Bold", size: number, color: string) => {
      doc.font(font).fontSize(size).fillColor(color);
    };

    const drawHeader = () => {
      const top = margin;
      if (logoBuffer) {
        doc.image(logoBuffer, margin, top + 2, { fit: [120, 40] });
      } else {
        setTextStyle("Helvetica-Bold", 16, PDF_PRIMARY_COLOR);
        doc.text(PDF_COMPANY.name || "COVASA", margin, top + 10);
      }

      setTextStyle("Helvetica-Bold", 18, PDF_PRIMARY_COLOR);
      doc.text("Recibo de Pago", margin, top + 4, { width: contentWidth(), align: "right" });
      setTextStyle("Helvetica", 9, PDF_MUTED_COLOR);
      doc.text(`Folio: ${pago.id}`, margin, top + 26, { width: contentWidth(), align: "right" });
      doc.text(`Pedido: ${pago.pedido.codigo || pago.pedido.id}`, margin, top + 38, {
        width: contentWidth(),
        align: "right",
      });

      const lineY = top + headerHeight - 8;
      doc
        .strokeColor(PDF_LINE_COLOR)
        .lineWidth(0.5)
        .moveTo(margin, lineY)
        .lineTo(pageWidth() - margin, lineY)
        .stroke();
    };

    const drawFooter = (page: number) => {
      const lineY = pageHeight() - margin - footerHeight + 8;
      const previousX = doc.x;
      const previousY = doc.y;
      doc.save();
      doc
        .strokeColor(PDF_LINE_COLOR)
        .lineWidth(0.5)
        .moveTo(margin, lineY)
        .lineTo(pageWidth() - margin, lineY)
        .stroke();

      const footerParts = [
        PDF_COMPANY.name,
        PDF_COMPANY.rut ? `RUT ${PDF_COMPANY.rut}` : "",
        PDF_COMPANY.address,
        PDF_COMPANY.phone,
        PDF_COMPANY.email,
        PDF_COMPANY.website,
      ].filter(Boolean);

      setTextStyle("Helvetica", 8, PDF_MUTED_COLOR);
      doc.text(footerParts.join(" | "), margin, lineY + 8, {
        width: contentWidth() - 50,
        align: "left",
      });
      doc.text(`Página ${page}`, margin, lineY + 8, { width: contentWidth(), align: "right" });
      doc.restore();
      doc.x = previousX;
      doc.y = previousY;
    };

    const ensureSpace = (height: number) => {
      if (cursorY + height > contentBottom()) {
        drawFooter(pageNumber);
        doc.addPage({ size: "A4", margin });
        pageNumber += 1;
        drawHeader();
        cursorY = contentTop();
        return true;
      }
      return false;
    };

    const drawSectionTitle = (title: string) => {
      ensureSpace(26);
      setTextStyle("Helvetica-Bold", 12, PDF_PRIMARY_COLOR);
      doc.text(title, margin, cursorY);
      cursorY += 16;
      doc
        .strokeColor(PDF_LINE_COLOR)
        .lineWidth(0.5)
        .moveTo(margin, cursorY)
        .lineTo(pageWidth() - margin, cursorY)
        .stroke();
      cursorY += 12;
    };

    const drawKeyValueColumn = (
      items: Array<{ label: string; value?: string | null }>,
      x: number,
      y: number,
      width: number
    ) => {
      let currentY = y;
      items.forEach((item) => {
        const value = (item.value ?? "").trim();
        if (!value) {
          return;
        }
        setTextStyle("Helvetica", 8, PDF_MUTED_COLOR);
        doc.text(item.label.toUpperCase(), x, currentY, { width });
        currentY += 10;
        setTextStyle("Helvetica", 10, PDF_TEXT_COLOR);
        const height = doc.heightOfString(value, { width });
        doc.text(value, x, currentY, { width });
        currentY += height + 8;
      });
      return currentY;
    };

    const drawKeyValueColumns = (
      left: Array<{ label: string; value?: string | null }>,
      right: Array<{ label: string; value?: string | null }>
    ) => {
      const colGap = 16;
      const colWidth = (contentWidth() - colGap) / 2;
      const estimated = Math.max(left.length, right.length) * 22 + 8;
      ensureSpace(estimated);
      const startY = cursorY;
      const leftEnd = drawKeyValueColumn(left, margin, startY, colWidth);
      const rightEnd = drawKeyValueColumn(right, margin + colWidth + colGap, startY, colWidth);
      cursorY = Math.max(leftEnd, rightEnd) + 4;
    };

    const drawTableHeader = (columns: Array<{ label: string; width: number }>) => {
      const height = 20;
      ensureSpace(height + 6);
      doc.save();
      doc.fillColor(PDF_HEADER_FILL).rect(margin, cursorY, contentWidth(), height).fill();
      doc.restore();
      setTextStyle("Helvetica-Bold", 9, PDF_MUTED_COLOR);
      let x = margin;
      const textY = cursorY + 6;
      columns.forEach((column) => {
        doc.text(column.label, x + 4, textY, { width: column.width - 8, align: "left" });
        x += column.width;
      });
      cursorY += height;
      doc
        .strokeColor(PDF_LINE_COLOR)
        .lineWidth(0.5)
        .moveTo(margin, cursorY)
        .lineTo(pageWidth() - margin, cursorY)
        .stroke();
      cursorY += 6;
    };

    const drawTableRow = (
      columns: Array<{ key: string; width: number; align?: "left" | "right" }>,
      values: Record<string, string>,
      onPageBreak: () => void
    ) => {
      const padding = 6;
      const detalle = values.detalle ?? "";
      setTextStyle("Helvetica", 9, PDF_TEXT_COLOR);
      const detalleHeight = doc.heightOfString(detalle, { width: columns[0].width - padding * 2 });
      const rowHeight = Math.max(detalleHeight, 10) + padding * 2;
      const broke = ensureSpace(rowHeight + 2);
      if (broke) {
        onPageBreak();
      }
      let x = margin;
      const textY = cursorY + padding;
      columns.forEach((column) => {
        const value = values[column.key] ?? "";
        setTextStyle("Helvetica", 9, PDF_TEXT_COLOR);
        doc.text(value, x + padding, textY, {
          width: column.width - padding * 2,
          align: column.align ?? "left",
        });
        x += column.width;
      });
      cursorY += rowHeight;
      doc
        .strokeColor(PDF_LINE_COLOR)
        .lineWidth(0.5)
        .moveTo(margin, cursorY)
        .lineTo(pageWidth() - margin, cursorY)
        .stroke();
      cursorY += 4;
    };

    drawHeader();
    cursorY = contentTop();

    const direccionLine = pago.pedido.direccion
      ? construirDireccionLinea(
          pago.pedido.direccion.calle,
          pago.pedido.direccion.numero,
          pago.pedido.direccion.depto
        )
      : "";

    const comunaRegion = pago.pedido.direccion
      ? [pago.pedido.direccion.comuna, pago.pedido.direccion.region].filter(Boolean).join(", ")
      : "";

    drawSectionTitle("Cliente y Orden");
    drawKeyValueColumns(
      [
        { label: "Cliente", value: nombreCliente || pago.pedido.direccion?.nombreRecibe || "" },
        { label: "Email", value: pago.pedido.ecommerceCliente?.emailContacto || pago.pedido.direccion?.email || "" },
        { label: "Teléfono", value: pago.pedido.ecommerceCliente?.telefono || pago.pedido.direccion?.telefonoRecibe || "" },
        { label: "Dirección", value: direccionLine },
        { label: "Comuna / Región", value: comunaRegion },
      ],
      [
        { label: "Pedido", value: pago.pedido.codigo || pago.pedido.id },
        { label: "Estado pedido", value: pago.pedido.estado },
        { label: "Fecha pedido", value: formatDateCl(pago.pedido.createdAt) },
      ]
    );

    const transbank = proveedor.transbank;
    const transLeft = [
      { label: "Pago ID", value: pago.id },
      { label: "Estado pago", value: pago.estado },
      { label: "Método", value: pago.metodo },
      { label: "Referencia", value: proveedor.referencia || "" },
    ];
    if (transbank?.authorizationCode) transLeft.push({ label: "Autorización", value: transbank.authorizationCode });
    if (transbank?.paymentTypeCode) transLeft.push({ label: "Tipo de pago", value: transbank.paymentTypeCode });
    if (transbank?.cardNumber) transLeft.push({ label: "Tarjeta", value: transbank.cardNumber });

    const transRight = [
      { label: "Monto", value: formatCurrency(pago.monto) },
      { label: "Moneda", value: moneda ? moneda.toUpperCase() : "CLP" },
      { label: "Fecha pago", value: formatDateCl(pago.createdAt) },
      { label: "Actualizado", value: formatDateCl(pago.updatedAt) },
    ];
    if (transbank?.transactionDate) {
      transRight.push({ label: "Fecha Transbank", value: formatDateCl(transbank.transactionDate) });
    }

    drawSectionTitle("Transacción");
    drawKeyValueColumns(transLeft, transRight);

    drawSectionTitle("Resumen del pedido");
    const totalsWidth = 240;
    ensureSpace(80);
    const totalsX = pageWidth() - margin - totalsWidth;
    const totalLines = [
      { label: "Subtotal neto", value: formatCurrency(pago.pedido.subtotalNeto || 0) },
      { label: "IVA", value: formatCurrency(pago.pedido.iva || 0) },
      { label: "Total", value: formatCurrency(pago.pedido.total || pago.monto) },
    ];
    totalLines.forEach((line) => {
      const labelWidth = totalsWidth * 0.55;
      setTextStyle("Helvetica", 9, PDF_MUTED_COLOR);
      doc.text(line.label, totalsX, cursorY, { width: labelWidth, align: "left" });
      setTextStyle("Helvetica-Bold", line.label === "Total" ? 11 : 10, PDF_TEXT_COLOR);
      doc.text(line.value, totalsX + labelWidth, cursorY, {
        width: totalsWidth - labelWidth,
        align: "right",
      });
      cursorY += 16;
    });
    cursorY += 4;

    drawSectionTitle("Detalle de items");

    if (pago.pedido.items.length === 0) {
      setTextStyle("Helvetica", 10, PDF_MUTED_COLOR);
      doc.text("No hay items asociados al pedido.", margin, cursorY, { width: contentWidth() });
      cursorY += 16;
    } else {
      const columns = [
        { key: "detalle", label: "Producto", width: 301 },
        { key: "cantidad", label: "Cant.", width: 50 },
        { key: "unitario", label: "P. unitario", width: 90 },
        { key: "subtotal", label: "Subtotal", width: 90 },
      ];
      const headerColumns = columns.map((col) => ({ label: col.label, width: col.width }));
      const drawHeaderRow = () => drawTableHeader(headerColumns);

      drawHeaderRow();

      pago.pedido.items.forEach((item) => {
        drawTableRow(
          columns.map((col) => ({
            key: col.key,
            width: col.width,
            align: col.key === "detalle" ? "left" : "right",
          })),
          {
            detalle: item.descripcionSnapshot,
            cantidad: String(item.cantidad),
            unitario: formatCurrency(item.precioUnitarioNetoSnapshot),
            subtotal: formatCurrency(item.subtotalNetoSnapshot ?? item.totalSnapshot),
          },
          drawHeaderRow
        );
      });
    }

    drawFooter(pageNumber);
    doc.end();
  });

  return {
    buffer,
    fileName: `recibo-${pago.id}.pdf`,
  };
};
