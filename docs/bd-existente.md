# BD existente (CRM) - introspeccion Prisma

Fuente: `covasa-back/prisma/schema.prisma` tras `prisma db pull` (Railway).

## Tablas (modelos) detectadas
- `Cliente`
  - PK: `id` (String)
  - Campos relevantes: `nombre`, `rut`, `email`, `telefono`, `estado`, `direccion`, `comuna`, `ciudad`, `region`, `personaContacto`, `createdAt`, `updatedAt`
  - Indices: `nombre`, `rut`
- `Producto`
  - PK: `id` (String)
  - Campos: `sku`, `nombre`, `unidadMedida`, `fotoUrl`, `precioGeneral`, `precioConDescto`, `tipo`, `createdAt`, `updatedAt`
  - Relaciones: 1-N con `Inventario`, 1-N con `PrecioProveedor`
  - Indices: `nombre`, `tipo`, `sku` unico
- `Inventario`
  - PK: `id` (String)
  - FK: `productoId -> Producto.id`
  - Campos: `stock`, `minimo`, `codigo`, `ubicacion`, `createdAt`, `updatedAt`
  - Relaciones: 1-N con `StockMovimiento`
- `StockMovimiento`
  - PK: `id` (String)
  - FK: `inventarioId -> Inventario.id`
  - Campos: `tipo` (Entrada/Salida/Ajuste), `cantidad`, `nota`, `createdAt`
- `Proveedor`
  - PK: `id` (String)
  - Campos: `nombre`, `rut`, `email`, `telefono`, `contacto`, `direccion`, `createdAt`, `updatedAt`
  - Relacion: 1-N con `PrecioProveedor`
- `PrecioProveedor`
  - PK: `id` (String)
  - FK: `productoId -> Producto.id`, `proveedorId -> Proveedor.id`
  - Campos: `precio`, `moneda`, `vigente`, `createdAt`, `updatedAt`
  - Unique: `productoId + proveedorId`
- `FleteTarifa`
  - PK: `id` (String)
  - Campos: `nombre`, `zona`, `destino`, `precio`, `activo`, `observacion`, `createdAt`, `updatedAt`
- `ImportLote`
  - PK: `id` (String)
  - Campos: `tipo`, `archivoNombre`, `estado`, `totalFilas`, `filasOk`, `filasError`, `createdAt`
  - Relacion: 1-N con `ImportFila`
- `ImportFila`
  - PK: `id` (String)
  - FK: `loteId -> ImportLote.id`
  - Campos: `nroFila`, `ok`, `error`, `raw`, `createdAt`

## Observaciones para e-commerce
- No existen tablas de ventas/cotizaciones/pedidos en el esquema actual.
- Los IDs son `String` (probablemente UUIDs), por lo que nuevas tablas deben usar `String` para FK hacia `Cliente`, `Producto`, `Inventario`.
- Stock y movimientos ya estan modelados con `Inventario` y `StockMovimiento`; no se debe duplicar.

## Implicancias
- Se deberan crear tablas nuevas para carrito/cotizacion/pedido/pago, o definir un puente si el CRM usa otro esquema fuera del Prisma actual.
- Se debe reutilizar `Producto` + `Inventario` para catalogo y stock.
