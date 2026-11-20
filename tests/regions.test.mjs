// فحص مناطق العالم (GW12 W2.1): كل منطقة إلها شكل، الجيران متبادلين، كل دولة إلها مناطق كافية
// node tests/regions.test.mjs
import fs from 'fs';
const J = f => JSON.parse(fs.readFileSync(new URL('../data/world/' + f, import.meta.url), 'utf8'));
const C = J('countries.json'), R = J('regions.json').r, G = J('regions_geo.json');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; };
const ids = new Set(C.map(c => c.id)), byId = new Map(R.map(r => [r.id, r]));
if (byId.size !== R.length) no('أرقام مناطق مكررة');
for (const r of R) {
  if (r.c && !ids.has(r.c)) no(`${r.id}: دولة مو بالقائمة ${r.c}`);
  if (!G[r.id] || !G[r.id].length) no(`${r.id}: بلا شكل`);
  if (!(r.a > 0)) no(`${r.id}: مساحة ${r.a}`);
  for (const n of r.nb) { const o = byId.get(n); if (!o) no(`${r.id}: جار مو موجود ${n}`); else if (!o.nb.includes(r.id)) no(`${r.id}↔${n}: الجيرة مو متبادلة`); }
}
const MIN = { A: 8, B: 4, C: 2 }, cnt = {};
for (const r of R) if (r.c) cnt[r.c] = (cnt[r.c] || 0) + 1;
for (const c of C) if (!cnt[c.id]) no(`${c.id}: بلا مناطق`); else if (cnt[c.id] < MIN[c.tier] && R.filter(r => r.c === c.id).reduce((t, r) => t + r.a, 0) > 3000 * MIN[c.tier]) no(`${c.id}: ${cnt[c.id]} مناطق بس`);
const land = R.filter(r => r.c).length, iso = R.filter(r => !r.nb.length).length;
console.log(`مناطق ${R.length} (دول ${land}، محايدة ${R.length - land}) · جزر بلا جار بري ${iso} · العراق ${cnt.IRQ} · إيران ${cnt.IRN}`);
console.log(bad ? `\n❌ ${bad} مشكلة` : '\n✅ المناطق سليمة'); process.exit(bad ? 1 : 0);
