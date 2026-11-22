# Misión: Limpieza completa y optimización de rendimiento
- **ID:** 2026-11-22-limpieza-optimizacion
- **Estado:** pendiente
- **Rama:** feat/limpieza-optimizacion
- **Repo:** CoreX-SF
- **Prioridad:** ALTA — lentitud observada en producción (2026-11-22): login y carga del
  panel muy lentos en el teléfono de Fabian; medido por Mijo, `GET /api/dashboard`
  tardó ~2.9 s desde una conexión de datacenter.
## Objetivo
Que KoreX se sienta rápido: login ágil y panel principal usable en menos de ~1.5 s en
una conexión móvil normal, sin cambiar ninguna funcionalidad ni comportamiento visible.
## Regla de oro
**Medir antes de tocar.** Primero diagnóstico con números, luego correcciones en orden
de impacto, y al final la misma medición para probar la mejora (antes/después).
## Pasos
1. **Diagnóstico backend**: tiempos por endpoint (dashboard, cuentas, plan, calendario)
   en producción y local; consultas lentas, patrones N+1, índices faltantes en Supabase,
   costo de RLS por consulta; arranques en frío y recursos del servicio en Railway.
2. **Diagnóstico frontend**: peso del bundle, code-splitting por ruta, fuentes/imágenes,
   qué bloquea el primer pintado útil tras el login. Lighthouse móvil en korexf.com.
3. **Correcciones** en orden de impacto medido (solo lo que la medición señale):
   índices/caché en endpoints calientes, payloads más chicos, lazy-loading de rutas
   pesadas, prefetch tras login, keep-warm del backend, compresión de assets.
4. **Limpieza**: código muerto, dependencias sin uso, assets huérfanos — solo lo que se
   pueda PROBAR muerto (búsqueda en todo el repo); ante la duda, no se borra.
5. **Re-medición completa** con el mismo método y tabla antes/después.
## Criterios de aceptación
- [ ] Tabla antes/después: endpoints clave y carga del panel (Lighthouse móvil + navegación real).
- [ ] `GET /api/dashboard` por debajo de ~800 ms en la medición del Reporte.
- [ ] Cero cambios de funcionalidad o textos visibles (si algo debe cambiar, se anota y se pregunta).
- [ ] pytest + vitest + eslint + build en verde.
- [ ] Sin migraciones salvo índices justificados por la medición; si las hay, `alembic heads` == 1.
## No tocar
- Nada de rediseño visual ni de flujos. No cambiar proveedores, planes ni configuración
  de Railway/Supabase fuera del código: eso se anota como recomendación para Fabian.
## Reporte (lo llena Claude al ejecutar)
- **Fecha:**
- **Rama y commit:**
- **Diagnóstico (los 3–5 cuellos de botella reales, con números):**
- **Correcciones aplicadas y su impacto individual:**
- **Tabla antes/después:**
- **Limpieza hecha (qué se borró y cómo se probó que estaba muerto):**
- **Recomendaciones fuera de código (si las hay):**
