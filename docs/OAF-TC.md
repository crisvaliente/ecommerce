# 🧬 OAF-TC — Operativa Atlas Flow (Technical Continuity)
**Versión:** v1.0  
**Estado:** Interno (uso operativo)

---

## 🎯 Propósito

Definir un estándar interno de continuidad técnica para el proyecto SaaS ecommerce.

Este estándar organiza cómo:

- Se retoman sesiones
- Se cierran bloques
- Se validan cambios estructurales
- Se promueven migraciones a producción

No es documentación pública.  
Es marco operativo interno.

---

# 1️⃣ DELTA OPERATIVO (DO)

## Uso
Continuar desarrollo técnico entre sesiones.

## Objetivo
Retomar exactamente el estado estructural sin ruido narrativo.

## Estructura obligatoria

```markdown
🧷 DELTA OPERATIVO — [Módulo]

📍 Proyecto
Stack:
ADN vigente:

🧱 Infra relevante (si aplica)

🧬 Estado actual del módulo
- Tablas involucradas
- Migraciones activas
- Invariantes vigentes
- Triggers
- RLS (si aplica)

🔎 Hallazgos abiertos

🎯 Próximo paso inmediato
Reglas

Debe ser compacto.

Solo estado técnico.

Sin roadmap largo.

Sin narrativa emocional.

2️⃣ ANCLA TÉCNICA (AT)
Uso

Cerrar una sección o bloque técnico.

Objetivo

Dejar registro claro de qué quedó sólido y qué quedó pendiente.

Estructura
🧷 ANCLA TÉCNICA — [Sección]

📍 Contexto

✅ Lo implementado
- Cambios reales
- Migraciones
- Decisiones estructurales

⚠️ Lo detectado
- Riesgos
- Deuda técnica
- Ajustes futuros

📌 Estado final del sistema

🎯 Próxima sección
Reglas

Más descriptiva que el DO.

Debe dejar claro el estado final real.

No debe mezclar planificación extensa.

3️⃣ CHECKPOINT PRE-RELEASE (CPR)
Uso

Antes de aplicar cambios estructurales relevantes (ej: db push).

Incluye validaciones obligatorias

supabase migration list

supabase db diff

Constraints verificadas

Invariantes revisadas

RLS revisada

Smoke tests definidos

Plan de rollback mental

Regla

No se hace push estructural sin CPR.

4️⃣ CHECKPOINT PRE-PROD (CPP)
Uso

Antes de impactar producción real.

Incluye

Variables de entorno verificadas

Migraciones alineadas

Grants confirmados

Policies activas

RPC probadas

Endpoint crítico smoke testeado

Confirmación de idempotencia

Regla

Máxima rigurosidad.
No se asume nada.

🧠 Regla Madre

DO → continuidad

AT → cierre

CPR → promoción técnica

CPP → impacto real

No se mezclan capas.

📌 Alcance Actual

Este estándar es:

Interno

Operativo

Flexible

Ajustable con el uso

Se refina con la práctica.