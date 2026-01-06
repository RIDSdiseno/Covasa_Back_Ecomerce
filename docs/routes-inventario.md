# Inventario de rutas (PASO 1)

Estado:
- LIVE: consumida por front o integraciones
- DEPRECATED: montada pero sin consumo actual identificado
- DEAD: definida pero no montada

## Router principal

| Metodo | Path | Archivo | Handler | Estado |
| --- | --- | --- | --- | --- |
| GET | /api | src/routes/index.ts | inline | LIVE |
| GET | /api/health | src/routes/index.ts | healthCheck | LIVE |
| POST | /api/health/auth | src/routes/index.ts | healthAuth | DEPRECATED |

## Legacy raiz (compat)

| Metodo | Path | Archivo | Handler | Estado |
| --- | --- | --- | --- | --- |
| GET | /api/productos | src/routes/legacy.routes.ts | listarProductos | DEPRECATED |
| GET | /api/productos/:id | src/routes/legacy.routes.ts | obtenerProducto | DEPRECATED |
| GET | /api/products | src/routes/legacy.routes.ts | listarProductos | DEPRECATED |
| GET | /api/products/:id | src/routes/legacy.routes.ts | obtenerProducto | DEPRECATED |
| POST | /api/cotizaciones | src/routes/legacy.routes.ts | crearCotizacion | DEPRECATED |
| POST | /api/pagos | src/routes/legacy.routes.ts | crearPago | DEPRECATED |

## Ecommerce

### Usuarios
| Metodo | Path | Archivo | Handler | Estado |
| --- | --- | --- | --- | --- |
| POST | /api/ecommerce/usuarios/registro | src/modules/ecommerce/routes/usuarios.routes.ts | registrarUsuario | LIVE |
| POST | /api/ecommerce/usuarios/login | src/modules/ecommerce/routes/usuarios.routes.ts | loginUsuario | LIVE |

### Catalogo / productos
| Metodo | Path | Archivo | Handler | Estado |
| --- | --- | --- | --- | --- |
| GET | /api/ecommerce/productos | src/modules/ecommerce/routes/productos.routes.ts | listarProductos | LIVE |
| GET | /api/ecommerce/productos/:id | src/modules/ecommerce/routes/productos.routes.ts | obtenerProducto | DEPRECATED |

### Cotizaciones ecommerce
| Metodo | Path | Archivo | Handler | Estado |
| --- | --- | --- | --- | --- |
| POST | /api/ecommerce/cotizaciones | src/modules/ecommerce/routes/cotizaciones.routes.ts | crearCotizacion | LIVE |
| GET | /api/ecommerce/cotizaciones/:id | src/modules/ecommerce/routes/cotizaciones.routes.ts | obtenerCotizacion | DEPRECATED |
| POST | /api/ecommerce/cotizaciones/:id/convert-to-cart | src/modules/ecommerce/routes/cotizaciones.routes.ts | convertirCotizacionACarrito | DEPRECATED |
| POST | /api/ecommerce/quotes | src/modules/ecommerce/routes/quotes.routes.ts | crearQuote | DEPRECATED |
| GET | /api/ecommerce/quotes/:id | src/modules/ecommerce/routes/quotes.routes.ts | obtenerCotizacion | DEPRECATED |
| POST | /api/ecommerce/quotes/:id/convert-to-cart | src/modules/ecommerce/routes/quotes.routes.ts | convertirCotizacionACarrito | DEPRECATED |

### Carrito
| Metodo | Path | Archivo | Handler | Estado |
| --- | --- | --- | --- | --- |
| POST | /api/ecommerce/carritos | src/modules/ecommerce/routes/carrito.routes.ts | crearCarrito | DEPRECATED |
| GET | /api/ecommerce/carritos/:id | src/modules/ecommerce/routes/carrito.routes.ts | obtenerCarrito | DEPRECATED |
| POST | /api/ecommerce/carritos/:id/items | src/modules/ecommerce/routes/carrito.routes.ts | agregarItemCarrito | DEPRECATED |
| PATCH | /api/ecommerce/carritos/:id/items/:itemId | src/modules/ecommerce/routes/carrito.routes.ts | actualizarItemCarrito | DEPRECATED |
| DELETE | /api/ecommerce/carritos/:id/items/:itemId | src/modules/ecommerce/routes/carrito.routes.ts | eliminarItemCarrito | DEPRECATED |
| DELETE | /api/ecommerce/carritos/:id/items | src/modules/ecommerce/routes/carrito.routes.ts | vaciarCarrito | DEPRECATED |
| POST | /api/ecommerce/cart | src/modules/ecommerce/routes/carrito.routes.ts | crearCarrito | DEPRECATED |
| GET | /api/ecommerce/cart/:id | src/modules/ecommerce/routes/carrito.routes.ts | obtenerCarrito | DEPRECATED |
| POST | /api/ecommerce/cart/:id/items | src/modules/ecommerce/routes/carrito.routes.ts | agregarItemCarrito | DEPRECATED |
| PATCH | /api/ecommerce/cart/:id/items/:itemId | src/modules/ecommerce/routes/carrito.routes.ts | actualizarItemCarrito | DEPRECATED |
| DELETE | /api/ecommerce/cart/:id/items/:itemId | src/modules/ecommerce/routes/carrito.routes.ts | eliminarItemCarrito | DEPRECATED |
| DELETE | /api/ecommerce/cart/:id/items | src/modules/ecommerce/routes/carrito.routes.ts | vaciarCarrito | DEPRECATED |

