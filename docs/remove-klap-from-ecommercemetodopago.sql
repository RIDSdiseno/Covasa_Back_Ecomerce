-- Run this script once per database (CRM DB and Ecommerce DB).
-- It aborts if any column using EcommerceMetodoPago still has KLAP rows.
-- Prerequisite: backup/snapshot taken.

BEGIN;

-- Optional visibility check.
SELECT unnest(enum_range(NULL::"EcommerceMetodoPago")) AS valor;

DO $$
DECLARE
  has_enum boolean;
  col_rec record;
  klap_count bigint;
  total_klap bigint := 0;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'EcommerceMetodoPago'
      AND typtype = 'e'
  ) INTO has_enum;

  IF NOT has_enum THEN
    RAISE EXCEPTION 'Enum EcommerceMetodoPago not found in current database';
  END IF;

  FOR col_rec IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      a.attname AS column_name
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE a.attnum > 0
      AND NOT a.attisdropped
      AND c.relkind IN ('r', 'p')
      AND a.atttypid = 'EcommerceMetodoPago'::regtype
    ORDER BY n.nspname, c.relname, a.attname
  LOOP
    EXECUTE format(
      'SELECT COUNT(*) FROM %I.%I WHERE %I::text = %L',
      col_rec.schema_name,
      col_rec.table_name,
      col_rec.column_name,
      'KLAP'
    ) INTO klap_count;

    total_klap := total_klap + klap_count;

    RAISE NOTICE '%.%.% has % KLAP rows',
      col_rec.schema_name,
      col_rec.table_name,
      col_rec.column_name,
      klap_count;
  END LOOP;

  IF total_klap > 0 THEN
    RAISE EXCEPTION 'Abortado: existen % filas con KLAP. Migralas antes de continuar.', total_klap;
  END IF;
END $$;

-- If you have KLAP rows, migrate first (example):
-- UPDATE "ecommerce_pago" SET "metodo" = 'TRANSFERENCIA' WHERE "metodo"::text = 'KLAP';

CREATE TYPE "EcommerceMetodoPago_new" AS ENUM (
  'TRANSBANK',
  'APPLE_PAY',
  'STRIPE',
  'TRANSFERENCIA',
  'OTRO',
  'APPLEPAY_DEV'
);

DO $$
DECLARE
  col_rec record;
BEGIN
  FOR col_rec IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      a.attname AS column_name
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE a.attnum > 0
      AND NOT a.attisdropped
      AND c.relkind IN ('r', 'p')
      AND a.atttypid = 'EcommerceMetodoPago'::regtype
    ORDER BY n.nspname, c.relname, a.attname
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN %I TYPE "EcommerceMetodoPago_new" USING (%I::text::"EcommerceMetodoPago_new")',
      col_rec.schema_name,
      col_rec.table_name,
      col_rec.column_name,
      col_rec.column_name
    );
  END LOOP;
END $$;

DROP TYPE "EcommerceMetodoPago";
ALTER TYPE "EcommerceMetodoPago_new" RENAME TO "EcommerceMetodoPago";

COMMIT;
