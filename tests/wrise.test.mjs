// فحص «العالم» v5-7 (I-150): مسيرتنا — لقطة شهرية، المؤشر يبدي 100، تقرير السنة، الإنجازات، والحفظ.
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js'), N = require('../prototypes/world/nation.js'), RI = require('../prototypes/world/wrise.js'), P = require('../prototypes/world/wpol.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; };
const day = Q => { const b = Q.log.length; S.step(Q, WD, 1); N.daily(Q, WD, { S, SIM: null, T: null, before: b }); while (Q.pev.length) P.choose(Q, 0, 0); };
const G = S.init(WD, 'TUR', { seed: 4 }); N.init(G, WD); for (let i = 0; i < 430; i++) day(G);
const R = G.rise; if (!R || R.h.length < 12) no('ماكو لقطات شهرية: ' + (R && R.h.length));
if (R.h[0].i !== 100) no('المؤشر ما يبدي 100: ' + R.h[0].i);
if (!R.yr.length) no('ماكو تقرير سنة'); if (!G.log.some(l => l.k === 'year')) no('ماكو رسالة السنة');
G.log.push({ t: G.t + 1, k: 'ars', a: 'done', f: Object.keys(require('../prototypes/world/warsenal.js').FL)[0] }); for (let i = 0; i < 32; i++) day(G);
if (!R.ms.some(m => /دخل الخدمة/.test(m.x))) no('الإنجاز ما انكتب');
const H = S.load(S.save(G), WD); if (!H.rise || H.rise.h.length !== R.h.length) no('الحفظ ضيّع المسيرة');
const old = JSON.parse(S.save(S.init(WD, 'IRQ', { seed: 1 }))); old.v = 23; delete old.rise; if (S.load(JSON.stringify(old), WD).v < 24) no('ترقية V23');
const n = RI.now(G); console.log(`تركيا بعد سنة: المؤشر ${n.i}، ترتيب الجيش ${R.b.rk} ← ${n.rk}، تقرير: ${JSON.stringify(R.yr[0]).slice(0, 90)}`);
console.log(bad ? `❌ ${bad} مشاكل` : '✅ مسيرتنا تمام'); process.exit(bad ? 1 : 0);
