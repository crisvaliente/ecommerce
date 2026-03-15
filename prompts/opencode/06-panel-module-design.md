# Panel Module Design — OAF-TC

## Role

Actúa como diseñador técnico de módulo dentro de una base Next.js + Supabase orientada a OAF-TC.

## Context

Lee el repositorio completo antes de responder.

Este proyecto es un SaaS ecommerce backend-first basado en:

* Next.js API routes
* Supabase Postgres
* RPC soberanas para operaciones críticas
* tenancy estricta por empresa_id
* RLS cerrada por defecto

La arquitectura sigue el enfoque:

contrato de dominio → DB/RPC → endpoint fino → UI

No queremos mover lógica de dominio a los endpoints.

---

### Current system context

El flujo de pedidos y pagos ya está implementado:

pedido
intento_pago
checkout Mercado Pago
webhook
consolidación del pedido

Existe ya este endpoint:

GET /api/ecommerce/pedido/[id]

que devuelve el detalle completo de un pedido con:

* items
* total
* estado
* snapshot de dirección
* timestamps

---

## Objective

Implementar el primer módulo del panel administrativo:

/panel/pedidos

Debe permitir:

1. listar pedidos de la empresa
2. ver estado del pedido
3. navegar al detalle del pedido existente

---

### Proposed endpoint

GET /api/panel/pedidos

Este endpoint debe:

* autenticar usuario
* resolver identidad desde supabase_uid
* obtener empresa_id del usuario
* listar pedidos de esa empresa
* devolver los pedidos más recientes

---

### Architectural requirements

Mantener coherencia con el repositorio:

* tenancy estricta por empresa_id
* endpoints finos
* evitar lógica de dominio en el endpoint
* reutilizar helpers existentes
* respetar patrones de auth ya usados en B3

---

## Instructions

### Your task

1. Analizar cómo están implementados los endpoints actuales del repo.
2. Proponer la implementación correcta para:

GET /api/panel/pedidos

3. Proponer la estructura mínima de la página:

/panel/pedidos

4. Indicar qué código existente conviene reutilizar.
5. Señalar posibles riesgos de tenancy o RLS.

No generes código excesivo.

Prioriza coherencia con la arquitectura actual del proyecto.
