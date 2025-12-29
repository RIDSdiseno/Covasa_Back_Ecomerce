-- CreateEnum
CREATE TYPE "EstadoCarrito" AS ENUM ('Activo', 'Convertido', 'Abandonado');

-- CreateEnum
CREATE TYPE "EstadoCotizacion" AS ENUM ('Recibida', 'EnRevision', 'Cotizada', 'Aprobada', 'Rechazada', 'Cancelada');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('TRANSBANK', 'APPLE_PAY', 'TRANSFERENCIA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('Pendiente', 'Iniciado', 'Autorizado', 'Rechazado', 'Anulado');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('Recibido', 'EnPreparacion', 'Enviado', 'Entregado', 'Cancelado');

-- CreateEnum
CREATE TYPE "OrigenRegistro" AS ENUM ('CRM', 'ECOMMERCE');

-- CreateTable
CREATE TABLE "Carrito" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "clienteId" TEXT,
    "email" TEXT,
    "estado" "EstadoCarrito" NOT NULL DEFAULT 'Activo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Carrito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarritoItem" (
    "id" TEXT NOT NULL,
    "carritoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "nombreProducto" TEXT NOT NULL,
    "descripcion" TEXT,
    "unidad" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitarioNeto" INTEGER NOT NULL,
    "subtotalNeto" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarritoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudCotizacion" (
    "id" TEXT NOT NULL,
    "carritoId" TEXT,
    "clienteId" TEXT,
    "nombreContacto" TEXT NOT NULL,
    "empresa" TEXT,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "tipoObra" TEXT NOT NULL,
    "ubicacion" TEXT NOT NULL,
    "observaciones" TEXT,
    "ocNumero" TEXT,
    "subtotalNeto" INTEGER NOT NULL,
    "ivaPct" INTEGER NOT NULL DEFAULT 19,
    "ivaMonto" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'CLP',
    "estado" "EstadoCotizacion" NOT NULL DEFAULT 'Recibida',
    "origen" "OrigenRegistro" NOT NULL DEFAULT 'ECOMMERCE',
    "canal" TEXT,
    "origenRef" TEXT,
    "contenidoHash" TEXT,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "fingerprintHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitudCotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudCotizacionItem" (
    "id" TEXT NOT NULL,
    "solicitudCotizacionId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "nombreProducto" TEXT NOT NULL,
    "descripcion" TEXT,
    "unidad" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitarioNeto" INTEGER NOT NULL,
    "subtotalNeto" INTEGER NOT NULL,
    "ivaPct" INTEGER NOT NULL,
    "ivaMonto" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitudCotizacionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" TEXT NOT NULL,
    "solicitudCotizacionId" TEXT,
    "clienteId" TEXT,
    "nombreContacto" TEXT NOT NULL,
    "empresa" TEXT,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "tipoObra" TEXT,
    "ubicacion" TEXT,
    "observaciones" TEXT,
    "subtotalNeto" INTEGER NOT NULL,
    "ivaPct" INTEGER NOT NULL DEFAULT 19,
    "ivaMonto" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'CLP',
    "estado" "EstadoPedido" NOT NULL DEFAULT 'Recibido',
    "origen" "OrigenRegistro" NOT NULL DEFAULT 'ECOMMERCE',
    "canal" TEXT,
    "origenRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoItem" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "nombreProducto" TEXT NOT NULL,
    "descripcion" TEXT,
    "unidad" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitarioNeto" INTEGER NOT NULL,
    "subtotalNeto" INTEGER NOT NULL,
    "ivaPct" INTEGER NOT NULL,
    "ivaMonto" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PedidoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "solicitudCotizacionId" TEXT,
    "pedidoId" TEXT,
    "metodo" "MetodoPago" NOT NULL,
    "estado" "EstadoPago" NOT NULL DEFAULT 'Pendiente',
    "monto" INTEGER NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'CLP',
    "referenciaExterna" TEXT,
    "payload" JSONB,
    "origen" "OrigenRegistro" NOT NULL DEFAULT 'ECOMMERCE',
    "canal" TEXT,
    "origenRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MensajeNotificacion" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "entidad" TEXT,
    "entidadId" TEXT,
    "origen" "OrigenRegistro" NOT NULL DEFAULT 'ECOMMERCE',
    "canal" TEXT,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "solicitudCotizacionId" TEXT,

    CONSTRAINT "MensajeNotificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Carrito_token_key" ON "Carrito"("token");

-- CreateIndex
CREATE INDEX "Carrito_clienteId_idx" ON "Carrito"("clienteId");

-- CreateIndex
CREATE INDEX "Carrito_estado_idx" ON "Carrito"("estado");

-- CreateIndex
CREATE INDEX "CarritoItem_carritoId_idx" ON "CarritoItem"("carritoId");

-- CreateIndex
CREATE INDEX "CarritoItem_productoId_idx" ON "CarritoItem"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "CarritoItem_carritoId_productoId_key" ON "CarritoItem"("carritoId", "productoId");

-- CreateIndex
CREATE INDEX "SolicitudCotizacion_carritoId_idx" ON "SolicitudCotizacion"("carritoId");

-- CreateIndex
CREATE INDEX "SolicitudCotizacion_clienteId_idx" ON "SolicitudCotizacion"("clienteId");

-- CreateIndex
CREATE INDEX "SolicitudCotizacion_estado_idx" ON "SolicitudCotizacion"("estado");

-- CreateIndex
CREATE INDEX "SolicitudCotizacion_origen_idx" ON "SolicitudCotizacion"("origen");

-- CreateIndex
CREATE INDEX "SolicitudCotizacion_contenidoHash_idx" ON "SolicitudCotizacion"("contenidoHash");

-- CreateIndex
CREATE INDEX "SolicitudCotizacion_ipHash_idx" ON "SolicitudCotizacion"("ipHash");

-- CreateIndex
CREATE INDEX "SolicitudCotizacion_userAgentHash_idx" ON "SolicitudCotizacion"("userAgentHash");

-- CreateIndex
CREATE INDEX "SolicitudCotizacion_fingerprintHash_idx" ON "SolicitudCotizacion"("fingerprintHash");

-- CreateIndex
CREATE INDEX "SolicitudCotizacionItem_solicitudCotizacionId_idx" ON "SolicitudCotizacionItem"("solicitudCotizacionId");

-- CreateIndex
CREATE INDEX "SolicitudCotizacionItem_productoId_idx" ON "SolicitudCotizacionItem"("productoId");

-- CreateIndex
CREATE INDEX "Pedido_clienteId_idx" ON "Pedido"("clienteId");

-- CreateIndex
CREATE INDEX "Pedido_solicitudCotizacionId_idx" ON "Pedido"("solicitudCotizacionId");

-- CreateIndex
CREATE INDEX "Pedido_estado_idx" ON "Pedido"("estado");

-- CreateIndex
CREATE INDEX "Pedido_origen_idx" ON "Pedido"("origen");

-- CreateIndex
CREATE INDEX "PedidoItem_pedidoId_idx" ON "PedidoItem"("pedidoId");

-- CreateIndex
CREATE INDEX "PedidoItem_productoId_idx" ON "PedidoItem"("productoId");

-- CreateIndex
CREATE INDEX "Pago_solicitudCotizacionId_idx" ON "Pago"("solicitudCotizacionId");

-- CreateIndex
CREATE INDEX "Pago_pedidoId_idx" ON "Pago"("pedidoId");

-- CreateIndex
CREATE INDEX "Pago_estado_idx" ON "Pago"("estado");

-- CreateIndex
CREATE INDEX "Pago_origen_idx" ON "Pago"("origen");

-- CreateIndex
CREATE INDEX "MensajeNotificacion_solicitudCotizacionId_idx" ON "MensajeNotificacion"("solicitudCotizacionId");

-- CreateIndex
CREATE INDEX "MensajeNotificacion_leido_idx" ON "MensajeNotificacion"("leido");

-- CreateIndex
CREATE INDEX "MensajeNotificacion_origen_idx" ON "MensajeNotificacion"("origen");

-- CreateIndex
CREATE INDEX "MensajeNotificacion_tipo_idx" ON "MensajeNotificacion"("tipo");

-- AddForeignKey
ALTER TABLE "Carrito" ADD CONSTRAINT "Carrito_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarritoItem" ADD CONSTRAINT "CarritoItem_carritoId_fkey" FOREIGN KEY ("carritoId") REFERENCES "Carrito"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarritoItem" ADD CONSTRAINT "CarritoItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudCotizacion" ADD CONSTRAINT "SolicitudCotizacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudCotizacion" ADD CONSTRAINT "SolicitudCotizacion_carritoId_fkey" FOREIGN KEY ("carritoId") REFERENCES "Carrito"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudCotizacionItem" ADD CONSTRAINT "SolicitudCotizacionItem_solicitudCotizacionId_fkey" FOREIGN KEY ("solicitudCotizacionId") REFERENCES "SolicitudCotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudCotizacionItem" ADD CONSTRAINT "SolicitudCotizacionItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_solicitudCotizacionId_fkey" FOREIGN KEY ("solicitudCotizacionId") REFERENCES "SolicitudCotizacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_solicitudCotizacionId_fkey" FOREIGN KEY ("solicitudCotizacionId") REFERENCES "SolicitudCotizacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensajeNotificacion" ADD CONSTRAINT "MensajeNotificacion_solicitudCotizacionId_fkey" FOREIGN KEY ("solicitudCotizacionId") REFERENCES "SolicitudCotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
