// فحص الدفاع الجوي (GW5، I-086): كل نظام لحاله ضد تهديدات حقيقية، مئات المرات، ونطبع نسب الاعتراض.
// node tests/ad.test.mjs [عدد المحاولات]
import { createRequire } from 'module';
const require = createRequire(import.meta.url); const AIR = require('../air.js');
const N = +(process.argv[2] || 200);
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const SIM = { airHit() { } };
const fakeW = () => ({ rnd, battles: new Map(), cells: [], divs: [], ctrl: [], N: 0, t: 0 });
const site = (sys, ll = [33.25, 44.5], side = 0) => ({ n: sys, ll, side, sys });
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) fails++; };

// يشغّل سيناريو لحد ما تخلص كل الذخائر؛ يرجع [اعترضنا، وصل، صواريخ دفاع انطلقت]
function run(sams, raid, opt = {}) {
  const W = fakeW(); const A = AIR.create(W, { sams, bases: opt.bases || [], mbases: [], raidCd: 1e9 });
  raid(A);
  let t = 0; while (t < 200 && A.msls.some(m => !m.done && (m.kind === 'bm' || m.kind === 'uav' || m.kind === 'cm'))) { AIR.step(A, W, SIM, .02); t += .02; }
  const fired = A.sams.reduce((s, x) => s + x.fired, 0);
  return { down: A.stat.tbm[0] + A.stat.uav[0] + A.stat.cm[0], hit: A.stat.tbm[1] + A.stat.uav[1] + A.stat.cm[1], fired, A };
}
const P0 = AIR.LL(33.25, 44.5);                 // بغداد
const from = (km, deg = 90) => [P0[0] + Math.cos(deg * Math.PI / 180) * km, P0[1] - Math.sin(deg * Math.PI / 180) * km];
const near = (r = 4) => [P0[0] + (rnd() - .5) * r, P0[1] + (rnd() - .5) * r];
function trials(label, sams, raid, n = N) {
  let d = 0, h = 0, f = 0; for (let i = 0; i < n; i++) { const r = run(sams(), raid); d += r.down; h += r.hit; f += r.fired; }
  const rate = d / Math.max(1, d + h); console.log(`  ${label}: اعتراض ${(rate * 100).toFixed(0)}% (${d} من ${d + h}) · صواريخ دفاع لكل تهديد ${(f / Math.max(1, d + h)).toFixed(2)}`); return { rate, perThreat: f / Math.max(1, d + h) };
}

console.log('— باليستي (فاتح-110 من 300 كم) على مدينة محمية —');
const pac4 = trials('باتريوت ضد 4 باليستي', () => [site('pac')], A => { for (let i = 0; i < 4; i++) AIR.spawn(A, 'bm', from(300, 85 + i), near(), { mun: 'fateh' }); });
check(pac4.rate > .7 && pac4.rate < .97, 'باتريوت يعترض أغلب صلية صغيرة بس مو كلها (70–97%)');
const pac16 = trials('باتريوت ضد 16 باليستي سوا (إغراق)', () => [site('pac')], A => { for (let i = 0; i < 16; i++) AIR.spawn(A, 'bm', from(300, 80 + i), near(), { mun: 'fateh' }); });
check(pac16.rate < pac4.rate - .1, 'الإغراق ينزّل نسبة الاعتراض (قنوات وصواريخ جاهزة محدودة)');
const far = trials('باليستي على هدف 80 كم بعيد عن الباتريوت', () => [site('pac')], A => { for (let i = 0; i < 4; i++) AIR.spawn(A, 'bm', from(300, 85 + i), from(80, 0), { mun: 'fateh' }); }, 60);
check(far.rate === 0, 'الباتريوت ما يحمي ضد الباليستي إلا ~20–35 كم حوله');
const pan = trials('بانتسير وحده ضد 4 باليستي', () => [site('pantsir')], A => { for (let i = 0; i < 4; i++) AIR.spawn(A, 'bm', from(300, 85 + i), near(), { mun: 'fateh' }); }, 60);
check(pan.rate === 0, 'بانتسير ما يضرب باليستي');

console.log('— مسيّرات شاهد-136 —');
const pacU = trials('باتريوت وحده ضد 12 مسيّرة', () => [site('pac')], A => { for (let i = 0; i < 12; i++) AIR.spawn(A, 'uav', from(250, 70 + i * 3), near()); }, 80);
const panU = trials('باتريوت + بانتسير ضد 12 مسيّرة', () => [site('pac'), site('pantsir', [33.27, 44.52])], A => { for (let i = 0; i < 12; i++) AIR.spawn(A, 'uav', from(250, 70 + i * 3), near()); }, 80);
check(panU.rate > .8, 'الطبقة القريبة (بانتسير) توقف أغلب المسيّرات');

console.log('— صواريخ كروز واطية (40 م) —');
const pacC = trials('باتريوت ضد 4 كروز', () => [site('pac')], A => { for (let i = 0; i < 4; i++) AIR.spawn(A, 'cm', from(400, 80 + i * 4), near()); }, 100);
const both = trials('باتريوت + بانتسير ضد 4 كروز', () => [site('pac'), site('pantsir', [33.27, 44.52])], A => { for (let i = 0; i < 4; i++) AIR.spawn(A, 'cm', from(400, 80 + i * 4), near()); }, 100);
check(both.rate > pacC.rate, 'الطبقات سوا أحسن من طبقة وحدة');

