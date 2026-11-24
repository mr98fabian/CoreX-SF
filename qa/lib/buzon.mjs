// Buzón desechable (mail.tm) para confirmar cuentas de prueba. Solo LEE correos.
import { randomBytes } from 'node:crypto';

const API = 'https://api.mail.tm';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(path, opts = {}, token) {
  for (let intento = 0; intento < 5; intento++) {
    const res = await fetch(API + path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (res.status === 429) { await sleep(1500 * (intento + 1)); continue; }
    if (!res.ok) throw new Error(`mail.tm ${path} → ${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json();
  }
  throw new Error(`mail.tm ${path} → 429 persistente`);
}

export async function crearBuzon(prefijo = 'korexqa') {
  const dominios = await call('/domains');
  const dominio = dominios['hydra:member'].find((d) => d.isActive)?.domain;
  if (!dominio) throw new Error('mail.tm sin dominios activos');
  const address = `${prefijo}${randomBytes(5).toString('hex')}@${dominio}`;
  const password = 'Qa!' + randomBytes(9).toString('base64url');
  const cuenta = await call('/accounts', { method: 'POST', body: JSON.stringify({ address, password }) });
  const { token } = await call('/token', { method: 'POST', body: JSON.stringify({ address, password }) });
  return { address, token, id: cuenta.id };
}

/** Espera el correo de confirmación de Supabase y devuelve el enlace de verificación. */
export async function esperarEnlace(buzon, { timeoutMs = 420_000 } = {}) {
  const fin = Date.now() + timeoutMs;
  while (Date.now() < fin) {
    const lista = await call('/messages', {}, buzon.token);
    for (const m of lista['hydra:member']) {
      const full = await call(`/messages/${m.id}`, {}, buzon.token);
      const html = [].concat(full.html || []).join('\n') + '\n' + (full.text || '');
      const enlace = html.match(/https?:\/\/[^\s"'<>\]]+\/auth\/v1\/verify[^\s"'<>\]]+/);
      if (enlace) return { enlace: enlace[0].replace(/&amp;/g, '&'), asunto: full.subject, de: full.from?.address };
    }
    await sleep(5000);
  }
  throw new Error(`no llegó el correo de confirmación a ${buzon.address} en ${timeoutMs / 1000}s`);
}

export async function borrarBuzon(buzon) {
  try { await call(`/accounts/${buzon.id}`, { method: 'DELETE' }, buzon.token); } catch { /* best effort */ }
}
