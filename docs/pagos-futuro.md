# Preparacion de pagos (sin integracion)

## Estado actual
- Se creo la tabla `Pago` para registrar intentos de pago.
- Endpoint placeholder: `POST /api/pagos`.
- No hay integracion real con Transbank ni Apple Pay.

## Modelo `Pago`
- `metodo`: TRANSBANK | APPLE_PAY | TRANSFERENCIA | OTRO
- `estado`: Pendiente | Iniciado | Autorizado | Rechazado | Anulado
- `referenciaExterna`: id/orden en pasarela
- `payload`: JSON libre para guardar request/response
- `origen`, `canal`, `origenRef`: trazabilidad por canal

## Flujo sugerido a futuro
1) Crear intento de pago (`POST /api/pagos`) con `solicitudCotizacionId` o `pedidoId`, `metodo`, `monto`.
2) Redirigir a pasarela o iniciar flujo tokenizado.
3) Recibir webhook/confirmacion y actualizar `estado` + `referenciaExterna`.
4) Si se confirma, crear movimiento de stock y marcar cotizacion/pedido como aprobado.

## Pendientes
- Endpoint `POST /api/pagos/confirmacion` (webhook).
- Endpoint `GET /api/pagos/:id` para tracking.
- Relacionar pagos con pedido real si se habilita checkout.
