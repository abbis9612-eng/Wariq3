// فحص التوقّع (GW11 B3): نتوقّع هجوم، وبعدين نسوي الهجوم نفسه بالمحاكاة (بدون ذكاء)، 50 حالة: معدل التوقّع قريب من النتيجة الحقيقية
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire(import.meta.url); const SIM = require('../sim.js');
const rd = f => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8').split('=').slice(1).join('=').trim().replace(/;$/, ''));
const C = rd('cells.js'), RD = rd('roads.js');
let fails = 0; const check = (ok, m) => { console.log((ok ? '✅ ' : '❌ ') + m); if (!ok) fails++; };
const rows = [];
for (let seed = 1; rows.length < 50 && seed < 400; seed++) {
  const W = SIM.World(C, { seed, roads: RD }); SIM.scenario(W);
  for (let h = 0; h < 24 * (seed % 5); h++) { if (h % 6 === 0) { SIM.ai(W, 0); SIM.ai(W, 1); } SIM.step(W); }
  for (const d of W.divs) { d.path = []; d.mode = 'hold'; }
  // هدف: منطقة إيرانية بيها فرق، وجنبها فرقنا (1–3 فرق)
  const F = SIM.frontCells(W, 0); let pick = null;
  for (const f of F.sort(() => (seed % 3) - 1)) { for (const j of W.cells[f].nb) { if (W.ctrl[j] === 1 && W.divs.some(d => !d.dead && d.cell === j && d.side === 1)) { const att = W.divs.filter(d => !d.dead && d.side === 0 && W.cells[d.cell].nb.includes(j)).slice(0, 1 + seed % 3); if (att.length) { pick = { j, att }; break; } } } if (pick) break; }
  if (!pick) continue;
  const fc = SIM.forecast(W, pick.att, pick.j); if (!fc || fc.empty) continue;
  for (const d of pick.att) { d.path = [pick.j]; d.prog = 0; d.mode = 'manual'; }
  W.cool = new Map(); let won = false;
  for (let h = 0; h < 168; h++) { SIM.step(W); if (W.ctrl[pick.j] === 0 || !W.divs.some(d => !d.dead && d.cell === pick.j && d.side === 1)) { won = true; break; } if (pick.att.every(d => d.dead || !d.path.length)) break; }
  rows.push({ f: fc.chance, won });
}
const mf = rows.reduce((s, r) => s + r.f, 0) / rows.length, mw = rows.filter(r => r.won).length / rows.length;
const hiF = rows.filter(r => r.f >= .6), loF = rows.filter(r => r.f <= .4);
console.log(`حالات ${rows.length}: معدل التوقّع ${(mf * 100).toFixed(0)}٪، النتيجة الحقيقية ${(mw * 100).toFixed(0)}٪ · التوقّع ≥60٪ نجح ${hiF.filter(r => r.won).length}/${hiF.length} · التوقّع ≤40٪ نجح ${loF.filter(r => r.won).length}/${loF.length}`);
check(rows.length >= 40, 'اكو حالات كافية');
check(Math.abs(mf - mw) <= .15, 'معدل التوقّع ضمن ±15٪ من النتيجة الحقيقية');
check(!hiF.length || !loF.length || hiF.filter(r => r.won).length / hiF.length > loF.filter(r => r.won).length / Math.max(1, loF.length), 'التوقّع العالي ينجح أكثر من الواطي');
console.log(fails ? `\n❌ ${fails} فشل` : '\n✅ كل الفحوص نجحت'); process.exit(fails ? 1 : 0);
