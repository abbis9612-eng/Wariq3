// فحص «الحركة الحقيقية» (WM10.6، I-064): الفيزياء ما تنغش. node tools/simtest3.ts
import { World } from '../src/sim2.ts';
import { AIR } from '../src/catalog.ts';
const G = 9.81, dt = .02, ang = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
let ok = true; const chk = (c: boolean, m: string) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
const w = new World(); const prev = new Map<number, any>(), gprev = new Map<number, any>();
let gOver = 0, turnNoBank = 0, turnSamples = 0, maxRoll = 0, inverted = 0, dives = 0, maxDive = 0, slip = 0, slipN = 0, turretOver = 0, rev = 0, scoot = 0, maxPull = 0, hardBank = 0, split = 0, breaks = 0, popups = 0;
const FLY = ['climb', 'transit', 'evade', 'rtb', 'land'];
while (w.t < 1500 && !(w.endT > 0 && w.t > w.endT)) { w.step(dt);
  for (const e of w.ev.splice(0)) { if (e.type === 'evade' && e.data?.split) split++; if (e.type === 'break') breaks++; if (e.type === 'popup') popups++; }
  for (const j of w.jets) { const p = prev.get(j.id);
    if (p && FLY.includes(j.st) && FLY.includes(p.st) && j.p.z > 5) {
      const dpsi = ang(j.hd - p.hd) / dt, V = j.spd, cg = Math.cos(j.gam);
      // الحمل اللازم للفة: n_h = ω·V·cosγ/g؛ لازم ما يتجاوز حد الطيارة
      const nh = Math.abs(dpsi) * V * Math.max(.15, cg) / G; if (nh > AIR[j.type].maxG + .3) gOver++;
      if (j.n > AIR[j.type].maxG + .05) gOver++; maxPull = Math.max(maxPull, j.n);
      // ما تلف بدون ميلان: اتجاه اللفة نفس اتجاه الجناح
      if (Math.abs(dpsi) > .03 && Math.abs(j.gam) < 1) { turnSamples++; if (Math.sign(dpsi) !== Math.sign(Math.sin(j.bank)) && Math.abs(Math.sin(j.bank)) > .05) turnNoBank++; }
      maxRoll = Math.max(maxRoll, Math.abs(ang(j.bank - p.bank)) / dt); if (Math.abs(j.bank) > 1.75) inverted++; if (Math.abs(j.bank) > 1.0) hardBank++;
      if (j.type === 'su25' && j.man === 'dive') { dives++; maxDive = Math.min(maxDive, j.gam); }
      // الارتفاع يتبع الأنف: vz = V·sinγ
      if (Math.abs(j.vz - V * Math.sin(j.gam)) > 1) gOver++;
    }
    prev.set(j.id, { hd: j.hd, bank: j.bank, st: j.st });
  }
  for (const g of w.gnd) { const p = gprev.get(g.id);
    if (p && g.st !== 'dead' && g.st !== 'gone') { const dx = g.p.x - p.x, dy = g.p.y - p.y, d = Math.hypot(dx, dy);
      if (d > .02) { slipN++; const along = (dx * Math.cos(g.hd) + dy * Math.sin(g.hd)) / d; if (Math.abs(along) < .95) slip++; if (along < -.95) rev++; }
      const tr = Math.abs(ang(g.turret - p.tur)) / dt, lim = ({ abrams: .73, t72: .42, bmp: .6 } as any)[g.type] ?? .5; if (tr > lim + .01) turretOver++;
      if (g.man === 'back') scoot++; }
    gprev.set(g.id, { x: g.p.x, y: g.p.y, tur: g.turret });
  }
}
chk(gOver === 0, `الطيارات ما تتجاوز حد الـG وارتفاعها من أنفها (مخالفات ${gOver})، أقصى حمل ${maxPull.toFixed(1)}G`);
chk(turnNoBank / Math.max(1, turnSamples) < .01, `اللفة دائماً باتجاه الميلان (${turnNoBank}/${turnSamples} عينة عكس)`);
chk(maxRoll <= 3.45, `سرعة لف الجناح محدودة: أقصى ${(maxRoll * 57.3).toFixed(0)}°/ث`);
chk(hardBank > 500, `ميلان حاد (>57°) بالمناورات: ${(hardBank * dt).toFixed(0)} ث`);
chk(popups >= 3 && dives > 100 && maxDive < -.3, `Su-25 تطلع وتغطس على الهدف: ${popups} طلعات، أعمق غطسة ${(-maxDive * 57.3).toFixed(0)}°`);
chk(breaks >= 3, `هبوط بكسر فوق المدرج (overhead break): ${breaks}`);
chk(slip / Math.max(1, slipN) < .002, `الدبابات ما تنزلق على جنب (${slip}/${slipN})`);
chk(turretOver === 0, `البرج يلف بسرعته الحقيقية (مخالفات ${turretOver})`);
chk(rev > 50 && scoot > 50, `دبابات ترجع لورا (shoot-and-scoot): ${(rev * dt).toFixed(0)} ث`);
console.log(`مقلوبة على ظهرها: ${(inverted * dt).toFixed(0)} ث، Split-S: ${split}`);
console.log(ok ? 'ALL PASS' : 'SOME FAIL'); process.exit(ok ? 0 : 1);