### Pedidos
| Metodo | Path | Archivo | Handler | Estado |
| --- | --- | --- | --- | --- |
| POST | /api/ecommerce/orders | src/modules/ecommerce/routes/pedidos.routes.ts | crearPedido | LIVE |
| POST | /api/ecommerce/orders/from-cart/:cartId | src/modules/ecommerce/routes/pedidos.routes.ts | crearPedidoDesdeCarrito | DEPRECATED |
| GET | /api/ecommerce/orders/:id | src/modules/ecommerce/routes/pedidos.routes.ts | obtenerPedido | DEPRECATED |
| POST | /api/ecommerce/pedidos | src/modules/ecommerce/routes/pedidos.routes.ts | crearPedido | DEPRECATED |
| POST | /api/ecommerce/pedidos/from-cart/:cartId | src/modules/ecommerce/routes/pedidos.routes.ts | crearPedidoDesdeCarrito | DEPRECATED |
| GET | /api/ecommerce/pedidos/:id | src/modules/ecommerce/routes/pedidos.routes.ts | obtenerPedido | DEPRECATED |

### Pagos
| Metodo | Path | Archivo | Handler | Estado |
| --- | --- | --- | --- | --- |
| POST | /api/ecommerce/payments/mercadopago | src/modules/ecommerce/routes/pagos.routes.ts | crearMercadoPago | LIVE |
| POST | /api/ecommerce/payments/transbank | src/modules/ecommerce/routes/pagos.routes.ts | crearTransbankPago | LIVE |
| POST | /api/ecommerce/payments/applepay-dev/create-intent | src/modules/ecommerce/routes/pagos.routes.ts | crearApplePayDevIntent | LIVE |
| GET | /api/ecommerce/payments/:id | src/modules/ecommerce/routes/pagos.routes.ts | obtenerPagoRecibo | LIVE |
| POST | /api/ecommerce/payments/transbank/return | src/modules/ecommerce/routes/pagos.routes.ts | recibirRetornoTransbank | LIVE |
| GET | /api/ecommerce/payments/transbank/return | src/modules/ecommerce/routes/pagos.routes.ts | recibirRetornoTransbank | LIVE |
| POST | /api/ecommerce/payments/transbank/commit | src/modules/ecommerce/routes/pagos.routes.ts | confirmarTransbankPago | DEPRECATED |
| GET | /api/ecommerce/payments/transbank/status/:token | src/modules/ecommerce/routes/pagos.routes.ts | obtenerEstadoTransbank | DEPRECATED |
| PATCH | /api/ecommerce/payments/:id/confirm | src/modules/ecommerce/routes/pagos.routes.ts | confirmarPago | DEPRECATED |
| PATCH | /api/ecommerce/payments/:id/reject | src/modules/ecommerce/routes/pagos.routes.ts | rechazarPago | DEPRECATED |
| POST | /api/ecommerce/pagos | src/modules/ecommerce/routes/pagos.routes.ts | crearPago | DEPRECATED |
| POST | /api/ecommerce/payments | src/modules/ecommerce/routes/pagos.routes.ts | crearPago | DEPRECATED |

### Clientes
| Metodo | Path | Archivo | Handler | Estado |
| --- | --- | --- | --- | --- |
| GET | /api/ecommerce/clientes/:id | src/modules/ecommerce/routes/clientes.routes.ts | obtenerCliente | LIVE |

### Notificaciones
| Metodo | Path | Archivo | Handler | Estado |
| --- | --- | --- | --- | --- |
| GET | /api/ecommerce/notificaciones | src/modules/ecommerce/routes/notificaciones.routes.ts | listarNotificaciones | DEPRECATED |

## CRM

| Metodo | Path | Archivo | Handler | Estado |
| --- | --- | --- | --- | --- |
| GET | /api/crm/cotizaciones | src/modules/crm/routes/cotizaciones.routes.ts | listarCrmCotizaciones | LIVE |
| GET | /api/crm/cotizaciones/:id | src/modules/crm/routes/cotizaciones.routes.ts | obtenerCrmCotizacion | LIVE |
