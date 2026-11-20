// فحص السياسة والأحداث بالعالم (W7): الانتخابات (اللاعب والذكاء)، الانقلابات، سبب الحرب، الاحتلال، الأحداث العالمية وقرارات اللاعب، والترقية من V5.
// node tests/wpol.test.mjs
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js'), N = require('../prototypes/world/nation.js'), P = require('../prototypes/world/wpol.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; }; const out = [];
const run = (G, days, choose = 0) => { const k = {}; for (let d = 0; d < days && !G.over; d++) { const b = G.log.length; S.step(G, WD, 1); N.daily(G, WD, { S, SIM: null, T: null, before: b });
  for (const l of G.log) if (l.t === G.t) k[l.k] = (k[l.k] || 0) + 1; while (G.pev.length) { P.choose(G, 0, choose); k.pchose = (k.pchose || 0) + 1; } } return k; };
// 1) 10 سنين، 3 دول: الانتخابات والانقلابات والأحداث
for (const [me, ch] of [['IRQ', 0], ['USA', 1], ['EGY', 0]]) {
  const G = S.init(WD, me, { seed: 21 }); N.init(G, WD); const nE = Object.keys(G.elec).length;
  const k = run(G, 365 * 10, ch);
  if (nE < 50) no(me + ': ديمقراطيات قليلة ' + nE);
  if (!k.elect) no(me + ': ماكو انتخابات'); if (!(k.disaster || k.terror || k.opec)) no(me + ': ماكو أحداث');
  if ((k.coup || 0) > 25) no(me + ': انقلابات كثيرة ' + k.coup);
  const myE = G.log.filter(l => l.k === 'elect' && l.me);
  out.push(`${me}: ${nE} ديمقراطية · انتخابات ${k.elect || 0}${myE.length ? ' (انتخاباتنا: ' + myE.map(l => (l.win ? 'فزنا ' : 'خسرنا ') + l.sc).join('، ') + ')' : ''} · انقلابات ${k.coup || 0} · كوارث ${k.disaster || 0} · إرهاب ${k.terror || 0} · أوبك ${k.opec || 0} · أزمات ${(k.fin || 0) + (k.pandemic || 0)} · ثورات احتلال ${k.revolt || 0} · قرارات ${k.pchose || 0}${G.over ? ' · نهاية ' + G.over.why + ' ' + S.date(G.over.t).toISOString().slice(0, 10) : ''}`);
}
// 2) سبب الحرب
{ const G = S.init(WD, 'IRQ', { seed: 4 }); G.ap = 9; const st0 = G.C.IRQ.stab, r0 = S.rel(G, 'IRQ', 'EGY');
  if (P.casus(G, WD, S, 'IRQ', 'JOR')) no('العراق عنده سبب على الأردن؟');
  if (!P.casus(G, WD, S, 'IND', 'PAK')) no('الهند وباكستان ماكو سبب؟');
  const r = S.act(G, WD, 'war', 'JOR'); if (r.cb || !G.log.some(l => l.k === 'nocause')) no('الحرب بلا سبب ما انحسبت');
  if (S.rel(G, 'IRQ', 'EGY') > r0 - 15) no('العالم ما زعل كفاية من حرب بلا سبب');
  out.push(`حرب بلا سبب (العراق ← الأردن): استقرار ${Math.round(st0)} ← ${Math.round(G.C.IRQ.stab)} · مصر ${r0} ← ${S.rel(G, 'IRQ', 'EGY')} · توتر ${Math.round(G.ten)}`); }
// 3) الاحتلال يكلّف
{ const G = S.init(WD, 'TUR', { seed: 4 }); let n = 0; for (let i = 0; i < WD.r.length && n < 20; i++) if (WD.r[i][1] === 'SYR' && G.ctl[i] === 'SYR') { G.ctl[i] = 'TUR'; n++; }
  S.step(G, WD, 45); if (!(G.C.TUR.occG < 0) || !G.C.TUR.why.some(w => w[0].includes('الاحتلال'))) no('الاحتلال ما يكلّف'); out.push(`تركيا تحتل ${n} منطقة سورية: نمو ${G.C.TUR.occG}٪`); }
// 4) ترقية V5
{ const G = S.init(WD, 'IRQ', { seed: 2 }); const o = JSON.parse(S.save(G)); o.v = 5; delete o.elec; delete o.pev; delete o.occT; delete o.coupT;
  const L = S.load(o, WD); S.step(L, WD, 60); if (L.v !== 6 || !L.elec || !Array.isArray(L.pev)) no('الترقية من V5 ما اشتغلت'); }
console.log(out.join('\n')); console.log(bad ? `\n❌ ${bad} مشكلة` : '\n✅ السياسة والأحداث سليمة'); process.exit(bad ? 1 : 0);
