# Backend ecommerce COVASA

## Variables de entorno relevantes
- `DATABASE_URL`: conexion PostgreSQL.
- `IVA_PCT`: porcentaje IVA (default 19).
- `ECOMMERCE_VALIDAR_STOCK`: `true` para validar stock al crear pedido.
- `CORS_ALLOW_ALL`: `true` para permitir todos los origenes.
- `ALLOWED_ORIGINS`: lista separada por comas.
- `ECOMMERCE_SALT_ROUNDS`: rounds bcrypt para usuarios ecommerce (default 10).

### Transbank (Webpay Plus)
- `TRANSBANK_ENV`: `integration` | `production`.
- `TRANSBANK_COMMERCE_CODE`: requerido en produccion.
- `TRANSBANK_API_KEY`: requerido en produccion.
- `TRANSBANK_RETURN_URL`: URL backend que recibe el `token_ws`.
- `ECOMMERCE_FRONT_URL`: URL base del frontend (default `http://localhost:5173`).

### Mercado Pago
- `MERCADOPAGO_ACCESS_TOKEN`: token privado para crear preferencias.

## Endpoints principales

### Productos
- `GET /api/productos` (legacy)
- `GET /api/ecommerce/productos`

### Clientes (solo lectura)
- `GET /api/ecommerce/clientes/:id`

### Usuarios ecommerce
- `POST /api/ecommerce/usuarios/registro`
- `POST /api/ecommerce/usuarios/login`

### Cotizaciones
- `POST /api/cotizaciones` (legacy)
- `POST /api/ecommerce/quotes`
- `GET /api/ecommerce/quotes/:id`
- `POST /api/ecommerce/quotes/:id/convert-to-cart`

### Carrito
- `POST /api/ecommerce/cart`
- `GET /api/ecommerce/cart/:id`
- `POST /api/ecommerce/cart/:id/items`
- `PATCH /api/ecommerce/cart/:id/items/:itemId`
- `DELETE /api/ecommerce/cart/:id/items/:itemId`
- `DELETE /api/ecommerce/cart/:id/items`

### Pedidos
- `POST /api/ecommerce/orders`
- `POST /api/ecommerce/orders/from-cart/:cartId`
- `GET /api/ecommerce/orders/:id`

### Pagos (placeholder)
- `POST /api/ecommerce/payments`
- `GET /api/ecommerce/payments/:id`
- `PATCH /api/ecommerce/payments/:id/confirm`
- `PATCH /api/ecommerce/payments/:id/reject`

### Pagos Transbank
- `POST /api/ecommerce/payments/transbank`
- `POST /api/ecommerce/payments/transbank/return`
- `POST /api/ecommerce/payments/transbank/commit`
- `GET /api/ecommerce/payments/transbank/status/:token`

### Pagos Mercado Pago
- `POST /api/ecommerce/payments/mercadopago`

## Flujo Transbank (backend)
1) Crear pedido (por ejemplo desde carrito) via `POST /api/ecommerce/orders`.
2) Iniciar pago Transbank:
   - Navegador envia `POST /api/ecommerce/payments/transbank` (form POST).
   - Respuesta: HTML que auto-redirige a Webpay (token no visible).
   - Si se usa API JSON, la respuesta incluye `{ pagoId, url, monto }` sin token.
3) Transbank redirige a `TRANSBANK_RETURN_URL` con `token_ws`.
4) Backend confirma (commit) y redirige al front:
   - `/pago/transbank?pagoId=...&pedidoId=...&estado=CONFIRMADO|RECHAZADO|ERROR`
5) Front consulta `GET /api/ecommerce/payments/:id` para boleta/recibo.

## Flujo Mercado Pago (backend)
1) Crear pedido (por ejemplo desde carrito).
2) Iniciar pago Mercado Pago:
   - `POST /api/ecommerce/payments/mercadopago` con `{ pedidoId }`.
   - Respuesta incluye `{ preferenceId, redirectUrl }`.
3) Redirigir al usuario a `redirectUrl`.
4) Mercado Pago devuelve al front `/pago/mercadopago?status=...`.

## Ejemplos cURL

### Registrar usuario
```bash
curl -X POST "http://localhost:3000/api/ecommerce/usuarios/registro" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Juan Perez","email":"juan@correo.cl","password":"Secreto123"}'
```

### Login usuario
```bash
curl -X POST "http://localhost:3000/api/ecommerce/usuarios/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"juan@correo.cl","password":"Secreto123"}'
```

### Iniciar pago Transbank (JSON)
```bash
curl -X POST "http://localhost:3000/api/ecommerce/payments/transbank" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"pedidoId":"PEDIDO_ID"}'
```

### Estado Transbank
```bash
curl -X GET "http://localhost:3000/api/ecommerce/payments/transbank/status/TOKEN_WS"
```

### Obtener boleta/recibo
```bash
curl -X GET "http://localhost:3000/api/ecommerce/payments/PAGO_ID"
```

### Iniciar pago Mercado Pago
```bash
curl -X POST "http://localhost:3000/api/ecommerce/payments/mercadopago" \
  -H "Content-Type: application/json" \
  -d '{"pedidoId":"PEDIDO_ID"}'
```
