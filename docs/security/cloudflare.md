# Cloudflare

## Objetivo

Documentar el estado real de la configuración de Cloudflare para `raeyz.com`, las decisiones tomadas, los errores encontrados durante la validación y los pendientes para futuras iteraciones.

## Estado actual

### Base de Cloudflare validada

- DNS principal en modo **proxied**
- **Always Use HTTPS** habilitado
- **Automatic HTTPS Rewrites** habilitado
- SSL/TLS en **Full (strict)**
- **Bot Fight Mode** habilitado
- baseline de protección revisada:
  - managed ruleset
  - HTTP DDoS protection
  - network-layer DDoS protection
  - SSL/TLS DDoS protection
  - Browser Integrity Check

## Reglas activas

### Custom rules

#### `protect-admin-panel`

- Match:

```txt
(http.request.uri.path eq "/panel" or starts_with(http.request.uri.path, "/panel/"))
```

- Acción: `Managed Challenge`
- Estado: **Activa**
- Motivo: endurecer la entrada humana al panel administrativo sin tocar APIs internas del panel.

### Rate limiting rules

#### `rate-limit-intento-pago`

- Match: `URI Path equals /api/ecommerce/intento-pago`
- Característica: `IP`
- Umbral: `2 requests`
- Ventana: `10 seconds`
- Acción: `Block`
- Duración: `10 seconds`
- Estado: **Activa**
- Motivo: agregar una capa edge a una de las rutas más sensibles del checkout dentro del límite del plan Free.

## Reglas desactivadas

### `protect-admin-api`

- Match:

```txt
starts_with(http.request.uri.path, "/api/panel/")
```

- Acción configurada: `Managed Challenge`
- Estado: **Disabled**

## Error encontrado y resolución

### Problema

Al aplicar `Managed Challenge` sobre `/api/panel/*`, las vistas de productos y pedidos del panel dejaron de cargar.

### Causa

Las rutas `/api/panel/*` son consumidas desde el navegador mediante `fetch()` y esperan respuestas técnicas limpias (JSON).

El challenge interactivo funciona para navegación humana sobre páginas, pero puede interrumpir llamadas AJAX/API, devolviendo una respuesta no compatible con el flujo esperado por el frontend.

### Evidencia observada

- `/panel` seguía cargando
- `/panel/productos` mostraba error al cargar productos
- `/panel/pedidos` mostraba error al cargar pedidos

### Resolución

- mantener `Managed Challenge` solo en `/panel`
- desactivar `protect-admin-api`
- validar nuevamente el panel

### Resultado

El panel volvió a funcionar correctamente con esta combinación:

- `/panel` protegido con challenge
- `/api/panel/*` sin challenge interactivo

## Decisiones tomadas

### 1. Proteger la entrada humana del panel, no las APIs internas con challenge

Se priorizó proteger `/panel` en el edge y evitar romper las APIs administrativas consumidas por `fetch()`.

### 2. Priorizar `intento-pago` como única rate limiting rule de Cloudflare Free

El plan Free solo permitió una regla de rate limiting. Se eligió `/api/ecommerce/intento-pago` por ser una superficie de abuso más sensible que `pedido` o `mi-cuenta/direccion`.

### 3. Apoyarse en backend para el resto de rutas sensibles

Se decidió dejar bajo protección de aplicación las rutas:

- `/api/ecommerce/pedido`
- `/api/ecommerce/mi-cuenta/direccion`
- `/api/webhooks/mercadopago`

## Relación con el backend

El repo ya tiene controles relevantes que complementan Cloudflare:

- validación de sesión/auth en endpoints críticos
- validación de `Origin` en rutas sensibles de ecommerce
- rate limiting en aplicación (`src/lib/apiSecurity.ts`)
- RPCs con control transaccional para pedido e intento de pago
- webhook de Mercado Pago con:
  - validación de firma
  - deduplicación
  - idempotencia
  - auditoría operativa

## Limitaciones actuales

### Plan Free de Cloudflare

- solo permite **1 rate limiting rule**
- no alcanza para cubrir con reglas dedicadas todas las rutas sensibles del ecommerce

## Próximos pasos recomendados

### Corto plazo

- mantener esta configuración estable
- observar eventos de Cloudflare sobre `/panel`
- validar periódicamente que checkout y panel sigan funcionando normal

### Mediano plazo

- endurecer `/api/panel/*` con estrategia **no interactiva**:
  - rate limiting
  - señales de riesgo
  - protección más cerrada si el negocio lo justifica

### Si se sube de plan

Agregar rate limiting dedicado para:

- `/api/ecommerce/pedido`
- `/api/ecommerce/mi-cuenta/direccion`

## Referencias

- `src/lib/apiSecurity.ts`
- `src/pages/api/panel/pedidos.ts`
- `src/pages/api/panel/pedidos/[id].ts`
- `src/pages/api/panel/productos.ts`
- `src/pages/api/ecommerce/intento-pago.ts`
- `src/pages/api/ecommerce/pedido.ts`
- `src/pages/api/ecommerce/mi-cuenta/direccion.ts`
- `src/pages/api/webhooks/mercadopago/index.ts`
