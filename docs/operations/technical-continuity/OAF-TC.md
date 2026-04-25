# 🧬 OAF-TC — Operativa Atlas Flow (Technical Continuity)

**Versión:** v2.0  
**Estado:** Interno (uso operativo)

---

## 1. Propósito

OAF-TC existe para mantener continuidad técnica real en un flujo humano + IA.

Su objetivo es evitar:

- pérdida de contexto entre sesiones
- duplicación de estado
- cierres ambiguos
- promoción de cambios críticos sin validación
- confusión entre conversación, memoria, documentación y control operativo

OAF-TC no es una burocracia de plantillas.
No es documentación por obligación.
No es productividad vacía.

Es un protocolo para decidir:

- qué se conversa
- qué se recuerda
- qué se documenta
- qué requiere checkpoint formal

---

## 2. Principio madre

**La evidencia vive antes que la decisión.**  
**La decisión durable vive donde pueda ser encontrada.**  
**Nada crítico se promueve sin validación.**

---

## 3. Núcleo heredado de OAF-TC v1

El modelo original sigue siendo válido en su intención.

### Regla madre original

- **DO** → continuidad
- **AT** → cierre
- **CPR** → promoción técnica
- **CPP** → impacto real

**No se mezclan capas.**

Ese núcleo se mantiene.
Lo que cambia en v2 no es la intención, sino el uso rígido de los artefactos.

---

## 4. Evolución del modelo

OAF-TC v1 nació en un contexto donde la continuidad dependía mucho más de artefactos manuales.

Hoy el flujo de trabajo puede apoyarse también en:

- conversación natural con IA
- memoria persistente (`engram`)
- documentación viva dentro del repo (`docs/`)
- commits coherentes por bloque

Por eso, en v2 los artefactos dejan de ser obligatorios para todo y pasan a ser herramientas que se activan cuando agregan claridad real.

La pregunta central ya no es:

> “¿Qué plantilla tengo que llenar?”

La pregunta correcta es:

> “¿Qué tipo de conocimiento generé y dónde debe vivir para no perder coherencia?”

---

## 5. Regla de ruteo operativo

Cada avance importante debe responder estas 4 preguntas.

### 5.1 ¿Esto todavía se está pensando?
→ **Conversación**

Usar conversación para:

- hipótesis
- exploración
- debugging vivo
- diseño en curso
- lectura de evidencia antes de decidir

La conversación sirve para pensar, no para conservarlo todo.

### 5.2 ¿Esto cambia mi criterio futuro de trabajo?
→ **Memoria persistente**

Usar memoria para:

- patrones reutilizables
- preferencias operativas
- decisiones metodológicas
- deudas técnicas vivas
- restricciones aprendidas

La memoria no debe guardar cada detalle técnico. Debe guardar criterio reusable.

### 5.3 ¿Esto cambia cómo se entiende o se opera el sistema?
→ **Docs del repo**

Usar documentación del repo para:

- arquitectura
- seguridad
- integraciones
- decisiones durables
- configuración validada
- errores conocidos con resolución
- runbooks y operación

Pregunta clave:

> “¿Un futuro operador técnico necesita esto para entender o tocar el sistema?”

Si la respuesta es sí, va a `docs/`.

### 5.4 ¿Esto puede romper datos, auth, pagos, stock, permisos o producción?
→ **Checkpoint formal**

Usar checkpoint para:

- migraciones
- RLS / grants / policies
- RPCs
- auth
- webhooks
- edge / Cloudflare en rutas sensibles
- deploys con variables o dependencias críticas
- cambios con impacto real sobre usuarios o negocio

Pregunta clave:

> “¿Este cambio puede romper confianza, dinero, datos o acceso?”

Si sí, checkpoint formal.

---

## 6. Capa activa

Antes de diagnosticar, decidir o promover un cambio, nombrar la capa activa.

Capas válidas:

- **UI**
- **endpoint**
- **RPC**
- **DB**
- **edge**
- **integración externa**

Si no está clara la capa activa, el razonamiento se contamina y el diagnóstico pierde precisión.

---

## 7. Artefactos vigentes

### 7.1 DO — Delta Operativo

