// فحص C7 (عمليات سرية) وC8 (أدوات الميزانية والتعبئة) وC9 (مشاريع كبرى)
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire(import.meta.url); const SIM = require('../sim.js'); const AIR = require('../air.js'); const ECON = require('../econ.js'); const DIP = require('../dip.js'); const IND = require('../ind.js'); const HOME = require('../home.js');
AIR.useEcon(ECON); IND.register(ECON);
const rd = f => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8').split('=').slice(1).join('=').trim().replace(/;$/, ''));
const C = rd('cells.js'), RD = rd('roads.js');
let fails = 0; const check = (ok, m) => { console.log((ok ? '✅ ' : '❌ ') + m); if (!ok) fails++; };
const X = { SIM, ECON, DIP };
const mk = s => { const W = SIM.World(C, { seed: s || 6, roads: RD }); SIM.scenario(W); ECON.init(W); DIP.init(W); IND.init(W); IND.effects(W); HOME.init(W); HOME.effects(W); const A = AIR.create(W); return { W, A }; };
// C7
{ let ok = 0, n = 0; for (let s = 1; s <= 30; s++) { const { W } = mk(s); const r = DIP.spy(W, 0, 'riot', ECON); n++; if (r.ok) ok++; } check(ok > 9 && ok < 25, `تحريض المظاهرات نجح ${ok} من ${n} (الفرصة ~55٪)`); }
{ const { W } = mk(); let r; for (let k = 0; k < 8 && !(r && r.ok); k++) { W.dip.opCd = 0; r = DIP.spy(W, 0, 'recon', ECON); } const e = W.divs.find(d => d.side === 1 && !d.dead);
  check(r.ok && SIM.isSeen(W, 0, e.cell) && SIM.known(W, 0).length === SIM.alive(W).filter(d => d.side === 1).length, 'الكشف: نشوف كل فرق إيران'); W.t += 49; check(!SIM.isSeen(W, 0, W.divs.find(d => d.side === 1 && !d.dead && W.cells[d.cell].nb.every(j => W.ctrl[j] === 1)).cell), 'وبعد 48 ساعة يرجع الضباب'); }
{ const { W } = mk(); W.dip.opCd = 0; DIP.spy(W, 0, 'riot', ECON); check(typeof DIP.spy(W, 0, 'oil', ECON) === 'string', 'مهلة 7 أيام بين العمليات'); }
{ const { W } = mk(); let r; for (let k = 0; k < 8 && !(r && r.ok); k++) { W.dip.opCd = 0; r = DIP.spy(W, 0, 'oil', ECON); } check(W.oil.sites.some(f => f.side === 1 && f.dmg > 0), 'التخريب عطّل منشأة نفط إيرانية'); }
// C8
{ const { W, A } = mk(); const b0 = ECON.budget(W, A, 0); W.eco[0].civL = 'cut'; const b1 = ECON.budget(W, A, 0); check(b1.civ < b0.civ * .9, 'التقشف يوفّر من الرواتب'); W.eco[0].civL = 'norm';
  W.eco[0].mob = true; check(ECON.costOf('inf', 0, W) < .25 && ECON.daysOf('inf', 0, W) < 10, 'التعبئة العامة: فرقة المشاة أرخص وأسرع');
  const c0 = W.eco[0].cash; check(ECON.cbDraw(W, 0).ok && W.eco[0].cash === c0 + 12 && typeof ECON.cbDraw(W, 0) === 'string', 'الاحتياطي: +12 مليار مرة وحدة'); }
// C9
{ const { W, A } = mk(); W.eco[0].cash = 30; W.eco[0].auto = false; DIP.closeHz(W); const o0 = ECON.budget(W, A, 0).oil; IND.megaGo(W, 0, 'pipe');
  for (let d = 0; d < 46; d++) { W.t += 24; IND.daily(W, A, X); DIP.hz(W).op = 0; W.dip.hz.closed = 1; W.dip.truce = 0; }
  const o1 = ECON.budget(W, A, 0).oil; check(W.ind[0].mega.pipe && o1 > o0 * 3, `الأنابيب البديلة: بهرمز مغلق نفطنا ×${(o1 / o0).toFixed(1)}`); }
{ const { W } = mk(); W.eco[0].cash = 30; IND.megaGo(W, 0, 'fort'); for (let d = 0; d < 31; d++) { W.t += 24; IND.daily(W, null, X); }
  const c = W.divs.find(d => d.side === 0 && W.cells[d.cell].vp); const o0 = c.org; SIM.airHit(W, 1, c.cell, 1); const hit1 = o0 - c.org; c.org = o0; W.ind[0].mega = {}; IND.effects(W); SIM.airHit(W, 1, c.cell, 1); const hit0 = o0 - c.org;
  check(hit1 < hit0 * .8, `تحصين المدن: الضربة أضعف (${hit0.toFixed(1)} ← ${hit1.toFixed(1)})`); }
console.log(fails ? `\n❌ ${fails} فشل` : '\n✅ كل الفحوص نجحت'); process.exit(fails ? 1 : 0);
