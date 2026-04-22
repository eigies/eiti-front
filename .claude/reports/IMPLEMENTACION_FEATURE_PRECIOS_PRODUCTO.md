# Implementación Front: Precios de Producto

Backend ya implementado y migración aplicada.

## Objetivo
Soportar en frontend estos campos de producto:

- `publicPrice` (precio de venta, principal)
- `costPrice` (precio costo)
- `unitPrice` (precio unitario opcional)
- `price` (alias legacy de `publicPrice`)

## Endpoints impactados

- `POST /api/products`
- `PUT /api/products/{id}`
- `GET /api/products`
- `GET /api/products/paged`
- `GET /api/stock?branchId=...`
- `GET /api/stock/product/{productId}?branchId=...`

## Request (alta/edición de producto)

Campos:

- `code`, `sku`, `brand`, `name`, `description?`
- `publicPrice?`
- `price?` (legacy)
- `costPrice` (obligatorio)
- `unitPrice?` (opcional)

Reglas backend:

1. Debe venir `publicPrice` o `price`.
2. Si vienen ambos, deben ser iguales.
3. Ningún precio puede ser negativo.

## Response (productos y stock)

Ahora devuelve:

- `price`
- `publicPrice`
- `costPrice`
- `unitPrice`

En frontend usar `publicPrice` como precio comercial visible.

## Reglas UI

1. Mostrar/usar `publicPrice` para venta y catálogo.
2. `costPrice` mostrar solo a roles `owner` y `admin`.
3. `unitPrice` editable opcional para packs.
4. Mantener compatibilidad temporal con `price` en componentes legacy.

## Venta

- No cambió payload de venta por este feature.
- La venta debe trabajar con el precio público del producto (`publicPrice`).

## Roles para ocultar costo

Tomar roles desde `GET /api/users/me` (`roles`):

- `owner`
- `admin`

Si el usuario no tiene esos roles, ocultar `costPrice`.

## Ejemplo payload recomendado

```json
{
  "code": "BAT-001",
  "sku": "BAT-001",
  "brand": "Contoso",
  "name": "Bateria 65Ah",
  "description": "Opcional",
  "publicPrice": 100000,
  "costPrice": 70000,
  "unitPrice": 50000
}
```

