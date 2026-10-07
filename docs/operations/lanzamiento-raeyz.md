# Lanzamiento de Raeyz — pendientes

Estado al 2026-10-07. Gate 3 está cerrado y desplegado: PR #44, merge `b476925`, base de producción con 75 migraciones. `raeyz.com` sigue cerrado con Cloudflare Access a propósito.

Marcá cada ítem cuando esté hecho y verificado.

## 1. Bloqueantes para abrir al público

### Infraestructura

- [ ] **Supabase en plan pago (Pro).** El plan gratis pausa la base después de unos días sin uso; ya pasó antes del 06/10 y la tienda queda caída. El plan pago además trae backups diarios: hoy no hay ninguno, solo el backup manual del 30/09 en `~/backups/raeyz/`, que nunca se probó restaurando.
  *Dónde:* Dashboard de Supabase → proyecto Raeyz → Billing.
- [ ] **Webhook de Mercado Pago.** Cloudflare Access también bloquea `/api/webhooks/mercadopago`, así que hoy ningún pago real se consolidaría. Al abrir la tienda: sacar Access, o dejarlo y agregar una excepción para esa ruta.
  *Dónde:* Cloudflare → Zero Trust → Access → Applications.
- [ ] **`www.raeyz.com`.** Resuelve a Cloudflare pero no está conectado a la tienda. Configurar una redirección de `www` a `raeyz.com`.
  *Dónde:* Cloudflare → Rules → Redirect Rules.
- [ ] **Conexión Cloudflare → Vercel.** Vercel avisa "dominio no configurado" porque Cloudflare está en el medio. Verificar SSL en "Full (strict)" y probar la tienda abierta.
  *Dónde:* Cloudflare → SSL/TLS; Vercel → Settings → Domains.
- [ ] **Renovación automática del dominio** (vence el 2027-04-12).
  *Dónde:* Cloudflare → Domain Registration.
- [ ] **Proteger los previews de Vercel.** Hoy son públicos y usan la base de producción y el token real de Mercado Pago.
  *Dónde:* Vercel → Settings → Deployment Protection.

### Pagos y checkout

- [ ] **Deriva del checkout en producción.** `crear_pedido_con_items` no rechaza variantes sin stock: el cliente paga y el pedido queda bloqueado al consolidar. Necesita una migración que alinee la función con el repo (el archivo `20260331120000` se editó después de aplicarse).
- [ ] **Confirmar el token de Mercado Pago** (de producción y no de sandbox) y separar credenciales de preview y producción.
- [ ] **Prueba completa de compra** con el checkout de prueba de Mercado Pago: pedido, pago, webhook, consolidación y descuento de stock.

### Validación

- [ ] **Prueba en `raeyz.com` con Google,** con el deploy nuevo: login, panel, y crear, editar y borrar un producto de prueba.
- [ ] **Login con Google en previews:** necesita `APP_BASE_URL` por entorno en Vercel y la URL del preview en las redirect URLs de Supabase Auth. No bloquea la tienda, pero hoy impide probar ramas antes del merge.

## 2. Antes de sumar la tienda #2

Ver `docs/architecture/decisiones/0001-raeyz-primer-tenant.md`.

- [ ] Mercado Pago por empresa.
- [ ] Marca por empresa en la base (en lugar de `instance.config.json`).
- [ ] Proceso de alta de dominio (Vercel + Cloudflare + `empresa_dominio`).
- [ ] Proyecto de staging en Supabase para pruebas y previews.

## 3. Deuda técnica

### Panel

- [ ] `ProductForm`: pasar producto, variantes e imágenes a la API del panel. Hoy escribe desde el navegador, protegido por RLS. El borde de la imagen principal no es atómico.
- [ ] Bugs de UI que ya existían:
  - el slug de categoría se queda con la primera letra;
  - "Stock disponible hoy" no se actualiza después de guardar;
  - el nombre de usuario en el header de la tienda sale blanco sobre beige.

### Tests

- [ ] Arreglar los dos tests de base con falla conocida:
  - borrar Storage por la API en la limpieza de `panel-catalog-storage-db`;
  - aceptar el `P0001` del trigger legacy, o decidir si el trigger se queda.
- [ ] Un script único que corra toda la suite. Hoy no hay CI; `profile-backfill-db` tiene que correr solo.

### Base y datos

- [ ] Una sola versión del CLI de Supabase: el repo fija `2.67.2` y el entorno local usa `2.114.0`.
- [ ] Deriva de producción sin migración: estructura de `producto_categoria`, trigger `trg_producto_categoria_misma_empresa`, índices extra.
- [ ] Datos de prueba en producción: EMPRESA_SMOKE con las cuentas "Federico" y "Prueba", 4 organizaciones personales vacías y 3 empresas vacías.
- [ ] Modelo legacy: `membresia`, `ensure_personal_org`, y `empresa.created_by`/`owner_auth` con RESTRICT (bloquean borrar usuarios).

### Código

- [ ] `safeErrorCode` duplicada en 5 archivos, sin filtro de caracteres en las del panel.
- [ ] Páginas legacy: `nuevo-favorito.tsx`, `post.tsx`, `debug/*`, `auth/[...nextauth].ts`.
- [ ] El precio se lee dos veces en `crear_pedido_con_items`.

### Documentación

- [ ] `docs/security/cloudflare.md` dice que el webhook queda protegido por la aplicación, pero hoy Access lo bloquea.
