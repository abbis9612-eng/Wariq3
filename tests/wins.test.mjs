// فحص «العالم» v5-3 (I-146): الجماعات المسلحة — البذور، الهجمات، الأفعال، العملية الأمنية، مصير الأسرى، المقاومة، الحفظ.
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js'), N = require('../prototypes/world/nation.js'), I = require('../prototypes/world/wins.js'), GE = require('../prototypes/world/wgeo.js'), P = require('../prototypes/world/wpol.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; };
const day = Q => { const b = Q.log.length; S.step(Q, WD, 1); N.daily(Q, WD, { S, SIM: null, T: null, before: b }); while (Q.pev.length) P.choose(Q, 0, 0); };
const mk = (k = 'IRQ', seed = 3) => { const G = S.init(WD, k, { seed }); N.init(G, WD); day(G); return G; };
// البذور
{ const G = mk(); I.ensure(G, WD); const L = I.live(G); if (L.length !== 2) no('العراق لازم بيه جماعتين: ' + L.length);
  const mil = L.find(g => g.k === 'mil'), isis = L.find(g => g.k === 'jih'); if (!mil || mil.sup !== 'IRN') no('الفصائل بلا داعم'); if (!isis) no('ماكو داعش');
  if (L.some(g => !g.reg.length)) no('جماعة بلا مناطق');
  // الاحتواء يرفض الجهادية
  G.ap = 8; if (typeof I.act(G, WD, S, isis.id, 'cont') !== 'string') no('داعش قبلت تندمج');
  // العملية الأمنية تهزم داعش وتطلع أسرى
  G.nat.eco[0].cash += 20; const r = I.act(G, WD, S, isis.id, 'op'); if (typeof r === 'string') no('العملية: ' + r); if (G.ap !== 7) no('العملية ما صرفت نقطة');
  for (let i = 0; i < 200 && !G.ins.cap.length; i++) day(G); if (!G.ins.cap.length) no('داعش ما انهزمت ب200 يوم');
  else { const q = G.ins.cap[0], relSA = S.rel(G, 'SAU', 'IRQ'), st = G.nat.home.fac.street; I.fate(G, WD, S, 0, 'exec');
    if (!(S.rel(G, 'SAU', 'IRQ') < relSA)) no('الإعدام بلا إدانة'); if (!(G.nat.home.fac.street < st)) no('الشارع ما انقسم'); if (!G.ins.ret.some(x => x.why === 'exec')) no('ماكو ثأر'); if (!(G.ins.heat >= 25)) no('الغضب ما زاد'); }
  // التفاوض يصرف نقطتين
  G.ap = 5; const m2 = I.live(G).find(g => g.k === 'mil'); if (m2) { I.act(G, WD, S, m2.id, 'talk'); if (G.ap !== 3) no('التفاوض ما صرف نقطتين'); }
  const H = S.load(S.save(G), WD); if (!H.ins || H.ins.g.length !== G.ins.g.length) no('الحفظ ضيّع الجماعات'); }
// الهجمات بدولة زعلانة: الاستقرار ينزل
{ const G = mk('IRQ', 7); I.ensure(G, WD); for (const g of G.ins.g) { g.sat = 0; g.str = 20; g.fk = null; } let atk = 0; for (let i = 0; i < 360; i++) { const b = G.log.length; day(G); atk += G.log.slice(b).filter(l => l.k === 'insatk').length; } if (atk < 3) no('هجمات قليلة: ' + atk); }
// السجن والحل والنفي والدمج
{ const G = mk('IRQ', 9); I.ensure(G, WD); for (const how of ['jail', 'free', 'exile', 'integ']) { G.ins.cap.push({ id: 99, n: 'تجربة', k: 'reb', sup: 'IRN', num: 2000, t: G.t }); const r = I.fate(G, WD, S, G.ins.cap.length - 1, how); if (typeof r === 'string') no(how + ': ' + r); }
  if (G.ins.jail.length !== 1) no('السجن ما انحفظ'); if (G.ins.ret.length < 3) no('ماكو خطر رجعة'); }
// اليمن: الحوثيين كيان يمسك أرض؛ العملية ترجع مناطق
{ const G = mk('YEM', 4); I.ensure(G, WD); const h = I.live(G).find(g => g.ent === 'HTH'); if (!h) no('الحوثيين مو جماعة باليمن'); else if (h.reg.length < 3) no('الحوثيين بلا أرض'); }
// المقاومة بعد الضم
{ const G = mk('IRQ', 5); GE.ensure(G).post = { x: 'KWT', t: G.t }; GE.decide(G, WD, S, 'annex'); for (let i = 0; i < 35; i++) day(G); if (!G.ins.g.some(g => g.k === 'res' && g.org === 'KWT')) no('ماكو مقاومة كويتية'); }
// ترقية V25
{ const old = JSON.parse(S.save(S.init(WD, 'IRQ', { seed: 1 }))); old.v = 25; delete old.ins; if (S.load(JSON.stringify(old), WD).v < 26) no('ترقية V25'); }
console.log(bad ? `❌ ${bad} مشاكل` : '✅ الجماعات المسلحة تمام'); process.exit(bad ? 1 : 0);
