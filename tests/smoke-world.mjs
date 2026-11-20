// اختبار دخان «العالم» (D-052: اللعبة الأساسية): يفتح الصفحة، يبدي بدولة، ويلعب أشهر بالواجهة نفسها، وأي خطأ بالصفحة = فشل.
// node tests/smoke-world.mjs [أشهر=36] [دولة=IRQ]
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const months = +(process.argv[2] || 36), me = process.argv[3] || 'IRQ';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 412, height: 860 } });
const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FILE_NOT_FOUND/.test(m.text())) errors.push(m.text()); });
await p.goto(new URL('../prototypes/world/index.html', import.meta.url).href); await p.waitForFunction(() => !document.querySelector('#load'), null, { timeout: 120000 });
await p.evaluate(me => { localStorage.clear(); __G.begin(WSIM.init(WD, me, { seed: 7 })); }, me);
const t0 = Date.now(); let res = null;
for (let m = 0; m < months; m++) {
  res = await p.evaluate(() => { const G = __G.G; __G.step(30);
    while (G.pev && G.pev.length) WPOL.choose(G, 0, 0); while (G.offers && G.offers.length) WSIM.answerOffer(G, WD, 0, true);
    if (G.nat) while (G.nat.home.iss.length) HOME.choose(G.nat, 0, 0);
    return { t: WSIM.date(G.t).toISOString().slice(0, 10), over: G.over, gdp: Math.round(G.C[G.me].gdp), stab: Math.round(G.C[G.me].stab), T: !!__G.T, HT: !!__G.HT }; });
  if (res.over) break;
}
for (const t of ['me', 'army', 'dip', 'war', 'world', 'news']) { await p.click(`#tabs button[data-p=${t}]`); await p.waitForTimeout(150); }
const saved = await p.evaluate(() => { const s = localStorage.getItem('wariq.world.v1'); return s ? s.length : 0; });
console.log(JSON.stringify({ months, me, end: res, saveKB: Math.round(saved / 1024), ms: Date.now() - t0, errors }, null, 1));
await b.close(); process.exit(errors.length ? 1 : 0);
