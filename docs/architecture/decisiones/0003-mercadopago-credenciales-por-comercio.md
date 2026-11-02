# 0003 — Cada comercio cobra con sus propias credenciales de Mercado Pago, cifradas

- **Estado:** aceptada (2026-11-02)
- **Decidido por:** el dueño del proyecto
- **Complementa:** [0001](0001-raeyz-primer-tenant.md) (punto 4, "Mercado Pago por tienda antes de abrir la tienda #2") y [0002](0002-plataforma-dominio-neutro.md) (los webhooks viven en la plataforma)

## Principio

> Priorizamos el lanzamiento de FG Herramientas, garantizando aislamiento de credenciales, pagos y webhooks entre comercios.

## Contexto

Hoy hay **un solo** `MERCADOPAGO_ACCESS_TOKEN` y **un solo** `MERCADOPAGO_WEBHOOK_SECRET` para toda la plataforma (variables de entorno de Vercel, solo Production). Los usan:

- la creación, recuperación y conciliación de preferencias (`src/pages/api/ecommerce/intento-pago.ts:69,509-552`; `src/lib/mercadoPagoPreference.ts`);
- el webhook, para verificar la firma y para consultar cada pago (`src/pages/api/webhooks/mercadopago/index.ts:125-126,472-491`).

Con eso, una venta de FG Herramientas cobraría en la cuenta de Raeyz, y con dos cuentas el webhook consultaría los pagos de una con el token de la otra.

## Decisión

1. **Credenciales por comercio.** Cada comercio tiene su propio *access token* de Mercado Pago y su propia clave secreta de webhook, de su propia cuenta y aplicación de Mercado Pago. La plataforma nunca cobra a nombre de un comercio con credenciales de otro.
2. **Cifradas en reposo, descifrables solo por el servidor de producción.** Las credenciales se guardan cifradas en la base, en una tabla sin acceso para `anon` ni `authenticated`. La clave para descifrar existe solo en el entorno *Production* de Vercel: ni en previews, ni en desarrollo, ni en los backups. Un backup de la base o una consulta SQL no exponen ningún token.
3. **Sin respaldo global.** Un comercio sin credenciales activas no puede iniciar pagos (falla cerrado). El token global se retira cuando Raeyz pasa al esquema por comercio.
4. **Un webhook por comercio en el dominio de la plataforma.** Cada comercio tiene su propia ruta de webhook; el webhook verifica la firma con la clave de ese comercio, consulta el pago con su token y solo actualiza intentos de pago de esa misma empresa.
5. **Alta por el operador.** Las credenciales las carga el operador de la plataforma con un procedimiento escrito, validándolas contra Mercado Pago antes de guardarlas. Un formulario en el panel queda para más adelante.

## Alternativas consideradas

- **OAuth de Mercado Pago (modelo marketplace).** Cada comercio autoriza a la aplicación de la plataforma, sin entregar su token. Es el camino cuando los comercios se den de alta solos, pero exige una aplicación de plataforma, una URL de retorno fija en el dominio de la plataforma (ADR 0002, todavía sin comprar) y manejo de *refresh tokens*. Queda prevista: el diseño no la impide.
- **Una sola cuenta para todos los comercios.** Descartada: el dinero de un comercio caería en la cuenta de otro.
- **Supabase Vault para guardar los secretos.** Disponible en el proyecto, pero los secretos se descifran dentro de la base, con acceso SQL de servicio. La clave `SUPABASE_SERVICE_ROLE_KEY` está en todo el servidor, así que filtrarla expondría los tokens. Con el cifrado en la aplicación, filtrar la base o un backup no alcanza.

## Tradeoffs

- **A favor:** aislamiento real entre comercios; un backup o una fuga de la base no revela credenciales; agregar un comercio no toca la infraestructura.
- **En contra:** hay que custodiar y rotar una clave más; cada comercio tiene que crear su aplicación en Mercado Pago y entregar sus credenciales al operador; durante la transición de Raeyz conviven la ruta de webhook vieja y la nueva.

## Impacto

- **Gate 6** (diseño en `odd/tasks/mercadopago-per-store.md`): tabla de credenciales, cifrado, carga por el operador, preferencias y webhook por comercio, migración de Raeyz, pagos en curso y pruebas con cuentas sandbox. Implementación pendiente de autorización.
- **Nada cambia hoy en producción.**
