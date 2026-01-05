# Auditoria BD actual (Railway)

Fuente: npx prisma db pull

## Tablas existentes (NO tocar)
- Cliente
- Producto
- Inventario
- StockMovimiento
- Proveedor
- PrecioProveedor
- FleteTarifa
- ImportLote
- ImportFila
- _prisma_migrations

## Campos clave (PK/FK)
### Cliente
- PK: id
- FK: ninguna
- Indices: nombre, rut

### Producto
- PK: id
- UQ: sku
- FK entrantes: Inventario.productoId, PrecioProveedor.productoId
- Indices: nombre, tipo, fotoPublicId

### Inventario
- PK: id
- FK: productoId -> Producto.id
- Indices: productoId

### StockMovimiento
- PK: id
- FK: inventarioId -> Inventario.id
- Indices: inventarioId

## Confirmacion
- Las tablas existentes del CRM se mantienen intactas.
- Solo se agregaran tablas nuevas con prefijo Ecommerce* y FKs hacia Cliente/Producto.
