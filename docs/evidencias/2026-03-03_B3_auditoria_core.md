# 📎 Evidencia Técnica — B3 Core Auditoría Estructural

**Fecha:** 2026-03-03  
**Módulo:** B3 — Pedidos (Core transaccional)  
**Contexto:** Auditoría con evidencia en Supabase Studio local antes de avanzar con `intento_pago`.

---

## 🎯 Objetivo

Validar el estado estructural real de las tablas `pedido` y `pedido_item` en base de datos local y detectar inconsistencias antes de continuar el desarrollo.

---

## 🔎 Evidencia Técnica

### Estado observado — Tabla `pedido`

- `empresa_id` → NOT NULL
- `total` → NOT NULL
- `direccion_envio_snapshot` → jsonb NOT NULL
- `expira_en` → timestamptz NOT NULL
- `bloqueado_por_stock` → boolean NOT NULL default false
- `estado` → enum `pedido_estado`, nullable, default `'pendiente_pago'`
- `creado_en` → timestamptz NOT NULL (sin default)
- `actualizado_en` → timestamptz NOT NULL (sin default)
- `fecha_pedido` → timestamp without time zone, nullable, default now()

#### Constraints detectadas

- PK (id)
- FK usuario → ON DELETE CASCADE
- FK direccion_envio_id → ON DELETE SET NULL
- FK duplicada direccion_envio_id (sin SET NULL)
- CHECK `bloqueado_por_stock = true ⇒ estado = 'bloqueado'`

#### Triggers

- No existen triggers en `pedido`.

---

### Estado observado — Tabla `pedido_item`

- `pedido_id` → NOT NULL + FK CASCADE
- `empresa_id` → NOT NULL
- Snapshot fuerte (`nombre_producto`, `precio_unitario`)
- `cantidad` → CHECK (cantidad > 0)
- `subtotal` → nullable, sin default visible
- FK `producto_id` → ON DELETE SET NULL
- FK `variante_id` → ON DELETE SET NULL

#### Triggers detectados

- `trg_pedido_item_assert_empresa_match`
  - BEFORE INSERT OR UPDATE
  - Asegura coherencia `empresa_id` ↔ empresa del pedido

---

## ⚠️ Hallazgos

1. Existe FK duplicada en `pedido.direccion_envio_id`.
2. `pedido.estado` es nullable (riesgo para máquina de estados).
3. `creado_en` y `actualizado_en` no tienen default ni trigger.
4. `subtotal` no está garantizado por DB (no se detectó trigger asociado).
5. `fecha_pedido` podría ser redundante frente a `creado_en`.

---

## ✅ Decisiones Tomadas

- Realizar migración **B3 Core Patch** antes de continuar con `intento_pago`.
- Incluir en el patch:
  - Eliminación de FK duplicada.
  - `estado` → NOT NULL.
  - Definición clara de contrato para timestamps.
- No realizar `supabase db push` a PROD hasta cerrar patch.

---

## 📌 Estado Final del Sistema (Post-Auditoría)

B3 Core estructuralmente sólido pero requiere blindaje mínimo antes de continuar con modelado de pagos.

Infra local estable.  
Migraciones versionadas.  
Auditoría realizada con evidencia en DB.

---

## 🔜 Próximo Paso

Implementar migración **B3 Core Patch** con fixes mínimos estructurales y re-auditar antes de avanzar con `intento_pago`.