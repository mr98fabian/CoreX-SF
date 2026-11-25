// Lanza al Revisor UX (Claude Code sin interfaz) sobre la última corrida oficial, o la indicada.
// Uso: node resena.mjs [corridas/<carpeta>]
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const QA = new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const corrida = process.argv[2] || 'corridas/' + readdirSync(`${QA}corridas`).filter((d) => !d.startsWith('canario')).sort().pop();
const instruccion = readFileSync(`${QA}revisor-ux.md`, 'utf8');
const prompt = `${instruccion}\n\nCorrida a revisar: qa/${corrida}. Escribe la reseña ahora.`;
// El prompt va por stdin: en Windows `claude` es un .cmd y la línea de comandos rompe los saltos de línea.
const r = spawnSync('claude', ['-p', '--allowedTools', '"Read" "Glob" "Write(qa/resenas/**)"'],
  { cwd: `${QA}..`, input: prompt, stdio: ['pipe', 'inherit', 'inherit'], shell: true });
process.exit(r.status ?? 1);
