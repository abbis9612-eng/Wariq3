// فحص «العملية الكاملة» (D-011): node tools/simtest2.ts
import { World } from '../src/sim2.ts';
let ok = true; const chk = (c: boolean, m: string) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
const w = new World(3), dt = .02, cnt: Record<string, number> = {}; let maxTurn = 0, ign: any = null, ej: any = null; const prev = new Map<number, number>();
while (w.t < 2600 && !(w.endT > 0 && w.t > w.endT)) { w.step(dt);
  for (const j of w.jets) { if (['transit', 'climb', 'rtb', 'land', 'evade'].includes(j.st)) { const p = prev.get(j.id); if (p !== undefined) maxTurn = Math.max(maxTurn, Math.abs(Math.atan2(Math.sin(j.hd - p), Math.cos(j.hd - p))) / dt); } prev.set(j.id, j.hd); }
  for (const e of w.ev.splice(0)) { cnt[e.type] = (cnt[e.type] || 0) + 1; if (e.type === 'sam_eject' && !ej) ej = e; if (e.type === 'ignite' && !ign) ign = e; } }
console.log(JSON.stringify(cnt)); console.log('stats', JSON.stringify(w.stats), 't', w.t.toFixed(0));
chk((cnt.takeoff || 0) >= 9, `إقلاع ${cnt.takeoff} طيارات (عراق 8 + F-14)`);
chk(!!ign && ign.p.z - ej.p.z > 18 && ign.p.z - ej.p.z < 40, `S-400 إطلاق بارد: اشتعل على ${ign && (ign.p.z - ej.p.z).toFixed(0)} م فوق الأنبوب`);
chk((cnt.sam_kill || 0) >= 1, `HARM دمّر منصات S-400: ${cnt.sam_kill || 0}`);
chk((cnt.kill_jet || 0) >= 1 && w.stats.lostA[0] <= 4, `طيارات سقطت: عراق ${w.stats.lostA[0]}، إيران ${w.stats.lostA[1]}`);
chk((cnt.landed || 0) >= 3, `طيارات رجعت وهبطت: ${cnt.landed || 0}`);
chk((cnt.kill_bm || 0) >= 1, `باتريوت اعترض باليستي: ${cnt.kill_bm || 0} من ${w.stats.bm}`);
chk(w.stats.lostG[1] >= 6 && w.stats.lostG[0] >= 2, `دروع: خسائر العراق ${w.stats.lostG[0]}، إيران ${w.stats.lostG[1]}`);
chk((cnt.reinforce || 0) >= 1, 'وصلت تعزيزات ورتل إمداد');
chk(w.won, 'الهجوم وصل خرمشهر');
chk(maxTurn < .4, `أقصى لفة طيارات ${maxTurn.toFixed(2)} راد/ث`);
console.log(ok ? 'ALL PASS' : 'SOME FAIL'); process.exit(ok ? 0 : 1);
