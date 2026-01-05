# Integracion CRM (BD compartida)

## Resumen
- El e-commerce escribe en tablas nuevas: `Carrito`, `SolicitudCotizacion`, `SolicitudCotizacionItem`, `Pedido`, `PedidoItem`, `Pago`, `MensajeNotificacion`.
- Reutiliza tablas CRM: `Producto`, `Inventario`, `StockMovimiento`, `Cliente`.
- La integracion es por la misma BD PostgreSQL en Railway.

## Mapa de datos
- Catalogo: `Producto` (precioGeneral/precioConDescto, unidadMedida, fotoUrl).
- Stock: `Inventario.stock` (sumado por producto).
- Solicitudes de cotizacion e-commerce:
  - `SolicitudCotizacion` contiene contacto, totales y trazabilidad (`origen`, `canal`, `origenRef`).
  - `SolicitudCotizacionItem` contiene snapshot por item (precioUnitarioNeto, subtotalNeto, ivaMonto, total).
  - `clienteId` referencia `Cliente` si existe o se crea por email.
  - `ipHash`, `userAgentHash` y `fingerprintHash` permiten control anti-spam.
- Pedidos:
  - `Pedido` y `PedidoItem` permiten KPIs cuando se confirme una venta.
- Pagos futuros: `Pago` con `metodo`, `estado`, `referenciaExterna` y `payload`.
- Notificaciones: `MensajeNotificacion` permite que CRM consuma eventos del e-commerce.
  - Al crear una solicitud de cotizacion se registra un mensaje `COTIZACION_RECIBIDA`.
  - Campos principales: `tipo`, `titulo`, `mensaje`, `origen`, `canal`, `leido`, `createdAt`.

## Creacion/relacion de Cliente
- Al registrar cotizacion:
  - Se busca `Cliente` por email.
  - Si no existe, se crea un `Cliente` minimo con `nombre`, `email`, `telefono`, `ciudad` (ubicacion) y `updatedAt`.
- Esta estrategia evita duplicar productos/inventario, pero podria crear clientes duplicados si el CRM no normaliza por email.

## Lectura desde CRM
- CRM puede leer cotizaciones desde `SolicitudCotizacion` y `SolicitudCotizacionItem`.
- Recomendado: joins por `clienteId` y `productoId` para ver datos maestros.

## Estrategia de migraciones (BD compartida)
- El CRM ya posee migraciones aplicadas que no estan en este repo.
- Se genero una migracion manual solo con nuevas tablas:
  - `covasa-back/prisma/migrations/*_ecommerce_base/migration.sql`
- No usar `prisma migrate dev` contra la BD compartida (detecta drift y pide reset).
- Para aplicar en Railway:
  1) Validar SQL de la migracion.
  2) Ejecutar `npm run prisma:migrate` (usa `prisma migrate deploy`) o aplicar el SQL manualmente.
  3) Confirmar que no hay cambios destructivos.
