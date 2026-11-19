// فحص الحفظ (GW7، I-089): نحفظ، نحمّل، نكمّل — ولازم الحرب تمشي بالضبط مثل ما لو ما انقطعت
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire(import.meta.url); const SIM = require('../sim.js'); const AIR = require('../air.js'); const SAVE = require('../save.js');
const rd = f => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8').split('=').slice(1).join('=').trim().replace(/;$/, ''));
const C = rd('cells.js'), RD = rd('roads.js');
let fails = 0; const check = (ok, m) => { console.log((ok ? '✅ ' : '❌ ') + m); if (!ok) fails++; };
const hour = (W, A, h) => { if (h % 6 === 0) { SIM.ai(W, 0); SIM.ai(W, 1); } SIM.step(W); if (A) AIR.step(A, W, SIM, 2); };
const fp = W => JSON.stringify({ t: W.t, ctrl: Array.from(W.ctrl), d: W.divs.map(d => [d.id, d.cell, d.dead, d.str.toFixed(6), d.org.toFixed(6), d.path.join('.')]), b: [...W.battles.keys()], wx: W.wx, br: W.bridges.map(b => b.down) });

// 1) الأرض بالضبط: نفس الحرب بعد التحميل
{
  const seed = 5, W1 = SIM.World(C, { seed, roads: RD }); SIM.scenario(W1);
  for (let h = 0; h < 24 * 10; h++) hour(W1, null, h);
  const txt = JSON.stringify(SAVE.snapshot(W1, null, SIM, { seed }));
  const nid = SIM.getNID(); const { W: W2 } = SAVE.restore(JSON.parse(txt), C, { roads: RD }, SIM, AIR); SIM.setNID(nid);
  check(fp(W1) === fp(W2), 'بعد التحميل الحالة نفسها بالضبط');
  // نكمّل الاثنين 20 يوم: لازم يمشون نفس الشي (W2 أول، وNID نرجعه بينهم لأن العدّاد مشترك)
  const n0 = SIM.getNID(); for (let h = 240; h < 240 + 24 * 20; h++) hour(W1, null, h); const n1 = SIM.getNID(); SIM.setNID(n0);
  for (let h = 240; h < 240 + 24 * 20; h++) hour(W2, null, h); SIM.setNID(n1);
  check(fp(W1) === fp(W2), 'بعد 20 يوم ثاني: الحرب المحمّلة مشت بالضبط مثل الأصلية (نفس المناطق والفرق والمعارك)');
  console.log(`  يوم ${W1.t / 24}: مناطق العراق ${[...W1.ctrl].filter(x => x === 0).length} / ${[...W2.ctrl].filter(x => x === 0).length}`);
}
// 2) الجو: المطارات والبطاريات والمخازن ترجع، والطيارات اللي بالجو ترجع لقواعدها
{
  const seed = 7, W = SIM.World(C, { seed, roads: RD }); SIM.scenario(W); const A = AIR.create(W);
  for (let h = 0; h < 24 * 15; h++) hour(W, A, h);
  A.sams[0].doc = 'save'; A.sams[0].prio = true; AIR.moveSite(A, 2, [A.sams[2].p[0] + 40, A.sams[2].p[1]]);
  const flying = A.planes.filter(p => p.st !== 'dead' && p.st !== 'fall').length, readyBefore = A.bases.reduce((s, b) => s + b.ready, 0);
  const s = SAVE.snapshot(W, A, SIM, { seed, ui: { cam: { x: 1, y: 2, s: .7 } } }); const txt = JSON.stringify(s);
  const R = SAVE.restore(JSON.parse(txt), C, { roads: RD }, SIM, AIR);
  const readyAfter = R.A.bases.reduce((s, b) => s + b.ready, 0);
  console.log(`  بالجو وقت الحفظ ${flying} طيارة · جاهزة قبل ${readyBefore} بعد ${readyAfter} · حجم الحفظ ${(txt.length / 1024).toFixed(0)} ك.ب`);
  check(readyAfter >= readyBefore && readyAfter <= readyBefore + flying, 'الطيارات اللي بالجو رجعت جاهزة لقواعدها');
  check(JSON.stringify(R.A.sams.map(x => [x.p, x.mags.map(m => [m.ready, m.stock, m.ready0]), x.doc, x.prio, !!x.mv])) === JSON.stringify(A.sams.map(x => [x.p, x.mags.map(m => [m.ready, m.stock, m.ready0]), x.doc, x.prio, !!x.mv])), 'البطاريات: مكانها وصواريخها وطريقة رميها ونقلها نفس الشي');
  check(JSON.stringify(R.A.pool) === JSON.stringify(A.pool) && JSON.stringify(R.A.kills) === JSON.stringify(A.kills), 'مخزون البلد والإسقاطات نفس الشي');
  check(R.ui.cam.s === .7, 'مكان الكاميرا ينحفظ');
  let err = null; try { for (let h = 0; h < 24 * 10; h++) hour(R.W, R.A, h); } catch (e) { err = e; }
  check(!err, 'الحرب المحمّلة تكمل 10 أيام بدون أخطاء' + (err ? ': ' + err.message : ''));
}
// 3) التخزين: كتابة آمنة، احتياط إذا خرب، ونسخة أحدث ترفض
{
  const mem = new Map(), st = { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  const W = SIM.World(C, { seed: 3, roads: RD }); SIM.scenario(W);
  SAVE.write(st, 0, SAVE.snapshot(W, null, SIM, { seed: 3 })); for (let h = 0; h < 24; h++) hour(W, null, h); SAVE.write(st, 0, SAVE.snapshot(W, null, SIM, { seed: 3 }));
  check(SAVE.read(st, 0).W.t === 24, 'آخر حفظ ينقرا');
  mem.set('gw.save.0', '{خربان'); check(SAVE.read(st, 0)?.W.t === 0, 'إذا الحفظ خرب ناخذ الاحتياط (الحفظ اللي قبله)');
  let threw = false; try { SAVE.migrate({ game: 'grandwar', v: SAVE.V + 1 }); } catch (e) { threw = true; } check(threw, 'حفظ من نسخة أحدث ما ينقرا غلط (يرفض بوضوح)');
  SAVE.remove(st, 0); check(SAVE.read(st, 0) === null, 'المسح يمسح الحفظ واحتياطه');
}
console.log(fails ? `❌ ${fails} فشل` : '✅ كل الفحوص نجحت'); process.exitCode = fails ? 1 : 0;
