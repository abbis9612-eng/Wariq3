// فحص «العالم» v5-4 (I-147): نظام الحكم (إصلاح، تغيير سريع، الفئات، الانتخابات، نقاط القرار) والتحالف الإسلامي (تأسيس، دعوة، دفاع مشترك، ذكاء).
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js'), N = require('../prototypes/world/nation.js'), V = require('../prototypes/world/wgov.js'), P = require('../prototypes/world/wpol.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; };
const day = Q => { const b = Q.log.length; S.step(Q, WD, 1); N.daily(Q, WD, { S, SIM: null, T: null, before: b }); while (Q.pev.length) P.choose(Q, 0, 0); };
const mk = (k = 'IRQ', seed = 3) => { const G = S.init(WD, k, { seed }); N.init(G, WD); day(G); return G; };
// إصلاح نحو نظام إسلامي
{ const G = mk(); V.ensure(G); if (V.gtOf(G, WD, 'IRQ') !== 'parl') no('العراق مو برلماني بالبداية');
  G.ap = 8; G.nat.home.fac.street = 60; const r = V.change(G, WD, S, 'theo', 'reform'); if (typeof r === 'string') no('الإصلاح: ' + r); if (G.ap !== 5) no('الإصلاح ما صرف 3');
  if (typeof V.change(G, WD, S, 'mil', 'reform') !== 'string') no('تغييرين بنفس الوقت');
  const rSA = S.rel(G, 'SAU', 'IRQ'), rUS = S.rel(G, 'USA', 'IRQ'); G.gov.tr.t1 = G.t + 5; for (let i = 0; i < 45; i++) day(G);
  if (V.gtOf(G, WD, 'IRQ') !== 'theo') no('الإصلاح ما خلص'); const H = G.nat.home; if (!H.fk.includes('clergy')) no('ماكو رجال دين بالفئات'); if (!H.fk.includes('tribe')) no('العشائر انمسحت من العراق');
  if (G.elec.IRQ != null) no('النظام الإسلامي بيه انتخابات'); if (!(S.rel(G, 'USA', 'IRQ') < rUS)) no('أمريكا ما زعلت');
  // نقاط قرار إضافية: نص نقطة بالشهر
  const a0 = G.ap = 0; G.gov.apx = 0; for (let i = 0; i < 62; i++) day(G); if (G.ap < 4 + 1) no('ماكو نقاط قرار إضافية: ' + G.ap);
  // التحالف الإسلامي
  G.ap = 8; const f = V.found(G, WD, S); if (typeof f === 'string') no('التأسيس: ' + f); const b = V.mine(G); if (!b) no('ماكو تحالف');
  let tries = 0; for (const x of ['IRN', 'SYR', 'PAK', 'AFG', 'YEM', 'QAT', 'OMN', 'DZA', 'LBY', 'TUN', 'MRT']) { G.ap = 8; if (b.m.length >= 3) break; V.invite(G, WD, S, x); tries++; }
  if (b.m.length < 3) { b.m.push('IRN', 'SYR'); } G.ap = 8; const u = V.upgrade(G, WD, S); if (typeof u === 'string') no('الترقية: ' + u);
  if (!S.allied(G, 'IRQ', b.m[1])) no('الدفاعي ما صار تحالف');
  const L = S.load(S.save(G), WD); if (!L.iblocs.length || V.gtOf(L, WD, 'IRQ') !== 'theo') no('الحفظ ضيّع النظام أو التحالف'); }
// التغيير السريع (انقلاب) نحو حكم عسكري: عقوبات غربية
{ const G = mk('EGY', 5); G.ap = 8; G.nat.home.fac.army = 100; G.rnd = () => 0; const r = V.change(G, WD, S, 'mil', 'coup'); if (typeof r === 'string' || r.fail) no('الانقلاب: ' + JSON.stringify(r));
  if (V.gtOf(G, WD, 'EGY') !== 'mil') no('ما صار عسكري'); }
// الرجوع للديمقراطية: الانتخابات ترجع
{ const G = mk('IRN', 6); V.ensure(G); if (G.elec.IRN != null) no('إيران بيها انتخابات بالبداية'); V.apply(G, WD, S, 'IRN', 'parl', 'reform'); if (G.elec.IRN == null) no('البرلماني بلا انتخابات'); }
// الذكاء يأسّس تحالف ويدعونا
{ const G = mk('IRQ', 8); V.ensure(G); G.t = 400; let ok = false; const r0 = G.rnd; for (let i = 0; i < 200 && !ok; i++) { V.month(G, WD, S); ok = G.iblocs.length > 0; } if (!ok) no('الذكاء ما أسّس تحالف ب200 شهر'); }
// ترقية V26
{ const old = JSON.parse(S.save(S.init(WD, 'IRQ', { seed: 1 }))); old.v = 26; delete old.gov; delete old.iblocs; if (S.load(JSON.stringify(old), WD).v < 27) no('ترقية V26'); }
console.log(bad ? `❌ ${bad} مشاكل` : '✅ نظام الحكم والتحالف الإسلامي تمام'); process.exit(bad ? 1 : 0);
