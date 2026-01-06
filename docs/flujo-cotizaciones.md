# Flujo cotizaciones ecommerce -> CRM

## Diagrama textual

QuotePage (front)
  -> POST /api/ecommerce/cotizaciones
    -> ecommerce cotizaciones service
      -> Prisma transaction
         1) Crear CrmCotizacion (snapshots, OrigenCliente.CLIENTE_ECOMMERCE)
         2) Crear EcommerceCotizacion + items (link crmCotizacionId)
      -> Response { id, codigo, total, estado }
  -> CRM inbox
    -> GET /api/crm/cotizaciones
    -> GET /api/crm/cotizaciones/:id

## Tablas usadas
- EcommerceCotizacion
- EcommerceCotizacionItem
- CrmCotizacion
- Producto (solo lectura para snapshots)

## Notas de dominio
- `CrmCotizacion.origenCliente` se fija en `CLIENTE_ECOMMERCE`.
- No se usa tabla `Cliente` CRM, solo snapshots.

## Endpoints involucrados
- POST /api/ecommerce/cotizaciones
- GET /api/crm/cotizaciones
- GET /api/crm/cotizaciones/:id

## Payload ejemplo (QuotePage -> backend)

```json
{
  "contacto": {
    "nombre": "Juan Perez",
    "email": "juan@obra.cl",
    "telefono": "+56912345678",
    "empresa": "Constructora X",
    "rut": "11.111.111-1",
    "direccion": "Av. Principal 100",
    "mensaje": "Necesito despacho en 72h",
    "tipoObra": "obra-gruesa",
    "ubicacion": "Santiago"
  },
  "items": [
    { "productoId": "prod_1", "cantidad": 10, "observacion": "bolsas" },
    { "productoId": "prod_2", "cantidad": 20 }
  ],
  "origen": "ECOMMERCE",
  "metadata": {
    "userAgent": "Mozilla/5.0",
    "utm": { "utm_source": "google" }
  }
}
```

## Respuesta CRM inbox (ejemplo)

```json
{
  "ok": true,
  "data": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "items": [
      {
        "id": "uuid",
        "crmCotizacionId": "uuid",
        "codigo": "ECQ-000123",
        "createdAt": "2026-01-05T12:00:00.000Z",
        "nombreContacto": "Juan Perez",
        "email": "juan@obra.cl",
        "telefono": "+56912345678",
        "estado": "NUEVA",
        "estadoCrm": "NUEVA",
        "cantidadItems": 2
      }
    ]
  }
}
```

## Respuesta CRM detalle (ejemplo)

```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "crmCotizacionId": "uuid",
    "codigo": "ECQ-000123",
    "origen": "ECOMMERCE",
    "estado": "NUEVA",
    "estadoCrm": "NUEVA",
    "createdAt": "2026-01-05T12:00:00.000Z",
    "contacto": {
      "nombre": "Juan Perez",
      "email": "juan@obra.cl",
      "telefono": "+56912345678",
      "empresa": "Constructora X",
      "rut": "11.111.111-1",
      "direccion": "Av. Principal 100",
      "mensaje": "Necesito despacho en 72h"
    },
    "totales": {
      "subtotalNeto": 80000,
      "iva": 15200,
      "total": 95200
    },
    "items": [
      {
        "id": "item_1",
        "productoId": "prod_1",
        "skuSnapshot": "SKU-001",
        "nombreSnapshot": "Cemento Portland 25 kg",
        "unidadSnapshot": "unidad",
        "cantidad": 10,
        "precioUnitarioNetoSnapshot": 7800,
        "subtotalNetoSnapshot": 78000,
        "ivaPctSnapshot": 19,
        "ivaMontoSnapshot": 14820,
        "totalSnapshot": 92820
      }
    ]
  }
}
```
