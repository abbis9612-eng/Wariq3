// فحص المورّد وقطع الغيار (GW11 C2)
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire(import.meta.url); const SIM = require('../sim.js'); const AIR = require('../air.js'); const ECON = require('../econ.js'); const DIP = require('../dip.js');
AIR.useEcon(ECON);
const rd = f => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8').split('=').slice(1).join('=').trim().replace(/;$/, ''));
const C = rd('cells.js'), RD = rd('roads.js');
let fails = 0; const check = (ok, m) => { console.log((ok ? '✅ ' : '❌ ') + m); if (!ok) fails++; };
const mk = () => { const W = SIM.World(C, { seed: 2, roads: RD }); SIM.scenario(W); ECON.init(W); DIP.init(W); const A = AIR.create(W); return { W, A }; };
{ const { W } = mk(); check(ECON.parts(W, 0, 'f16') === 1 && ECON.parts(W, 0, 'inf') === 1, 'أول الحرب: أمريكا 30 ← قطع F-16 كاملة، والمشاة محلي'); }
{ const { W } = mk(); const c0 = ECON.costOf('f16', 0, W), d0 = ECON.daysOf('f16', 0, W); W.dip.c.us.rel[0] = -30; const c1 = ECON.costOf('f16', 0, W), d1 = ECON.daysOf('f16', 0, W);
  check(c1 > c0 * 1.4 && d1 > d0 * 2, `أمريكا −30 ← F-16 أغلى ×${(c1 / c0).toFixed(1)} وأبطأ ×${(d1 / d0).toFixed(1)}`);
  W.dip.c.us.rel[0] = -90; check(typeof ECON.canBuy(W, 0, 'f16') === 'string' && ECON.canBuy(W, 0, 'inf') === null, 'أمريكا −90 ← ما تبيع F-16، بس المشاة عادي'); }
{ const { W, A } = mk(); W.dip.c.us.rel[0] = -50; W.t = 24; ECON.daily(W, A, SIM); const b = A.bases.find(b => b.type === 'f16');
  check(b.gnd > 0 && b.ready <= b.n0 - b.gnd, `F-16 بـ${b.n} محبوسة ${b.gnd} من ${b.n0}`); }
{ const { W, A } = mk(); DIP.join(W, 'us', 0); W.dip.c.us.rel[0] = -50; check(ECON.parts(W, 0, 'f16') === 1, 'إذا أمريكا حليفة بالحرب، قطع كاملة'); }
{ const { W, A } = mk(); W.dip.c.ru.rel[1] = -100; check(ECON.parts(W, 1, 'n48') === 0 && ECON.parts(W, 1, 'arm') === 1, 'إيران: S-300 روسية، وكرار محلي ما يتأثر'); }
// الفرق المدرعة تتعوض أبطأ
{ const run = rel => { const { W, A } = mk(); W.dip.c.us.rel[0] = rel; const d = W.divs.find(d => d.side === 0 && d.kind === 'arm'); d.str = .5; d.path = []; d.lastFight = -99; W.t = 24; ECON.daily(W, A, SIM); for (let h = 0; h < 100; h++) { W.t++; d.path = []; } const s0 = d.str; for (let h = 0; h < 48; h++) SIM.step(W); return d.str - s0; };
  const a = run(30), b = run(-50); check(b < a * .6, `أبرامز بلا قطع تتعوض أبطأ (${(a * 100).toFixed(1)}٪ ← ${(b * 100).toFixed(1)}٪ بيومين)`); }
console.log(fails ? `\n❌ ${fails} فشل` : '\n✅ كل الفحوص نجحت'); process.exit(fails ? 1 : 0);
