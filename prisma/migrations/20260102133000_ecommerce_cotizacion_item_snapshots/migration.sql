-- Add metadata and relax contact requirements for ecommerce cotizaciones
ALTER TABLE "ecommerce_cotizacion" ADD COLUMN "metadata" JSONB;
ALTER TABLE "ecommerce_cotizacion" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "ecommerce_cotizacion" ALTER COLUMN "telefono" DROP NOT NULL;

-- Add snapshot fields for cotizacion items
ALTER TABLE "ecommerce_cotizacion_item" ADD COLUMN "skuSnapshot" TEXT;
ALTER TABLE "ecommerce_cotizacion_item" ADD COLUMN "unidadSnapshot" TEXT;
ALTER TABLE "ecommerce_cotizacion_item" ADD COLUMN "observacion" TEXT;
