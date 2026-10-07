# 0001 — Raeyz es el primer tenant de una plataforma multi-tenant

- **Estado:** aceptada (2026-10-07)
- **Decidido por:** el dueño del proyecto

## Contexto

El ecommerce nació como la tienda de Raeyz, pero los Gates 1 a 3 lo convirtieron en una base multi-tenant:

- Gate 1: catálogo y stock aislados por `empresa_id`.
- Gate 2: la tienda se resuelve por dominio (`empresa_dominio`).
- Gate 3: el panel autoriza por empresa y rol en el servidor y en la base.

Lo que todavía es de una sola tienda:

- La marca (nombre, logo, imágenes) sale de `instance.config.json`, que leen 14 archivos.
- Hay un único `MERCADOPAGO_ACCESS_TOKEN` para toda la app.
- Solo `raeyz.com` está registrado como dominio.

## Decisión

1. **Raeyz es el tenant #1**: la primera tienda real de la plataforma. La base de producción es una plataforma compartida, no "la base de Raeyz".
2. **Un solo deploy para todas las tiendas**: un proyecto de Vercel y una base de Supabase. Cada tienda entra por su dominio (`empresa_dominio`).
3. **La marca de cada tienda vive en la base**, por empresa: nombre, descripción, logo, hero, favicon, colores y tipografías de una lista cerrada.
   - Los colores se aplican inyectando las variables CSS que ya usa Tailwind (`--color-primary`, `--color-bg`, etc.); no hace falta recompilar.
   - Los archivos de marca van a Storage, bajo `empresa/{id}/marca/…`.
   - `instance.config.json` queda como valor por defecto de la plataforma y para desarrollo local.
4. **Mercado Pago por tienda antes de abrir la tienda #2.** Cada empresa cobra con su propia cuenta (OAuth de Mercado Pago o credenciales cifradas por empresa). Con el token único actual, las ventas de otra tienda caerían en la cuenta de Raeyz.
5. **Producción no guarda datos de prueba.** Las pruebas van en local, y más adelante en un proyecto de staging.

## Alternativas consideradas

- **Un deploy por tienda con base compartida:** cada tienda con su proyecto en Vercel, su `instance.config` y sus variables. Necesita menos cambios hoy, pero cada tienda nueva implica configurar un deploy, y las correcciones se despliegan N veces.
- **Una base por tienda:** el aislamiento más fuerte, pero multiplica la operación (migraciones, backups, costos) y descarta el trabajo de aislamiento de los Gates 1 a 3.

## Tradeoffs

- **A favor:** una sola base de código y un solo deploy; una tienda nueva se suma con datos (empresa, dominio y marca) en lugar de infraestructura.
- **En contra:** un error de aislamiento afecta a todas las tiendas, así que los controles de los Gates 1 a 3 pasan a ser críticos. Además, la marca deja de ser estática: hay que resolverla por request y cachearla.

## Impacto

- **Antes de la tienda #2:** marca por empresa en la base, Mercado Pago por empresa, y alta de dominio con su proceso (Vercel, Cloudflare y `empresa_dominio`).
- **Para Raeyz hoy:** nada cambia en el código. Lo pendiente para abrir Raeyz está en `docs/operations/lanzamiento-raeyz.md`.
