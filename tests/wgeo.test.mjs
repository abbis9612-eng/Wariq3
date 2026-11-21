// فحص «العالم» v5-2 (I-145): بعد الاستسلام — ضم، تابعة، تعويض؛ والدمج بعد 3 سنين؛ والحفظ.
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js'), N = require('../prototypes/world/nation.js'), GE = require('../prototypes/world/wgeo.js'), P = require('../prototypes/world/wpol.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; };
const day = Q => { const b = Q.log.length; S.step(Q, WD, 1); N.daily(Q, WD, { S, SIM: null, T: null, before: b }); while (Q.pev.length) P.choose(Q, 0, 0); };
const mk = () => { const G = S.init(WD, 'IRQ', { seed: 3 }); N.init(G, WD); day(G); return G; };
const regs = (G, k) => WD.r.filter((r, i) => G.ctl[i] === k).length;
// ضم
{ const G = mk(), n0 = regs(G, 'IRQ'), nk = regs(G, 'KWT'), core0 = G.C.IRQ.core, rUS = S.rel(G, 'SAU', 'IRQ');
  GE.ensure(G).post = { x: 'KWT', n: 'تجربة', t: G.t }; const r = GE.decide(G, WD, S, 'annex'); if (typeof r === 'string') no('الضم: ' + r);
  if (G.ids.includes('KWT')) no('الكويت بعدها بالعالم'); if (regs(G, 'IRQ') !== n0 + nk) no(`المناطق ما انتقلت ${regs(G, 'IRQ')} ≠ ${n0 + nk}`);
  if (!(G.C.IRQ.core > core0)) no('الاقتصاد ما كبر'); if (!(S.rel(G, 'SAU', 'IRQ') < rUS)) no('ماكو خوف عند السعودية');
  for (let i = 0; i < 40; i++) day(G); if (!(G.C.IRQ.occN > 0)) no('المضموم ما عليه كلفة احتلال بالبداية');
  if (G.wars.some(w => w.a.includes('KWT') || w.b.includes('KWT'))) no('حرب بيها دولة مضمومة');
  const H = S.load(S.save(G), WD); if (H.ids.includes('KWT') || !H.geo.annex.KWT) no('الحفظ ضيّع الضم');
  G.geo.annex.KWT.t -= 365 * 3 + 10; for (let i = 0; i < 35; i++) day(G); if (G.C.IRQ.occN > 0) no('ما اندمجت بعد 3 سنين: ' + G.C.IRQ.occN); }
// تابعة
{ const G = mk(); GE.ensure(G).post = { x: 'KWT', t: G.t }; GE.decide(G, WD, S, 'pup'); if (!S.allied(G, 'IRQ', 'KWT')) no('التابعة مو حليفة'); const c0 = G.nat.eco[0].cash; for (let i = 0; i < 32; i++) day(G); if (!(G.geo.pup.KWT && G.geo.pup.KWT.paid > 0)) no('التابعة ما دفعت'); }
// تعويض
{ const G = mk(); GE.ensure(G).post = { x: 'KWT', t: G.t }; const c0 = G.nat.eco[0].cash, r = GE.decide(G, WD, S, 'comp'); if (!(G.nat.eco[0].cash > c0 && r.v > 0)) no('ماكو تعويض'); if (!G.ids.includes('KWT')) no('الكويت انمحت بالتعويض'); }
const old = JSON.parse(S.save(S.init(WD, 'IRQ', { seed: 1 }))); old.v = 24; delete old.geo; if (S.load(JSON.stringify(old), WD).v < 25) no('ترقية V24');
console.log(bad ? `❌ ${bad} مشاكل` : '✅ الضم والتابعين والتعويض تمام'); process.exit(bad ? 1 : 0);