console.log('— ضربة مركّبة (مثل نيسان 2024): 16 مسيّرة + 4 كروز + 10 باليستي توصل سوا —');
const mix = trials('باتريوت + بانتسير', () => [site('pac'), site('pantsir', [33.27, 44.52])], A => {
  const R = 300, Tu = R / AIR.MUN.shahed.v; // كل شي يوصل سوا: المسيّرة تنطلق أول، والكروز بعدها، والباليستي آخر شي
  for (let i = 0; i < 16; i++) AIR.spawn(A, 'uav', from(R, 70 + i * 3), near());
  for (let i = 0; i < 4; i++) AIR.spawn(A, 'cm', from(R, 80 + i * 5), near()).t = -(Tu - R / AIR.MUN.paveh.v);
  for (let i = 0; i < 10; i++) AIR.spawn(A, 'bm', from(R, 85 + i), near(), { mun: 'fateh' }).t = -(Tu - (2 + R / 120));
}, 60);
check(mix.rate > .5 && mix.rate < .95, 'الضربة المركّبة: أغلبها ينعترض بس شي يوصل');

console.log('— أفق الرادار والطيارات —');
{ const S = AIR.SYS.s300; const hi = AIR.HOR(S.hm, 7), lo = AIR.HOR(S.hm, .1);
  console.log(`  S-300 (هوائي ${S.hm} م): يشوف طيارة على 7 كم لحد ${hi.toFixed(0)} كم، وعلى 100 م لحد ${lo.toFixed(0)} كم بس`);
  check(lo < 70 && hi > 300, 'الطيران الواطي يتخبى ورا الأفق'); }
{ // S-300 ضد طيارتين F-16 عالية جاية عليه، و2 سوخوي-25 واطية
  let k = 0, kl = 0; const n = 60;
  for (let i = 0; i < n; i++) {
    const W = fakeW(); const A = AIR.create(W, { sams: [site('s300', [33.25, 44.5], 1)], bases: [{ n: 'ق', rw: 0, ll: [33.25, 42.0], side: 0, type: 'f16', planes: 4 }], mbases: [], raidCd: 1e9 });
    const mk = (type, z, dy) => { const p = { id: A.id++, fid: 1, slot: 0, side: 0, type, base: 0, x: P0[0] - (type === 'su25' ? 60 : 180), y: P0[1] + dy, z, h: 0, v: 0, m: { kind: 'cap', p: [P0[0] + 300, P0[1]] }, st: 'out', t: 0, shots: 0, harm: 0, bombs: 0, zT: z, alt: 0, bank: 0, gam: 0, flares: 30, vx: 0, vy: 0, vz: 0, trk: [] }; A.planes.push(p); return p; };
    mk('f16', 7, 0); const lp = mk('su25', .08, 75); lp.m = { kind: 'cas', p: [P0[0] + 45, P0[1] + 75] };  // تمر على بعد 75 كم من البطارية
    for (let t = 0; t < 5; t += .02) AIR.step(A, W, SIM, .02);   // 5 دقايق: مرحلة العبور بس (قبل ما الواطية تصعد للضربة)
    k += A.planes.some(p => p.type === 'f16' && p.st !== 'fall') ? 0 : 1; kl += A.planes.some(p => p.type === 'su25' && p.st !== 'fall') ? 0 : 1;
  }
  console.log(`  S-300 أسقط F-16 العالية (جاية عليه) ${k}/${n}، وسوخوي-25 الواطية (100 م تمر على 75 كم) ${kl}/${n}`);
  check(k > kl, 'العالية تنضرب أكثر من الواطية');
}
console.log('— تحكّم اللاعب (GW5b) —');
{ // طريقة الرمي: «وفّر» يصرف أقل، «كل شي» يصرف أكثر، «صامت» ما يرمي
  const mk = doc => () => { const x = site('pac'); return [x]; };
  const withDoc = doc => trials(`باتريوت «${doc}» ضد 12 مسيّرة`, () => [site('pac')], A => { A.sams[0].doc = doc; for (let i = 0; i < 12; i++) AIR.spawn(A, 'uav', from(250, 70 + i * 3), near()); }, 40);
  const n = withDoc('normal'), sv = withDoc('save'), al = withDoc('all'), sl = withDoc('silent');
  check(sv.perThreat < n.perThreat, '«وفّر» يصرف صواريخ أقل');
  check(al.perThreat >= n.perThreat, '«كل شي» يصرف أكثر أو نفس');
  check(sl.rate === 0 && sl.perThreat === 0, '«صامت» ما يرمي أبداً');
}
{ // نقل بطارية باتريوت 120 كم: تفكيك ساعة + 3 ساعات طريق + نصب ساعة ≈ 5 ساعات
  const W = fakeW(); const A = AIR.create(W, { sams: [site('pac')], bases: [], mbases: [], raidCd: 1e9 });
  const to = [A.sams[0].p[0] + 120, A.sams[0].p[1]]; AIR.moveSite(A, 0, to); let h = 0;
  while (A.sams[0].mv && h < 20) { W.t++; h++; AIR.step(A, W, SIM, .02); }
  console.log(`  نقل باتريوت 120 كم خلص بـ ${h} ساعة، ومكانها الجديد يبعد ${Math.hypot(A.sams[0].p[0] - to[0], A.sams[0].p[1] - to[1]).toFixed(1)} كم عن الهدف`);
  check(h >= 5 && h <= 6, 'النقل ياخذ وقت حقيقي (تفكيك + طريق + نصب)');
}
console.log(fails ? `❌ ${fails} فشل` : '✅ كل الفحوص نجحت');
process.exitCode = fails ? 1 : 0;
