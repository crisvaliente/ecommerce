# Respaldo, restauración y continuidad (plan gratuito de Supabase)

Decisión del 2026-11-02: **no se contrata Supabase Pro; se sigue con el plan gratuito.** El plan gratuito no trae backups gestionados ni recuperación a un momento dado (PITR) y pausa los proyectos con poca actividad. Este documento cubre esos huecos con procedimientos manuales, sin infraestructura permanente.

**Requisito que se mantiene:** antes de una migración que toque datos sensibles (pedidos, pagos, usuarios, credenciales) tiene que existir un backup **restaurado con éxito** en un entorno local. Un backup que nunca se restauró no cuenta.

## 1. Backup

**Cuándo:**

- antes de cada migración en producción (obligatorio);
- una vez por semana mientras la tienda esté abierta;
- antes de cualquier operación manual sobre datos (limpiezas, correcciones).

**Qué** (procedimiento usado el 2026-11-02, carpeta `~/backups/raeyz/AAAA-MM-DD-<motivo>/`, permisos 700 y archivos 600):

| Archivo | Comando o fuente |
|---|---|
| `roles.sql` | `supabase db dump --linked --project-ref <ref> --role-only` |
| `schema.sql` | `supabase db dump --linked --project-ref <ref>` |
| `data.sql` | `supabase db dump --linked --project-ref <ref> --data-only --use-copy` |
| `schema_migrations_versions.txt` | versiones de `supabase_migrations.schema_migrations` (el dump no las incluye) |
| `storage/` | `supabase storage cp -r ss:///producto-imagenes … --experimental --linked` |
| `<funcion>.before.sql` | antes de una migración que redefine funciones: `pg_get_functiondef` de cada una (rollback exacto) |
| `SHA256SUMS` | `sha256sum` de todos los archivos |

Comandos ejecutados desde un directorio fuera del repositorio (por ejemplo `/tmp`), sin `.env` ni claves en archivos.

**Verificación del backup** (siempre, en el momento):

- `sha256sum -c SHA256SUMS`;
- filas por tabla del `data.sql` contra conteos de solo lectura en producción: 0 diferencias;
- versiones del registro de migraciones iguales a las migraciones de `master`;
- archivos de Storage: misma cantidad y tamaño que `storage.objects`.

**Retención y cuidado:** el backup contiene datos personales de compradores. Se conservan los últimos 4 semanales y los previos a cada migración; los demás se borran. Si se copia fuera de la máquina del operador (recomendado: una copia en otro disco o en una nube personal), va cifrado (por ejemplo con `age` o `gpg`). Nunca en el repositorio.

## 2. Restauración

Se restaura en un **stack local temporal y aislado** (proyecto Supabase local con otro `project_id` y otros puertos), nunca sobre producción ni sobre el stack de desarrollo.

Pasos conocidos (aprendidos en el intento del 2026-11-02):

1. Alinear las versiones de servicios con producción: `supabase link --project-ref <ref>` en la carpeta temporal (escribe solo archivos locales en `supabase/.temp`).
2. `roles.sql` sin la línea `ALTER ROLE "supabase_admin" …` (rol reservado).
3. `data.sql` sin `SET transaction_timeout = 0;` (lo escribe `pg_dump` 17; Postgres 15 no lo reconoce).
4. **Abierto:** la carga se corta en `permission denied for table buckets_vectors` (tabla interna de Storage). Próximo intento: ejecutar la restauración conectado como `supabase_admin` (superusuario en la imagen local) en lugar de `postgres`. A verificar.
5. Todo en una sola transacción (`psql --single-transaction -v ON_ERROR_STOP=1`): si falla, no queda nada a medias.

**Restauración verificada** significa:

- 0 diferencias de filas por tabla contra el `data.sql`;
- mismas cantidades de funciones y políticas que producción (`public`, `storage`) y el trigger de `auth.users`;
- el archivo de rollback de funciones aplica sobre la base restaurada;
- la migración pendiente aplica sobre la base restaurada.

Al terminar se borran contenedores, volúmenes y la carpeta temporal.

**Estado al 2026-11-02:** backup `2026-11-02-pre-gate4` íntegro y completo; rollback de la función probado; **restauración completa no verificada** (paso 4). Tiene que quedar resuelta antes de G6-1 (Gate 6), que crea la tabla de credenciales.

## 3. Rollback de una migración

- **Funciones:** aplicar el `<funcion>.before.sql` guardado con el backup (segundos, sin tocar datos). Probado para el Gate 4.
- **Tablas y columnas nuevas:** las migraciones de los gates se diseñan aditivas, así que revertir el código alcanza mientras la estructura nueva no se use.
- **Datos:** solo con la restauración del punto 2; por eso es requisito antes de migraciones sobre datos sensibles.

## 4. Continuidad: pausa del proyecto

El plan gratuito pausa el proyecto tras un período sin actividad; ya pasó dos veces (antes del 06/10 y antes del 02/11). Pausado, la tienda, el panel y el webhook de Mercado Pago no funcionan.

- **Antes de cualquier operación** (backup, migración, prueba): `supabase projects list` (desde fuera del repositorio). Si dice `INACTIVE`, reanudar desde el Dashboard de Supabase → proyecto → *Restore project*; tardó entre 2 y 7 minutos las dos veces, sin pérdida de datos.
- **Con la tienda abierta** el tráfico real debería evitar la pausa, pero no hay garantía documentada. El chequeo semanal del backup incluye mirar el estado del proyecto.
- **Si se pausa con pagos en curso:** Mercado Pago reintenta las notificaciones durante un tiempo; al reanudar, el webhook las procesa (es idempotente). Los pedidos pendientes que vencieron en el medio quedan vencidos; un pago aprobado sobre un pedido vencido se registra como no consolidado y se revisa a mano.
- **Política de Supabase sobre proyectos pausados mucho tiempo** (plazo para reanudarlos, límites de tamaño del plan gratuito): consultar la documentación vigente antes del lanzamiento; no está verificada acá.

No se agrega ningún servicio para mantener el proyecto activo (sin infraestructura permanente).

## 5. Chequeo semanal (10 minutos)

1. Estado del proyecto (`ACTIVE_HEALTHY`).
2. Backup semanal y su verificación (punto 1).
3. Tamaño de la base y de Storage contra los límites del plan.
4. Borrar backups fuera de la retención.
