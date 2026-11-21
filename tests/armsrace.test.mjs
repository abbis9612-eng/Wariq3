// فحص I-162: سباق التسلح — إذا قوتنا كبرت، الجيران يرفعون ميزانية جيوشهم ويخبرونا؛ والذكاء يحدّث جيل سلاحه بالبحث؛ والحفظ.
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; };
const run = boost => { const G = S.init(WD, 'IRQ', { seed: 4 }); if (boost) G.C.IRQ.pw *= 3; S.step(G, WD, 400); return G; };
const A = run(false), B = run(true);
for (const k of ['SAU', 'KWT', 'SYR', 'TUR']) if (!(B.C[k].milPct > A.C[k].milPct)) no(`${k} ما رفعت ميزانية جيشها لما صرنا أقوى: ${A.C[k].milPct.toFixed(2)} ← ${B.C[k].milPct.toFixed(2)}`);
if (!B.log.some(l => l.k === 'armsrace')) no('ماكو خبر سباق تسلح');
if (B.C.USA.milPct > A.C.USA.milPct * 1.05) no('أمريكا (بعيدة) خافت منا');
const G = S.init(WD, 'IRQ', { seed: 4 }); S.step(G, WD, 365 * 4); const up = Object.keys(G.agen || {}); if (up.length < 5) no('الذكاء ما حدّث جيل سلاحه: ' + up.length);
const L = S.load(S.save(G), WD); if (JSON.stringify(L.agen) !== JSON.stringify(G.agen)) no('الحفظ ضيّع جيل سلاح الذكاء');
const old = JSON.parse(S.save(S.init(WD, 'IRQ', { seed: 1 }))); old.v = 28; if (S.load(JSON.stringify(old), WD).v < 29) no('ترقية V28');
console.log(bad ? `❌ ${bad} مشاكل` : `✅ سباق التسلح تمام (السعودية ${A.C.SAU.milPct.toFixed(2)}٪ ← ${B.C.SAU.milPct.toFixed(2)}٪، ${up.length} دولة حدّثت سلاحها بـ4 سنين)`); process.exit(bad ? 1 : 0);
