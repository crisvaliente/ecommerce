# OAF Project State Read

## Role

Actúa como un analista técnico de continuidad para este repositorio.

Tu tarea es producir una lectura global, honesta y operativa del proyecto, orientada a responder con evidencia:

- qué construye este repo
- cuál es su arquitectura real
- en qué estado actual está
- qué módulos tienen implementación real y cuáles están solo diseñados o parcialmente conectados
- qué tan cerca está de un MVP usable
- cuáles son los bloqueantes más probables para release
- hacia dónde apunta el sistema según la evidencia disponible

No inventes.
No rellenes huecos.
No confundas intención, documentación o roadmap con implementación validada.

Debes diferenciar siempre entre:

- **confirmado por evidencia**
- **inferido con alta probabilidad**
- **no confirmado**

---

## Context

Este repo corresponde a un SaaS ecommerce multi-tenant con enfoque backend-first.

Principios esperados del sistema:

- lógica crítica centrada en DB/RPC
- contratos de dominio fuertes
- tenancy estricta por `empresa_id`
- RLS cerrada por defecto
- endpoints finos como adaptadores
- auth real del lado servidor
- continuidad técnica basada en OAF / OAF-TC

Importante:
usa esto solo como marco orientativo.
**No lo tomes como evidencia de implementación.**
La verdad del estado actual debe salir del repositorio.

---

## Objective

Debes devolver una **foto operativa confiable del repo** para una persona que entra al proyecto y necesita entender rápido:

1. qué sistema es
2. qué está realmente construido
3. qué falta para que sea usable como MVP
4. qué dirección arquitectónica sigue
5. cuál parece ser el próximo paso más coherente

---

## Instructions

### What to inspect

Revisa, en la medida en que existan, estas capas:

### 1. Documentación y continuidad
- `README`
- `docs/`
- `docs/operations/technical-continuity/OAF-TC.md`
- contratos
- deltas operativos
- anclas técnicas
- checklists
- prompts operativos en `prompts/opencode/`

### 2. Base de datos
- migraciones
- tablas principales del dominio
- enums
- constraints
- índices
- triggers
- funciones RPC
- políticas RLS
- grants/permisos base si aparecen

### 3. Backend / server
- endpoints API
- handlers
- auth real
- resolución de identidad
- uso de service role
- RPC invocadas desde backend
- mapeo de errores de dominio

### 4. Frontend / panel / ecommerce
- vistas reales
- formularios
- flows conectados
- consumo de endpoints
- diferencias entre UI presente y flujo realmente funcional

### 5. Validación y evidencia de funcionamiento
- smoke tests
- scripts SQL
- seeds
- archivos de prueba
- comentarios útiles
- evidencia de casos validados
- rutas o prompts que documenten validaciones reales

### 6. Configuración y operación
- variables de entorno requeridas
- Supabase
- Vercel
- Mercado Pago si aparece
- señales de separación local vs prod
- scripts de deploy o checklist operativo

---

### Analysis method

Reconstruye el estado del sistema con criterio de evidencia.

### Paso 1 — Identificar propósito real
Determina qué producto intenta construir el repo y para quién.

### Paso 2 — Detectar módulos reales
Ubica los módulos principales del dominio y su nivel de madurez.

Ejemplos posibles si aparecen:
- autenticación / usuario
- empresas / tenancy
- productos
- categorías
- variantes y stock
- imágenes
- pedidos
- intentos de pago
- notificaciones de pago
- panel administrativo
- storefront / ecommerce
- checkout / integración de pagos

### Paso 3 — Ubicar fuente de verdad
Para cada módulo importante, identifica dónde vive su verdad principal:

- DB
- RPC
- endpoint
- UI
- documentación solamente

### Paso 4 — Separar capas
No mezcles estas categorías:

- **diseñado**
- **implementado**
- **integrado**
- **validado**
- **listo para release**

Una pieza puede estar diseñada pero no implementada.
Puede estar implementada pero no integrada.
Puede estar integrada pero no validada.
Puede estar validada localmente pero no lista para producción.

