// Reporte de una página en español: veredicto por flujo y, si falla algo, qué y dónde mirar.
import { writeFileSync, unlinkSync } from 'node:fs';

export function escribirReporte(carpeta, d) {
  const L = [];
  const estado = d.verde ? '🟢 VERDE' : '🔴 ROJO';
  L.push(`# Corrida QA — ${d.fecha.slice(0, 16).replace('T', ' ')} UTC · ${estado}`);
  L.push('');
  L.push(`- Destino: ${d.base} · main en \`${d.commit}\`${d.canario ? ` · **CANARIO en «${d.canario}»** (corrida de prueba de la guardia, no oficial)` : ''}`);
  L.push(`- Resultado: ${d.flujos.filter((f) => f.veredicto === 'PASA').length}/${d.flujos.length} flujos pasan · limpieza: ${d.limpieza}`);
  if (d.regresion) {
    L.push(`- Regresión contra la última verde ${d.regresion.base}: ${d.regresion.rotos.length ? `**se rompió ${d.regresion.rotos.join(', ')}** entre esa verde y \`${d.commit}\`` : 'nada roto'}`);
  }
  L.push('', '| Flujo | Veredicto | Tiempo | Detalle |', '|---|---|---|---|');
  for (const f of d.flujos) {
    const det = [f.detalle, ...(f.errores || [])].filter(Boolean).join(' · ').replace(/\|/g, '/');
    L.push(`| ${f.flujo} | ${f.veredicto === 'PASA' ? '✅ PASA' : f.veredicto === 'FALLA' ? '❌ FALLA' : f.veredicto === 'OMITIDO' ? '➖ OMITIDO' : '⏸ NO CORRIÓ'} | ${(f.ms / 1000).toFixed(1)} s | ${det || '—'} |`);
  }
  const fallos = d.flujos.filter((f) => f.veredicto === 'FALLA');
  if (fallos.length) {
    L.push('', '## Dónde mirar');
    for (const f of fallos) L.push(`- **${f.flujo}**: ${f.capturas.slice(-1)[0] ?? 'sin captura'}`);
  }
  L.push('', 'Capturas en `capturas/`, todas juntas en `hoja-contacto.png`. Datos crudos en `resultado.json`.');
  writeFileSync(`${carpeta}/reporte.md`, L.join('\n') + '\n');
  try { unlinkSync(`${carpeta}/hoja-contacto.html`); } catch { /* la hoja HTML pesa mucho: queda solo el PNG */ }
}
