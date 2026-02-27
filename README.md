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

## Klap (Deprecated)
- Klap ya no esta soportado en ecommerce.
- Cualquier intento a:
  - `POST /api/ecommerce/payments/klap`
  - `POST /api/ecommerce/payments/klap/webhook`
  - `POST /api/ecommerce/payments/klap/mock-webhook`
  responde `410 Gone` con:
  - `code: "KLAP_DEPRECATED"`
  - `errorCode: "PAYMENT_METHOD_DEPRECATED"`
  - `message: "Klap is no longer supported"`
- Las variables `KLAP_*` se ignoran y no afectan el flujo de pagos.
