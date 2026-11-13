import { newCruise, stepCruise, newInterceptor, stepInterceptor, MUZZLES, len, sub, terrainH } from '../src/sim.ts';
const dt = 1 / 120, LAUNCH = 8.0;
const c = newCruise(); const ms: any[] = []; let t = 0, hitT = -1;
let minAlt = 1e9;
while (t < 40) {
  t += dt; if (c.alive) stepCruise(c, dt);
  minAlt = Math.min(minAlt, c.p[1] - terrainH(c.p[0], c.p[2]));
  if (ms.length === 0 && t >= LAUNCH) { ms.push(newInterceptor(MUZZLES[0])); console.log('launch: cruise at', c.p.map(Math.round), 'range', Math.round(len(c.p)), 'm'); }
  if (ms.length === 1 && t >= LAUNCH + 1.4) ms.push(newInterceptor(MUZZLES[3]));
  for (const m of ms) if (stepInterceptor(m, c.alive ? c : null, dt) === 'hit' && c.alive) {
    c.alive = false; hitT = t;
    console.log(`HIT t=${t.toFixed(2)}s flight=${m.t.toFixed(2)}s at`, m.p.map(Math.round), 'range from battery', Math.round(len(m.p)), 'm', 'interceptor speed', Math.round(len(m.v)), 'm/s', 'miss', m.miss.toFixed(1));
  }
  if (hitT > 0 && t > hitT + 0.1) break;
}
if (hitT < 0) console.log('NO HIT. closest:', ms.map(m => m.miss.toFixed(1)), 'cruise', c.p.map(Math.round));
console.log('cruise min clearance over terrain', minAlt.toFixed(1), 'm');
// مقطع طيران الصاروخ المهاجم
const c2 = newCruise(); let mn = 1e9, at: number[] = [];
for (let tt = 0; tt < 45; tt += 1 / 60) { stepCruise(c2, 1 / 60); const cl = c2.p[1] - terrainH(c2.p[0], c2.p[2]); if (cl < mn) { mn = cl; at = c2.p.map(Math.round); } }
console.log('profile min clearance', mn.toFixed(1), 'at', at);
