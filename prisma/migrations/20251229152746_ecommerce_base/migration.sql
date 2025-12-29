-- CreateEnum
CREATE TYPE "EcommerceEstadoCarrito" AS ENUM ('ACTIVO', 'CONVERTIDO', 'ABANDONADO');

-- CreateEnum
CREATE TYPE "EcommerceEstadoCotizacion" AS ENUM ('NUEVA', 'EN_REVISION', 'RESPONDIDA', 'CERRADA');

-- CreateEnum
CREATE TYPE "EcommerceEstadoPedido" AS ENUM ('CREADO', 'PAGADO', 'EN_PREPARACION', 'ENVIADO', 'ENTREGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EcommerceMetodoPago" AS ENUM ('TRANSBANK', 'APPLE_PAY', 'TRANSFERENCIA', 'OTRO');

-- CreateEnum
CREATE TYPE "EcommerceEstadoPago" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'RECHAZADO');

-- CreateTable
CREATE TABLE "EcommerceCarrito" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT,
    "estado" "EcommerceEstadoCarrito" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcommerceCarrito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcommerceCarritoItem" (
    "id" TEXT NOT NULL,
    "carritoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitarioNetoSnapshot" INTEGER NOT NULL,
    "subtotalNetoSnapshot" INTEGER NOT NULL,
    "ivaPctSnapshot" INTEGER NOT NULL,
    "ivaMontoSnapshot" INTEGER NOT NULL,
    "totalSnapshot" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcommerceCarritoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcommerceCotizacion" (
    "id" TEXT NOT NULL,
    "correlativo" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "origen" TEXT NOT NULL DEFAULT 'ECOMMERCE',
    "clienteId" TEXT,
    "nombreContacto" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "empresa" TEXT,
    "rut" TEXT,
    "observaciones" TEXT,
    "ocCliente" TEXT,
    "subtotalNeto" INTEGER NOT NULL,
    "iva" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "estado" "EcommerceEstadoCotizacion" NOT NULL DEFAULT 'NUEVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcommerceCotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcommerceCotizacionItem" (
    "id" TEXT NOT NULL,
    "cotizacionId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "descripcionSnapshot" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitarioNetoSnapshot" INTEGER NOT NULL,
    "subtotalNetoSnapshot" INTEGER NOT NULL,
    "ivaPctSnapshot" INTEGER NOT NULL,
    "ivaMontoSnapshot" INTEGER NOT NULL,
    "totalSnapshot" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcommerceCotizacionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcommercePedido" (
    "id" TEXT NOT NULL,
    "correlativo" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "clienteId" TEXT,
    "despachoNombre" TEXT,
    "despachoTelefono" TEXT,
    "despachoEmail" TEXT,
    "despachoDireccion" TEXT,
    "despachoComuna" TEXT,
    "despachoCiudad" TEXT,
    "despachoRegion" TEXT,
    "despachoNotas" TEXT,
    "subtotalNeto" INTEGER NOT NULL,
    "iva" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "estado" "EcommerceEstadoPedido" NOT NULL DEFAULT 'CREADO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcommercePedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcommercePedidoItem" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "descripcionSnapshot" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitarioNetoSnapshot" INTEGER NOT NULL,
    "subtotalNetoSnapshot" INTEGER NOT NULL,
    "ivaPctSnapshot" INTEGER NOT NULL,
    "ivaMontoSnapshot" INTEGER NOT NULL,
    "totalSnapshot" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcommercePedidoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcommercePago" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "metodo" "EcommerceMetodoPago" NOT NULL,
    "estado" "EcommerceEstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "monto" INTEGER NOT NULL,
    "referencia" TEXT,
    "evidenciaUrl" TEXT,
    "gatewayPayloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcommercePago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcommerceNotificacion" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "referenciaTabla" TEXT NOT NULL,
    "referenciaId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcommerceNotificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EcommerceCarrito_clienteId_idx" ON "EcommerceCarrito"("clienteId");

-- CreateIndex
CREATE INDEX "EcommerceCarrito_estado_idx" ON "EcommerceCarrito"("estado");

-- CreateIndex
CREATE INDEX "EcommerceCarritoItem_carritoId_idx" ON "EcommerceCarritoItem"("carritoId");

-- CreateIndex
CREATE INDEX "EcommerceCarritoItem_productoId_idx" ON "EcommerceCarritoItem"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "EcommerceCarritoItem_carritoId_productoId_key" ON "EcommerceCarritoItem"("carritoId", "productoId");

-- CreateIndex
CREATE UNIQUE INDEX "EcommerceCotizacion_codigo_key" ON "EcommerceCotizacion"("codigo");

-- CreateIndex
CREATE INDEX "EcommerceCotizacion_clienteId_idx" ON "EcommerceCotizacion"("clienteId");

-- CreateIndex
CREATE INDEX "EcommerceCotizacion_estado_idx" ON "EcommerceCotizacion"("estado");

-- CreateIndex
CREATE INDEX "EcommerceCotizacionItem_cotizacionId_idx" ON "EcommerceCotizacionItem"("cotizacionId");

-- CreateIndex
CREATE INDEX "EcommerceCotizacionItem_productoId_idx" ON "EcommerceCotizacionItem"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "EcommercePedido_codigo_key" ON "EcommercePedido"("codigo");

-- CreateIndex
CREATE INDEX "EcommercePedido_clienteId_idx" ON "EcommercePedido"("clienteId");

-- CreateIndex
CREATE INDEX "EcommercePedido_estado_idx" ON "EcommercePedido"("estado");

-- CreateIndex
CREATE INDEX "EcommercePedidoItem_pedidoId_idx" ON "EcommercePedidoItem"("pedidoId");

-- CreateIndex
CREATE INDEX "EcommercePedidoItem_productoId_idx" ON "EcommercePedidoItem"("productoId");

-- CreateIndex
CREATE INDEX "EcommercePago_pedidoId_idx" ON "EcommercePago"("pedidoId");

-- CreateIndex
CREATE INDEX "EcommercePago_estado_idx" ON "EcommercePago"("estado");

-- CreateIndex
CREATE INDEX "EcommerceNotificacion_tipo_idx" ON "EcommerceNotificacion"("tipo");

-- CreateIndex
CREATE INDEX "EcommerceNotificacion_leido_idx" ON "EcommerceNotificacion"("leido");

-- CreateIndex
CREATE INDEX "EcommerceNotificacion_referenciaTabla_idx" ON "EcommerceNotificacion"("referenciaTabla");

-- CreateIndex
CREATE INDEX "EcommerceNotificacion_referenciaId_idx" ON "EcommerceNotificacion"("referenciaId");

-- AddForeignKey
ALTER TABLE "EcommerceCarrito" ADD CONSTRAINT "EcommerceCarrito_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceCarritoItem" ADD CONSTRAINT "EcommerceCarritoItem_carritoId_fkey" FOREIGN KEY ("carritoId") REFERENCES "EcommerceCarrito"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceCarritoItem" ADD CONSTRAINT "EcommerceCarritoItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceCotizacion" ADD CONSTRAINT "EcommerceCotizacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceCotizacionItem" ADD CONSTRAINT "EcommerceCotizacionItem_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "EcommerceCotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceCotizacionItem" ADD CONSTRAINT "EcommerceCotizacionItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommercePedido" ADD CONSTRAINT "EcommercePedido_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommercePedidoItem" ADD CONSTRAINT "EcommercePedidoItem_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "EcommercePedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommercePedidoItem" ADD CONSTRAINT "EcommercePedidoItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommercePago" ADD CONSTRAINT "EcommercePago_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "EcommercePedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
