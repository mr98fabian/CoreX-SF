// Misión 19 evidence: one contact sheet of the 5 bar screens + login at 375 px, and the
// tap-target audit (every visible button/link in the content pane, < 44 px listed).
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/Khine/Desktop/Workspace/Proyectos_Software/KoreX/qa/package.json');
const { chromium } = require('playwright');
const OUT = process.argv[2];
const W = +(process.argv[3] || 375);
const b = await chromium.launch();
const shots = []; const audit = {};
for (const [name, path, token] of [['Inicio', '/dashboard', 1], ['Calendario', '/dashboard/calendar', 1], ['Plan', '/dashboard/action-plan', 1],
    ['Cuentas', '/dashboard/accounts', 1], ['Suscripciones', '/dashboard/subscriptions', 1], ['Login', '/login', 0]]) {
    const ctx = await b.newContext({ viewport: { width: W, height: 1500 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await ctx.addInitScript((t) => { sessionStorage.setItem('kx-opening', '1'); if (t) localStorage.setItem('korex_demo_token', 'demo-stress-test-token'); else localStorage.removeItem('korex_demo_token'); }, token);
    const p = await ctx.newPage();
    await p.goto(`http://localhost:5173${path}`); await p.waitForTimeout(3500);
    shots.push({ name, b64: (await p.screenshot()).toString('base64') });
    audit[name] = await p.evaluate(() => {
        const root = document.querySelector('main .overflow-y-auto') ?? document.body;
        return [...root.querySelectorAll('button, a, [role="button"]')].filter((e) => {
            const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
        }).map((e) => { const r = e.getBoundingClientRect(); return { t: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) }; })
            .filter((x) => x.w < 44 || x.h < 44);
    });
    await ctx.close();
}
const html = `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(6,${W}px);gap:8px;padding:8px;font:16px sans-serif;color:#fff">${shots.map((s) => `<figure style="margin:0"><figcaption>${s.name}</figcaption><img src="data:image/png;base64,${s.b64}" width="${W}"></figure>`).join('')}</body>`;
const sheet = await b.newPage({ viewport: { width: 6 * W + 56, height: 1560 } });
await sheet.setContent(html);
await sheet.screenshot({ path: `${OUT}/pantallas-${W}.png`, fullPage: true });
writeFileSync(`${OUT}/objetivos-tactiles-${W}.json`, JSON.stringify(audit, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(audit).map(([k, v]) => [k, v.length]))));
await b.close();
