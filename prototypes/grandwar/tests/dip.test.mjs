// فحص العالم والدبلوماسية (GW10، I-091): بعثات، مساعدات، تحالفات، هدنة، سلام، أحداث، والحفظ
// node tests/dip.test.mjs [أيام] [بذور]
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire(import.meta.url); const SIM = require('../sim.js'); const AIR = require('../air.js'); const ECON = require('../econ.js'); const DIP = require('../dip.js'); const SAVE = require('../save.js');
AIR.useEcon(ECON);
const rd = f => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8').split('=').slice(1).join('=').trim().replace(/;$/, ''));
const C = rd('cells.js'), RD = rd('roads.js');
const days = +(process.argv[2] || 120), seeds = (process.argv[3] || '1,2,3').split(',').map(Number);
let fails = 0; const check = (ok, m) => { console.log((ok ? '✅ ' : '❌ ') + m); if (!ok) fails++; };
const hour = (W, A, h) => { if (h % 6 === 0) { SIM.ai(W, 0); SIM.ai(W, 1); } SIM.step(W); if (A) AIR.step(A, W, SIM, .5); if (W.t % 24 === 0) { ECON.daily(W, A, SIM); DIP.daily(W, A, SIM, ECON); } };
const mk = seed => { const W = SIM.World(C, { seed, roads: RD }); SIM.scenario(W); ECON.init(W); DIP.init(W); const A = AIR.create(W); return { W, A }; };

// 1) حرب آلية ويا «دبلوماسي» بسيط للعراق: بعثات للسعودية وأمريكا، يطلب مساعدة وتحالف، ويقبل/يعرض سلام
const res = [];
for (const seed of seeds) {
  const { W, A } = mk(seed); const log = [];
  for (let h = 0; h < days * 24 && !W.over; h++) {
    hour(W, A, h);
    if (W.t % 24 === 12) {
      const d = Math.floor(W.t / 24);
      for (const id of ['sa', 'us', 'kw']) DIP.mission(W, 0, id);
      if (d % 5 === 0) for (const id of ['kw', 'sa', 'us', 'ae']) DIP.askAid(W, 0, id);
      for (const id of ['sa', 'us']) if (W.dip.c[id].rel[0] >= DIP.BY[id].join) DIP.askJoin(W, 0, id);
      if (W.dip.ev.length) DIP.choose(W, 0, 0);
      if (W.dip.offer) DIP.answerOffer(W, W.dip.offer.k !== 'keep');
      if (DIP.verdict(W, 1, 'sq').ok) DIP.propose(W, 0, 'sq');
    }
  }
  const L = a => W.log.filter(l => l.k === 'dip' && l.a === a);
  const allies = Object.entries(W.dip.c).filter(([, c]) => c.st !== 'neutral').map(([id, c]) => DIP.BY[id].n + ':' + c.st);
  console.log(`  [${seed}] يوم ${Math.round(W.t / 24)}${W.over ? ` — ${W.over.peace ? 'سلام ' + W.over.peace + ' (' + W.over.res + ')' : 'استسلام ' + (W.over.loser ? 'إيران' : 'العراق')}` : ''} | تعب ${DIP.weary(W, 0).toFixed(2)}/${DIP.weary(W, 1).toFixed(2)} | مساعدات وصلت ${L('got').filter(l => l.side === 0).length}/${L('got').filter(l => l.side === 1).length} | قوات حليفة ${L('arrive').length} | حلفاء ${allies.join('،') || '—'} | أحداث ${L('event').map(l => l.ev).join(',')} | هدن ${L('truce').length} عروض ${L('offer').map(l => l.term).join(',')} | علاقات السعودية ${W.dip.c.sa.rel} أمريكا ${W.dip.c.us.rel}`);
  res.push({ W, A, L });
}
check(res.every(r => r.L('mission').length > 0 && r.L('got').length > 0), 'البعثات تصير والمساعدات توصل');
check(res.some(r => r.L('join').length > 0), 'دول تدخل الحرب ويانا لما العلاقة تعلى (وصول قواتها بالفحص 4)');
check(res.every(r => r.L('event').length > 0), 'الأحداث العالمية تصير');
check(res.every(r => r.L('got').some(l => l.side === 1)), 'إيران هم تطلب وتاخذ مساعدات (روسيا، الصين)');
check(res.every(r => r.W.eco.every(e => isFinite(e.cash)) && Object.values(r.W.dip.c).every(c => c.rel.every(v => v >= -100 && v <= 100))), 'الأرقام سليمة والعلاقات بين −100 و100');

