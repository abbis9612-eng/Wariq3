// فحص الاقتصاد (GW8، I-090): حرب آلية بالاقتصاد، وأرقام معقولة، والحفظ والترقية
// node tests/econ.test.mjs [أيام] [بذور مفصولة بفاصلة]
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire(import.meta.url); const SIM = require('../sim.js'); const AIR = require('../air.js'); const ECON = require('../econ.js'); const SAVE = require('../save.js');
AIR.useEcon(ECON);
const rd = f => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8').split('=').slice(1).join('=').trim().replace(/;$/, ''));
const C = rd('cells.js'), RD = rd('roads.js');
const days = +(process.argv[2] || 120), seeds = (process.argv[3] || '1,2,3').split(',').map(Number);
let fails = 0; const check = (ok, m) => { console.log((ok ? '✅ ' : '❌ ') + m); if (!ok) fails++; };
const hour = (W, A, h) => { if (h % 6 === 0) { SIM.ai(W, 0); SIM.ai(W, 1); } SIM.step(W); if (A) AIR.step(A, W, SIM, .5); if (W.t % 24 === 0) ECON.daily(W, A, SIM); };
const f1 = x => x.toFixed(1);

const res = [];
for (const seed of seeds) {
  const W = SIM.World(C, { seed, roads: RD }); SIM.scenario(W); ECON.init(W); const A = AIR.create(W);
  const B0 = [0, 1].map(s => ECON.budget(W, A, s));
  if (seed === seeds[0]) console.log(`ميزانية أول يوم (مليار$/يوم): العراق دخل ${B0[0].inc.toFixed(3)} (نفط ${B0[0].oil.toFixed(3)}) مصاريف ${B0[0].out.toFixed(3)} | إيران دخل ${B0[1].inc.toFixed(3)} (نفط ${B0[1].oil.toFixed(3)}) مصاريف ${B0[1].out.toFixed(3)}`);
  let bad = null;
  for (let h = 0; h < days * 24 && !W.over; h++) {
    hour(W, A, h);
    if (W.t % 480 === 0) { const e = W.eco; console.log(`  [${seed}] يوم ${W.t / 24}: خزينة ${f1(e[0].cash)}/${f1(e[1].cash)} معنويات ${Math.round(e[0].mor)}/${Math.round(e[1].mor)} فرق ${SIM.score(W).divs} طابور ${e[0].q.length}/${e[1].q.length} نفط $${Math.round(W.oil.price)} صادرات ${f1(ECON.oilOf(W, 0).exp)}/${f1(ECON.oilOf(W, 1).exp)} طيارات ${A.bases.filter(b => b.side === 0).reduce((n, b) => n + b.n0, 0)}/${A.bases.filter(b => b.side === 1).reduce((n, b) => n + b.n0, 0)}`); }
    for (const e of W.eco) if (!isFinite(e.cash) || !isFinite(e.mor)) bad = 'رقم مو صالح';
  }
  const L = k => W.log.filter(l => l.k === k);
  const built = [0, 1].map(s => L('built').filter(l => l.side === s).length), oil = [0, 1].map(s => L('oilhit').filter(l => l.side === s).length);
  const sc = SIM.score(W);
  console.log(`  [${seed}] النهاية يوم ${Math.round(W.t / 24)}${W.over ? ` (استسلم ${W.over.loser ? 'إيران' : 'العراق'} ${W.over.why})` : ''}: نقاط ${sc.vp} فرق ${sc.divs} وصل إنتاج ${built} ضربات نفط ${oil} خزينة ${W.eco.map(e => f1(e.cash))} معنويات ${W.eco.map(e => Math.round(e.mor))}`);
  res.push({ seed, W, A, built, oil, bad });
}
check(res.every(r => !r.bad), 'ما اكو أرقام خربانة (NaN/لانهاية)');
check(res.every(r => r.W.eco.every((e, s) => e.cash > -ECON.LAND[s].lim * 1.6 && e.cash < 120)), 'الخزينة ضمن المعقول (ما تنفجر ولا تغرق بلا حد)');
check(res.every(r => r.built[1] > 0 && r.built[0] > 0), 'الطرفين يشترون ويستلمون (فرق، طيارات، صواريخ)');
check(res.some(r => r.oil[0] + r.oil[1] > 0), 'ضربات النفط تصير');
check(res.every(r => r.W.eco.every(e => e.mor >= 0 && e.mor <= 100)), 'المعنويات بين 0 و100');

