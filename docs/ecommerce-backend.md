# Ecommerce backend - flujo end-to-end

## Resumen
- Backend Node/Express/Prisma con tablas Ecommerce*.
- No se modifican tablas maestras CRM (Cliente, Producto, Inventario, etc).
- El formulario de cotizacion guarda tipoObra/comunaRegion/detalleAdicional en EcommerceCotizacion.observaciones como JSON string.

## Base URL y CORS
- Backend local: `http://localhost:3000/api`.
- Front usa `VITE_API_URL` en `Covasa_ecommer_front-dev/covasa_web_front/src/services/api.ts`.
- CORS permite por defecto `http://localhost:5173` y `http://localhost:3000`.
- Para agregar dominios: `ALLOWED_ORIGINS=dominio1,dominio2` o `CORS_ALLOW_ALL=true`.

## Variables .env relevantes
- `PORT=3000`
- `DATABASE_URL=...`
- `IVA_PCT=19` (por defecto)
- `ECOMMERCE_VALIDAR_STOCK=true` (opcional, valida stock Inventario antes de crear pedido)
- `ALLOWED_ORIGINS=...`

## Reglas de negocio (snapshots y totales)
- `precioUnitarioNetoSnapshot` = `Producto.precioConDescto` si > 0, si no `Producto.precioGeneral`.
- `subtotalNetoSnapshot` = `precioUnitarioNetoSnapshot * cantidad`.
- `ivaPctSnapshot` = IVA (default 19%).
- `ivaMontoSnapshot` = round(`subtotalNetoSnapshot * ivaPctSnapshot / 100`).
- `totalSnapshot` = `subtotalNetoSnapshot + ivaMontoSnapshot`.
- Totales de carrito/cotizacion/pedido = suma de items.
- Carrito respeta `@@unique([carritoId, productoId])` y hace UPSERT + merge de cantidades.

## Endpoints principales

### Salud
- GET `/api/health`

### Productos
- GET `/api/products` (alias de `/api/productos`)
  - Retorna campos base + precios calculados y stock.

### Cotizaciones (formulario)
- POST `/api/ecommerce/quotes`
  - Body:
    ```json
    {
      "nombreContacto": "Juan Perez",
      "empresa": "Constructora X",
      "email": "jp@x.cl",
      "telefono": "+56 9 1234 5678",
      "tipoObra": "obra-gruesa",
      "comunaRegion": "Santiago, RM",
      "ocCliente": "OC-123",
      "detalleAdicional": "Entrega urgente",
      "items": [{"productoId": "...", "cantidad": 3}]
    }
    ```
  - Respuesta:
    ```json
    {"ok": true, "data": {"cotizacionId": "...", "codigo": "ECQ-000001", "total": 12345}}
    ```

- GET `/api/ecommerce/quotes/:id`

- POST `/api/ecommerce/quotes/:id/convert-to-cart`
  - Convierte cotizacion a carrito ACTIVO y crea notificacion.

### Carrito
- POST `/api/ecommerce/cart`
  - Body opcional: `{ "clienteId": "..." }`.

- GET `/api/ecommerce/cart/:id`
- POST `/api/ecommerce/cart/:id/items`
  - Body: `{ "productoId": "...", "cantidad": 2 }`.
- PATCH `/api/ecommerce/cart/:id/items/:itemId`
  - Body: `{ "cantidad": 5 }`.
- DELETE `/api/ecommerce/cart/:id/items/:itemId`
- DELETE `/api/ecommerce/cart/:id/items`

### Pedidos (checkout)
- POST `/api/ecommerce/orders/from-cart/:cartId`
  - Body despacho opcional:
    ```json
    {
      "despacho": {
        "nombre": "Juan",
        "telefono": "+56 9 1234 5678",
        "email": "jp@x.cl",
        "direccion": "Av. 123",
        "comuna": "Santiago",
        "ciudad": "Santiago",
        "region": "RM",
        "notas": "Llamar antes"
      }
    }
    ```
  - Respuesta: `{ "pedidoId": "...", "codigo": "ECP-000001", "total": 12345 }`.

- GET `/api/ecommerce/orders/:id`

### Pagos
- POST `/api/ecommerce/payments`
  - Body:
    ```json
    {
      "pedidoId": "...",
      "metodo": "TRANSBANK",
      "monto": 12345,
      "referencia": "trx-123",
      "evidenciaUrl": "https://...",
      "gatewayPayloadJson": {"raw": true}
    }
    ```
  - Crea EcommercePago con estado PENDIENTE.

- PATCH `/api/ecommerce/payments/:id/confirm`
- PATCH `/api/ecommerce/payments/:id/reject`

## Ejemplos cURL

### Productos
```
curl -s http://localhost:3000/api/products
```

### Crear cotizacion (quotes)
```
curl -s -X POST http://localhost:3000/api/ecommerce/quotes \
  -H "Content-Type: application/json" \
  -d '{
    "nombreContacto": "Juan Perez",
    "email": "juan@demo.cl",
    "telefono": "+56 9 1111 2222",
    "tipoObra": "obra-gruesa",
    "comunaRegion": "Santiago, RM",
    "items": [{"productoId": "PROD_ID", "cantidad": 2}]
  }'
```

### Convertir cotizacion a carrito
```
curl -s -X POST http://localhost:3000/api/ecommerce/quotes/COT_ID/convert-to-cart
```

### Crear carrito
```
curl -s -X POST http://localhost:3000/api/ecommerce/cart \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Agregar item al carrito
```
curl -s -X POST http://localhost:3000/api/ecommerce/cart/CAR_ID/items \
  -H "Content-Type: application/json" \
  -d '{"productoId": "PROD_ID", "cantidad": 1}'
```

### Checkout desde carrito
```
curl -s -X POST http://localhost:3000/api/ecommerce/orders/from-cart/CAR_ID \
  -H "Content-Type: application/json" \
  -d '{"despacho": {"nombre": "Juan"}}'
```

### Crear pago pendiente
```
curl -s -X POST http://localhost:3000/api/ecommerce/payments \
  -H "Content-Type: application/json" \
  -d '{"pedidoId": "PED_ID", "metodo": "TRANSBANK", "monto": 12345}'
```

### Confirmar pago
```
curl -s -X PATCH http://localhost:3000/api/ecommerce/payments/PAGO_ID/confirm
```

### Rechazar pago
```
curl -s -X PATCH http://localhost:3000/api/ecommerce/payments/PAGO_ID/reject
```

## Checklist end-to-end (obligatorio)
- [ ] GET /api/health
- [ ] GET /api/products (ver stock y precios)
- [ ] POST /api/ecommerce/cart (crear carrito)
- [ ] POST /api/ecommerce/cart/:id/items (upsert + merge)
- [ ] PATCH /api/ecommerce/cart/:id/items/:itemId (actualizar cantidad)
- [ ] DELETE /api/ecommerce/cart/:id/items/:itemId (eliminar item)
- [ ] POST /api/ecommerce/quotes (crear cotizacion)
- [ ] POST /api/ecommerce/quotes/:id/convert-to-cart
- [ ] POST /api/ecommerce/orders/from-cart/:cartId
- [ ] POST /api/ecommerce/payments
- [ ] PATCH /api/ecommerce/payments/:id/confirm
- [ ] PATCH /api/ecommerce/payments/:id/reject
- [ ] Validar registros en DB con Prisma Studio