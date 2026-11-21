// فحص التصنيع الوطني والبحث والقطاعات (GW11 C3–C5، I-095)
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire(import.meta.url); const SIM = require('../sim.js'); const AIR = require('../air.js'); const ECON = require('../econ.js'); const DIP = require('../dip.js'); const IND = require('../ind.js'); const SAVE = require('../save.js');
AIR.useEcon(ECON); IND.register(ECON);
const rd = f => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8').split('=').slice(1).join('=').trim().replace(/;$/, ''));
const C = rd('cells.js'), RD = rd('roads.js');
let fails = 0; const check = (ok, m) => { console.log((ok ? '✅ ' : '❌ ') + m); if (!ok) fails++; };
const X = { SIM, ECON, DIP };
const mk = s => { const W = SIM.World(C, { seed: s || 4, roads: RD }); SIM.scenario(W); ECON.init(W); DIP.init(W); IND.init(W); IND.effects(W); const A = AIR.create(W); return { W, A }; };
const day = (W, A) => { for (let h = 0; h < 24; h++) SIM.step(W); ECON.daily(W, A, SIM); DIP.daily(W, A, SIM, ECON); IND.daily(W, A, X); };
// C3: المحلي يحتاج بحث، وما يعتمد على مورّد
{ const { W } = mk(); check(typeof ECON.canBuy(W, 0, 'larm') === 'string', '«بابل» مقفولة ببحث الدروع 1');
  W.ind[0].tech.arm = 4; W.dip.c.us.rel[0] = -100; W.dip.c.ru.rel[0] = -100;
  check(ECON.canBuy(W, 0, 'larm') === null && typeof ECON.canBuy(W, 0, 'arm') === 'string', 'بدروع 4: «بابل» تنصنع حتى لو أمريكا وروسيا قاطعين، والأبرامز لا');
  const o = ECON.buy(W, 0, 'larm'); W.eco[0].auto = false; for (let d = 0; d < 52; d++) day(W, null);
  check(W.divs.some(d => d.side === 0 && d.kind === 'arm' && /محلية/.test(d.n)), 'الفرقة المدرعة المحلية وصلت'); }
// C4: البحث يتقدم حسب الميزانية، والفرع يصعد
{ const { W } = mk(); W.eco[0].auto = false; IND.setBudget(W, 0, 2); IND.setBranch(W, 0, 'arm'); for (let d = 0; d < 180; d++) day(W, null);
  const t = W.ind[0].tech, gained = IND.BRK.reduce((n, k) => n + t[k] - IND.START[0][k], 0);
  console.log('  180 يوم بميزانية متوسطة:', JSON.stringify(t)); check(gained >= 3 && gained <= 8, `مستويات انكسبت ${gained} (3–8)`); }
{ const { W } = mk(); const d0 = W.divs.find(d => d.side === 0 && d.kind === 'arm'); const tg = W.cells[d0.cell].nb[0]; const a0 = (IND.effects(W), W.indF[0].armAtk);
  W.ind[0].tech.arm = 5; IND.effects(W); check(W.indF[0].armAtk > a0 + .1, `بحث الدروع 5 ← هجوم الدروع ×${W.indF[0].armAtk.toFixed(2)}`);
  W.ind[0].tech.ew = 4; IND.effects(W); check(W.indF[0].ewDef < .85, `التشويش 4 ← ضرباتهم علينا ×${W.indF[0].ewDef.toFixed(2)}`); }
// C3: السلاح الوطني بأربع مراحل
{ const { W } = mk(); W.eco[0].cash = 50; W.eco[0].auto = false; check(typeof IND.natGo(W, 0) === 'object', 'مرحلة 1 تبدي (ترخيص) ببحث 1'); for (let d = 0; d < 31; d++) day(W, null);
  check(W.ind[0].nat.st === 1, 'خلصت مرحلة الترخيص'); check(typeof IND.natGo(W, 0) === 'string', 'المرحلة 2 تحتاج بحث 3');
  W.ind[0].tech.arm = 5; for (let k = 0; k < 3; k++) { IND.natGo(W, 0); for (let d = 0; d < 61; d++) day(W, null); }
  check(W.ind[0].nat.st === 4, 'وصلنا التصدير (4)'); IND.effects(W); check(W.indF[0].armAtk >= 1.20 + .03 * 4 - 1e-9, 'السلاح الوطني الناضج يقوّي الضربة'); }
// C5: القطاعات
{ const { W, A } = mk(); W.eco[0].cash = 50; W.eco[0].auto = false; W.eco[1].auto = false; const o0 = ECON.oilOf(W, 0).prod; IND.secGo(W, 0, 'oil'); for (let d = 0; d < 21; d++) day(W, A);
  check(W.ind[0].sec.oil === 1 && ECON.oilOf(W, 0).prod > o0 * 1.02, 'قطاع النفط 1 ← إنتاج أعلى');
  const L0 = W.eco[0].lines; for (let k = 0; k < 2; k++) { IND.secGo(W, 0, 'war'); for (let d = 0; d < 21; d++) day(W, A); } check(W.eco[0].lines === L0 + 1, `صناعة حربية 2 ← خط إنتاج جديد (${L0} ← ${W.eco[0].lines})`);
  IND.secGo(W, 0, 'tr'); for (let d = 0; d < 21; d++) day(W, A); check(W.indF[0].sup === 1 && W.indF[0].br > 1, 'النقل 1 ← إمداد أبعد وجسور أسرع'); }
// الحفظ: v5 بلا صناعة يتحمّل
{ const { W, A } = mk(); for (let d = 0; d < 5; d++) day(W, A); const txt = JSON.stringify(SAVE.snapshot(W, A, SIM, { seed: 4 }));
  const R = SAVE.restore(JSON.parse(txt), C, { roads: RD }, SIM, AIR, ECON, DIP, IND); check(JSON.stringify(R.W.ind) === JSON.stringify(W.ind), 'البحث والصناعة ينحفظون بالضبط');
  const v5 = JSON.parse(txt); v5.v = 5; delete v5.W.ind; delete v5.W.indF; let err = null; try { const R2 = SAVE.restore(v5, C, { roads: RD }, SIM, AIR, ECON, DIP, IND); for (let d = 0; d < 3; d++) day(R2.W, R2.A); } catch (e) { err = e; }
  check(!err, 'حفظ v5 يتحمّل ويكمّل' + (err ? ': ' + err.message : '')); }
console.log(fails ? `\n❌ ${fails} فشل` : '\n✅ كل الفحوص نجحت'); process.exit(fails ? 1 : 0);
