// فحص البحث لكل الدول وسوق السلاح (W8): الذكاء يبحث، شروط الشراء (علاقة، تحالف، عقوبات، حرب)، العقد يوصل ويفتح الإنتاج،
// السلاح المشترى يدخل المسرح، التصدير، والترقية من V6.  node tests/wmkt.test.mjs
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
new Function('window', fs.readFileSync(new URL('../prototypes/world/world-roads.js', import.meta.url), 'utf8'))(window); window.WD.WR = window.WR;
const WD = window.WD, S = require('../prototypes/world/wsim.js'), N = require('../prototypes/world/nation.js'), M = require('../prototypes/world/wmkt.js');
const ECON = require('../prototypes/world/gwecon.js'), TH = require('../prototypes/world/theater.js'), AW = require('../prototypes/world/airworld.js'), SIM = require('../prototypes/world/gwsim.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; }; const out = [];
const day = (G, T = null) => { const b = G.log.length; S.step(G, WD, 1); N.daily(G, WD, { S, SIM, T, before: b }); };
// 1) الذكاء يبحث: 5 سنين
{ const G = S.init(WD, 'IRQ', { seed: 3 }); N.init(G, WD); const t0 = JSON.parse(JSON.stringify(G.tech)); for (let d = 0; d < 365 * 5; d++) day(G);
  const up = G.ids.filter(x => x !== 'IRQ' && M.BR.some(b => G.tech[x][b] > t0[x][b]));
  const top = up.sort((a, b) => G.C[b].gdp - G.C[a].gdp).slice(0, 6).map(x => WD.cs[x].ar + ' ' + M.BR.map(b => t0[x][b] + '→' + G.tech[x][b]).join(' '));
  if (up.length < 10) no('دول قليلة طوّرت ' + up.length); if (up.length > 120) no('كل الدول طوّرت؟ ' + up.length);
  out.push(`5 سنين: ${up.length} دولة طوّرت بحثها (${top.join(' · ')})`); }
// 2) الشروط والشراء والتوصيل
{ const G = S.init(WD, 'POL', { seed: 4 }); N.init(G, WD); G.nat.eco[0].cash = 50;
  const r1 = M.buy(G, WD, S, 'RUS', 's400'); if (typeof r1 !== 'string') no('بولندا اشترت S-400 من روسيا؟');
  const usR = S.rel(G, 'USA', 'POL'); const d = M.buy(G, WD, S, 'USA', 'pac'); if (typeof d === 'string') no('بولندا ما تقدر تشتري باتريوت: ' + d);
  const d2 = M.buy(G, WD, S, 'KOR', 'k2'); const d3 = M.buy(G, WD, S, 'USA', 'f35');
  for (let i = 0; i < 560; i++) day(G);
  const A = G.nat.arms || {}; if (!(A.sam && A.sam.pac >= 2)) no('الباتريوت ما وصل');
  if (!ECON.ITEMS['sm_PAC-3 MSE'] && !N.items().some(k => k.startsWith('sm_PAC'))) no('صواريخ الباتريوت ما انفتحت بالإنتاج');
  out.push(`بولندا: S-400 من روسيا «${r1}» · باتريوت ${typeof d === 'string' ? d : 'عقد'} · K2 ${typeof d2 === 'string' ? d2 : 'عقد'} · F-35 ${typeof d3 === 'string' ? d3 : 'عقد'} · وصل: ${JSON.stringify(A)} · دبابات المورّد ${ECON.SUPPLY[0].arm}`);
  // الإمارات تشتري من روسيا: أمريكا تزعل
  const H = S.init(WD, 'ARE', { seed: 4 }); N.init(H, WD); H.nat.eco[0].cash = 50; const u0 = S.rel(H, 'USA', 'ARE'); const r = M.buy(H, WD, S, 'RUS', 'pantsir');
  out.push(`الإمارات ← بانتسير روسي: ${typeof r === 'string' ? r : 'عقد'} · أمريكا ${u0} ← ${S.rel(H, 'USA', 'ARE')}`);
  if (typeof r !== 'string' && S.rel(H, 'USA', 'ARE') >= u0) no('أمريكا ما زعلت'); }
// 3) السلاح المشترى يدخل المسرح
{ const G = S.init(WD, 'IRQ', { seed: 6 }); N.init(G, WD); G.nat.arms = { jets: { f15: 12 }, sam: { pac: 2 }, tank: null };
  G.ap = 9; S.act(G, WD, 'war', 'SYR'); const w = G.wars[G.wars.length - 1]; const T = TH.build(G, WD, w, 'IRQ'); T.arms = G.nat.arms; const A = AW.build(T, G, WD);
  const f15 = A.bases.filter(b => b.side === 0 && b.type === 'f15').reduce((s, b) => s + b.n0, 0), pac = A.sams.filter(s => s.side === 0 && s.sys === 'pac').length;
  if (!f15 || !pac) no(`المسرح ما بيه السلاح المشترى (F-15 ${f15}، باتريوت ${pac})`); out.push(`العراق بالحرب: F-15 بالقواعد ${f15} · بطاريات باتريوت ${pac}`); }
// 4) التصدير
{ const G = S.init(WD, 'TUR', { seed: 8 }); N.init(G, WD); let asks = 0, sold = 0, c0 = G.nat.eco[0].cash;
  for (let d = 0; d < 365 * 2; d++) { day(G); while (G.mkt.offers.length) { asks++; if (M.answer(G, WD, S, 0, true)) sold++; } }
  if (!asks) no('تركيا ما جاها طلب تصدير'); out.push(`تركيا تصدّر: ${M.canExport(G).join('، ')} · طلبات ${asks} · بعنا ${sold}`); }
// 5) الترقية من V6
{ const G = S.init(WD, 'IRQ', { seed: 2 }); const o = JSON.parse(S.save(G)); o.v = 6; delete o.tech; delete o.tech0; delete o.rp; delete o.mkt;
  const L = S.load(o, WD); S.step(L, WD, 40); if (L.v !== S.V || !L.tech || !L.mkt) no('الترقية من V6 ما اشتغلت'); }
console.log(out.join('\n')); console.log(bad ? `\n❌ ${bad} مشكلة` : '\n✅ البحث وسوق السلاح سليم'); process.exit(bad ? 1 : 0);
