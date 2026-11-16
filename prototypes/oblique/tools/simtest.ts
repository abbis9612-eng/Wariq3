// فحص المنطق رياضياً (D-011): node tools/simtest.ts
import { World } from '../src/sim.ts';
let ok = true; const chk = (c: boolean, msg: string) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) ok = false; };
const w = new World(7), dt = .01; let ign: any = null, maxTurn = 0, prevHd = w.jets.map(j => j.hd), samLaunch: number[] = [], killT = -1, missD = -1, bmApex = 0, bmLaunch = -1, pacKill: any = null, ejectPos: any = null;
while (w.t < 600 && !(w.phase === 'bm' && w.endT > 0 && w.t > w.endT)) {
  w.step(dt);
  w.jets.forEach((j, i) => { if (j.st !== 'hit' && j.st !== 'gone') maxTurn = Math.max(maxTurn, Math.abs(Math.atan2(Math.sin(j.hd - prevHd[i]), Math.cos(j.hd - prevHd[i]))) / dt); prevHd[i] = j.hd; });
  for (const e of w.ev.splice(0)) {
    if (e.type === 'sam_eject') { samLaunch.push(e.t); if (!ejectPos) ejectPos = e.p; }
    if (e.type === 'ignite' && !ign) ign = e;
    if (e.type === 'kill_jet') killT = e.t;
    if (e.type === 'selfdestruct' && e.data?.miss) missD = e.data.miss;
    if (e.type === 'bm_launch') bmLaunch = e.t;
    if (e.type === 'kill_bm') pacKill = { ...e, d: Math.hypot(e.p.x - w.pat.p.x, e.p.y - w.pat.p.y) };
  }
  const bm = w.msls.find(m => m.kind === 'bm'); if (bm) bmApex = Math.max(bmApex, bm.p.z);
}
chk(!!ign && ign.p.z - ejectPos.z > 20 && ign.p.z - ejectPos.z < 40 && Math.hypot(ign.p.x - ejectPos.x, ign.p.y - ejectPos.y) < 1, `S-400: يطّرد عمودي ويشتعل على ارتفاع ${ign && (ign.p.z - ejectPos.z).toFixed(1)} م فوق الأنبوب`);
chk(samLaunch.length === 2 && samLaunch[0] > 12, `S-400 رمى صاروخين بعد رفع الأنابيب (${samLaunch.map(t => t.toFixed(1)).join(', ')} ث)`);
chk(killT > 0 && killT - samLaunch[0] < 45, `الصاروخ الأول أصاب الطيارة القائدة بعد ${(killT - samLaunch[0]).toFixed(1)} ث`);
chk(missD > 150, `الصاروخ الثاني فات الطيارة الثانية بمسافة ${missD.toFixed(0)} م ودمّر نفسه`);
chk(maxTurn < .32, `أقصى لفة للطيارات ${maxTurn.toFixed(2)} راد/ث (بدون قلب مفاجئ)`);
chk(bmLaunch > 0 && bmApex > 35000 && bmApex < 110000, `الباليستي انطلق (${bmLaunch.toFixed(0)} ث) وأعلى ارتفاع ${(bmApex / 1000).toFixed(1)} كم`);
chk(!!pacKill && pacKill.p.z > 6000 && pacKill.p.z < 35000 && pacKill.d < 45000, `باتريوت اعترض على ارتفاع ${pacKill && (pacKill.p.z / 1000).toFixed(1)} كم وبعد ${pacKill && (pacKill.d / 1000).toFixed(1)} كم من المنصة`);
// بدون باتريوت: الباليستي لازم يوصل البصرة
const w2 = new World(7, false); let imp: any = null; while (w2.t < 900 && !imp) { w2.step(.02); for (const e of w2.ev.splice(0)) if (e.type === 'bm_impact') imp = e; }
const B = { x: w2.zolf.p.x, y: 0 }; void B; const tgt = (await import('../src/sim.ts')).SITES.basra;
chk(!!imp && Math.hypot(imp.p.x - tgt.x, imp.p.y - tgt.y) < 3000, `بدون باتريوت الباليستي ينزل على البصرة (خطأ ${imp && (Math.hypot(imp.p.x - tgt.x, imp.p.y - tgt.y) / 1000).toFixed(2)} كم، الرحلة ${imp && (imp.t - w2.bmT0).toFixed(0)} ث)`);
console.log(ok ? 'ALL PASS' : 'SOME FAIL'); process.exit(ok ? 0 : 1);
