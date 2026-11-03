# Salida a producción: Mercado Pago por comercio (G6-1 + G6-2)

Procedimiento para poner en producción las credenciales de Mercado Pago por comercio (ADR 0003) **sin que ninguna tienda deje de poder cobrar**. Cubre la migración de G6-1 (#53, ya mergeada en `master` como `1fe6514`) y el merge de G6-2 (#55, PR #56). G6-3 (webhook por comercio) no forma parte de esta salida.

**Regla central:** el PR #56 se mergea **al final**. El merge despliega `raeyz.com`, y desde ese momento `intento-pago` solo usa las credenciales de la tabla. Si Raeyz no tiene su fila cargada y la clave privada no está en Vercel Production, Raeyz responde `409 pagos_no_configurados` o `503 pagos_no_disponibles` y no puede cobrar.

Cada paso necesita el OK explícito del dueño del proyecto. Si un chequeo falla, **se detiene** y se vuelve al rollback de ese paso; no se sigue "a ver qué pasa".

Datos fijos: proyecto Supabase `tdzlbwjcpdwlidniyhdd`; proyecto Vercel `ecommerce-5vlw` (equipo `crisvalientes-projects`); migración `20261103120000_mercadopago_per_store_credentials`; variable `MP_CREDENTIALS_PRIVATE_KEY_V1`.

## Paso 0 — Condiciones previas (solo lectura)

1. Proyecto activo: `supabase projects list` (desde fuera del repositorio) muestra `Raeyz … ACTIVE_HEALTHY`. Si está `INACTIVE`, reanudar desde el Dashboard antes de seguir.
2. Registro de migraciones de producción: **76** entradas, la última `20261029120000`.
3. `0` pedidos `pendiente_pago` vigentes y `0` sesiones activas ajenas (mismas consultas que la verificación previa del Gate 4).
4. PR #56 en verde (`CLEAN`) y sin cambios desde la última verificación.
5. Token actual de Raeyz: confirmar en el panel de desarrolladores de Mercado Pago que la aplicación de Raeyz usa credenciales **de producción** (el token empieza con `APP_USR-`, no `TEST-`). Es el ítem abierto "Confirmar el token de Mercado Pago" de `lanzamiento-raeyz.md`, y define si se carga con `--mode live` o `--mode test`.

## Paso 1 — Backup y restauración verificada

Obligatorio: la migración toca `intento_pago` y `webhook_recepcion_mp`.

- Backup completo según `respaldo-y-continuidad.md`, punto 1, en `~/backups/raeyz/AAAA-MM-DD-pre-g6/`, **incluido** `managed-schema-objects.sql`.
- Restauración verificada según el punto 2 en un stack local aislado: 0 diferencias de filas, funciones, políticas y trigger iguales a producción, el trigger crea el perfil, **y** la migración `20261103120000` aplica sobre la base restaurada.

**Si falla:** no se sigue. Nada cambió en producción.

## Paso 2 — Migración de G6-1

Desde un worktree limpio de `master` (sin `.env.local`):

1. `supabase db push --linked --project-ref tdzlbwjcpdwlidniyhdd --dry-run`: tiene que listar **solo** `20261103120000_mercadopago_per_store_credentials.sql`. Si lista otra cosa, detenerse.
2. `supabase db push --linked --project-ref tdzlbwjcpdwlidniyhdd`.
3. Verificación posterior (solo lectura, dentro de `begin transaction read only … rollback`):
   - registro de migraciones en **77**, la última `20261103120000`;
   - `public.empresa_mercadopago` existe, con RLS activo **y forzado**, 0 políticas, y 0 filas;
   - `has_table_privilege`: `service_role` solo `select`; `anon` y `authenticated` sin acceso;
   - `intento_pago.mp_user_id` y `webhook_recepcion_mp.empresa_id` existen y están en `null` en todas las filas;
   - conteos de `pedido`, `pedido_item`, `intento_pago`, `usuario` y `auth.users` iguales al backup.
4. Cerrar el issue #53 con esta evidencia.

**Efecto en la tienda:** ninguno. El código desplegado (`master`) no usa la tabla todavía.

**Rollback:** no hace falta revertirla para volver atrás: es aditiva y el código no la usa. Si se quisiera quitar, va una migración nueva que la elimine; no se edita la migración aplicada.

## Paso 3 — Par de claves de la plataforma

En la máquina del operador, **fuera del repositorio**:

1. `mkdir -m 700 ~/secrets/ecommerce-platform` (o la ruta elegida).
2. `pnpm mp:credentials keygen --out-dir ~/secrets/ecommerce-platform --key-version 1` → crea `mercadopago-credentials-v1.public.pem` (0644) y `mercadopago-credentials-v1.private.pem` (0600).
3. Respaldar la clave **privada** en un lugar separado y cifrado (un gestor de contraseñas o un archivo cifrado con `age`/`gpg`). Si se pierde, las credenciales cargadas no se pueden descifrar y hay que volver a cargarlas con una clave nueva (`key_version` 2).
4. La clave **pública** no es secreta: puede guardarse junto al runbook.

**Rollback:** borrar los dos archivos. Nada cambió fuera de la máquina del operador.

## Paso 4 — Clave privada en Vercel Production

1. `vercel env add MP_CREDENTIALS_PRIVATE_KEY_V1 production --scope crisvalientes-projects < ~/secrets/ecommerce-platform/mercadopago-credentials-v1.private.pem` (solo el entorno **Production**; nunca Preview ni Development).
2. Verificar sin imprimir el valor: la variable existe, con destino únicamente `production` y tipo cifrado.
3. **No redeplegar todavía.** La variable solo se aplica a deploys nuevos; el siguiente es el merge del paso 6.

**Efecto en la tienda:** ninguno; el código actual no lee esta variable.

**Rollback:** borrar la variable en Vercel → Settings → Environment Variables.

## Paso 5 — Credenciales de Raeyz

1. Identificar la empresa de Raeyz (solo lectura): `select empresa_id from public.empresa_dominio where hostname = 'raeyz.com';`.
2. Obtener del panel de desarrolladores de Mercado Pago, en la **misma aplicación** que usa hoy la tienda, el *access token* y la clave secreta del webhook. Tienen que ser los mismos que `MERCADOPAGO_ACCESS_TOKEN` y `MERCADOPAGO_WEBHOOK_SECRET`: el webhook actual los sigue usando hasta G6-3, y la cuenta tiene que coincidir.
3. Cargar en forma **interactiva**, para que los secretos no queden en el historial del shell:

   ```bash
   pnpm mp:credentials set --empresa <empresa-id-de-raeyz> --mode live --key-version 1 \
     --public-key-file ~/secrets/ecommerce-platform/mercadopago-credentials-v1.public.pem \
     --target linked --project-ref tdzlbwjcpdwlidniyhdd
   ```

   Pegar el token, Enter, la clave secreta, Enter, y cerrar con **Ctrl-D**. Usar `--mode test` solo si el paso 0.5 mostró credenciales de prueba.
4. La salida debe mostrar solo el id de empresa, `mp_user_id`, `live_mode: true`, `key_version: 1` y una ruta `/api/webhooks/mercadopago/<clave>`. **Esa ruta todavía no se configura** en Mercado Pago: es para G6-3.
5. Verificación (solo lectura): una fila para la empresa de Raeyz, `estado = 'activo'`, `live_mode = true`, `key_version = 1`, y `access_token_enc` / `webhook_secret_enc` que empiezan con `v1:`. Nunca se imprime el contenido cifrado.

**Efecto en la tienda:** ninguno todavía; el código actual sigue usando la variable global.

**Rollback:** `delete from public.empresa_mercadopago where empresa_id = '<empresa-id-de-raeyz>';` (no hay pagos que dependan de la fila mientras G6-2 no esté desplegado).

## Paso 6 — Merge del PR #56 (G6-2)

1. Merge con *merge commit*, atado a la punta verificada del PR (`--match-head-commit`).
2. Esperar el deploy de producción (Ready, alias `raeyz.com`).
3. Smoke sin login sobre la URL del deploy: `/` 200, APIs del panel 401, webhook GET 405, `POST /api/ecommerce/pedido` sin datos 404 `tienda_no_encontrada` (la URL técnica no es una tienda).
4. Smoke con login de admin de Raeyz (pasando Cloudflare Access): `/panel/payments` muestra **"Pagos configurados (modo real)"**. Ojo: el panel solo lee el estado guardado, **no descifra**; no prueba que la clave privada esté bien cargada.
5. Prueba de descifrado, **recomendada y con OK aparte**: en `raeyz.com`, iniciar un pago hasta la redirección a Mercado Pago, sin pagar. Es la única prueba de que el servidor descifra el token: si responde `503 pagos_no_disponibles`, falta la variable o no corresponde a la clave pública usada en el paso 5. Si llega a Mercado Pago, la preferencia se creó con la cuenta de Raeyz y el intento queda marcado con su `mp_user_id`. Crea un pedido y un intento de pago reales que después vencen.
6. Cerrar el issue #55 con la evidencia.

**Si el smoke falla** (por ejemplo, `503 pagos_no_disponibles` al iniciar el pago): Vercel → Deployments → *Instant Rollback* al deploy anterior, que vuelve en segundos al token global. Después se diagnostica (variable faltante, `key_version`, fila de Raeyz) sin apuro.

## Después de la salida

- El webhook sigue verificando con `MERCADOPAGO_WEBHOOK_SECRET` y consultando con `MERCADOPAGO_ACCESS_TOKEN` hasta G6-3. **No borrar** esas variables: se retiran 30 días después de que la ruta vieja deje de recibir avisos (D6-b).
- FG Herramientas se suma cuando exista su dominio, su empresa y su aplicación de Mercado Pago, con el mismo paso 5 (`--empresa <id-de-fg>`). Hasta G6-3, sus pagos se crearían con su token, pero el webhook todavía no podría consultarlos: **FG no abre al público antes de G6-3**.
- Actualizar `lanzamiento-raeyz.md` y el documento del gate con lo hecho.
