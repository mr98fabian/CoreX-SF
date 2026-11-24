// Hoja de contacto: todas las capturas de la corrida en una sola imagen, con el veredicto de su flujo.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export async function hojaDeContacto(browser, carpeta, capturas, resultados) {
  const color = { PASA: '#1f9d55', FALLA: '#d64545', 'NO CORRIÓ': '#8a8a8a' };
  const celdas = capturas.map((c) => {
    const r = resultados[c.flujo];
    const b64 = readFileSync(`${carpeta}/${c.archivo}`).toString('base64');
    const tono = color[r?.veredicto] || '#8a8a8a';
    return `<figure style="border-color:${tono}"><img src="data:image/png;base64,${b64}"><figcaption><b style="color:${tono}">${r?.veredicto ?? ''}</b> ${c.flujo} · ${c.nombre}</figcaption></figure>`;
  }).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:16px;background:#111;font:13px system-ui;color:#eee;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
    figure{margin:0;border:3px solid;border-radius:6px;overflow:hidden;background:#000}
    img{width:100%;display:block}figcaption{padding:6px 8px}</style>${celdas}`;
  writeFileSync(`${carpeta}/hoja-contacto.html`, html);
  const ctx = await browser.newContext({ viewport: { width: 1800, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(`${carpeta}/hoja-contacto.html`).href);
  await page.screenshot({ path: `${carpeta}/hoja-contacto.png`, fullPage: true });
  await ctx.close();
}
