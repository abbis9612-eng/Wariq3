// فحص مسرح الحرب (GW12 W5): يتبني لحرب برية، الفرق من الجيوش الحقيقية، القتال يمشي، السيطرة ترجع للخريطة، والحفظ يرجع نفس الشي.
// node tests/theater.test.mjs
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js'), TH = require('../prototypes/world/theater.js'), SIM = require('../prototypes/world/gwsim.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; };
const out = [];
for (const [me, war] of [['UKR', 'ukraine'], ['RUS', 'ukraine'], ['IRQ', null], ['IND', null]]) {
  const G = S.init(WD, me, { seed: 5 }); let w = G.wars.find(x => x.id === war);
  if (!w) { G.ap = 9; S.act(G, WD, 'war', me === 'IRQ' ? 'SYR' : 'PAK'); w = G.wars[G.wars.length - 1]; }
  const t0 = Date.now(); const T = TH.build(G, WD, w, me);
  if (!T) { no(`${me}: المسرح ما انبنى`); continue; }
  const bt = Date.now() - t0, n0 = SIM.alive(T.W).length;
  const t1 = Date.now(); TH.step(T, 24 * 30); const run = Date.now() - t1;
  const ch = TH.sync(T, G, WD), sc = TH.score(T);
  if (T.cells.length < 100 || T.cells.length > 2500) no(`${me}: عدد الخلايا ${T.cells.length}`);
  if (!SIM.alive(T.W).some(d => d.side === 0) || !SIM.alive(T.W).some(d => d.side === 1)) no(`${me}: طرف بلا فرق`);
  // الحفظ والتحميل يكمل نفس الشي
  const o = JSON.parse(JSON.stringify(TH.save(T))), T2 = TH.restore(o, G, WD, w, me);
  TH.step(T, 48); TH.step(T2, 48);
  if (Array.from(T.W.ctrl).join() !== Array.from(T2.W.ctrl).join()) no(`${me}: الحفظ/التحميل غيّر المسرح`);
  out.push(`${me} (${w.n}): ${T.cells.length} خلية ${Math.round(T.hs)} كم من ${T.regs.length} منطقة · فرق ${T.ob[0].inf + T.ob[0].mec + T.ob[0].arm} ضد ${T.ob[1].inf + T.ob[1].mec + T.ob[1].arm} · بناء ${bt}ms · شهر ${run}ms · خلايا ${sc.cells.join('/')} · مناطق تغيرت ${ch.length} · استسلام ${sc.lost.join('/')} ${sc.over ? '· نهاية ' + JSON.stringify(sc.over) : ''}`);
}
console.log(out.join('\n')); console.log(bad ? `\n❌ ${bad} مشكلة` : '\n✅ المسرح سليم'); process.exit(bad ? 1 : 0);
