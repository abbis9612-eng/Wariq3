// فحص البحرية الحقيقية («العالم» W12، D-053): node tests/wnav.test.mjs
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js'), N = require('../prototypes/world/wnav.js');
let bad = 0; const out = [], no = m => { bad++; out.push('❌ ' + m); };
// 1) البناء
const G = S.init(WD, 'USA', { seed: 3 }), NV = G.nav;
if (!NV || NV.g.length < 100) no('أساطيل قليلة: ' + (NV && NV.g.length));
const of = cc => NV.g.filter(g => g.cc === cc);
if (of('USA').filter(g => g.s.cv).length < 5) no('أمريكا لازم حاملات');
if (!of('IRN').some(g => g.s.fac)) no('إيران لازم زوارق صواريخ');
if (of('IRQ').length) no('العراق بلا بحرية بالأرقام الموحّدة');
if (!['S115', 'S123'].every(k => of('USA').some(g => WD.s[g.z][0] === k))) no('انتشار أمريكا ببحر العرب وخليج عمان ما طلع');
for (const g of NV.g) if (!N.coastZones(G, WD, g.cc).includes(g.home)) { no('ميناء مو على ساحل الدولة ' + g.cc); break; }
out.push(`الأساطيل: ${NV.g.length} لـ${new Set(NV.g.map(g => g.cc)).size} دولة · أمريكا ${of('USA').length} (${of('USA').map(g => N.name(WD, g)).slice(0, 2).join('، ')}...) · إيران ${of('IRN').length}`);
// 2) الطريق
const a = N.net(WD).id.get('S106'), b = N.net(WD).id.get('S074'), p = N.path(WD, a, b);
if (!p || p.length < 3) no('ماكو طريق من الخليج للمتوسط'); else out.push(`طريق الخليج العربي ← المتوسط: ${p.length} بحر (${p.map(z => WD.s[z][1]).slice(0, 4).join('، ')}...)`);
if (N.path(WD, N.net(WD).id.get(WD.s.find(z => /قزوين/.test(z[1]))[0]), a) !== null) no('بحر قزوين لازم مسكّر');
// 3) حرب إيران 90 يوم
const L0 = G.log.length, t0 = Date.now(); S.step(G, WD, 90); const ms = (Date.now() - t0) / 3;
const sunk = {}; for (const l of G.log.slice(L0)) if (l.k === 'navsink') sunk[l.cc] = (sunk[l.cc] || 0) + 1;
if ((sunk.USA || 0) > 4) no('أمريكا خسرت هواية سفن قدام إيران: ' + sunk.USA);
if ((sunk.IRN || 0) < 10) no('بحرية إيران ما انضربت: ' + (sunk.IRN || 0));
if (!(G.C.IRN.blk > .2)) no('ماكو حصار على إيران: ' + G.C.IRN.blk);
if (ms > 60) no('بطيء: ' + ms.toFixed(0) + ' مللي للشهر');
out.push(`حرب إيران 90 يوم: غرقت ${JSON.stringify(sunk)} · حصار إيران ${Math.round(G.C.IRN.blk * 100)}٪ · ${ms.toFixed(0)} مللي/شهر`);
// 4) الأوامر
const g0 = of('USA')[0], dest = N.net(WD).id.get('S086'), r = N.order(G, WD, g0, { go: dest, mode: 'block' });
if (r !== true || !g0.path.length || !g0.man) no('أمر التحرك ما اشتغل'); S.step(G, WD, 40); if (g0.z !== dest && N.count(g0)) no('الأسطول ما وصل: ' + WD.s[g0.z][1]);
// 5) الحفظ والترقية
const o = JSON.parse(S.save(G)), L2 = S.load(JSON.parse(JSON.stringify(o)), WD);
if (!L2.nav || L2.nav.g.length !== G.nav.g.length || JSON.stringify(L2.nav.g[0]) !== JSON.stringify(G.nav.g[0])) no('الحفظ ما رجّع الأساطيل');
o.v = 8; delete o.nav; const L3 = S.load(o, WD); if (L3.v !== S.V || !L3.nav || !L3.nav.g.length) no('الترقية من 8 ما بنت الأساطيل');
if (S.V < 9) no('إصدار الحفظ لازم 9 أو أكثر');
console.log(out.join('\n')); console.log(bad ? `\n❌ ${bad} مشكلة` : '\n✅ البحرية سليمة'); process.exit(bad ? 1 : 0);
