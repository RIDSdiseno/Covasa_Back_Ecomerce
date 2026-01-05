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
   - `ALLOWED_ORIGINS=http://localhost:5173`
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

## Railway
- Variables requeridas: `DATABASE_URL`, `PORT`, `ALLOWED_ORIGINS`, `IVA_PCT`.
- Recomendado: ejecutar `npm run prisma:migrate` en el deploy para crear tablas nuevas.
