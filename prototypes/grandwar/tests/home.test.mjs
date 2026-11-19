// فحص الداخل (GW11 C6): الفئات، القضايا، وطرق الخسارة
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire(import.meta.url); const SIM = require('../sim.js'); const AIR = require('../air.js'); const ECON = require('../econ.js'); const DIP = require('../dip.js'); const HOME = require('../home.js'); const SAVE = require('../save.js'); const IND = require('../ind.js');
AIR.useEcon(ECON);
const rd = f => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8').split('=').slice(1).join('=').trim().replace(/;$/, ''));
const C = rd('cells.js'), RD = rd('roads.js');
let fails = 0; const check = (ok, m) => { console.log((ok ? '✅ ' : '❌ ') + m); if (!ok) fails++; };
const X = { SIM, ECON, DIP };
const mk = s => { const W = SIM.World(C, { seed: s || 5, roads: RD }); SIM.scenario(W); ECON.init(W); DIP.init(W); HOME.init(W); const A = AIR.create(W); return { W, A }; };
const day = (W, A) => { for (let h = 0; h < 24; h++) { if (h % 6 === 0) { SIM.ai(W, 0); SIM.ai(W, 1); } SIM.step(W); if (A) AIR.step(A, W, SIM, .5); } ECON.daily(W, A, SIM); DIP.daily(W, A, SIM, ECON); HOME.daily(W, A, X); };
{ const { W, A } = mk(); for (let d = 0; d < 30; d++) day(W, A); const H = W.home;
  console.log('  بعد 30 يوم:', JSON.stringify({ stab: Math.round(H.stab), fac: Object.fromEntries(Object.entries(H.fac).map(([k, v]) => [k, Math.round(v)])) }), 'قضايا:', W.log.filter(l => l.a === 'issue').map(l => l.i).join(','));
  check(W.log.some(l => l.k === 'home' && l.a === 'issue'), 'القضايا تطلع'); check(H.stab > 20 && H.stab < 90, 'الاستقرار معقول'); }
{ const { W } = mk(); W.home.iss.push({ k: 'army', t: W.t }); const a0 = W.home.fac.army, c0 = W.eco[0].cash; HOME.choose(W, 0, 0);
  check(W.home.fac.army > a0 + 10 && W.eco[0].cash < c0 - .5, 'تدفع للجيش ← الجيش يرضى والخزينة تنقص'); }
{ const { W } = mk(); W.home.fac.army = 10; for (let d = 0; d < 15; d++) { W.t += 24; HOME.daily(W, null, X); W.home.fac.army = 10; }
  check(W.over && W.over.why === 'coup', 'الجيش تحت 20 أسبوعين ← انقلاب'); }
{ const { W } = mk(); W.cfg = { ez: { on: 1, immune: 1 } }; W.home.fac.army = 10; for (let d = 0; d < 15; d++) { W.t += 24; HOME.daily(W, null, X); W.home.fac.army = 10; } check(!W.over, 'الوضع الخاص (حصانة) يمنع الانقلاب'); }
{ const { W } = mk(); for (let d = 0; d < 31; d++) { W.eco[0].cash = -30; W.t += 24; HOME.daily(W, null, X); } check(W.over && W.over.why === 'bank', 'دين فوق حدّه ×1.5 لشهر ← إفلاس'); }
{ const { W } = mk(); W.t += 12; DIP.join(W, 'us', 0); W.t += 12; const m0 = W.home.fac.mil; HOME.daily(W, null, X); check(W.home.fac.mil < m0 - 8, 'أمريكا دخلت ويانا ← الفصائل تزعل'); }
{ const { W, A } = mk(); W.home.fac.biz = 20; HOME.effects(W); const b = ECON.budget(W, A, 0); W.home.fac.biz = 60; HOME.effects(W); check(ECON.budget(W, A, 0).other > b.other * 1.2, 'رجال الأعمال تحت 30 ← الدخل غير النفطي ينزل'); }
{ const { W, A } = mk(); for (let d = 0; d < 3; d++) day(W, A); const txt = JSON.stringify(SAVE.snapshot(W, A, SIM, { seed: 5 })); const v6 = JSON.parse(txt); v6.v = 6; delete v6.W.home; delete v6.W.homeF;
  let err = null; try { const R = SAVE.restore(v6, C, { roads: RD }, SIM, AIR, ECON, DIP, IND, HOME); if (!R.W.home) throw new Error('ما انبنى'); for (let d = 0; d < 2; d++) day(R.W, R.A); } catch (e) { err = e; } check(!err, 'حفظ v6 يتحمّل' + (err ? ': ' + err.message : '')); }
console.log(fails ? `\n❌ ${fails} فشل` : '\n✅ كل الفحوص نجحت'); process.exit(fails ? 1 : 0);
