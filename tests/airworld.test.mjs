// فحص الجو الحقيقي بالعالم (W5، D-050): محرك «الحرب الكبرى» (air.js) يشتغل على أي مسرح بقواعد وطيارات ودفاع جوي من البيانات الحقيقية.
// node tests/airworld.test.mjs
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js'), TH = require('../prototypes/world/theater.js'), SIM = require('../prototypes/world/gwsim.js');
const AIR = require('../prototypes/world/gwair.js'), AW = require('../prototypes/world/airworld.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; };
const out = [];
for (const [me, tgt] of [['UKR', null], ['IRQ', 'IRN'], ['IND', 'PAK'], ['ISR', 'LBN']]) {
  const G = S.init(WD, me, { seed: 5 }); let w = G.wars.find(x => x.id === 'ukraine' && me === 'UKR');
  if (!w) { G.ap = 9; S.act(G, WD, 'war', tgt); w = G.wars[G.wars.length - 1]; }
  const T = TH.build(G, WD, w, me); if (!T) { no(me + ': ما اكو مسرح'); continue; }
  const A = AW.build(T, G, WD); T.A = A;
  const sum = s => ({ bases: A.bases.filter(b => b.side === s).length, planes: A.bases.filter(b => b.side === s).reduce((t, b) => t + b.planes, 0), sams: A.sams.filter(x => x.side === s).map(x => x.sys), mb: A.mbases.filter(m => m.side === s).length });
  const s0 = sum(0), s1 = sum(1);
  if (!s0.bases || !s1.bases) no(`${me}: طرف بلا قواعد ${JSON.stringify([s0, s1])}`);
  // يومين حرب بنفس ربط «الحرب الكبرى» بسرعة «ساعة بالثانية»: كل ساعة أرض = 1.6 ثانية جو (af الأقصى)
  const t0 = Date.now(); let ev = { takeoff: 0, samlaunch: 0, kill: 0, raid: 0, bomb: 0 };
  for (let h = 0; h < 48; h++) { TH.step(T, 1); AIR.step(A, T.W, SIM, 1.6); for (const e of A.ev) if (e.k in ev) ev[e.k]++; else if (/kill|down|shot/.test(e.k)) ev.kill++; A.ev.length = 0; }
  const ms = Date.now() - t0;
  if (!ev.takeoff) no(`${me}: ما طارت ولا طيارة`);
  out.push(`${me} ← ${w.n}: إلنا ${s0.bases} قاعدة/${s0.planes} طيارة/${s0.sams.length} بطارية (${[...new Set(s0.sams)].join('، ')})/${s0.mb} موقع صواريخ · إلهم ${s1.bases}/${s1.planes}/${s1.sams.length} (${[...new Set(s1.sams)].join('، ')})/${s1.mb} · يومين: إقلاع ${ev.takeoff}، إطلاق دفاع ${ev.samlaunch}، ضربات مركّبة ${ev.raid}، قنابل ${ev.bomb}، خسائر طيارات ${A.lostPlanes.join('/')} · ${ms}ms`);
  const o = JSON.parse(JSON.stringify(AW.save(A))), A2 = AW.restore(AW.build(T, G, WD), o);
  if (A2.bases.map(b => b.ready).join() !== A.bases.map(b => b.ready).join()) no(me + ': حفظ الجو ما رجع نفس الحالة');
}
console.log(out.join('\n')); console.log(bad ? `\n❌ ${bad} مشكلة` : '\n✅ الجو الحقيقي سليم'); process.exit(bad ? 1 : 0);