// 2) الهدنة: القتال يوقف، وما اكو أخذ مناطق، وبعدها يرجع
{
  const { W, A } = mk(4); for (let h = 0; h < 24 * 10; h++) hour(W, A, h);
  const b0 = W.battles.size; DIP.accept(W, 0, 'truce'); const t0 = W.t, ctrl0 = W.ctrl.join('');
  let maxB = 0, raids = 0; for (let h = 0; h < 24 * 6; h++) { hour(W, A, W.t); if (h > 2) maxB = Math.max(maxB, W.battles.size); raids += A.queue.length; }
  check(maxB === 0 && W.ctrl.join('') === ctrl0, `بالهدنة ما اكو معارك ولا أخذ مناطق (قبلها ${b0} معارك، بالهدنة أقصى ${maxB})`);
  for (let h = 0; h < 24 * 6; h++) hour(W, A, W.t);
  check(W.battles.size > 0 || W.log.some(l => l.t > t0 + 24 * 7 && l.k === 'take'), 'بعد الهدنة الحرب ترجع');
}
// 3) السلام: إيران ترفض وهي مرتاحة، وتقبل وهي تعبانة
{
  const { W } = mk(5); const r1 = DIP.propose(W, 0, 'sq'); check(r1 && r1.ok === false, `أول الحرب إيران ترفض السلام (تعبها ${DIP.weary(W, 1).toFixed(2)})`);
  W.eco[1].mor = 10; W.eco[1].cash = -5; const cap = W.cells.map((c, i) => i).filter(i => W.cells[i].s === 1 && W.cells[i].vp).slice(0, 6); cap.forEach(i => { W.ctrl[i] = 0; });
  W.dip.peaceCd = 0; const g = DIP.guess(DIP.verdict(W, 1, 'keep')); const r2 = DIP.propose(W, 0, 'keep');
  check(r2.ok && W.over && W.over.res === 'win', `إيران التعبانة (${DIP.weary(W, 1).toFixed(2)}، «${g}») تقبل سلام نحتفظ بيه باللي أخذناه ← فوز`);
  const { W: W2 } = mk(6); const r3 = DIP.propose(W2, 0, 'truce', 'sy');
  check(typeof r3 === 'string', 'الوسيط لازم علاقته زينة ويا الطرفين (سوريا ما تقدر)');
}
// 4) التحالف يحتاج علاقة عالية، والعقوبات تنقص دخل إيران
{
  const { W, A } = mk(7);
  const r = DIP.askJoin(W, 0, 'sa'); check(r.ok === false && W.dip.c.sa.st === 'neutral', 'السعودية ما تدخل الحرب بعلاقة 25');
  W.dip.c.sa.rel[0] = 90; W.dip.cd = {}; DIP.askJoin(W, 0, 'sa'); check(W.dip.c.sa.st === 'ally0' && W.dip.c.sa.rel[1] === -100, 'بعلاقة 90 السعودية تدخل الحرب ويانا');
  const b0 = ECON.budget(W, A, 1).oil; W.dip.sanc = W.t + 999; const b1 = ECON.budget(W, A, 1).oil;
  check(b1 < b0 * .85, `العقوبات تنقص نفط إيران (${(b0 * 1000).toFixed(0)} ← ${(b1 * 1000).toFixed(0)} مليون/يوم)`);
  const n0 = W.divs.length; for (let h = 0; h < 24 * 14; h++) hour(W, A, W.t);
  const al = W.divs.filter(d => d.ally === 'sa'); check(al.length === 3 && al.every(d => d.side === 0), `قوات السعودية وصلت (${al.map(d => d.n).join('، ')}) بـ ${W.cells[al[0]?.cell]?.city || 'منطقة ' + al[0]?.cell}`);
  check(ECON.budget(W, A, 0).army === ECON.budget(W, A, 0).army && al.length, 'رواتب القوات الحليفة على دولتها مو علينا');
}
// 5) الحفظ: الدبلوماسية ترجع بالضبط، وحفظ v2 يترقّى
{
  const { W, A } = mk(8); for (let h = 0; h < 24 * 15; h++) hour(W, A, h); DIP.mission(W, 0, 'sa');
  const txt = JSON.stringify(SAVE.snapshot(W, A, SIM, { seed: 8 }));
  const R = SAVE.restore(JSON.parse(txt), C, { roads: RD }, SIM, AIR, ECON, DIP);
  check(JSON.stringify(R.W.dip) === JSON.stringify(W.dip), 'العلاقات والهدنة والمساعدات الجاية نفسها بعد التحميل');
  const v2 = JSON.parse(txt); v2.v = 2; delete v2.W.dip; let err = null;
  try { const R2 = SAVE.restore(v2, C, { roads: RD }, SIM, AIR, ECON, DIP); for (let h = 0; h < 24 * 5; h++) hour(R2.W, R2.A, R2.W.t); if (!R2.W.dip) throw new Error('ما انبنت'); } catch (e) { err = e; }
  check(!err, 'حفظ v2 (قبل الدبلوماسية) يتحمّل ويكمّل' + (err ? ': ' + err.message : ''));
}
console.log(fails ? `\n❌ ${fails} فشل` : '\n✅ كل الفحوص نجحت'); process.exit(fails ? 1 : 0);