// ميزانية: الفرقة بالقتال تكلّف أكثر، والحقل المضروب ينقص الدخل
{
  const W = SIM.World(C, { seed: 4, roads: RD }); SIM.scenario(W); ECON.init(W);
  const b0 = ECON.budget(W, null, 0);
  W.divs.filter(d => d.side === 0).forEach(d => { d.lastFight = W.t; });
  const b1 = ECON.budget(W, null, 0); check(b1.army > b0.army * 2, `الجيش بالقتال يكلّف أكثر (${b0.army.toFixed(3)} ← ${b1.army.toFixed(3)} مليار/يوم)`);
  const term = W.oil.sites.findIndex(f => f.term === 'south'); W.oil.sites[term].dmg = 100;
  const b2 = ECON.budget(W, null, 0); check(b2.oil < b0.oil * .5, `ضرب موانئ البصرة يقطع أغلب دخل العراق (${b0.oil.toFixed(3)} ← ${b2.oil.toFixed(3)})`);
  W.oil.sites[term].dmg = 0;
  // البصرة بيد إيران
  const fao = W.oil.sites[term].cell; W.ctrl[fao] = 1; const b3 = ECON.budget(W, null, 0); check(b3.oil < b0.oil * .3, 'إذا إيران أخذت الفاو: صادرات الجنوب تنقطع');
  W.ctrl[fao] = 0;
  check(W.oil.sites.filter(f => !f.off).every(f => f.cell >= 0), 'كل حقل وميناء على الخريطة إله منطقة: ' + W.oil.sites.filter(f => !f.off && f.cell < 0).map(f => f.n).join('،'));
  // الشراء: الفلوس تنقص، والطلب يوصل بعد أيامه
  const e = W.eco[0], c0 = e.cash; const o = ECON.buy(W, 0, 'inf'); check(typeof o === 'object' && Math.abs(e.cash - (c0 - .35)) < 1e-9, 'الشراء ينقص الخزينة');
  e.auto = false; const n0 = W.divs.length; for (let d = 0; d < 16; d++) { for (let h = 0; h < 24; h++) SIM.step(W); ECON.daily(W, null, SIM); }
  check(W.divs.length > n0 && W.divs[W.divs.length - 1].side === 0, 'الفرقة اللي طلبناها وصلت بعد ~14 يوم');
  e.cash = -ECON.LAND[0].lim * .5 + .1; check(typeof ECON.buy(W, 0, 'arm') === 'string', 'ما تقدر تشتري إذا وصلت حد الدين');
}
// أمر يدوي «🛢 اضرب نفط»: F-16 بلد على حقل آزادكان، بعد ما ينخمد الدفاع الجوي الإيراني (بدونه الطيارات تنضرب أو تتهرّب: المنطقة تحت S-300 الأهواز)
{
  let ok = 0;
  for (const seed of [11, 12, 13]) {
    const W = SIM.World(C, { seed, roads: RD }); SIM.scenario(W); ECON.init(W); const A = AIR.create(W);
    A.sams.filter(s => s.side === 1).forEach(s => { s.down = 1e9; });
    const oi = W.oil.sites.findIndex(f => f.n === 'آزادكان'), b = A.bases.find(b => b.n === 'قاعدة بلد');
    b.mission = { kind: 'oil', p: W.oil.sites[oi].p, oil: oi };
    for (let h = 0; h < 24 * 6; h++) { if (h % 6 === 0) { SIM.ai(W, 0); SIM.ai(W, 1); } SIM.step(W); AIR.step(A, W, SIM, .8); if (W.t % 24 === 0) ECON.daily(W, A, SIM); }
    if (W.log.some(l => l.k === 'oilhit' && l.side === 0)) ok++;
  }
  check(ok >= 1, `أمر «🛢 اضرب نفط» يشتغل: F-16 بلد ضربت آزادكان (بعد إخماد الدفاع الجوي) بـ${ok} من 3 حروب (6 أيام)`);
}
// الحفظ: الاقتصاد ينحفظ ويكمّل بالضبط، والحفظ القديم (v1) يترقّى
{
  const seed = 6, W1 = SIM.World(C, { seed, roads: RD }); SIM.scenario(W1); ECON.init(W1); const A1 = AIR.create(W1);
  for (let h = 0; h < 24 * 12; h++) hour(W1, A1, h);
  const txt = JSON.stringify(SAVE.snapshot(W1, A1, SIM, { seed }));
  const R = SAVE.restore(JSON.parse(txt), C, { roads: RD }, SIM, AIR, ECON);
  check(JSON.stringify(R.W.eco) === JSON.stringify(W1.eco) && JSON.stringify(R.W.oil) === JSON.stringify(W1.oil), 'الخزينة والطابور والمعنويات والنفط نفسها بعد التحميل');
  const v1 = JSON.parse(txt); v1.v = 1; delete v1.W.eco; delete v1.W.oil;
  let err = null, R2; try { R2 = SAVE.restore(v1, C, { roads: RD }, SIM, AIR, ECON); for (let h = 0; h < 24 * 5; h++) hour(R2.W, R2.A, h); } catch (e) { err = e; }
  check(!err && R2.W.eco && R2.W.eco[0].cash !== undefined, 'حفظ قديم (v1، قبل الاقتصاد) يتحمّل ويكمّل 5 أيام' + (err ? ': ' + err.message : ''));
}
console.log(fails ? `\n❌ ${fails} فشل` : '\n✅ كل الفحوص نجحت'); process.exit(fails ? 1 : 0);