Uso actual:

Continuidad entre sesiones o herramientas cuando existe riesgo real de perder estado.

Usarlo cuando:

- un bloque queda a medio terminar
- hay varias capas involucradas
- hay decisiones abiertas
- cambia la sesión o el entorno de trabajo
- se necesita traer contexto entre herramientas

No usarlo para cada avance mínimo.

Formato sugerido:

```md
## DO — [bloque]

Capa activa:
Estado real:
Evidencia:
Pendiente inmediato:
Riesgo principal:
```

### 7.2 AT — Ancla Técnica

Uso actual:

Cierre de un bloque importante con estado real, evidencia y próximo paso.

Usarla cuando:

- se cierra una feature coherente
- se resuelve un bug importante
- se valida una integración
- se toma una decisión técnica relevante
- se termina una investigación con resultado claro

Formato sugerido:

```md
## AT — [bloque]

Implementado:
Evidencia validada:
Decisión tomada:
Pendiente:
Próximo paso:
Riesgo / cuidado:
Destino durable:
- conversación / memoria / docs / checkpoint
```

### 7.3 CPR — Checkpoint Pre-Release

Uso actual:

Antes de promover cambios técnicos estructurales o sensibles.

Ejemplos:

- migraciones
- contratos de endpoints
- RLS / grants / policies
- RPCs
- auth
- pagos
- stock
- tenancy
- reglas edge que afecten rutas críticas

Formato sugerido:

```md
## CPR — [cambio]

Cambio a promover:
Archivos / migraciones:
Fuente de verdad:
Validaciones locales:
RLS / grants / policies:
Smokes definidos:
Riesgos:
Rollback mental:
Decisión:
```

### 7.4 CPP — Checkpoint Pre-Prod

Uso actual:

Antes de impacto real sobre producción o flujos críticos.

Ejemplos:

- pagos
- stock
- auth
- webhooks
- reglas edge activas
- deploys con riesgo real

Formato sugerido:

```md
## CPP — [impacto]

Cambio:
Entorno:
Variables / env:
DB / migraciones:
Permisos / grants:
Integraciones externas:
Smokes prod:
Observabilidad / logs:
Riesgo de usuario real:
Decisión final:
```

### 7.5 ADR-Mini

Uso actual:

Cuando una decisión cambia cómo se entiende el sistema y debe quedar durable en `docs/`.

Ejemplos:

- Cloudflare
- Mercado Pago
- auth
- tenancy
- webhook
- RLS

Formato sugerido:

```md
# [tema]

## Contexto
## Estado actual
## Evidencia
## Decisión
## Motivo
## Límites
## Próximos pasos
## Referencias
```

---

## 8. Reglas mínimas

1. **No duplicar estado.** Si algo ya está bien ubicado, no repetirlo entero en otro artefacto.
2. **No documentar por obligación.** Documentar cuando agrega durabilidad o claridad operativa.
3. **No cerrar bloques con sensación.** El cierre requiere estado real y evidencia.
4. **No promover cambios críticos sin checkpoint.**
5. **Nada durable debe quedar perdido solo en chat.**
6. **La IA asiste, pero el criterio humano decide.**
7. **Nombrar la capa activa antes de razonar.**

---

## 9. Anti-patrones

Evitar:

- llenar artefactos por ansiedad
- documentar todo
- guardar decisiones durables solo en memoria
- confundir conversación con documentación
- confundir avance con cierre
- tocar producción sin validación explícita
- usar IA sin dejar rastro de lo importante

---

## 10. Forma corta operativa

**Conversación para pensar.**  
**Memoria para criterio reusable.**  
**Docs para conocimiento durable.**  
**Checkpoints para cambios críticos.**  
**Commits para cerrar bloques reales.**

---

## 11. Alcance actual

Este estándar es:

- interno
- operativo
- ajustable con la práctica
- compatible con conversación natural, memoria persistente y documentación viva

OAF-TC v2 conserva el ADN de continuidad de v1, pero deja atrás la rigidez innecesaria.

Su objetivo no es producir más artefactos.

Su objetivo es que el conocimiento importante termine en el lugar correcto, con el nivel correcto de permanencia y validación.
