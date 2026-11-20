// فحص دبلوماسية السلم بالعالم (W6b): التكتلات الدفاعية، التوتر العالمي، عروض الدول، عدم الاعتداء، المساعدة، الوساطة، الأمم المتحدة، والترقية من حفظ قديم.
// node tests/wdip.test.mjs
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js'), N = require('../prototypes/world/nation.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; }; const out = [];
// 1) التكتلات: بيلاروسيا ← روسيا (الأمن الجماعي)، قطر ← السعودية (مجلس التعاون)، أي عضو ناتو
{ const G = S.init(WD, 'IRQ', { seed: 3 });
  if (!S.allied(G, 'RUS', 'BLR') || !S.allied(G, 'SAU', 'QAT') || !S.allied(G, 'USA', 'POL')) no('التكتلات الدفاعية ما تشتغل');
  const w = S.declare(G, WD, 'IRQ', 'KWT', false); if (!w.b.includes('SAU')) no('مجلس التعاون ما دخل يدافع عن الكويت');
  out.push(`الكويت انضربت: دخلوا ${w.b.slice(1).map(x => WD.cs[x].ar).join('، ')} · توتر ${Math.round(G.ten)} · عقوبات على العراق ${G.sanc.filter(s => s[1] === 'IRQ').length}`); }
// 2) التوتر والعروض و5 سنين من الذكاء
for (const me of ['IRQ', 'TUR', 'BRA']) {
  const G = S.init(WD, me, { seed: 11 }); N.init(G, WD); const t0 = G.ten; let offers = 0, wars0 = G.wars.length, maxT = 0, minT = 100, aiW = 0;
  for (let d = 0; d < 365 * 5; d++) { const b = G.log.length; S.step(G, WD, 1); N.daily(G, WD, { S, SIM: null, T: null, before: b });
    for (const l of G.log.slice(b)) { if (l.k === 'offer') offers++; if (l.k === 'war' && l.byAI) aiW++; } maxT = Math.max(maxT, G.ten); minT = Math.min(minT, G.ten);
    if (G.offers.length) S.answerOffer(G, WD, 0, true); }
  if (!(G.ten >= 0 && G.ten <= 100)) no(me + ': التوتر برّا 0–100');
  if (!offers) no(me + ': ولا عرض بخمس سنين');
  if (aiW > 6) no(me + ': حروب الذكاء كثيرة ' + aiW);
  out.push(`${me}: توتر ${Math.round(t0)} ← ${Math.round(G.ten)} (${Math.round(minT)}–${Math.round(maxT)}) · عروض ${offers} · تجارة ${G.trade.filter(p => p.includes(me)).length} · تحالفات ${G.pacts.filter(p => p.includes(me)).length} · عدم اعتداء ${G.naps.length} · حروب ذكاء ${aiW} · نفط ${Math.round(G.oilP)}$`);
}
// 3) أفعال اللاعب: عدم اعتداء، مساعدة، وساطة، قرار مجلس الأمن، قمة
{ const G = S.init(WD, 'TUR', { seed: 5 }); N.init(G, WD); G.ap = 8;
  const nap = S.act(G, WD, 'nap', 'GRC'), aid = S.act(G, WD, 'aid', 'SYR');
  G.ap = 8; const w = G.wars.find(x => x.id === 'ukraine'); w.weary.RUS = 50; w.weary.UKR = 50; const med = S.act(G, WD, 'mediate', 'RUS');
  if (!med.ok || G.wars.includes(w)) no('الوساطة ما خلّصت حرب تعبانة');
  G.ap = 8; const v = S.unVote(G, 'ISR'); const res = S.act(G, WD, 'unres', 'ISR'); const sum = S.unSummit(G);
  if (v.M.length !== 15) no('مجلس الأمن مو 15');
  out.push(`تركيا: عدم اعتداء ويا اليونان ${nap.ok ? 'نعم' : nap.why} · مساعدة لسوريا ${aid.ok ? 'نعم' : aid.why} · وساطة بأوكرانيا ${med.ok ? 'نجحت' : med.why} · قرار ضد إسرائيل: ${v.yes.length}/15${v.veto.length ? ' فيتو ' + v.veto.join(',') : ''} ${res.ok ? 'انقبل' : res.why} · قمة ${sum.ok ? 'نعم' : sum.why} · توتر ${Math.round(G.ten)}`); }
// 4) ترقية حفظ V=4
{ const G = S.init(WD, 'IRQ', { seed: 2 }); const o = JSON.parse(S.save(G)); o.v = 4; delete o.ten; delete o.naps; delete o.offers; delete o.unT; delete o.blocs;
  const L = S.load(o, WD); S.step(L, WD, 40); if (L.v !== S.V || L.ten == null || !Array.isArray(L.offers) || !S.allied(L, 'RUS', 'BLR')) no('الترقية من V4 ما اشتغلت'); }
console.log(out.join('\n')); console.log(bad ? `\n❌ ${bad} مشكلة` : '\n✅ دبلوماسية العالم سليمة'); process.exit(bad ? 1 : 0);
