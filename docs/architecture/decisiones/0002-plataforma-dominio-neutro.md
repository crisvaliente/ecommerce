# 0002 — La plataforma vive en un dominio neutro, separado de los comercios

- **Estado:** aceptada (2026-11-02)
- **Decidido por:** el dueño del proyecto
- **Complementa:** [0001 — Raeyz es el primer tenant](0001-raeyz-primer-tenant.md)

## Principio

> La plataforma multiempresa es un producto independiente de Raeyz y FG Herramientas. Cada comercio tendrá su dominio; el panel, la autenticación y los webhooks compartirán una infraestructura con identidad propia.

> La solución debe ser configurable y escalable a futuros comercios.

## Contexto

La 0001 definió un solo deploy y una sola base para todas las tiendas, con cada tienda resuelta por su dominio (`empresa_dominio`). Después del Gate 5 el lado del comprador ya sigue esa regla: catálogo, pedido, pago, dirección y registro usan el dominio de la tienda.

Pero `APP_BASE_URL`, que hoy es `https://raeyz.com`, sigue siendo el origen de la plataforma, así que la plataforma depende del dominio de un comercio:

| Qué depende de `APP_BASE_URL` | Dónde |
|---|---|
| Webhook de Mercado Pago de **todas** las tiendas (`notification_url`) | `src/pages/api/ecommerce/intento-pago.ts` |
| Único origen aceptado por las APIs de escritura del panel | `src/lib/apiSecurity.ts` (`validateTrustedOrigin`), usado por `src/pages/api/panel/*` y `src/lib/orderOperationsApi.ts` |
| CSP y variable inyectada en el build | `next.config.ts` |
| Dominio que el bootstrap registra como dominio **de la tienda** configurada | `scripts/bootstrap-instance.mjs` (`resolveCanonicalHostname(APP_BASE_URL)` → `ensureTenantDomain`) |

Además, la identidad visible de la plataforma es la de Raeyz:

- el panel muestra `instanceConfig.store.name` ("Raeyz Admin" en `AdminLayout`, marca en `Sidebar`);
- título, favicon e idioma salen de `instance.config.json` (`_app.tsx`, `_document.tsx`);
- la sesión del navegador se guarda con la clave `raeyz.supabase.auth` (`instanceKey`);
- el login siempre devuelve a `/coleccion` (`getSafeAuthReturn`), una página de tienda.

## Decisión

1. **Tres papeles de dominio, nunca mezclados:**
   - **Dominio de la plataforma** (pendiente de elección y compra): panel y login de administradores de todos los comercios, webhooks y servicios compartidos. **Nunca** se registra en `empresa_dominio`: no es una tienda.
   - **Dominio de cada comercio** (`raeyz.com`, el de FG Herramientas, los futuros): solo catálogo, checkout y cuenta del comprador. Se registra en `empresa_dominio` con un proceso de alta de operador.
   - **Direcciones técnicas** (`*.vercel.app`, previews): no sirven tiendas ni panel productivo.
2. **El cambio de dominio de la plataforma es configuración.** `APP_BASE_URL` conserva su significado ("origen de la plataforma", ya documentado en el README). Mudar la plataforma es cambiar esa variable, conectar el dominio y actualizar Auth y Cloudflare, sin tocar código de cada comercio.
3. **Un solo panel para todos los comercios.** El panel ya decide la empresa por el perfil del administrador (Gate 3), no por el dominio. Un administrador de FG Herramientas entra al panel de la plataforma y solo opera sobre su empresa.
4. **La plataforma tiene identidad propia.** Panel, login y portada del dominio de la plataforma no muestran la marca de un comercio. La marca de cada comercio se resuelve por su dominio (gate "marca por empresa", ya previsto en la 0001).
5. **Los comercios se suman con datos, no con código.** Un comercio nuevo es: empresa, dominio en `empresa_dominio`, redirect URL en Auth, credenciales de cobro (Gate 6) y marca. El proceso queda en un comando de operador y un procedimiento escrito.
6. **El ruteo de webhooks por comercio se diseña en el Gate 6.** Este cambio solo mueve la base del webhook al dominio de la plataforma; cómo identifica el webhook a qué comercio pertenece un pago depende del modelo de credenciales que se elija ahí.

## Alternativas consideradas

- **Mantener `raeyz.com` como dominio de la plataforma.** Cero trabajo hoy, pero contradice el principio: los administradores de otros comercios trabajarían en el dominio de Raeyz y el webhook de todos dependería de un comercio.
- **Panel en el dominio de cada comercio** (`ferreteria.com.uy/panel`). Más trabajo (origen, login y redirect por dominio en el panel) sin ganancia de aislamiento, porque la empresa ya sale del perfil. Se puede revisar si un comercio lo pide.
- **Subdominios de la plataforma para comercios sin dominio propio** (`fg.<plataforma>`). Compatible con esta decisión: el registro acepta cualquier hostname. Queda como opción, no como requisito.

## Tradeoffs

- **A favor:** la plataforma deja de depender de un comercio; sumar un comercio no toca la infraestructura compartida; un solo lugar para proteger el panel y exponer el webhook.
- **En contra:** hay que comprar y operar un dominio más; los administradores de Raeyz cambian la URL del panel; durante la transición conviven dos orígenes y hay que coordinar Cloudflare (el panel protegido, el webhook libre).

## Impacto

- **Gate "plataforma en dominio neutro"** (preparado en `odd/tasks/platform-domain.md`): separar el bootstrap del dominio de tienda, comando de alta de dominio, entrada al panel desde el dominio de la plataforma, identidad neutra en el panel y procedimiento de cambio.
- **Gate 6 (Mercado Pago por comercio):** define la forma del webhook por comercio sobre el dominio de la plataforma.
- **Nada cambia hoy en producción.** El dominio de la plataforma está pendiente de elección y compra.
