// فحص محرك مشهد المعركة: أرقام حقيقية (مسافات الرمي، أزمنة الطيران، السرعات) ونتائج منطقية
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const BV = require('../bv.js');
const cases = [
  ['مدرعة ضد مشاة (سهل)', 'plain', [{ kind: 'arm', str: 1, n: 'م3' }], [{ kind: 'inf', str: 1, n: 'م40' }], { att: 2, def: 0 }],
  ['مدرعة+آلية ضد مشاة×2 (مدينة)', 'city', [{ kind: 'arm', str: 1, n: 'م3' }, { kind: 'mec', str: 1, n: 'م5' }], [{ kind: 'inf', str: 1, n: 'م40' }, { kind: 'inf', str: 1, n: 'م41' }], { att: 1, def: 1 }],
  ['مشاة ضد مدرعة (هجوم فاشل؟)', 'plain', [{ kind: 'inf', str: 1, n: 'م11' }], [{ kind: 'arm', str: 1, n: 'م92' }], { att: 0, def: 1 }],
  ['آلية ضد آلية (أهوار)', 'marsh', [{ kind: 'mec', str: .8, n: 'م5' }], [{ kind: 'mec', str: .8, n: 'م92' }], { att: 1, def: 1 }],
];
for (const [name, terr, a, d, air] of cases) {
  const res = { win: {}, t: 0, la: 0, ld: 0 }; const st = { gunD: [], atgmT: [], artyT: [], maxV: 0, jets: 0, manpad: 0, kills: 0, firstShot: null };
  for (let seed = 1; seed <= 6; seed++) {
    const B = BV.create({ seed, terr, att: { side: 0, divs: a }, def: { side: 1, divs: d }, air });
    let n0 = 0;
    for (let i = 0; i < 700 * 10 && !(B.over && B.t > B.over.t + 1); i++) {
      BV.step(B, .1);
      for (const u of B.units) st.maxV = Math.max(st.maxV, Math.abs(u.spd));
      for (; n0 < B.ev.length; n0++) { const e = B.ev[n0]; if (e.k === 'gun') { const s = B.shots[B.shots.length - 1]; if (s && s.k === 'shell') st.gunD.push(Math.hypot(s.tx - s.x, s.ty - s.y)); if (st.firstShot == null) st.firstShot = B.t; } if (e.k === 'atgm') { const s = B.shots.filter(x => x.k === 'atgm').pop(); if (s) st.atgmT.push(s.dur); } if (e.k === 'artyfire') st.artyT.push(e.eta); if (e.k === 'jetin') st.jets++; if (e.k === 'manpad') st.manpad++; if (e.k === 'kill') st.kills++; }
    }
    res.win[B.over?.win || 'none'] = (res.win[B.over?.win || 'none'] || 0) + 1; res.t += B.over ? B.over.t : B.t; res.la += B.lost[0]; res.ld += B.lost[1];
  }
  const avg = a2 => a2.length ? (a2.reduce((s, x) => s + x, 0) / a2.length) : 0;
  console.log(`${name}: نتيجة ${JSON.stringify(res.win)} | مدة ~${(res.t / 6 / 60).toFixed(1)} دقيقة | خسائر مهاجم ${(res.la / 6).toFixed(1)} مدافع ${(res.ld / 6).toFixed(1)}`);
  console.log(`   مسافة رمي الدبابة ~${avg(st.gunD).toFixed(0)} م (أقصى ${Math.max(0, ...st.gunD).toFixed(0)}) | طيران صاروخ ضد دروع ~${avg(st.atgmT).toFixed(1)} ث | مدفعية تطير ~${avg(st.artyT).toFixed(0)} ث | أعلى سرعة ${st.maxV.toFixed(1)} م/ث | أول رمية بعد ${st.firstShot?.toFixed(0)} ث | طيارات ${st.jets} دفاع محمول ${st.manpad}`);
}
