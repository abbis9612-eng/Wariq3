// فحص المعركة البحرية القريبة («العالم» W13، D-054): node tests/wnavb.test.mjs
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const B = require('../prototypes/world/wnavb.js');
let bad = 0; const out = [], no = m => { bad++; out.push('❌ ' + m); };
const avg = (def, att, n = 40) => { const R = { sunk: 0, hit: 0, kill: 0, fired: 0, sam: 0, ciws: 0, t: 0 }; for (let i = 1; i <= n; i++) { const S = B.run(B.create(def, att, i * 97)); const r = B.result(S); R.sunk += Object.values(r.sunk).reduce((a, b) => a + b, 0); for (const k of ['hit', 'kill', 'fired', 'sam', 'ciws']) R[k] += r.stat[k]; R.t += S.t; } for (const k in R) R[k] = +(R[k] / n).toFixed(2); return R; };
// 1) أفق الرادار: أيجس (22 م) يشوف صاروخ على 7 م من ~30 كم
const h = B.HOR(22, 7); if (h < 25 || h > 35) no('أفق الرادار غلط: ' + h.toFixed(1)); out.push(`أفق رادار المدمرة لصاروخ واطي: ${h.toFixed(1)} كم`);
// 2) رشقة 6 C-802 من 60 كم على مجموعة ضاربة: أغلبها ينعترض
const csg = avg({ s: { cv: 1, dd: 2 } }, { from: [60, 0], n: 6, kind: 'c802' });
if (csg.hit > 1.2) no('المجموعة الضاربة انضربت هواية: ' + csg.hit); if (csg.kill < 4) no('اعتراض قليل: ' + csg.kill);
out.push(`6 نور على حاملة+2 مدمرة: انعترض ${csg.kill}، أصاب ${csg.hit}، غرق ${csg.sunk}، صواريخ دفاع ${csg.sam}، رشقات فالانكس ${csg.ciws}، المدة ${csg.t} ث`);
// 3) رشقة كبيرة 48 من اتجاهين: تشبّع، لازم يوصل قسم (الحوثيين بالبحر الأحمر ما وصلوا لهالعدد سوا)
const sat = avg({ s: { cv: 1, dd: 2 } }, { from: [40, 0], n: 48, kind: 'c802', gap: .15, spread: 30 });
if (sat.hit < .5) no('ما اكو تشبّع بـ48 صاروخ: ' + sat.hit);
out.push(`48 نور (تشبّع) على نفس المجموعة: انعترض ${sat.kill}، أصاب ${sat.hit}، غرق ${sat.sunk}`);
// 4) فرقاطة وحدة ضد 6: تنضرب
const ff = avg({ s: { ff: 1 } }, { from: [50, 0], n: 6, kind: 'c802' });
if (ff.hit < .5) no('الفرقاطة الوحدة لازم تنضرب: ' + ff.hit);
out.push(`6 نور على فرقاطة وحدة: انعترض ${ff.kill}، أصاب ${ff.hit}، غرقت ${ff.sunk}`);
// 5) زوارق ما عدها دفاع: كل إصابة تغرّق
const fac = avg({ s: { fac: 4 } }, { from: [40, 0], n: 4, kind: 'harpoon' });
if (fac.sunk < 2) no('الزوارق لازم تغرق بالهاربون: ' + fac.sunk);
out.push(`4 هاربون على 4 زوارق: غرق ${fac.sunk}`);
// 6) كاليبر (طور أخير أسرع) أصعب من نور
const kal = avg({ s: { ff: 2 } }, { from: [80, 0], n: 8, kind: 'kalibr', gap: 1 }), c12 = avg({ s: { ff: 2 } }, { from: [80, 0], n: 8, kind: 'c802', gap: 1 });
if (!(kal.hit >= c12.hit)) no(`كاليبر لازم أصعب (${kal.hit} مقابل ${c12.hit})`);
out.push(`8 كاليبر مقابل 8 نور على فرقاطتين: أصاب ${kal.hit} مقابل ${c12.hit}`);
// 7) حتمية: نفس البذرة = نفس النتيجة
const a = JSON.stringify(B.resolve({ s: { dd: 2 } }, { from: [50, 0], n: 8 }, 5)), b = JSON.stringify(B.resolve({ s: { dd: 2 } }, { from: [50, 0], n: 8 }, 5)); if (a !== b) no('مو حتمية');
// الطوربيدات (I-140): غواصتين ضد مجموعة حراسة تغرق شي وتخسر غواصة تقريباً، والرادار ما يشوف الطوربيد، والسونار يكشف
{ let sunk = 0, lost = 0, sam = 0; for (let i = 1; i <= 100; i++) { const r = B.resolve({ s: { dd: 2, ff: 1 } }, { from: [40, 0], n: 0, subs: 2, kind: 'torp' }, i, 1); sunk += Object.values(r.sunk).reduce((a, b) => a + b, 0); lost += r.subLost; sam += r.stat.sam; }
  if (!(sunk / 100 > .3 && sunk / 100 < 1.5)) no('الطوربيدات: غرق ' + sunk / 100); if (!(lost / 100 > .4)) no('السونار ما يصيد غواصات ' + lost / 100); if (sam) no('الرادار اعترض طوربيد');
  const r = B.resolve({ s: { amp: 2 } }, { from: [40, 0], n: 0, subs: 2, kind: 'torp' }, 5, 1); if (r.subLost) no('سفن الإنزال ما عدها سونار'); console.log(`طوربيدات: غرق ${sunk / 100} · غواصات خسرت ${lost / 100}`); }

console.log(out.join('\n')); console.log(bad ? `\n❌ ${bad} مشكلة` : '\n✅ المعركة البحرية سليمة'); process.exit(bad ? 1 : 0);
