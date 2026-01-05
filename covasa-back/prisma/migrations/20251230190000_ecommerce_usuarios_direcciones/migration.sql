-- CreateTable
CREATE TABLE "EcommerceUsuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "passwordHash" TEXT NOT NULL,
    "clienteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcommerceUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcommerceDireccion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "pedidoId" TEXT,
    "nombreContacto" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "comuna" TEXT NOT NULL,
    "ciudad" TEXT,
    "region" TEXT NOT NULL,
    "notas" TEXT,
    "esPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcommerceDireccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EcommerceUsuario_email_key" ON "EcommerceUsuario"("email");

-- CreateIndex
CREATE INDEX "EcommerceUsuario_clienteId_idx" ON "EcommerceUsuario"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "EcommerceDireccion_pedidoId_key" ON "EcommerceDireccion"("pedidoId");

-- CreateIndex
CREATE INDEX "EcommerceDireccion_usuarioId_idx" ON "EcommerceDireccion"("usuarioId");

-- CreateIndex
CREATE INDEX "EcommerceDireccion_usuarioId_esPrincipal_idx" ON "EcommerceDireccion"("usuarioId", "esPrincipal");

-- AddForeignKey
ALTER TABLE "EcommerceUsuario" ADD CONSTRAINT "EcommerceUsuario_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceDireccion" ADD CONSTRAINT "EcommerceDireccion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "EcommerceUsuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceDireccion" ADD CONSTRAINT "EcommerceDireccion_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "EcommercePedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
