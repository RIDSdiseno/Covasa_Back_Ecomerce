import { logger } from "../../../lib/logger";

const CRM_API_BASE_URL = (process.env.CRM_API_BASE_URL || "").trim();
const CRM_INTEGRATION_TOKEN = (process.env.CRM_INTEGRATION_TOKEN || "").trim();

/** Error específico para fallos de notificación al CRM */
export class CRMNotificationError extends Error {
  statusCode: number;
  pedidoId: string;
  pagoId?: string;
  responseBody?: unknown;

  constructor(message: string, statusCode: number, pedidoId: string, pagoId?: string, responseBody?: unknown) {
    super(message);
    this.name = "CRMNotificationError";
    this.statusCode = statusCode;
    this.pedidoId = pedidoId;
    this.pagoId = pagoId;
    this.responseBody = responseBody;
  }
}

/**
 * Notifica al CRM cuando un pago ha sido confirmado
 * para que descuente el inventario de los productos del pedido
 *
 * IMPORTANTE: Esta función LANZA ERROR si la notificación falla.
 * El llamador debe manejar el error apropiadamente.
 *
 * @throws CRMNotificationError si la notificación falla
 */
export const notificarPagoConfirmadoCRM = async (pedidoId: string, pagoId?: string): Promise<void> => {
  const timestamp = new Date().toISOString();
  const payload = { pedidoId, pagoId };

  // === VALIDAR CONFIGURACIÓN ===
  if (!CRM_API_BASE_URL) {
    logger.warn("[CRM_NOTIFY] OMITIDO: CRM_API_BASE_URL no configurado", {
      timestamp,
      pedidoId,
      pagoId,
    });
    // No lanzar error si no está configurado (puede ser ambiente de desarrollo)
    return;
  }

  const url = `${CRM_API_BASE_URL.replace(/\/+$/, "")}/api/integracion/ecommerce/pagos/notificar-confirmado`;

  // === LOG DE INICIO ===
  logger.info("[CRM_NOTIFY] Iniciando notificación al CRM", {
    timestamp,
    url,
    payload,
    tokenPresente: !!CRM_INTEGRATION_TOKEN,
  });

  try {
    const startTime = Date.now();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(CRM_INTEGRATION_TOKEN ? { "x-integration-token": CRM_INTEGRATION_TOKEN } : {}),
      },
      body: JSON.stringify(payload),
    });

    const elapsedMs = Date.now() - startTime;
    const responseBody = await response.json().catch(() => null);

    // === LOG DE RESPUESTA ===
    logger.info("[CRM_NOTIFY] Respuesta recibida del CRM", {
      timestamp: new Date().toISOString(),
      url,
      pedidoId,
      pagoId,
      status: response.status,
      statusText: response.statusText,
      elapsedMs,
      responseBody,
    });

    // === VALIDAR RESPUESTA ===
    if (!response.ok) {
      const errorMessage = `CRM respondió con error ${response.status}: ${response.statusText}`;

      logger.error("[CRM_NOTIFY] ❌ ERROR: El CRM rechazó la notificación", {
        timestamp: new Date().toISOString(),
        url,
        pedidoId,
        pagoId,
        status: response.status,
        statusText: response.statusText,
        responseBody,
        elapsedMs,
      });

      // LANZAR ERROR para que el llamador lo maneje
      throw new CRMNotificationError(
        errorMessage,
        response.status,
        pedidoId,
        pagoId,
        responseBody
      );
    }

    // === ÉXITO ===
    logger.info("[CRM_NOTIFY] ✅ Notificación exitosa al CRM", {
      timestamp: new Date().toISOString(),
      pedidoId,
      pagoId,
      status: response.status,
      elapsedMs,
      crmResponse: responseBody,
      yaDescontado: (responseBody as { yaDescontado?: boolean })?.yaDescontado ?? false,
      itemsAfectados: (responseBody as { itemsAfectados?: number })?.itemsAfectados ?? "N/A",
    });

  } catch (error: unknown) {
    // Si ya es nuestro error personalizado, re-lanzarlo
    if (error instanceof CRMNotificationError) {
      throw error;
    }

    // Error de red u otro error inesperado
    const message = error instanceof Error ? error.message : "Error desconocido";

    logger.error("[CRM_NOTIFY] ❌ EXCEPCIÓN: Error de conexión con el CRM", {
      timestamp: new Date().toISOString(),
      url,
      pedidoId,
      pagoId,
      error: message,
      errorType: error instanceof Error ? error.name : typeof error,
    });

    // LANZAR ERROR para que el llamador lo maneje
    throw new CRMNotificationError(
      `Error de conexión con CRM: ${message}`,
      0, // 0 indica error de red
      pedidoId,
      pagoId
    );
  }
};
