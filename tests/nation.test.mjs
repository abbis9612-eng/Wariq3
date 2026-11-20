// فحص طبقة الدولة (D-050): home.js وind.js وecon.js من «الحرب الكبرى» على دولة اللاعب بالعالم.
// node tests/nation.test.mjs
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js'), N = require('../prototypes/world/nation.js'), SIM = require('../prototypes/world/gwsim.js'), ECON = require('../prototypes/world/gwecon.js'), IND = require('../prototypes/world/gwind.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; };
const day = G => { const b = G.log.length; S.step(G, WD, 1); N.daily(G, WD, { S, SIM, T: null, before: b }); };
const out = [];
for (const me of ['IRQ', 'IRN', 'USA', 'LBN', 'TUR']) {
  const G = S.init(WD, me, { seed: 9 }); N.init(G, WD); const NW = G.nat, e = NW.eco[0], c0 = e.cash;
  const it = N.items(); const k = it.find(x => ECON.ITEMS[x].cat === 'div' && ECON.ITEMS[x].kind !== 'inf' && !ECON.ITEMS[x].req) || 'mec', pl = it.find(x => x.startsWith('pl_'));
  const o1 = N.buy(G, 'inf'), o2 = N.buy(G, k), o3 = pl ? N.buy(G, pl) : null;
  if (typeof o1 === 'string') no(`${me}: ما قدر يطلب فرقة مشاة: ${o1}`);
  const pw0 = G.C[me].pw;
  for (let d = 0; d < 120 && !G.over; d++) day(G);
  for (const v of [e.cash, e.mor, NW.home.stab, G.C[me].stab]) if (!Number.isFinite(v)) no(`${me}: رقم مو صحيح ${v}`);
  const built = NW.log.filter(l => l.k === 'built').length, iss = NW.log.filter(l => l.k === 'home' && l.a === 'issue').length, tech = NW.log.filter(l => l.k === 'tech').length;
  if (!built) no(`${me}: ما توصّل شي من الطلبات`);
  if (!iss) no(`${me}: ما طلعت قضايا داخلية`);
  if (Math.abs(G.C[me].stab - NW.home.stab) > .01) no(`${me}: الاستقرار مو مربوط بالداخل`);
  // قضية: نختار الخيار الأول ونشوف الفئة تتغير
  if (NW.home.iss.length) { const q = NW.home.iss[0], f0 = NW.home.fac[q.k]; require('../prototypes/world/gwhome.js').choose(NW, 0, 0); if (NW.home.fac[q.k] === f0) no(`${me}: القرار ما غيّر الفئة`); }
  const sv = JSON.parse(S.save(G)), L = S.load(sv, WD); N.catalog(L, WD); const b = L.log.length; S.step(L, WD, 1); N.daily(L, WD, { S, SIM, T: null, before: b });
  if (!L.nat || !Number.isFinite(L.nat.eco[0].cash)) no(`${me}: الحفظ/التحميل خرّب طبقة الدولة`);
  out.push(`${me}: فئات ${NW.home.fk.join('/')} · خزينة ${c0.toFixed(1)} ← ${e.cash.toFixed(1)} مليار · معنويات ${Math.round(e.mor)} · استقرار ${Math.round(NW.home.stab)} · توصّل ${built} · قضايا ${iss} · بحث +${tech} · قوة ${Math.round(pw0)} ← ${Math.round(G.C[me].pw)} · طلبات: ${N.items().length}${G.over ? ' · نهاية ' + G.over.why : ''}`);
}
console.log(out.join('\n')); console.log(bad ? `\n❌ ${bad} مشكلة` : '\n✅ طبقة الدولة سليمة'); process.exit(bad ? 1 : 0);
