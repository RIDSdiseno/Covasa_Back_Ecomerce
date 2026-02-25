# Covasa Back Ecommerce

Backend e-commerce (Node.js + TypeScript + Express + Prisma + PostgreSQL).

## Requisitos
- Node.js 18+
- PostgreSQL (Railway)
- Prisma 7

## Configuracion local
1) Ir a `covasa-back`:
   - `cd covasa-back`
2) Instalar dependencias:
   - `npm install`
3) Variables de entorno (ejemplo):
   - `PORT=3000`
   - `DATABASE_URL=postgresql://USER:PASS@HOST:PORT/DB?sslmode=require`
   - `FRONTEND_ORIGIN=http://localhost:5173`
   - `EXTERNAL_DPA_BASE_URL=https://apis.digital.gob.cl/dpa` (opcional)
   - `CORS_ALLOW_ALL=true` (opcional)
   - `IVA_PCT=19` (opcional)
   - `COTIZACIONES_VENTANA_MIN=15` (opcional)
   - `COTIZACIONES_MAX_POR_IP=5` (opcional)
   - `COTIZACIONES_MAX_POR_HUELLA=5` (opcional)
   - `COTIZACIONES_DEDUP_MIN=30` (opcional)
4) Generar Prisma Client:
   - `npx prisma generate`
5) Levantar en local:
   - `npm run dev`

## Migraciones (BD compartida con CRM)
- El CRM ya tiene migraciones aplicadas y no estan en este repo.
- No usar `prisma migrate dev` contra la BD compartida (drift y reset).
- Migracion manual creada en `covasa-back/prisma/migrations/*_ecommerce_base/migration.sql`.
- Aplicacion recomendada:
  1) Revisar el SQL (solo tablas nuevas).
  2) Ejecutar `npm run prisma:migrate` (usa `prisma migrate deploy`) o aplicar el SQL manualmente.

## Endpoints principales
- `GET /api/health`
- `GET /api/productos`
- `GET /api/productos/:id`
- `POST /api/cotizaciones`
- `POST /api/pagos` (placeholder)

## Proxy API DPA (Chile)
Endpoints expuestos por el backend para evitar CORS:
- `GET /api/chile/regiones`
- `GET /api/chile/regiones/:regionCode/provincias`
- `GET /api/chile/provincias/:provinciaCode/comunas`
- `GET /api/chile/regiones/:regionCode/comunas`

Ejemplos de prueba (curl):
- `curl http://localhost:3001/api/chile/regiones`
- `curl http://localhost:3001/api/chile/regiones/13/provincias`
- `curl http://localhost:3001/api/chile/provincias/131/comunas`
- `curl http://localhost:3001/api/chile/regiones/13/comunas`

Ejemplo desde frontend (fetch):
```ts
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

export const fetchRegiones = async () => {
  const res = await fetch(`${API_BASE}/api/chile/regiones`);
  if (!res.ok) throw new Error("No se pudieron cargar las regiones");
  const { data } = await res.json();
  return data;
};
```

## Railway
- Variables requeridas: `DATABASE_URL`, `PORT`, `FRONTEND_ORIGIN`, `IVA_PCT`.
- Recomendado: ejecutar `npm run prisma:migrate` en el deploy para crear tablas nuevas.

## KLAP (Checkout Flex)
- Variables backend requeridas:
  - `KLAP_ENABLED=true|false`
  - `KLAP_ENV=sandbox|prod`
  - `KLAP_API_KEY=...`
  - `KLAP_ORDERS_URL=...`
  - `PUBLIC_BASE_URL=https://...`
  - `KLAP_WEBHOOK_PATH=/api/ecommerce/payments/klap/webhook`
  - `KLAP_RETURN_URL=/pago/klap` (opcional)
- Flujo: crear pedido -> `POST /api/ecommerce/payments/klap` -> redireccionar a `redirectUrl` -> webhook KLAP -> pago confirmado/rechazado/reembolsado.
- Firma webhook: `sha256(reference_id + order_id + KLAP_API_KEY)` comparada contra header `apikey`.
- Cuando `KLAP_ENABLED=false`, las rutas KLAP responden `404`.

## Probar Webhook KLAP en desarrollo
1) Exponer backend local:
   - `ngrok http 3001` o `cloudflared tunnel --url http://localhost:3001`
2) Configurar:
   - `PUBLIC_BASE_URL=<url-publica-del-tunnel>`
   - `KLAP_WEBHOOK_PATH=/api/ecommerce/payments/klap/webhook`
3) Flujo de prueba:
   - Crear pedido desde checkout.
   - Iniciar pago KLAP.
   - Verificar `EcommercePago` en `PENDIENTE`.
   - Disparar webhook (o completar pago en sandbox) y validar cambio a `CONFIRMADO/RECHAZADO`.
   - Confirmado: validar `EcommercePedido.estado = PAGADO`, aparición en `mis-pagos` y PDF.
