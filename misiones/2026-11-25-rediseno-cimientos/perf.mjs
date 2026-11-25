import { createRequire } from 'node:module'; import { writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/Khine/Desktop/Workspace/Proyectos_Software/KoreX/qa/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch(); const out = {};
for (const [name, port] of (process.argv[2] ? [['rama', 5176]] : [['main', 5175], ['rama', 5176]])) {
  out[name] = [];
  for (let r = 0; r < 3; r++) {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    await ctx.addInitScript(() => { localStorage.setItem('korex_demo_token', 'demo-stress-test-token'); window.__f = [];
      const tick = (t) => { window.__f.push([t, document.documentElement.classList.contains('kx-opening')]); if (t < 9000) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await p.goto(`http://localhost:${port}/dashboard`); await p.waitForTimeout(6000);
    const f = await p.evaluate(() => window.__f);
    const win = (a, z) => { const g = []; for (let i = a + 1; i <= z; i++) g.push(f[i][0] - f[i - 1][0]); return { frames: g.length, max: Math.round(Math.max(...g)), over32: g.filter((x) => x > 32).length }; };
    const z = f.findIndex((x) => x[0] - f[0][0] > 3000);
    const on = f.findIndex((x) => x[1]); const off = on < 0 ? -1 : f.findIndex((x, i) => i > on && !x[1]);
    const long = on < 0 ? [] : f.slice(on + 1, off + 1).map((x, i) => [Math.round(x[0] - f[on][0]), Math.round(x[0] - f[on + i][0])]).filter((x) => x[1] > 32);
    const all = f.slice(1, z + 1).map((x, i) => [Math.round(x[0] - f[0][0]), Math.round(x[0] - f[i][0])]).filter((x) => x[1] > 32);
    out[name].push({ all, long, first3000: win(0, z), opening: on < 0 ? null : { ms: Math.round(f[off][0] - f[on][0]), ...win(on, off) } });
    await ctx.close();
  }
}
writeFileSync('perf.json', JSON.stringify(out, null, 1)); console.log(JSON.stringify(out));
await b.close();
