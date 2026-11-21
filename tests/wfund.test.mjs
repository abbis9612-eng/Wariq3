// فحص «العالم» v3 E3+E4 (I-119): الصندوق السيادي — إيداع وسحب، عوائد، استثمار برّا ينخسر بالحرب، قروض ترجع، عروض الشركات وحصتها، والحفظ.
// node tests/wfund.test.mjs
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js'), N = require('../prototypes/world/nation.js'), F = require('../prototypes/world/wfund.js'), E = require('../prototypes/world/weco.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; };
const G = S.init(WD, 'SAU', { seed: 2 }); N.init(G, WD); const e = G.nat.eco[0]; e.cash = 60;
if (typeof F.put(G, 'bonds', 1000) !== 'string') no('أودع أكثر من الخزينة');
if (!F.put(G, 'bonds', 20).ok || !F.put(G, 'stocks', 20).ok) no('الإيداع');
const fr = G.ids.find(x => !F.okAbroad(G, WD, S, x)); if (!fr) no('ماكو دولة صديقة'); else if (!F.invest(G, WD, S, fr, 'port').ok) no('الاستثمار برّا');
const poor = G.ids.find(x => x !== 'SAU' && G.C[x].gdp * 1e9 / G.C[x].pop < 15000 && S.rel(G, 'SAU', x) >= 10 && !S.atWar(G, 'SAU', x));
if (poor && !F.lend(G, WD, S, poor).ok) no('القرض');
if (typeof F.lend(G, WD, S, 'USA') !== 'string') no('قرضنا دولة غنية');
const tot0 = F.total(G); let inc = 0;
for (let m = 0; m < 24; m++) { S.step(G, WD, 30.5); inc += G.fund3.inc; }
if (!(inc > 1)) no(`الأرباح بسنتين ${inc}`);
if (!(G.fund3.bonds > 19.9)) no('السندات نقصت');
if (Math.abs(G.fund3.idx - 100) < .01) no('الأسهم ما تتحرك');
// الحرب تضيّع الاستثمار
if (fr) { const before = G.fund3.inv.filter(i => i.x === fr).length; G.wars.push({ n: 'تجربة', a: ['SAU'], b: [fr], t0: G.t, weary: {} }); S.step(G, WD, 31); if (before && G.fund3.inv.some(i => i.x === fr)) no('الاستثمار ما انخسر بالحرب'); G.wars.pop(); }
// عروض الشركات: نجبر عرض ونقبله
G.fund3.offers.push({ id: 999, from: 'CHN', k: 'power', v: 2, terms: 'x', until: G.t + 60 }); const c0 = e.cash, r = F.answer(G, WD, S, 999, true);
if (!r.ok) no('قبول العرض: ' + r); else { const q = G.eco3.proj.find(q => q.fx === 'CHN'); if (!q || q.share !== .4 || q.cost !== 0) no('مشروع الشركة'); }
let offers = G.log.filter(l => l.k === 'fund' && l.a === 'offer').length;
const H = S.load(S.save(G), WD); if (!H.fund3 || H.fund3.bonds !== G.fund3.bonds) no('الحفظ');
const old = JSON.parse(S.save(S.init(WD, 'IRQ', { seed: 1 }))); old.v = 13; const G3 = S.load(JSON.stringify(old), WD); if (G3.v !== 14 && G3.v != null) no('ترقية V13');
console.log(`ربح سنتين ${inc.toFixed(2)} مليار · مؤشر الأسهم ${G.fund3.idx} · عروض شركات ${offers} · الصندوق ${tot0.toFixed(1)} → ${F.total(G).toFixed(1)}`);
console.log(bad ? `❌ ${bad} مشاكل` : '✅ الصندوق السيادي تمام'); process.exit(bad ? 1 : 0);
