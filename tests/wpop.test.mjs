// فحص «العالم» v3 P (I-120): السكان 10 سنين — نمو منطقي، شيخوخة، خصوبة تنزل، لاجئين بالحرب، قتلى، حفظ وترقية.
// node tests/wpop.test.mjs
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js'), P = require('../prototypes/world/wpop.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; };
const G = S.init(WD, 'IRQ', { seed: 4 });
// النمو الحقيقي بالسنة (تقريب، الأمم المتحدة) والمسموح ±0.9
const REAL = { IRQ: 2.1, NGA: 2.3, PAK: 1.9, EGY: 1.6, JPN: -.5, KOR: -.1, USA: .5, DEU: 0, SAU: 1.5 };
const p0 = Object.fromEntries(Object.keys(REAL).map(i => [i, G.C[i].pop])), t0 = Object.fromEntries(Object.keys(REAL).map(i => [i, G.pop3[i].tfr])), o0 = G.pop3.JPN.o;
for (const i of G.ids) { const p = G.pop3[i]; if (Math.abs(p.k + p.w + p.o - 1) > .01) no(`${i}: الأعمار ما تجمع 100٪`); if (!(p.hdi >= 0) && p.hdi != null) no(`${i} hdi`); }
S.step(G, WD, 3650);
const out = [];
for (const i in REAL) { const gr = (Math.pow(G.C[i].pop / p0[i], .1) - 1) * 100; out.push(`${i} ${gr.toFixed(2)}٪`); if (Math.abs(gr - REAL[i]) > .9) no(`${i}: النمو ${gr.toFixed(2)}٪ بعيد عن ${REAL[i]}٪`); }
if (!(G.pop3.IRQ.tfr < t0.IRQ)) no('خصوبة العراق ما نزلت');
if (!(G.pop3.JPN.o > o0)) no('اليابان ما شاخت');
for (const i of G.ids) { const c = G.C[i], p = G.pop3[i]; if (!Number.isFinite(c.pop) || c.pop <= 0) no(`${i} سكان ${c.pop}`); if (!(p.hdi > .2 && p.hdi < 1)) no(`${i} تنمية ${p.hdi}`); }
const ukr = G.pop3.UKR; if (G.wars.some(w => w.a.includes('UKR') || w.b.includes('UKR')) && !(ukr.ref > 0)) no('أوكرانيا بحرب وما بيها لاجئين');
// القتلى
const before = G.C.IRQ.pop; P.loss(G, 'IRQ', 50000); if (Math.abs(before - G.C.IRQ.pop - 50000) > 2 || G.pop3.IRQ.dead < 50000) no('القتلى ما نقصوا السكان');
// حفظ V11 يترقى
const old = JSON.parse(S.save(S.init(WD, 'IRQ', { seed: 1 }))); delete old.pop3; old.v = 11; const G3 = S.load(JSON.stringify(old), WD); if (!G3.pop3 || !G3.pop3.IRQ) no('حفظ V11 ما ترقى');
const H = S.load(S.save(G), WD); if (H.pop3.IRQ.tfr !== G.pop3.IRQ.tfr) no('الحفظ ضيّع السكان');
console.log('نمو 10 سنين: ' + out.join(' · ') + ` · تنمية العراق ${G.pop3.IRQ.hdi} · خصوبة ${t0.IRQ} → ${G.pop3.IRQ.tfr}`);
console.log(bad ? `❌ ${bad} مشاكل` : '✅ السكان تمام'); process.exit(bad ? 1 : 0);
