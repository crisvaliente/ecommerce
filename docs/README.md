# Documentación del proyecto ecommerce

## Objetivo

Esta carpeta es la casa oficial de la documentación técnica y operativa del proyecto.

La regla es simple:

- documentación del sistema → `docs/`
- prompts operativos reutilizables → `prompts/opencode/`
- evidencias técnicas y auditorías → `docs/evidencias/`

## Estructura

- `architecture/` — visión del sistema, límites, decisiones y criterios estructurales
- `security/` — Cloudflare, auth, hardening, rate limiting y controles
- `integrations/` — Mercado Pago, Supabase y otros terceros
- `operations/` — continuidad técnica, deploy, runbooks y material operativo
- `evidencias/` — auditorías, pruebas, capturas y evidencia técnica fechada

## Convenciones

### Qué va en `docs/`

- decisiones que hay que poder retomar
- documentación del comportamiento real del sistema
- runbooks operativos
- estrategias de seguridad e integración

### Qué NO va en `docs/`

- prompts reutilizables para asistentes o workflows operativos
- artefactos experimentales temporales
- notas sueltas sin clasificación

## Ubicaciones relevantes clasificadas

- Estándar OAF-TC → `docs/operations/technical-continuity/OAF-TC.md`
- Librería de prompts operativos → `prompts/opencode/` (clasificada desde `docs/operations/ai-prompts/README.md`)
- Evidencia SQL de stock efectivo → `docs/evidencias/sql/b1_contrato_stock.md`

## Regla de mantenimiento

Si aparece nueva documentación, primero se clasifica por dominio y recién después se crea el archivo.
No se agregan nuevas carpetas paralelas sin necesidad.
