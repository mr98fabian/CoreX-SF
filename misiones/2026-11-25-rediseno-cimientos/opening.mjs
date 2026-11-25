// Misión 18 evidence: (a) contact sheet of the opening at fixed times, (b) frame intervals
// during the opening with the CPU throttled ×4 (mid-range proxy), on the dev server.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/Khine/Desktop/Workspace/Proyectos_Software/KoreX/qa/package.json');
const { chromium } = require('playwright');

const URL = 'http://localhost:5173/dashboard';
const OUT = process.argv[2];
const mode = process.argv[3] || 'all';
const browser = await chromium.launch();
const ctxOpts = { viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
const seed = () => localStorage.setItem('korex_demo_token', 'demo-stress-test-token');

if (mode === 'all' || mode === 'sheet') {
    const ctx = await browser.newContext(ctxOpts);
    await ctx.addInitScript(seed);
    const page = await ctx.newPage();
    await page.clock.install(); // JS timers frozen: the overlay is never removed while we sample
    await page.goto(URL);
    await page.waitForSelector('[data-testid="opening"]');
    await page.waitForSelector('[data-testid="tabbar"]');
    await page.clock.runFor(1); // let React flush
    const shots = [];
    for (const t of [0, 120, 300, 480, 540, 700, 850, 1000]) {
        await page.evaluate((t) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t; }), t);
        shots.push({ t, b64: (await page.screenshot()).toString('base64') });
    }
    const html = `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(4,375px);gap:8px;padding:8px;font:14px sans-serif;color:#fff">${shots.map((s) => `<figure style="margin:0"><img src="data:image/png;base64,${s.b64}" width="375"><figcaption>${s.t} ms</figcaption></figure>`).join('')}</body>`;
    const sheet = await browser.newPage({ viewport: { width: 1540, height: 1700 } });
    await sheet.setContent(html);
    await sheet.screenshot({ path: `${OUT}/apertura-hoja.png`, fullPage: true });
    await ctx.close();
}

if (mode === 'all' || mode === 'frames') {
    const runs = [];
    for (let r = 0; r < 3; r++) {
        const ctx = await browser.newContext(ctxOpts);
        await ctx.addInitScript(seed);
        await ctx.addInitScript(() => {
            const w = window; w.__f = [];
            const tick = (t) => { w.__f.push([t, document.documentElement.classList.contains('kx-opening')]); if (t < 8000) requestAnimationFrame(tick); };
            requestAnimationFrame(tick);
        });
        const page = await ctx.newPage();
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await page.goto(URL);
        await page.waitForTimeout(5000);
        const f = await page.evaluate(() => window.__f);
        const on = f.findIndex((x) => x[1]); let off = f.findIndex((x, i) => i > on && !x[1]); if (off < 0) off = f.length - 1;
        const gaps = [];
        for (let i = on + 1; on >= 0 && i <= off; i++) gaps.push(+(f[i][0] - f[i - 1][0]).toFixed(1));
        runs.push({ run: r + 1, openingMs: on >= 0 ? +(f[off][0] - f[on][0]).toFixed(0) : null, frames: gaps.length, maxMs: Math.max(...gaps), over32: gaps.filter((g) => g > 32).length, gaps });
        await ctx.close();
    }
    writeFileSync(`${OUT}/apertura-fotogramas.json`, JSON.stringify(runs, null, 1));
    console.log(runs.map(({ gaps, ...r }) => r));
}
await browser.close();
