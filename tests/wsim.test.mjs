// فحص محاكاة «العالم» (GW12 W3): 10 سنين لعدة دول بدون أخطاء، أرقام منطقية، حفظ وتحميل، وتكرار نفس النتيجة بنفس البذرة.
// node tests/wsim.test.mjs [سنين]
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js');
const YEARS = +process.argv[2] || 10;
let bad = 0; const no = m => { if (bad++ < 30) console.log('❌ ' + m); };
const fin = (W, tag) => { for (const id of W.ids) { const c = W.C[id]; for (const k of ['gdp', 'core', 'debt', 'stab', 'pw', 'g', 'milPct']) if (!Number.isFinite(c[k])) { no(`${tag} ${id}.${k} = ${c[k]}`); return; } if (c.gdp <= 0) no(`${tag} ${id} ناتج سالب`); } };
const t0 = Date.now(); const summary = [];
for (const me of ['IRQ', 'USA', 'LBN', 'TWN', 'IRN']) {
  const W = S.init(WD, me, { seed: 7 });
  const g0 = Object.fromEntries(W.ids.map(i => [i, W.C[i].gdp])), w0 = W.C.USA.gdp;
  for (let y = 0; y < YEARS; y++) { S.step(W, WD, 365); fin(W, `${me} سنة ${y + 1}`); }
  const wars = W.log.filter(l => l.k === 'war').length, peace = W.log.filter(l => l.k === 'peace').map(l => l.n);
  const gr = W.ids.map(i => Math.pow(W.C[i].gdp / g0[i], 1 / YEARS) - 1).sort((a, b) => a - b);
  const med = gr[gr.length >> 1] * 100, lo = gr[0] * 100, hi = gr[gr.length - 1] * 100;
  if (med < 0 || med > 6) no(`${me}: النمو الوسيط ${med.toFixed(1)}٪ غريب`);
  const coll = W.ids.filter(i => W.C[i].stab < 15).length;
  summary.push(`${me}: نمو وسيط ${med.toFixed(1)}٪ (${lo.toFixed(1)} … ${hi.toFixed(1)}) · نفط ${Math.round(W.oilP)}$ · حروب جديدة ${wars} · سلام: ${peace.join('، ') || '—'} · باقية: ${W.wars.map(w => w.n).join('، ') || '—'} · دول مستقرارها تحت 15: ${coll} · نهاية: ${W.over ? W.over.why : 'لا'}`);
}
// نفس البذرة = نفس النتيجة، والحفظ/التحميل يكمل نفس الشي
const A = S.init(WD, 'IRQ', { seed: 3 }), B = S.init(WD, 'IRQ', { seed: 3 });
S.step(A, WD, 400); S.step(B, WD, 200); const B2 = S.load(S.save(B), WD); S.step(B2, WD, 200);
if (Math.abs(A.C.IRQ.gdp - B2.C.IRQ.gdp) > 1e-6 || A.ctl.join() !== B2.ctl.join()) no(`الحفظ/التحميل غيّر النتيجة: ${A.C.IRQ.gdp} ≠ ${B2.C.IRQ.gdp}`);
const size = S.save(A).length;
if (size > 1.5e6) no(`الحفظ كبير ${size}`);
// أفعال اللاعب
const P = S.init(WD, 'IRQ', { seed: 1 });
const r1 = S.act(P, WD, 'improve', 'JOR'), r2 = S.act(P, WD, 'trade', 'JOR'), r3 = S.act(P, WD, 'war', 'ISR');
if (!r1.ok || !r2.ok) no('تحسين/تجارة ويا الأردن فشل: ' + JSON.stringify([r1, r2]));
if (r3.ok) no('حرب بنقاط قرار ما تكفي'); 
console.log(summary.join('\n')); console.log(`حجم الحفظ ${Math.round(size / 1024)}KB · الوقت ${Date.now() - t0}ms`);
console.log(bad ? `\n❌ ${bad} مشكلة` : '\n✅ المحاكاة سليمة'); process.exit(bad ? 1 : 0);
