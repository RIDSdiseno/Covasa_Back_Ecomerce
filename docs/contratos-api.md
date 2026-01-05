# Contratos API (e-commerce)

Base URL: `/api`

## Respuesta estandar
```json
{
  "ok": true,
  "data": {},
  "message": "string",
  "details": {}
}
```

## GET /api/productos
Listado de productos del CRM con stock agregado.

Query params:
- `q` (opcional): busqueda por nombre.
- `tipo` (opcional): `Producto` | `Servicio`.
- `limit` (opcional, max 200)
- `offset` (opcional)

Response `data[]`:
```json
{
  "id": "string",
  "sku": "string|null",
  "nombre": "string",
  "descripcion": "string",
  "unidad": "string",
  "fotoUrl": "string|null",
  "tipo": "Producto",
  "precioNeto": 0,
  "precioLista": 0,
  "precioConDescuento": 0,
  "stockDisponible": 0
}
```

## GET /api/productos/:id
Detalle de producto.

Response `data`:
```json
{
  "id": "string",
  "sku": "string|null",
  "nombre": "string",
  "descripcion": "string",
  "unidad": "string",
  "fotoUrl": "string|null",
  "tipo": "Producto",
  "precioNeto": 0,
  "precioLista": 0,
  "precioConDescuento": 0,
  "stockDisponible": 0
}
```

## POST /api/cotizaciones
Registra solicitud de cotizacion + items + notificacion.

Request body:
```json
{
  "contacto": {
    "nombre": "string",
    "empresa": "string",
    "email": "string",
    "telefono": "string",
    "tipoObra": "string",
    "ubicacion": "string"
  },
  "observaciones": "string",
  "ocNumero": "string",
  "carritoId": "string",
  "canal": "WEB",
  "origenRef": "string",
  "fingerprint": "string",
  "items": [
    { "productoId": "string", "cantidad": 1 }
  ]
}
```

Response `data`:
```json
{
  "id": "string",
  "estado": "Recibida",
  "subtotalNeto": 0,
  "ivaPct": 19,
  "ivaMonto": 0,
  "total": 0,
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

Errores relevantes:
- 400: validacion
- 404: productos no encontrados
- 409: cotizacion duplicada
- 429: limite por IP o huella

Notas:
- La deduplicacion usa hash de contacto + items en una ventana de tiempo configurable.
- El rate limit usa IP y/o huella (fingerprint o user-agent).

## POST /api/pagos
Registra pago placeholder (sin integracion real).

Request body:
```json
{
  "solicitudCotizacionId": "string",
  "pedidoId": "string",
  "metodo": "TRANSBANK",
  "monto": 0,
  "moneda": "CLP",
  "referenciaExterna": "string",
  "canal": "WEB",
  "origenRef": "string",
  "payload": {}
}
```
Notas:
- Se requiere `solicitudCotizacionId` o `pedidoId`.

Response `data`:
```json
{
  "id": "string",
  "estado": "Pendiente",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```
