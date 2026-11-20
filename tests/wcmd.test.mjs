// فحص قائد القوات المسلحة (I-108): الجودة 1–5، نسب الزيادة، الخبرة والترقية بالحرب، التبديل والمناورات، الأثر على الحرب المختصرة، والحفظ/الترقية من V7.
// node tests/wcmd.test.mjs
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js'), N = require('../prototypes/world/nation.js'), C = require('../prototypes/world/wcmd.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; }; const out = [];
const G = S.init(WD, 'IRQ', { seed: 4 }); N.init(G, WD);
const qs = Object.values(G.cmdq); if (qs.some(q => !(q >= 1 && q <= 5))) no('جودة برّا 1–5');
const top = G.ids.slice().sort((a, b) => G.cmdq[b] - G.cmdq[a]).slice(0, 8).map(x => WD.cs[x].ar + ' ' + G.cmdq[x]);
const c0 = G.cmd.c, m0 = C.mult(c0); if (!(m0.atk >= 1 && m0.atk < 1.5 && m0.move >= 1)) no('نسب القائد غلط ' + JSON.stringify(m0));
out.push(`أعلى جودة قيادة: ${top.join('، ')} · العراق ${G.cmdq.IRQ}`);
out.push(`قائدنا: ${C.RANK[c0.rank]} ${c0.n} ${JSON.stringify(c0.sk)} · قوة ×${C.power(c0)} · انتشار ${Math.round(250 * m0.move)} كم/يوم`);
// الخبرة والترقية بالحرب: سنة حرب
G.ap = 9; S.act(G, WD, 'war', 'SYR'); const r0 = c0.rank; for (let d = 0; d < 365; d++) { const b = G.log.length; S.step(G, WD, 1); N.daily(G, WD, { S, SIM: null, T: null, before: b }); if (G.over) break; }
if (G.cmd.c.rank <= r0 && !G.over) no('ما صارت ترقية بسنة حرب'); out.push(`بعد سنة حرب: ${C.RANK[G.cmd.c.rank]} · خبرة ${Math.floor(G.cmd.c.xp)}`);
// التبديل والمناورات
G.ap = 5; const L = C.cands(G, WD); if (L.length !== 3) no('المرشحين مو 3'); const army0 = G.nat.home.fac.army; const ch = C.change(G, WD, 0); if (ch.ok !== true) no('التبديل ما اشتغل ' + ch);
const ch2 = C.change(G, WD, 0); if (ch2.ok && !(G.nat.home.fac.army < army0)) no('التبديل المتكرر ما زعّل الجيش');
G.nat.eco[0].cash = 50; const dr = C.drill(G); if (dr.ok !== true) no('المناورات ' + dr);
// الأثر على الحرب المختصرة: نفس الحرب بقائد قوي ضد ضعيف
const run = sk => { const H = S.init(WD, 'IRQ', { seed: 9 }); N.init(H, WD); H.cmd.c.sk = { atk: sk, def: sk, log: sk, plan: sk }; H.cmd.c.rank = sk ? 3 : 0; H.ap = 9; S.act(H, WD, 'war', 'SYR'); const w = H.wars[H.wars.length - 1];
  for (let d = 0; d < 300 && H.wars.includes(w); d++) { const b = H.log.length; S.step(H, WD, 1); N.daily(H, WD, { S, SIM: null, T: null, before: b }); } return Math.round(w.a.includes('IRQ') ? w.score : -w.score); };
const weak = run(0), strong = run(5); if (!(strong >= weak)) no(`القائد القوي ما فاد (${weak} ← ${strong})`); out.push(`حرب العراق وسوريا 300 يوم: قائد ضعيف سير الحرب ${weak} · قائد مشير بمهارات كاملة ${strong}`);
// قادة الدول الثانية: مهارات حتمية (نفس النتيجة كل مرة)، أقوى للجودة الأعلى، وتأثر على الحرب المختصرة (k)
{ const a1 = C.aiSk(G, 'RUS'), a2 = C.aiSk(G, 'RUS'); if (JSON.stringify(a1.sk) !== JSON.stringify(a2.sk)) no('مهارات قائد روسيا مو ثابتة');
  const byQ = [1, 2, 3, 4, 5].map(q => { const L = G.ids.filter(x => G.cmdq[x] === q && x !== G.me); return L.length ? +(L.reduce((t, x) => t + C.power(C.aiSk(G, x)), 0) / L.length).toFixed(3) : null; });
  const qq = byQ.filter(x => x != null); if (qq.some((x, i) => i && x < qq[i - 1])) no('قوة القادة ما تكبر ويا الجودة ' + byQ);
  const ks = G.ids.filter(x => x !== G.me).map(x => C.k(G, x)); if (ks.some(v => !(v >= 1 && v < 1.4))) no('k برّا المدى');
  const ru = C.ai(G, WD, 'RUS'); out.push(`قادة الذكاء: قوة حسب الجودة 1–5 ${JSON.stringify(byQ)} · روسيا ${C.RANK[ru.rank]} ${ru.n} ${JSON.stringify(ru.sk)} k=${C.k(G, 'RUS').toFixed(2)}`); }
// الحفظ والترقية
const o = JSON.parse(S.save(G)); const L2 = S.load(JSON.parse(JSON.stringify(o)), WD); if (!L2.cmd || L2.cmd.c.n !== G.cmd.c.n) no('القائد ما انحفظ');
o.v = 7; delete o.cmd; delete o.cmdq; const L3 = S.load(o, WD); if (L3.v !== S.V || !L3.cmd || !L3.cmdq) no('الترقية من V7 ما اشتغلت');
console.log(out.join('\n')); console.log(bad ? `\n❌ ${bad} مشكلة` : '\n✅ قائد القوات المسلحة سليم'); process.exit(bad ? 1 : 0);
