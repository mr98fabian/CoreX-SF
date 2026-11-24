// Probador + Regresión de KoreX. Recorre los flujos reales con cuentas desechables y reporta.
// Uso:  node run.mjs                 corrida oficial contra producción
//       node run.mjs --regresion     igual, y compara contra qa/ultima-verde.json
//       node run.mjs --canario=<flujo>  rompe a propósito una expectativa de ese flujo (no oficial)
// Reglas: solo cuentas desechables (mail.tm), nunca paga ni publica; borra sus cuentas al final.
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { crearBuzon, esperarEnlace, borrarBuzon } from './lib/buzon.mjs';
import { hojaDeContacto } from './lib/hoja.mjs';
import { escribirReporte } from './lib/reporte.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));
const BASE = process.env.QA_BASE_URL || 'https://korexf.com';
const CANARIO = typeof args.canario === 'string' ? args.canario : null;
const REGRESION = Boolean(args.regresion);
const OFICIAL = !CANARIO;
const QA = new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');

// Una corrida a la vez (la diaria y la del vigía podrían coincidir): comparten el usuario de relevo.
const candado = `${QA}.estado/corriendo.lock`;
mkdirSync(`${QA}.estado`, { recursive: true });
if (existsSync(candado) && Date.now() - Number(readFileSync(candado, 'utf8')) < 60 * 60_000) {
  console.log('Ya hay una corrida QA en marcha; esta se omite.');
  process.exit(0);
}
writeFileSync(candado, String(Date.now()));
process.on('exit', () => { try { unlinkSync(candado); } catch { /* ya no está */ } });

const ahora = new Date();
const stamp = ahora.toISOString().slice(0, 16).replace('T', '_').replace(':', '');
const carpeta = `${QA}corridas/${CANARIO ? 'canario-' : ''}${stamp}`;
mkdirSync(`${carpeta}/capturas`, { recursive: true });

const commit = (() => {
  try { return execSync('git ls-remote origin refs/heads/main', { cwd: QA, encoding: 'utf8' }).split(/\s/)[0].slice(0, 7); } catch { return 'desconocido'; }
})();

const FLUJOS = ['registro', 'login', 'agregar-deuda', 'plan', 'calendario', 'suscripciones', 'conectar-ia', 'borrar-cuenta'];
const resultados = Object.fromEntries(FLUJOS.map((f) => [f, { flujo: f, veredicto: 'NO CORRIÓ', detalle: 'dependía de un flujo que falló', capturas: [], ms: 0 }]));
const capturas = [];
let nCaptura = 0;

const nuevaClave = () => 'Qa-' + randomBytes(6).toString('base64url') + '7!a';
const browser = await chromium.launch();

async function contexto() {
  const ctx = await browser.newContext({ locale: 'es-ES', viewport: { width: 1280, height: 860 }, timezoneId: 'America/New_York' });
  const page = await ctx.newPage();
  page.qaErrores = [];
  page.on('response', (r) => { if (r.status() >= 500) page.qaErrores.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });
  page.on('pageerror', (e) => page.qaErrores.push(`JS: ${e.message.slice(0, 120)}`));
  // El asistente de bienvenida tapa la pantalla en cada entrada nueva: se omite como haría el usuario.
  await page.addLocatorHandler(page.getByText('Omitir por ahora'), async (l) => { await l.click(); });
  return { ctx, page };
}

