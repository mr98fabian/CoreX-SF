// Vigía post-merge: lo lanza el Programador de tareas cada 15 min. Si main tiene un commit nuevo,
// espera a que Railway/Vercel desplieguen y corre Probador + Regresión contra producción.
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const QA = new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const ESPERA_MIN = Number(process.env.QA_ESPERA_DEPLOY_MIN || 12); // margen para el build de Railway y Vercel
const estado = `${QA}.estado/vigia.json`;
mkdirSync(`${QA}.estado`, { recursive: true });

const linea = execSync('git ls-remote origin refs/heads/main', { cwd: QA, encoding: 'utf8' });
const sha = linea.split(/\s/)[0];
const previo = existsSync(estado) ? JSON.parse(readFileSync(estado, 'utf8')) : {};
if (!previo.probado) { writeFileSync(estado, JSON.stringify({ probado: sha, visto: sha })); process.exit(0); } // primera vez: solo anota
if (previo.probado === sha) process.exit(0);

if (previo.visto !== sha) { // merge nuevo: se anota la hora y se espera al despliegue
  writeFileSync(estado, JSON.stringify({ ...previo, visto: sha, vistoEn: Date.now() }));
  process.exit(0);
}
if (Date.now() - (previo.vistoEn || 0) < ESPERA_MIN * 60_000) process.exit(0);

console.log(`main ${sha.slice(0, 7)} desplegado: corriendo regresión`);
const r = spawnSync(process.execPath, [`${QA}run.mjs`, '--regresion'], { cwd: QA, stdio: 'inherit' });
writeFileSync(estado, JSON.stringify({ probado: sha, visto: sha, ultimaSalida: r.status }));
