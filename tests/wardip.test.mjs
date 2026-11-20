// فحص دبلوماسية الحرب بالعالم (W6، D-050): dip.js من «الحرب الكبرى» على حرب اللاعب بالمسرح.
// node tests/wardip.test.mjs
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
new Function('window', fs.readFileSync(new URL('../prototypes/world/world-roads.js', import.meta.url), 'utf8'))(window); window.WD.WR = window.WR;
const WD = window.WD, S = require('../prototypes/world/wsim.js'), TH = require('../prototypes/world/theater.js'), SIM = require('../prototypes/world/gwsim.js');
const N = require('../prototypes/world/nation.js'), WDP = require('../prototypes/world/wardip.js'), DIP = require('../prototypes/world/gwdip.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; };
const out = [];
for (const [me, war, foe] of [['UKR', 'ukraine'], ['IRQ', null, 'SYR'], ['IND', null, 'PAK']]) {
  const G = S.init(WD, me, { seed: 7 }); N.init(G, WD); let w = G.wars.find(x => x.id === war);
  if (!w) { G.ap = 9; S.act(G, WD, 'war', foe); w = G.wars[G.wars.length - 1]; }
  const T = TH.build(G, WD, w, me); if (!T) { no(me + ': ماكو مسرح'); continue; }
  const D = WDP.setup(G, WD, S, T), L = DIP.COUNTRIES;
  if (L.length < 6) no(`${me}: دول قليلة ${L.length}`);
  if (L.some(C => !DIP.BY[C.id] || C.rel.some(v => !Number.isFinite(v)))) no(me + ': دولة غلط');
  // أفعال: بعثة، مساعدة، تدخل، عقوبات، عملية سرية، اقتراح هدنة
  const fr = L.slice().sort((a, b) => b.rel[0] - a.rel[0]), r0 = S.rel(G, fr[0].id, me);
  const m = WDP.act(G, WD, S, T, W => DIP.mission(W, 0, fr[0].id)); if (typeof m === 'string' || !(m.dv > 0)) no(me + ': البعثة ما اشتغلت ' + JSON.stringify(m));
  if (S.rel(G, fr[0].id, me) <= r0 && r0 < 100) no(me + ': العلاقة ما رجعت للعالم');
  const aid = WDP.act(G, WD, S, T, W => DIP.askAid(W, 0, fr[0].id));
  const sp = WDP.act(G, WD, S, T, W => DIP.spy(W, 0, 'riot', null));
  const tr = WDP.act(G, WD, S, T, W => DIP.propose(W, 0, 'truce'));
  // 60 يوم: المسرح + العالم + الدولة + الدبلوماسية
  let joined = 0, evs = 0, got = 0;
  for (let d = 0; d < 60 && !T.W.over; d++) { TH.step(T, 24); TH.sync(T, G, WD); const b = G.log.length; S.step(G, WD, 1); N.daily(G, WD, { S, SIM, T, before: b }); WDP.daily(G, WD, { S, SIM, T }); }
  for (const l of T.W.log) if (l.k === 'dip') { if (l.a === 'event') evs++; if (l.a === 'got' || l.a === 'arrive') got++; if (l.a === 'join') joined++; }
  const wk = [DIP.weary(T.W, 0), DIP.weary(T.W, 1)];
  if (wk.some(v => !Number.isFinite(v))) no(me + ': التعب مو رقم');
  // الحفظ والتحميل
  const o = JSON.parse(JSON.stringify(TH.save(T))), T2 = TH.restore(o, G, WD, w, me); WDP.setup(G, WD, S, T2);
  if (!T2.W.dip || T2.W.dip.cl.length !== L.length) no(me + ': الدبلوماسية ما انحفظت');
  out.push(`${me} ضد ${WD.cs[T.side[1][0]].ar}: ${L.length} دولة (${L.slice(0, 6).map(C => C.n + ' ' + C.will + ' ' + Math.round(C.rel[0]) + '/' + Math.round(C.rel[1])).join('، ')}) · مساعدة ${typeof aid === 'string' ? aid : aid.ok ? 'نعم' : 'لا'} · سرية ${typeof sp === 'string' ? sp : sp.ok ? 'نجحت' : 'فشلت'} · هدنة ${typeof tr === 'string' ? tr : tr.ok ? 'قبلوا' : 'رفضوا'} · تعب ${wk.map(v => v.toFixed(2)).join('/')} · أحداث ${evs} · وصل ${got} · دخلوا ${joined}`);
}
console.log(out.join('\n')); console.log(bad ? `\n❌ ${bad} مشكلة` : '\n✅ دبلوماسية الحرب سليمة'); process.exit(bad ? 1 : 0);
