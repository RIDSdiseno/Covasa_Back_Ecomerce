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
import { notificarPagoConfirmadoCRM } from "./crm-notificacion";

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

  // Notificar al CRM para descontar inventario (async, no bloquea el flujo del pago)
  // IMPORTANTE: El pago ya está confirmado, no rechazamos la transacción si el CRM falla
  notificarPagoConfirmadoCRM(resultado.pedidoId, resultado.id).catch((error) => {
    logger.error("[PAGO_CONFIRMADO] ⚠️ Falló notificación al CRM (el pago SÍ fue confirmado)", {
      pagoId: resultado.id,
      pedidoId: resultado.pedidoId,
      error: error instanceof Error ? error.message : String(error),
      accion: "REQUIERE_REVISION_MANUAL - Verificar que el stock fue descontado en CRM",
    });
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

  return pagos.map((pago) => {
    const proveedor = construirProveedorPago(pago);
    const moneda = extraerMonedaPago(pago.gatewayPayloadJson);
    const rutAsociado = pago.pedido?.ecommerceCliente?.rut || pago.pedido?.despachoRut || null;

    return {
      pago: {
        id: pago.id,
        pedidoId: pago.pedidoId,
        metodo: pago.metodo,
        estado: pago.estado,
        monto: pago.monto,
        referencia: pago.referencia,
        moneda: moneda || "CLP",
        externalTransactionId: proveedor.referencia || pago.referencia || null,
        rutAsociado,
        fechaPago: pago.createdAt,
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
            despachoRut: pago.pedido.despachoRut,
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
    };
  });
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
    const headerHeight = 96;
    const footerHeight = 90;
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

    const drawLine = (y: number) => {
      doc
        .strokeColor(PDF_LINE_COLOR)
        .lineWidth(0.6)
        .moveTo(margin, y)
        .lineTo(pageWidth() - margin, y)
        .stroke();
    };

    const drawHeader = () => {
      const top = margin;
      if (logoBuffer) {
        doc.image(logoBuffer, margin, top + 6, { fit: [160, 60] });
      } else {
        setTextStyle("Helvetica-Bold", 18, PDF_PRIMARY_COLOR);
        doc.text(PDF_COMPANY.name || "COVASA", margin, top + 18);
      }

      setTextStyle("Helvetica-Bold", 22, PDF_PRIMARY_COLOR);
      doc.text("RECIBO DE PAGO", margin, top + 6, { width: contentWidth(), align: "right" });
      setTextStyle("Helvetica", 9, PDF_MUTED_COLOR);
      doc.text(`Recibo No: ${pago.id}`, margin, top + 34, { width: contentWidth(), align: "right" });
      doc.text(`Fecha: ${formatDateCl(pago.createdAt)}`, margin, top + 46, { width: contentWidth(), align: "right" });

      drawLine(top + headerHeight - 8);
    };

    const drawFooter = (page: number) => {
      const footerTop = pageHeight() - margin - footerHeight;
      const lineY = footerTop + 8;
      const previousX = doc.x;
      const previousY = doc.y;
      doc.save();
      drawLine(lineY);

      setTextStyle("Helvetica-Bold", 9, PDF_TEXT_COLOR);
      doc.text("Gracias por tu compra.", margin, lineY + 6, { width: contentWidth() });

      const noteLines = PDF_RECEIPT_NOTES
        ? PDF_RECEIPT_NOTES.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
        : [];
      const footerNotes = [...noteLines, `Forma de pago: ${pago.metodo}`].filter(Boolean).slice(0, 3);
      setTextStyle("Helvetica", 8, PDF_MUTED_COLOR);
      let notesY = lineY + 18;
      footerNotes.forEach((note) => {
        doc.text(note, margin, notesY, { width: contentWidth() - 60, align: "left" });
        notesY += 10;
      });

      const footerParts = [
        PDF_COMPANY.name,
        PDF_COMPANY.rut ? `RUT ${PDF_COMPANY.rut}` : "",
        PDF_COMPANY.address,
        PDF_COMPANY.phone,
        PDF_COMPANY.email,
        PDF_COMPANY.website,
      ].filter(Boolean);

      setTextStyle("Helvetica", 8, PDF_MUTED_COLOR);
      doc.text(footerParts.join(" | "), margin, pageHeight() - margin - 14, {
        width: contentWidth() - 50,
        align: "left",
      });
      doc.text(`Pagina ${page}`, margin, pageHeight() - margin - 14, { width: contentWidth(), align: "right" });
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

    const drawInfoBox = (
      title: string,
      x: number,
      y: number,
      width: number,
      height: number,
      lines: string[]
    ) => {
      doc.save();
      doc
        .lineWidth(0.6)
        .strokeColor(PDF_LINE_COLOR)
        .fillColor(PDF_HEADER_FILL)
        .rect(x, y, width, height)
        .fillAndStroke();

      setTextStyle("Helvetica-Bold", 9, PDF_PRIMARY_COLOR);
      doc.text(title, x + 8, y + 8, { width: width - 16 });

      setTextStyle("Helvetica", 9, PDF_TEXT_COLOR);
      const content = lines.join("\n");
      doc.text(content, x + 8, y + 24, { width: width - 16 });
      doc.restore();
    };

    const drawInfoBoxes = () => {
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

      const clienteLines = [
        nombreCliente || pago.pedido.direccion?.nombreRecibe || "",
        direccionLine,
        comunaRegion,
        pago.pedido.direccion?.telefonoRecibe || pago.pedido.ecommerceCliente?.telefono || "",
        pago.pedido.direccion?.email || pago.pedido.ecommerceCliente?.emailContacto || "",
      ].map((line) => line.trim()).filter(Boolean);

      const detalleLines = [
        `Recibo No: ${pago.id}`,
        `Fecha: ${formatDateCl(pago.createdAt)}`,
        `Pedido: ${pago.pedido.codigo || pago.pedido.id}`,
        `Estado: ${pago.estado}`,
      ].filter(Boolean);

      const transbank = proveedor.transbank;
      const pagoLines = [
        `Metodo: ${pago.metodo}`,
        proveedor.referencia ? `Referencia: ${proveedor.referencia}` : "",
        transbank?.authorizationCode ? `Autorizacion: ${transbank.authorizationCode}` : "",
        transbank?.paymentTypeCode ? `Tipo pago: ${transbank.paymentTypeCode}` : "",
        transbank?.cardNumber ? `Tarjeta: ${transbank.cardNumber}` : "",
      ].filter(Boolean);

      const padding = 8;
      const boxGap = 12;
      const boxWidth = (contentWidth() - boxGap * 2) / 3;

      setTextStyle("Helvetica", 9, PDF_TEXT_COLOR);
      const clienteHeight = doc.heightOfString(clienteLines.join("\n"), { width: boxWidth - padding * 2 });
      const detalleHeight = doc.heightOfString(detalleLines.join("\n"), { width: boxWidth - padding * 2 });
      const pagoHeight = doc.heightOfString(pagoLines.join("\n"), { width: boxWidth - padding * 2 });
      const titleHeight = 12;
      const boxHeight = Math.max(clienteHeight, detalleHeight, pagoHeight) + padding * 2 + titleHeight + 6;

      ensureSpace(boxHeight + 10);

      const boxY = cursorY;
      const box1X = margin;
      const box2X = margin + boxWidth + boxGap;
      const box3X = margin + (boxWidth + boxGap) * 2;

      drawInfoBox("Enviar a", box1X, boxY, boxWidth, boxHeight, clienteLines);
      drawInfoBox("Detalle", box2X, boxY, boxWidth, boxHeight, detalleLines);
      drawInfoBox("Pago", box3X, boxY, boxWidth, boxHeight, pagoLines);

      cursorY += boxHeight + 16;
    };

    const drawTableHeader = (columns: Array<{ label: string; width: number }>) => {
      const height = 22;
      ensureSpace(height + 6);
      doc.save();
      doc
        .fillColor(PDF_HEADER_FILL)
        .strokeColor(PDF_LINE_COLOR)
        .lineWidth(0.6)
        .rect(margin, cursorY, contentWidth(), height)
        .fillAndStroke();
      doc.restore();

      setTextStyle("Helvetica-Bold", 9, PDF_MUTED_COLOR);
      let x = margin;
      const textY = cursorY + 7;
      columns.forEach((column, index) => {
        doc.text(column.label, x + 6, textY, { width: column.width - 12, align: "left" });
        if (index < columns.length - 1) {
          doc
            .strokeColor(PDF_LINE_COLOR)
            .lineWidth(0.6)
            .moveTo(x + column.width, cursorY)
            .lineTo(x + column.width, cursorY + height)
            .stroke();
        }
        x += column.width;
      });
      cursorY += height;
    };

    const drawTableRow = (
      columns: Array<{ key: string; width: number; align?: "left" | "right" | "center" }>,
      values: Record<string, string>,
      rowIndex: number,
      onPageBreak: () => void
    ) => {
      const padding = 6;
      const detalle = values.detalle ?? "";
      setTextStyle("Helvetica", 9, PDF_TEXT_COLOR);
      const detalleHeight = doc.heightOfString(detalle, { width: columns[1].width - padding * 2 });
      const rowHeight = Math.max(detalleHeight, 12) + padding * 2;
      const broke = ensureSpace(rowHeight + 4);
      if (broke) {
        onPageBreak();
      }

      if (rowIndex % 2 === 0) {
        doc.save();
        doc.fillColor("#FAFAFA").rect(margin, cursorY, contentWidth(), rowHeight).fill();
        doc.restore();
      }

      doc.save();
      doc
        .strokeColor(PDF_LINE_COLOR)
        .lineWidth(0.6)
        .rect(margin, cursorY, contentWidth(), rowHeight)
        .stroke();
      doc.restore();

      let x = margin;
      columns.forEach((column, index) => {
        if (index < columns.length - 1) {
          doc
            .strokeColor(PDF_LINE_COLOR)
            .lineWidth(0.6)
            .moveTo(x + column.width, cursorY)
            .lineTo(x + column.width, cursorY + rowHeight)
            .stroke();
        }
        const value = values[column.key] ?? "";
        const align = column.align ?? "left";
        doc.text(value, x + padding, cursorY + padding, {
          width: column.width - padding * 2,
          align,
        });
        x += column.width;
      });

      cursorY += rowHeight;
    };

    drawHeader();
    cursorY = contentTop();

    drawInfoBoxes();

    setTextStyle("Helvetica-Bold", 11, PDF_PRIMARY_COLOR);
    doc.text("Detalle del pedido", margin, cursorY);
    cursorY += 16;

    const items = pago.pedido.items ?? [];
    if (items.length === 0) {
      setTextStyle("Helvetica", 10, PDF_MUTED_COLOR);
      doc.text("No hay items asociados al pedido.", margin, cursorY, { width: contentWidth() });
      cursorY += 16;
    } else {
      const columns = [
        { key: "cantidad", label: "Cant.", width: 50, align: "center" as const },
        { key: "detalle", label: "Descripcion", width: 281, align: "left" as const },
        { key: "unitario", label: "P. Unitario", width: 100, align: "right" as const },
        { key: "importe", label: "Importe", width: 100, align: "right" as const },
      ];
      const headerColumns = columns.map((col) => ({ label: col.label, width: col.width }));
      const drawHeaderRow = () => drawTableHeader(headerColumns);

      drawHeaderRow();

      items.forEach((item, index) => {
        drawTableRow(
          columns.map((col) => ({
            key: col.key,
            width: col.width,
            align: col.align,
          })),
          {
            detalle: item.descripcionSnapshot,
            cantidad: String(item.cantidad),
            unitario: formatCurrency(item.precioUnitarioNetoSnapshot),
            importe: formatCurrency(item.subtotalNetoSnapshot ?? item.totalSnapshot),
          },
          index,
          drawHeaderRow
        );
      });
    }

    cursorY += 10;

    const totalsWidth = 220;
    const totalLines = [
      { label: "Subtotal", value: formatCurrency(pago.pedido.subtotalNeto || 0) },
      { label: "Impuestos", value: formatCurrency(pago.pedido.iva || 0) },
      { label: "Total pagado", value: formatCurrency(pago.pedido.total || pago.monto) },
    ];
    const totalsHeight = totalLines.length * 16 + 28;
    ensureSpace(totalsHeight + 6);
    const totalsX = pageWidth() - margin - totalsWidth;
    const totalsY = cursorY;

    doc.save();
    doc
      .lineWidth(0.6)
      .strokeColor(PDF_LINE_COLOR)
      .fillColor(PDF_HEADER_FILL)
      .rect(totalsX, totalsY, totalsWidth, totalsHeight)
      .fillAndStroke();
    doc.restore();

    setTextStyle("Helvetica-Bold", 10, PDF_PRIMARY_COLOR);
    doc.text("Totales", totalsX + 10, totalsY + 8, { width: totalsWidth - 20 });

    let currentY = totalsY + 24;
    totalLines.forEach((line) => {
      setTextStyle("Helvetica", 9, PDF_MUTED_COLOR);
      doc.text(line.label, totalsX + 10, currentY, { width: totalsWidth - 20, align: "left" });
      setTextStyle("Helvetica-Bold", line.label === "Total pagado" ? 11 : 10, PDF_TEXT_COLOR);
      doc.text(line.value, totalsX + 10, currentY, { width: totalsWidth - 20, align: "right" });
      currentY += 14;
    });

    cursorY += totalsHeight + 6;

    drawFooter(pageNumber);
    doc.end();
  });

  return {
    buffer,
    fileName: `recibo-${pago.id}.pdf`,
  };
};
