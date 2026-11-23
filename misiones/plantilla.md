# Misión: <nombre corto>
- **ID:** AAAA-MM-DD-<slug>
- **Estado:** pendiente
- **Rama:** feat/<slug>
- **Repo:** CoreX-SF
## Objetivo
<Una o dos frases.>
## Contexto
<Decisiones tomadas, archivos relevantes, límites.>
## Criterios de aceptación ejecutables
<!-- OBLIGATORIA. Se llena ANTES de escribir código (primer commit de la rama). Cada criterio es
comprobable: un test o comando concreto con su resultado esperado, o un artefacto observable
(captura, respuesta de un endpoint). «Funciona bien» no es un criterio. La misión no pasa a
en-auditoria con un criterio sin su evidencia pegada en el Reporte. -->
| # | Criterio | Cómo se comprueba (test / comando / artefacto) | Resultado esperado |
|---|----------|-----------------------------------------------|--------------------|
| 1 | <qué debe ser cierto> | <`pytest tests/test_x.py::test_y`, `curl …`, captura de …> | <passed / 200 con … / se ve …> |
| 2 | Puerta compartida en verde | `python scripts/verify.py` | `verify: OK` (exit 0) |
| 3 | Si hay migraciones: un solo head | `cd backend && python -m alembic heads` | exactamente 1 `(head)` |
## Pasos
1.
## No tocar
- <fuera de alcance>
## Reporte (lo llena Claude al ejecutar)
- **Fecha:**
- **Rama y commit:**
- **Evidencia de los criterios de aceptación** (uno a uno, con el número de la tabla):
  1. <comando + salida relevante, o enlace/ruta a la captura>
- **Checklist de auto-verificación** (cada ítem con su artefacto; una marca sola no vale):
  - [ ] Diff auto-revisado → `git diff --stat origin/main...HEAD` (pegar la salida)
  - [ ] Archivos fuera de alcance = 0 → `git diff --name-only origin/main...HEAD` (pegar la lista y
        decir qué rutas permite la misión)
  - [ ] Migraciones = 1 head → salida de `alembic heads` (o «sin migraciones» + el diff que lo prueba)
  - [ ] Sin `console.log`, secretos ni `any` nuevos →
        `git diff origin/main...HEAD -U0 | grep -nE "^\+.*(console\.log|: any\b|as any\b|sk_live|sk_test|whsec_|PRIVATE KEY)"`
        (pegar la salida; vacía = OK)
  - [ ] Puerta compartida → salida final de `python scripts/verify.py`
  - [ ] Criterios de aceptación uno a uno → ver la sección anterior
- **Desviaciones o dudas:**
- **Fallos preexistentes** (si los hay): qué falla, evidencia de que ya fallaba en `main` (comando +
  salida) y la línea añadida en `scripts/verify-known-failures.txt`.
