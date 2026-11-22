// فحص I-169 (D-065): الوضع السهل — الدولة تمشي وحدها 5 سنين بلا إفلاس ولا سقوط، القرارات الصغيرة تنحل وحدها، والحرب والسلام تبقى للاعب. وترقية V30.
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js'), N = require('../prototypes/world/nation.js'), P = require('../prototypes/world/wpol.js'), M = require('../prototypes/world/wmkt.js');
const HOME = require('../prototypes/world/gwhome.js'), FUND = require('../prototypes/world/wfund.js'), RES = require('../prototypes/world/wres.js'), WCAB = require('../prototypes/world/wcab.js'), WINS = require('../prototypes/world/wins.js');
const SIMPLE = require('../prototypes/world/wsimple.js'), D = { S, FUND, RES, M, HOME, P, WCAB, WINS };
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; };
const YEARS = +(process.argv[2] || 5), out = [];
for (const me of ['IRQ', 'LBN', 'YEM', 'EGY', 'JOR']) {
  const G = S.init(WD, me, { seed: 11 }); N.init(G, WD); G.cfg = G.cfg || {}; G.cfg.simple = true; let minCash = 1e9, minStab = 100, peaceOffered = 0;
  for (let d = 0; d < YEARS * 360 && !G.over; d++) {
    const b = G.log.length; S.step(G, WD, 1); N.daily(G, WD, { S, SIM: null, T: null, before: b }); SIMPLE.day(G, WD, D); if (d % 30 === 29) SIMPLE.month(G, WD, D);
    const e = G.nat.eco[0]; minCash = Math.min(minCash, e.cash / (G.nat.lim || 1)); minStab = Math.min(minStab, G.C[me].stab);
    peaceOffered += G.log.slice(b).filter(l => l.k === 'peaceoffer' && l.by === me).length; }
  const left = (G.pev || []).length + G.nat.home.iss.length + (G.cab ? G.cab.props.length : 0) + (G.offers || []).length;
  out.push(`${me}: نهاية ${G.over ? 'سقطت (' + G.over.why + ')' : 'سليمة'} · أقل خزينة ${minCash.toFixed(1)}×الحد · أقل استقرار ${Math.round(minStab)} · قرارات معلّقة ${left}`);
  if (G.over) no(`${me} سقطت بالوضع السهل: ${G.over.why}`);
  if (left > 2) no(`${me}: ${left} قرار صغير ما انحل`);
  if (peaceOffered) no(`${me}: الوضع السهل عرض سلام بدون اللاعب`);
}
console.log(out.join('\n'));
// الترقية: حفظ V30 يصير سهل (المالك طلبه)
const old = JSON.parse(S.save(S.init(WD, 'IRQ', { seed: 1 }))); old.v = 30; delete old.cfg; const L = S.load(JSON.stringify(old), WD);
if (L.v < 31 || !L.cfg || L.cfg.simple !== true) no('ترقية V30 ← الوضع السهل');
console.log(bad ? `❌ ${bad} مشاكل` : '✅ الوضع السهل: الدولة تمشي وحدها'); process.exit(bad ? 1 : 0);
