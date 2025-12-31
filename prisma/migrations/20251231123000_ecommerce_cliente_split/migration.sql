-- Rename ecommerce tables to snake_case
ALTER TABLE "EcommerceCarrito" RENAME TO "ecommerce_carrito";
ALTER TABLE "EcommerceCarritoItem" RENAME TO "ecommerce_carrito_item";
ALTER TABLE "EcommerceCotizacion" RENAME TO "ecommerce_cotizacion";
ALTER TABLE "EcommerceCotizacionItem" RENAME TO "ecommerce_cotizacion_item";
ALTER TABLE "EcommercePedido" RENAME TO "ecommerce_pedido";
ALTER TABLE "EcommercePedidoItem" RENAME TO "ecommerce_pedido_item";
ALTER TABLE "EcommercePago" RENAME TO "ecommerce_pago";
ALTER TABLE "EcommerceNotificacion" RENAME TO "ecommerce_notificacion";
ALTER TABLE "EcommerceUsuario" RENAME TO "ecommerce_usuario";
ALTER TABLE "EcommerceDireccion" RENAME TO "ecommerce_direccion";

-- Rename foreign key columns to ecommerceClienteId
ALTER TABLE "ecommerce_carrito" RENAME COLUMN "clienteId" TO "ecommerceClienteId";
ALTER TABLE "ecommerce_cotizacion" RENAME COLUMN "clienteId" TO "ecommerceClienteId";
ALTER TABLE "ecommerce_pedido" RENAME COLUMN "clienteId" TO "ecommerceClienteId";
ALTER TABLE "ecommerce_direccion" RENAME COLUMN "usuarioId" TO "ecommerceClienteId";

-- Drop old CRM/user foreign keys
ALTER TABLE "ecommerce_carrito" DROP CONSTRAINT "EcommerceCarrito_clienteId_fkey";
ALTER TABLE "ecommerce_cotizacion" DROP CONSTRAINT "EcommerceCotizacion_clienteId_fkey";
ALTER TABLE "ecommerce_pedido" DROP CONSTRAINT "EcommercePedido_clienteId_fkey";
ALTER TABLE "ecommerce_usuario" DROP CONSTRAINT "EcommerceUsuario_clienteId_fkey";
ALTER TABLE "ecommerce_direccion" DROP CONSTRAINT "EcommerceDireccion_usuarioId_fkey";

-- Remove CRM link from ecommerce usuario
ALTER TABLE "ecommerce_usuario" DROP COLUMN "clienteId";

-- Create ecommerce_cliente
CREATE TABLE "ecommerce_cliente" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ecommerce_cliente_pkey" PRIMARY KEY ("id")
);

-- Unique constraints for ecommerce_cliente
CREATE UNIQUE INDEX "ecommerce_cliente_usuarioId_key" ON "ecommerce_cliente"("usuarioId");
CREATE UNIQUE INDEX "ecommerce_cliente_email_key" ON "ecommerce_cliente"("email");

-- Link ecommerce_cliente to ecommerce_usuario
ALTER TABLE "ecommerce_cliente" ADD CONSTRAINT "ecommerce_cliente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "ecommerce_usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Link ecommerce tables to ecommerce_cliente
ALTER TABLE "ecommerce_carrito" ADD CONSTRAINT "ecommerce_carrito_ecommerceClienteId_fkey" FOREIGN KEY ("ecommerceClienteId") REFERENCES "ecommerce_cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ecommerce_cotizacion" ADD CONSTRAINT "ecommerce_cotizacion_ecommerceClienteId_fkey" FOREIGN KEY ("ecommerceClienteId") REFERENCES "ecommerce_cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ecommerce_pedido" ADD CONSTRAINT "ecommerce_pedido_ecommerceClienteId_fkey" FOREIGN KEY ("ecommerceClienteId") REFERENCES "ecommerce_cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ecommerce_direccion" ADD CONSTRAINT "ecommerce_direccion_ecommerceClienteId_fkey" FOREIGN KEY ("ecommerceClienteId") REFERENCES "ecommerce_cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
