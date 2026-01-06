-- Add auth provider fields for ecommerce users
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'MICROSOFT');

ALTER TABLE "ecommerce_usuario"
  ADD COLUMN "authProvider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN "microsoftSubject" TEXT;

ALTER TABLE "ecommerce_usuario" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "ecommerce_usuario" ALTER COLUMN "email" DROP NOT NULL;

CREATE UNIQUE INDEX "ecommerce_usuario_microsoftSubject_key" ON "ecommerce_usuario"("microsoftSubject");