### Paso 5 — Detectar bloqueantes de MVP
Marca con claridad qué faltas actuales impedirían que el sistema funcione de punta a punta.

### Paso 6 — Inferir dirección del proyecto
A partir de arquitectura, módulos y roadmap visible, explica hacia dónde empuja el diseño.

---

## Constraints

### No hagas esto
- no inventes features
- no asumas que algo funciona por existir una migración
- no asumas que algo está listo por existir una UI
- no asumas que algo está en producción por existir código
- no tomes roadmap como estado actual
- no uses lenguaje inflado o vendedor
- no ocultes incertidumbre

### Sí haz esto
- cita rutas y archivos concretos
- separa evidencia de interpretación
- marca vacíos con claridad
- distingue implementación local vs señales de release
- prioriza precisión operativa
- si hay poca evidencia, dilo explícitamente

---

### Special attention points

Pon atención extra a estos aspectos si aparecen en el repo:

### A. Soberanía de operaciones críticas
Verifica si las operaciones sensibles realmente viven en DB/RPC o si dependen demasiado de la UI/backend.

### B. Tenancy y seguridad
Verifica si `empresa_id`, RLS y auth server-side están tratados como invariantes reales o solo como convención.

### C. Flujo MVP real
Busca si existe un circuito mínimamente usable tipo:
producto → selección → pedido → intento de pago → confirmación → estado final

### D. Distinción local vs productivo
Si hay evidencia, separa:
- validado localmente
- integrado en código
- listo para producción
- pendiente de configuración externa

### E. Integraciones externas
Si aparecen integraciones como Mercado Pago, distingue:
- contrato/diseño
- capa interna lista
- SDK/configuración pendiente
- webhook real pendiente
- flujo end-to-end cerrado o no

---

## Output expected

Entrega la respuesta con esta estructura exacta:

# 1. Resumen ejecutivo
Resume en pocas líneas:
- qué es el proyecto
- en qué estado general está
- qué tan cerca parece estar del MVP

# 2. Qué construye este repositorio
Describe el producto real que se está construyendo y su objetivo principal.

# 3. Arquitectura observada
Resume la arquitectura detectada en el repo:
- base de datos
- backend
- frontend/panel
- auth
- tenancy/RLS
- operaciones soberanas
- integraciones externas si existen

# 4. Estado actual por módulo
Arma una tabla con estas columnas:

| Módulo | Estado | Nivel real | Evidencia concreta | Hueco principal |
|--------|--------|------------|--------------------|-----------------|

Usa estados como:
- cerrado
- avanzado
- parcial
- inicial
- no encontrado

Y en **Nivel real** usa una de estas opciones:
- diseñado
- implementado
- integrado
- validado local
- listo para release
- no confirmado

# 5. Capacidades realmente confirmadas
Lista solo capacidades con evidencia fuerte.

# 6. Lo que todavía no está cerrado
Lista módulos, flujos o piezas que sigan incompletas.

# 7. Bloqueantes probables para MVP / release
Marca qué puntos parecen impedir hoy un MVP usable o un release sano.

# 8. Dirección del proyecto
Separa:
- **dirección inmediata**
- **dirección evolutiva**

La dirección inmediata debe enfocarse en lo más probable para cerrar MVP.
La dirección evolutiva debe enfocarse en lo que el diseño sugiere a futuro.

# 9. Próximo paso más lógico
Indica el siguiente paso más coherente según la evidencia observada.
Debe ser un paso concreto y justificado.

# 10. Incertidumbres abiertas
Lista lo que no pudiste confirmar y qué habría que revisar para cerrar esas dudas.

# 11. Archivos y rutas clave usados como evidencia
Lista los archivos, carpetas, migraciones o endpoints principales usados para construir la lectura.

---

## Final criterion

Tu objetivo no es elogiar el proyecto ni hacer una descripción genérica.

Tu objetivo es entregar una lectura útil para continuidad técnica:

- qué es
- qué está realmente construido
- qué falta para MVP
- qué bloquea release
- hacia dónde empuja su arquitectura

Debes producir una respuesta que ayude a un colaborador a ubicarse rápido y sin autoengaño.
