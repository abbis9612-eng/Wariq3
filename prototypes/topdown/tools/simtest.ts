// فحص المنطق (D-011): node tools/simtest.ts
import { World, SITES } from '../src/sim.ts';
let ok = true; const chk = (c: boolean, m: string) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
const w = new World(7), dt = .01; let lift = 0, launch: number[] = [], kill = -1, miss = -1, landed = -1, pk: any = null, maxTurn = 0; const prev = w.jets.map(j => j.hd);
while (w.t < 1500 && !(w.phase === 'bm' && w.endT > 0 && w.t > w.endT && landed > 0)) { w.step(dt);
  w.jets.forEach((j, i) => { if (['ingress', 'break', 'notch', 'egress', 'land', 'climb'].includes(j.st)) maxTurn = Math.max(maxTurn, Math.abs(Math.atan2(Math.sin(j.hd - prev[i]), Math.cos(j.hd - prev[i]))) / dt); prev[i] = j.hd; });
  for (const e of w.ev.splice(0)) { if (e.type === 'liftoff') lift++; if (e.type === 'sam_eject') launch.push(e.t); if (e.type === 'kill_jet') kill = e.t; if (e.type === 'selfdestruct' && e.data?.miss) miss = e.data.miss; if (e.type === 'landed') landed = e.t; if (e.type === 'kill_bm') pk = e; } }
chk(lift === 2, 'الطيارتين أقلعن من قاعدة البصرة');
chk(launch.length === 2, `S-400 رمى صاروخين (${launch.map(t => t.toFixed(0)).join(', ')} ث)`);
chk(kill > 0, `الأولى انضربت (${kill.toFixed(0)} ث)`);
chk(miss > 150, `الثانية نجت (الصاروخ فات بـ ${miss.toFixed(0)} م)`);
chk(landed > 0, `الثانية رجعت وهبطت بالقاعدة (${landed.toFixed(0)} ث)`);
chk(maxTurn < .32, `أقصى لفة ${maxTurn.toFixed(2)} راد/ث`);
chk(!!pk && pk.p.z > 6000, `باتريوت اعترض الباليستي على ${pk && (pk.p.z / 1000).toFixed(1)} كم`);
void SITES; console.log(ok ? 'ALL PASS' : 'SOME FAIL'); process.exit(ok ? 0 : 1);
