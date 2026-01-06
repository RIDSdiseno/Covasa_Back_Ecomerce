# Resultado refactor de rutas

## Cambios principales
- Rutas organizadas por dominio en `src/modules/ecommerce/routes` y `src/modules/crm/routes`.
- Router principal `src/routes/index.ts` limpio: solo health, legacy compat y modulos.
- Health controller movido a `src/modules/system/health.controller.ts`.
- Compatibilidad: `/api/ecommerce/*` sin cambios; legacy raiz mantenida via `legacy.routes.ts`.
- Rutas legacy raiz concentradas en `src/routes/legacy.routes.ts` (sin reexports).
- Legacy routes agrupadas en `src/routes/legacy.routes.ts` con comentarios DEPRECATED.
- Controllers, services, repos y schemas con naming uniforme (`*.controller.ts`, `*.service.ts`, `*.repo.ts`, `*.schema.ts`).
- Utilities ecommerce centralizadas en `src/modules/ecommerce/common/ecommerce.utils.ts`.

## Rutas finales (resumen)

| Base | Router | Archivo |
| --- | --- | --- |
| /api/ecommerce | ecommerceRouter | src/modules/ecommerce/routes/index.ts |
| /api/crm | crmRouter | src/modules/crm/routes/index.ts |
| /api (legacy) | legacyRouter | src/routes/legacy.routes.ts |
| /api/health | health | src/routes/index.ts |

Nota: el detalle completo por endpoint esta en `docs/routes-inventario.md`.

## Eliminado como dead code
- `src/controllers/productosController.ts`
- `src/controllers/cotizacionesController.ts`
- `src/controllers/pagosController.ts`
- `src/routes/productos.ts`
- `src/routes/cotizaciones.ts`
- `src/routes/pagos.ts`
- `src/controllers/` (carpeta)

## Deprecated (compatibilidad activa)
- `/api/productos`, `/api/products` (legacy catalogo).
- `/api/cotizaciones` (legacy cotizaciones).
- `/api/pagos` (legacy pagos).
- `/api/ecommerce/quotes` (legacy cotizaciones).
- `/api/ecommerce/cart` (legacy carrito).
- `/api/ecommerce/pedidos` (legacy pedidos).
- `/api/ecommerce/pagos` (legacy pagos).
- Endpoints de soporte pagos: `transbank/status`, `payments/:id/confirm`, `payments/:id/reject`.
- `/api/health/auth` (health auth legacy).

## Pendientes recomendados (sin romper flujo actual)
- Auth server-side: agregar JWT y middleware, sin exigirlo hasta migrar el front.
- Pago ApplePay DEV: ruta de confirmacion o webhook interno para cerrar pedidos.
- Revisar `covasa_web_front/.env` y evitar secretos sin prefijo `VITE_`.

## Smoke test sugerido
- POST `/api/ecommerce/cotizaciones` desde QuotePage.
- GET `/api/crm/cotizaciones` y `/api/crm/cotizaciones/:id`.
- GET `/api/ecommerce/productos`.
- Flujo Transbank sin cambios.
