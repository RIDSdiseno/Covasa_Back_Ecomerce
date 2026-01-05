# Estado backend e-commerce (actualizado)

## Estructura actual
- Codigo fuente en `covasa-back/src`.
- Archivos principales:
  - `covasa-back/src/server.ts`: carga env, levanta Express en `PORT` (default 3000).
  - `covasa-back/src/app.ts`: configura CORS, JSON, static `/uploads`, rutas `/api`, middleware de 404 y errores.
  - `covasa-back/src/routes/index.ts`: router base con `/`, `/health`, `/productos`, `/cotizaciones`, `/pagos`.
  - `covasa-back/src/controllers/healthController.ts`: responde `{ ok, data: { status } }`.
  - `covasa-back/src/lib/prisma.ts`: PrismaClient con adapter `@prisma/adapter-pg`.
  - `covasa-back/prisma.config.ts`: config Prisma 7 (schema + migrations + `DATABASE_URL`).
  - `covasa-back/prisma/schema.prisma`: modelos CRM + tablas e-commerce (carrito, solicitud de cotizacion, pedido, pago, notificaciones).

## Rutas y basePath
- Base path: `/api` (configurado en `covasa-back/src/app.ts`).
- Rutas actuales:
  - `GET /api/` -> `{ ok, data }` (`covasa-back/src/routes/index.ts`).
  - `GET /api/health` -> `{ ok, data: { status } }` (`covasa-back/src/controllers/healthController.ts`).
  - `GET /api/productos` (`covasa-back/src/controllers/productosController.ts`).
  - `GET /api/productos/:id` (`covasa-back/src/controllers/productosController.ts`).
  - `POST /api/cotizaciones` (`covasa-back/src/controllers/cotizacionesController.ts`).
  - `POST /api/pagos` (`covasa-back/src/controllers/pagosController.ts`).

## CORS y puertos locales
- CORS permite `http://localhost:3000`, `http://127.0.0.1:3000`, `http://localhost:5173` y `http://127.0.0.1:5173` por defecto (`covasa-back/src/app.ts`).
- Variables:
  - `ALLOWED_ORIGINS` (lista separada por comas).
  - `CORS_ALLOW_ALL=true` para permitir cualquier origen.
- Nota: se puede ampliar via `ALLOWED_ORIGINS` o usar `CORS_ALLOW_ALL=true`.

## Prisma y BD
- Prisma 7 configurado via `prisma.config.ts` con `DATABASE_URL` y migrations en `prisma/migrations`.
- `prisma/schema.prisma` contiene tablas CRM y nuevas tablas e-commerce: `Carrito`, `SolicitudCotizacion`, `SolicitudCotizacionItem`, `Pedido`, `PedidoItem`, `Pago`, `MensajeNotificacion`.
- `covasa-back/src/lib/prisma.ts` usa `PrismaPg` con `DATABASE_URL` (adapter pg).

## Verificacion de endpoints
- Validacion de tipos: `npx tsc -p . --noEmit` ejecutado sin errores.
- No se ejecuto el servidor local dentro de este analisis.