async function foto(page, flujo, nombre) {
  const archivo = `capturas/${String(++nCaptura).padStart(2, '0')}-${flujo}-${nombre}.png`;
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${carpeta}/${archivo}` });
  resultados[flujo].capturas.push(archivo);
  capturas.push({ archivo, flujo, nombre });
}

/** Afirmación con mensaje en español; el canario la invierte a propósito en su flujo. */
async function espera(flujo, descripcion, locator, timeout = 20_000) {
  if (CANARIO === flujo) locator = locator.page().getByText('CANARIO: texto que no existe en la app');
  try { await locator.first().waitFor({ state: 'visible', timeout }); }
  catch { throw new Error(`${CANARIO === flujo ? '(canario) ' : ''}no apareció: ${descripcion}`); }
}

async function flujo(nombre, fn, page) {
  const t0 = Date.now();
  const r = resultados[nombre];
  const antes = page ? page.qaErrores.length : 0;
  try {
    await fn();
    r.veredicto = 'PASA'; r.detalle = '';
  } catch (e) {
    r.veredicto = 'FALLA';
    r.detalle = String(e.message || e).split('\n')[0].slice(0, 220);
    if (page) await foto(page, nombre, 'fallo').catch(() => {});
  }
  if (page) {
    const errs = page.qaErrores.slice(antes);
    if (errs.length) r.errores = [...new Set(errs)].slice(0, 4);
  }
  r.ms = Date.now() - t0;
  console.log(`${r.veredicto.padEnd(9)} ${nombre}${r.detalle ? ' — ' + r.detalle : ''}`);
  return r.veredicto === 'PASA';
}

/** Registro por la UI + confirmación con el enlace real del correo. Devuelve la cuenta. */
async function registrar(page, flujoNombre, nombre) {
  const buzon = await crearBuzon();
  const cuenta = { email: buzon.address, clave: nuevaClave(), buzon };
  await page.goto(`${BASE}/login`);
  await page.getByRole('button', { name: 'Crear cuenta' }).first().click();
  await page.locator('#fullName').fill(nombre);
  await page.locator('#email').fill(cuenta.email);
  await page.locator('#confirmEmail').fill(cuenta.email);
  await page.locator('#password').fill(cuenta.clave);
  await page.locator('#confirmPassword').fill(cuenta.clave);
  const terminos = page.getByRole('checkbox').first();
  await terminos.click({ force: true });
  if (!(await terminos.isChecked())) await page.getByText('Acepto los').first().click();
  if (flujoNombre === 'registro') await foto(page, flujoNombre, 'formulario');
  await page.locator('form').getByRole('button', { name: 'Crear cuenta' }).click();
  const alerta = page.locator('[role=alert], .text-red-400, .text-kx-debt').filter({ hasText: /.+/ });
  await Promise.race([
    page.getByRole('heading', { name: '¡Cuenta creada!' }).waitFor({ timeout: 30_000 }),
    alerta.first().waitFor({ timeout: 30_000 }).then(async () => { throw new Error('el registro mostró: ' + (await alerta.first().innerText()).slice(0, 140)); }),
  ]);
  if (flujoNombre === 'registro') await foto(page, flujoNombre, 'cuenta-creada');
  const { enlace } = await esperarEnlace(buzon);
  await page.goto(enlace);
  await page.waitForURL('**/dashboard**', { timeout: 30_000 });
  return cuenta;
}

async function entrar(page, cuenta) {
  await page.goto(`${BASE}/login`);
  await page.locator('#email').fill(cuenta.email);
  await page.locator('#password').fill(cuenta.clave);
  await page.locator('form').getByRole('button', { name: 'Iniciar sesión' }).click();
}

async function borrarCuentaUI(page, cuenta, flujoNombre) {
  const shot = flujoNombre === 'borrar-cuenta';
  await page.goto(`${BASE}/dashboard/settings/cuenta`);
  await page.getByRole('button', { name: 'Eliminar mi cuenta' }).click();
  if (shot) await foto(page, flujoNombre, 'aviso');
  await page.getByTestId('delete-continue').click();
  await page.getByTestId('delete-secret').fill(cuenta.clave);
  if (shot) await foto(page, flujoNombre, 'confirmar');
  await page.getByTestId('delete-forever').click();
  await page.waitForURL('**/login?cuenta=eliminada', { timeout: 30_000 });
}

// ───────────────────────── corrida ─────────────────────────
const principal = await contexto();
const p = principal.page;
let cuentaA = null, cuentaB = null;

const relevoPath = `${QA}.estado/relevo.json`;
const relevo = existsSync(relevoPath) ? JSON.parse(readFileSync(relevoPath, 'utf8')) : null;

if (CANARIO && relevo) {
  // Supabase limita los correos por hora: el canario entra con el usuario de relevo en vez de registrar.
  cuentaA = relevo;
  await entrar(p, cuentaA);
  await p.waitForURL('**/dashboard**', { timeout: 30_000 });
  Object.assign(resultados.registro, { veredicto: 'OMITIDO', detalle: 'el canario entra con el usuario de relevo' });
} else await flujo('registro', async () => {
  cuentaA = await registrar(p, 'registro', 'QA Desechable');
  await espera('registro', 'saludo del panel tras confirmar el correo', p.getByText('Hola, QA'));
  await foto(p, 'registro', 'panel');
}, p);

if (cuentaA) {
  const segunda = await contexto(); // sesión limpia: login real con correo y contraseña
  await flujo('login', async () => {
    await entrar(segunda.page, cuentaA);
    await segunda.page.waitForURL('**/dashboard**', { timeout: 30_000 });
    await espera('login', 'panel con el nombre de la cuenta', segunda.page.getByText('Hola, QA'));
    await foto(segunda.page, 'login', 'panel');
  }, segunda.page);
  await segunda.ctx.close();

  // El canario que entra con el relevo usa la deuda que ese usuario ya registró en su corrida
  // (añadir otra choca con el tope de 2 deudas del plan gratis).
  const deudaOk = CANARIO && cuentaA === relevo
    ? (Object.assign(resultados['agregar-deuda'], { veredicto: 'OMITIDO', detalle: 'el canario usa la deuda del usuario de relevo' }), true)
    : await flujo('agregar-deuda', async () => {
    await p.goto(`${BASE}/dashboard/accounts/manage`);
    await p.getByRole('button', { name: 'Agregar Cuenta' }).click();
    const d = p.getByRole('dialog');
    await d.getByLabel('Nombre de Cuenta').fill('QA Tarjeta Prueba');
    await d.getByPlaceholder('0.00').first().fill('1500');
    await d.getByPlaceholder('24.99').fill('24.99');
    await d.getByPlaceholder('5,000').fill('5000');
    await d.getByLabel('Día de Corte').fill('15');
    await d.getByLabel('Día de Pago (opcional)').fill('5');
    await foto(p, 'agregar-deuda', 'formulario');
    await d.getByRole('button', { name: 'Verificar y Conectar' }).click();
    await d.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
    await espera('agregar-deuda', 'la deuda «QA Tarjeta Prueba» en la lista de pasivos', p.getByText('QA Tarjeta Prueba'));
    await foto(p, 'agregar-deuda', 'lista');
  }, p);

  if (deudaOk) {
    await flujo('plan', async () => {
      await p.goto(`${BASE}/dashboard/action-plan`);
      await espera('plan', 'encabezado «Plan de ataque»', p.getByRole('heading', { name: 'Plan de ataque' }));
      await espera('plan', 'la deuda «QA Tarjeta Prueba» dentro del plan', p.getByRole('main').getByText('QA Tarjeta Prueba'));
      await foto(p, 'plan', 'plan');
    }, p);

    await flujo('calendario', async () => {
      await p.goto(`${BASE}/dashboard/calendar`);
      await espera('calendario', 'encabezado «Tu calendario de deuda»', p.getByRole('heading', { name: 'Tu calendario de deuda' }));
      await espera('calendario', 'el saldo del mes «al cierre del mes (estimado)»', p.getByText('al cierre del mes (estimado)'));
      if (await p.getByText('Todo en verde').isVisible()) throw new Error('el calendario dice «Todo en verde» con una deuda registrada');
      await foto(p, 'calendario', 'calendario');
    }, p);
  }

  await flujo('suscripciones', async () => {
    await p.goto(`${BASE}/dashboard/subscriptions`);
    await p.getByRole('button', { name: 'Agregar suscripción' }).click();
    const d = p.getByRole('dialog');
    await d.getByLabel('Nombre').fill('QA Streaming');
    await d.getByLabel('Monto').fill('9.99');
    const prox = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
    await d.getByLabel('Próximo cobro').fill(prox);
    await foto(p, 'suscripciones', 'formulario');
    await d.getByRole('button', { name: 'Guardar' }).click();
    await espera('suscripciones', 'la suscripción «QA Streaming» en Próximos cobros', p.getByRole('main').getByText('QA Streaming'));
    await foto(p, 'suscripciones', 'lista');
  }, p);

  await flujo('conectar-ia', async () => {
    await p.goto(`${BASE}/dashboard/settings/ia`);
    await espera('conectar-ia', 'encabezado «KoreX con tu IA»', p.getByRole('heading', { name: 'KoreX con tu IA' }));
    await foto(p, 'conectar-ia', 'guia');
    // Plan gratis: la conexión real exige pagar (prohibido al equipo QA). Se prueba la puerta hasta los planes.
    await p.getByRole('link', { name: 'Ver planes' }).click();
    await p.waitForURL('**/settings/plans', { timeout: 20_000 });
    await espera('conectar-ia', 'precios en la página de planes', p.getByRole('main').getByText(/\$\s?\d/));
    await foto(p, 'conectar-ia', 'planes');
  }, p);
}

// borrar-cuenta: su PROPIO usuario desechable, nunca la cuenta principal de esta corrida.
// Supabase limita los correos de confirmación por hora, así que no se registra un segundo usuario:
// se borra la cuenta principal de la corrida ANTERIOR (desechable, con datos reales de prueba), que
// quedó de relevo en .estado/relevo.json. La primera corrida, sin relevo, registra uno propio.
if (CANARIO) { // el canario prueba la guardia, no el borrado: no gasta el usuario de relevo
  Object.assign(resultados['borrar-cuenta'], { veredicto: 'OMITIDO', detalle: 'el canario no borra cuentas' });
} else {
  const borrar = await contexto();
  await flujo('borrar-cuenta', async () => {
    if (relevo) {
      cuentaB = relevo;
      await entrar(borrar.page, cuentaB);
      try { await borrar.page.waitForURL('**/dashboard**', { timeout: 30_000 }); }
      catch { throw new Error(`no se pudo entrar con el usuario de relevo ${cuentaB.email}`); }
    } else {
      try { cuentaB = await registrar(borrar.page, 'borrar-cuenta', 'QA Borrar'); }
      catch (e) { throw new Error('no se pudo crear el usuario desechable: ' + e.message); }
    }
    await borrarCuentaUI(borrar.page, cuentaB, 'borrar-cuenta');
    await espera('borrar-cuenta', 'login tras borrar', borrar.page.locator('#email'));
    await foto(borrar.page, 'borrar-cuenta', 'borrada');
    await entrar(borrar.page, cuentaB); // la cuenta ya no debe existir
    await espera('borrar-cuenta', 'rechazo «Correo o contraseña incorrectos» al reentrar', borrar.page.getByText('Correo o contraseña incorrectos'));
    await foto(borrar.page, 'borrar-cuenta', 'reingreso-rechazado');
    cuentaB.borrada = true;
  }, borrar.page);
  await borrar.ctx.close();
}

// La cuenta principal queda de relevo para el borrado de la próxima corrida.
mkdirSync(`${QA}.estado`, { recursive: true });
let limpieza = cuentaB?.borrada ? `usuario de borrado eliminado (${cuentaB.email})` : (cuentaB ? `PENDIENTE borrar ${cuentaB.email}` : 'sin usuario de borrado');
if (cuentaA && cuentaA !== relevo) {
  writeFileSync(relevoPath, JSON.stringify({ email: cuentaA.email, clave: cuentaA.clave, creada: ahora.toISOString() }, null, 1));
  limpieza += ` · ${cuentaA.email} queda de relevo para la próxima corrida`;
} else if (cuentaB?.borrada && !cuentaA) {
  writeFileSync(relevoPath, 'null');
}
if (cuentaB && !cuentaB.borrada && relevo === null && cuentaA === null) limpieza += ' (revisar a mano)';
for (const c of [cuentaA, cuentaB]) if (c?.buzon) await borrarBuzon(c.buzon);
await principal.ctx.close();

// ───────────────────────── reporte ─────────────────────────
const lista = FLUJOS.map((f) => resultados[f]);
const verde = lista.every((r) => r.veredicto === 'PASA' || (CANARIO && r.veredicto === 'OMITIDO'));
let regresion = null;
const ultimaPath = `${QA}ultima-verde.json`;
if (REGRESION) {
  const ultima = existsSync(ultimaPath) ? JSON.parse(readFileSync(ultimaPath, 'utf8')) : null;
  regresion = { base: ultima ? `${ultima.commit} (${ultima.fecha})` : 'sin corrida verde previa', rotos: [] };
  if (ultima) regresion.rotos = lista.filter((r) => !['PASA', 'OMITIDO'].includes(r.veredicto) && ultima.flujos.includes(r.flujo)).map((r) => r.flujo);
}
const datos = { fecha: ahora.toISOString(), base: BASE, commit, canario: CANARIO, verde, limpieza, regresion, flujos: lista };
writeFileSync(`${carpeta}/resultado.json`, JSON.stringify(datos, null, 2));
await hojaDeContacto(browser, carpeta, capturas, resultados);
escribirReporte(carpeta, datos);
if (OFICIAL && verde) writeFileSync(ultimaPath, JSON.stringify({ fecha: datos.fecha, commit, carpeta: carpeta.slice(QA.length), flujos: FLUJOS }, null, 2) + '\n');
await browser.close();
console.log(`\n${verde ? 'VERDE' : 'ROJO'} · reporte: ${carpeta}/reporte.md`);
process.exit(verde ? 0 : 1);
