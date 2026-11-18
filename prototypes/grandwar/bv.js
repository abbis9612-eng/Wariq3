// «مشهد المعركة الحقيقي» BV1 (I-085): محرك معركة بالمتر والثانية الحقيقية. بدون رسم؛ ينفحص بـ Node (tests/bv.test.mjs).
// مأخوذ من «الحرب من فوق» WM10 (topdown/src/sim2.ts، مجمّد — نسخنا الأفكار والأرقام بس) و«المعركة الكلاسيكية» BC4:
//  - سياقة دبابة: تسارع وفرملة، لفة بمكانها لما بطيئة، رجوع لورا لو الهدف خلفها وقريب، تتجنب الجيران.
//  - برج يلف بسرعته الحقيقية (أبرامز ~42°/ث، T-72 ~24°/ث)، رمي من توقف قصير بس لما يصوّب، تلقيم 6–8 ث.
//  - إصابة حسب المسافة والجيل والحفرة والحركة، والجنب أضعف من القدام.
//  - المهاجم بقفزات (فصيل يتقدّم وفصيل يغطي، يتبادلون كل ~14 ث)؛ المدافع بحفر «يضرب ويرجع» (shoot-and-scoot).
//  - المدرعات تنزّل المشاة قريب، والمشاة يرمون رصاص وRPG (300 م) وصواريخ ضد الدروع (3.5 كم، ~15 ث طيران).
//  - مدفعية من ورا الأفق: القذيفة توصل بعد ~30–40 ث من الطلب. تمهيد قبل الهجوم.
//  - طيارة إسناد تدخل من الحافة بسرعتها الحقيقية: واطي ← صعود ← غطس ← رمي ← سحب ومشاعل؛ دفاع جوي محمول يرمي عليها.
// المحاور: x شرق، y جنوب (لتحت على الشاشة). المهاجم يجي من تحت (y موجب)، المدافع فوق.
(function (root) {
  const R0 = s => { let a = s >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const angd = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  const D2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  // الأنواع بأرقام تقريبية من معلومات عامة [ASSUMPTION]
  const T = {
    abrams: { k: 'tank', len: 9.8, v: 9, tr: .73, gun: 3000, rl: 6.5, acc: .82, armF: .65, armS: .25, gen: 3 },
    t72: { k: 'tank', len: 9.5, v: 8, tr: .42, gun: 2800, rl: 7.5, acc: .66, armF: .45, armS: .15, gen: 2 },
    bmp: { k: 'ifv', len: 6.7, v: 9, tr: .6, gun: 1500, rl: 3.5, acc: .55, armF: .12, armS: .05, gen: 2, atgm: 4000, troops: 6 },
    truck: { k: 'truck', len: 6.5, v: 10, tr: 0, gun: 0, rl: 0, acc: 0, armF: 0, armS: 0, gen: 1, troops: 10 },
  };
  const W_DIM = { w: 6000, h: 5200 }; // ساحة المعركة بالمتر

  function create(o) {
    // o: { seed, terr, att:{side, divs:[{kind, str, n, gen}]}, def:{...}, air:{att:n, def:n}, manpads:[n,n] }
    const r = R0(o.seed || 7);
    const B = { t: 0, r, terr: o.terr || 'plain', units: [], shots: [], ev: [], jets: [], arty: [], nid: 1, side: { att: o.att.side, def: o.def.side }, phase: 'prep', over: null,
      morale: [1, 1], lost: {}, init: {}, obj: { x: 0, y: -1300 }, cover: [] };
    // غطاء الأرض (نخل/بيوت/صخور) يقلل الإصابة ويخفي
    const nCov = { city: 60, marsh: 34, hills: 24, mount: 30, plain: 16, desert: 8 }[B.terr] ?? 14;
    for (let i = 0; i < nCov; i++) B.cover.push({ x: (r() - .5) * W_DIM.w * .9, y: (r() - .5) * W_DIM.h * .8, rad: 25 + r() * 60, kind: B.terr === 'city' ? 'house' : B.terr === 'marsh' ? 'reed' : B.terr === 'desert' ? 'rock' : r() < .5 ? 'palm' : 'rock' });
    const mk = (side, att) => {
      const F = att ? o.att : o.def; let plt = side * 100;
      F.divs.forEach((dv, di) => {
        const st = clamp(dv.str ?? 1, .1, 1); const cx = (di - (F.divs.length - 1) / 2) * 750; // قطاع من المعركة (~2 كم جبهة)
        const add = (type0, n, row) => { const type = type0 === 'tank' ? (side ? 't72' : 'abrams') : type0; const n2 = Math.max(1, Math.round(n * st)); plt++; for (let i = 0; i < n2; i++) { const x = cx + (i - (n2 - 1) / 2) * (type === 'truck' ? 70 : 105) + (r() - .5) * 30; const y = att ? 3300 + row * 200 + (r() - .5) * 50 : -1300 - row * 170 + (r() - .5) * 50;
          const u = { id: B.nid++, side, att, type, div: dv.n, plt, p: { x, y }, hd: att ? -Math.PI / 2 : Math.PI / 2, tur: att ? -Math.PI / 2 : Math.PI / 2, spd: 0, hp: 1, st: 'ok', reload: 2 + r() * 5, dug: !att, man: '', manP: null, manT: 0, troops: T[type].troops ? T[type].troops : 0, atgm: type === 'bmp' ? 2 : 0, burn: 0, home: { x, y }, spr: type === 'truck' ? 'truck' : type === 'bmp' ? 'bmp' : side ? 't72' : 'abrams' };
          B.units.push(u); } };
        if (dv.kind === 'arm') { add('tank', 8, 0); add('tank', 6, 1); add('bmp', 3, 2); }
        if (dv.kind === 'mec') { add('bmp', 7, 0); add('tank', 4, 1); }
        if (dv.kind === 'inf') { add('truck', 4, 1); add('bmp', 2, 0); B.inf.push(...Array.from({ length: Math.round(6 * st) }, (_, i) => ({ id: B.nid++, side, att, p: { x: cx + (i - 2.5) * 110, y: att ? 3250 : -1200 + (r() - .5) * 60 }, n: 8, rpg: 2, atgm: i % 3 === 0 ? 1 : 0, manpad: i === 2 ? 2 : 0, st: 'ok', reload: r() * 4, dug: !att, goal: null, div: dv.n }))); }
      });
    };
    B.inf = [];
    mk(o.att.side, true); mk(o.def.side, false);
    for (const s of [0, 1]) { B.init[s] = B.units.filter(u => u.side === s && u.type !== 'truck').length + B.inf.filter(q => q.side === s).length * .3; B.lost[s] = 0; }
    // جو: طلعات إسناد لكل طرف حسب ما عنده بالمعركة
    B.airQ = [];
    for (const [s, n] of [[o.att.side, o.air?.att || 0], [o.def.side, o.air?.def || 0]]) for (let i = 0; i < n; i++) B.airQ.push({ side: s, at: 70 + i * 55 + r() * 30, type: s ? 'su25' : 'su25' });
    B.manpads = o.manpads || [1, 1]; B.me = o.me ?? 0; B.calls = { arty: 3, air: o.myAir ?? 2 };
    // تمهيد مدفعية المهاجم: 24 قذيفة على مواقع المدافع خلال أول 40 ث (توصل بعد زمن طيرانها)
    for (let i = 0; i < 24; i++) B.arty.push({ side: o.att.side, at: 3 + i * 1.6 + r(), fly: 32 + r() * 8, x: (r() - .5) * 2400, y: -1300 + (r() - .5) * 500, cal: 155 });
    return B;
  }
  const emit = (B, k, p, d) => { B.ev.push({ t: B.t, k, x: p.x, y: p.y, ...d }); if (k === 'gun' || k === 'kill' || k === 'artyhit' || k === 'bombhit' || k === 'atgm' || k === 'can30') { B.act = B.act || []; B.act.push({ t: B.t, x: p.x, y: p.y, w: k === 'kill' ? 4 : k === 'artyhit' || k === 'bombhit' ? 2 : 1 }); if (B.act.length > 80) B.act.splice(0, 40); } if (B.ev.length > 600) B.ev.splice(0, 200); };
  const alive = u => u.st !== 'dead';
  const foesOf = (B, u) => B.units.filter(q => q.side !== u.side && alive(q));

  // ===== سياقة (من WM10) =====
  function drive(B, g, goal, vmax, dt, allowRev = false) {
    const dx = goal.x - g.p.x, dy = goal.y - g.p.y, d = Math.hypot(dx, dy); if (d < 6) { stop(g, dt); return true; }
    let ax = dx / d, ay = dy / d;
    for (const q of B.units) { if (q === g || !alive(q)) continue; const ox = g.p.x - q.p.x, oy = g.p.y - q.p.y, od = Math.hypot(ox, oy); if (od < 60 && od > .1) { const w = (60 - od) / 60; ax += ox / od * w * 1.3; ay += oy / od * w * 1.3; } }
    const a = Math.atan2(ay, ax); let err = angd(a, g.hd); const rev = allowRev && Math.abs(err) > 2 && d < 150; g.rev = rev; if (rev) err = angd(a + Math.PI, g.hd);
    const w = Math.abs(g.spd) < 2.5 ? .45 : Math.min(.45, Math.abs(g.spd) / 10);
    g.hd = angd(g.hd + clamp(err * 1.8, -w, w) * dt, 0);
    let vt = (rev ? -Math.min(4, vmax) : vmax) * Math.max(0, Math.cos(err)); if (Math.abs(err) > 1.1) vt = 0; if (d < 40) vt *= d / 40;
    g.spd += clamp(vt - g.spd, -3.5 * dt, 1.6 * dt); g.p.x += Math.cos(g.hd) * g.spd * dt; g.p.y += Math.sin(g.hd) * g.spd * dt;
    return false;
  }
  function stop(g, dt) { g.spd -= clamp(g.spd, -3.5 * dt, 3.5 * dt); g.p.x += Math.cos(g.hd) * g.spd * dt; g.p.y += Math.sin(g.hd) * g.spd * dt; }
  const covered = (B, p) => B.cover.some(c => Math.hypot(c.x - p.x, c.y - p.y) < c.rad);

  // ===== الرمي =====
  function shoot(B, g, q, d) {
    const ty = T[g.type] || T.abrams, tq = T[q.type] || T.truck;
    // إصابة: دقة الجيل والمسافة، المتحرك أصعب، الحفرة والغطاء يحمون
    let p = ty.acc * (1 - d / (ty.gun * 1.6)) * (Math.abs(g.spd) > 1 ? .45 : 1) * (Math.abs(q.spd) > 2 ? .75 : 1) * (q.dug ? .6 : 1) * (covered(B, q.p) ? .7 : 1);
    p = clamp(p, .03, .9); const hit = B.r() < p;
    // اتجاه الإصابة: من الجنب أقتل من القدام
    const side = Math.abs(Math.cos(angd(Math.atan2(g.p.y - q.p.y, g.p.x - q.p.x), q.hd)));
    const arm = side > .7 ? tq.armF : tq.armS; const kill = hit && B.r() > arm * (g.type === 'bmp' ? 2.2 : 1);
    const tp = hit ? { ...q.p } : { x: q.p.x + (B.r() - .5) * 70, y: q.p.y + (B.r() - .5) * 70 };
    const v = g.type === 'bmp' ? 1000 : 1650;
    B.shots.push({ k: g.type === 'bmp' ? 'can30' : 'shell', side: g.side, x: g.p.x, y: g.p.y, tx: tp.x, ty: tp.y, t: 0, dur: d / v, hit, kill, tgt: q.id, from: g.id });
    emit(B, g.type === 'bmp' ? 'can30' : 'gun', g.p, { hd: g.tur, id: g.id, side: g.side });
  }
  function atgm(B, g, q, d) { // صاروخ ضد الدروع: ~220 م/ث، تشوفه يطير؛ المتحرك أصعب، ودروع القدام أقوى
    const tq = T[q.type] || T.truck; const hit = B.r() < clamp(.7 - d / 9000, .25, .7) * (covered(B, q.p) ? .7 : 1) * (Math.abs(q.spd) > 2 ? .7 : 1);
    const side = Math.abs(Math.cos(angd(Math.atan2(g.p.y - q.p.y, g.p.x - q.p.x), q.hd))); const kill = hit && B.r() > (side > .7 ? tq.armF : tq.armS) * 1.1;
    B.shots.push({ k: 'atgm', side: g.side, x: g.p.x, y: g.p.y, tx: q.p.x, ty: q.p.y, t: 0, dur: d / 220, hit, kill, tgt: q.id, from: g.id, trail: [] });
    emit(B, 'atgm', g.p, { side: g.side });
  }
  function kill(B, q, how) {
    if (!alive(q)) return; q.st = 'dead'; q.hp = 0; q.spd = 0; B.lost[q.side] += 1; emit(B, 'kill', q.p, { id: q.id, type: q.type, side: q.side, how });
    // ركاب المدرعة/الشاحنة: نصهم ينجون وينزلون
    if (q.troops > 0 && B.r() < .5) B.inf.push({ id: B.nid++, side: q.side, att: q.att, p: { ...q.p }, n: Math.ceil(q.troops / 2), rpg: 1, atgm: 0, manpad: 0, st: 'ok', reload: 3, dug: false, goal: null, div: q.div });
  }

  // ===== خطوة =====
  function step(B, dt) {
    if (B.over && B.t > B.over.t + 12) return;
    B.t += dt;
    const A = B.side.att;
    if (B.phase === 'prep' && B.t > 42) { B.phase = 'attack'; emit(B, 'advance', { x: 0, y: 1500 }); }
    // ===== الآليات =====
    for (const g of B.units) {
      if (!alive(g)) { g.burn += dt; continue; }
      const ty = T[g.type] || T.truck;
      const foes = foesOf(B, g); let near = null, nd = 1e9; for (const q of foes) { const d = D2(q.p, g.p); if (d < nd) { nd = d; near = q; } }
      const range = ty.gun; const engaging = near && range && nd < range;
      const aimA = engaging ? Math.atan2(near.p.y - g.p.y, near.p.x - g.p.x) : g.hd;
      if (ty.tr) g.tur = angd(g.tur + clamp(angd(aimA, g.tur) * 3, -ty.tr, ty.tr) * dt, 0); else g.tur = g.hd;
      g.reload -= dt;
      // الشاحنات: ورا، تنزّل الجنود وترجع
      if (g.type === 'truck') { if (B.phase === 'attack' && g.att && !g.unloaded && g.p.y > 900) { drive(B, g, { x: g.p.x, y: 900 }, ty.v * .7, dt); } else if (g.att && !g.unloaded && B.phase === 'attack') { g.unloaded = 1; emit(B, 'dismount', g.p); } else stop(g, dt); continue; }
      // مدرعة: صاروخ ضد دروع على الدبابات البعيدة، ومدفع 30مم على الخفيف
      if (g.type === 'bmp' && g.atgm > 0 && g.reload <= 0 && Math.abs(g.spd) < 1) { const tk = foes.filter(q => T[q.type]?.k === 'tank').map(q => ({ q, d: D2(q.p, g.p) })).filter(x => x.d < 4000 && x.d > 600).sort((a, b) => a.d - b.d)[0]; if (tk) { g.atgm--; g.reload = 30; atgm(B, g, tk.q, tk.d); continue; } }
      // المدافع: «اضرب وارجع» من الحفرة
      if (g.man === 'back' || g.man === 'shift') { if (drive(B, g, g.manP, g.man === 'back' ? 4 : ty.v * .5, dt, true)) { if (g.man === 'back') { const s2 = g.plt % 2 ? 1 : -1; g.man = 'shift'; g.manP = { x: g.p.x + Math.cos(g.hd + Math.PI / 2 * s2) * 70, y: g.p.y + Math.sin(g.hd + Math.PI / 2 * s2) * 70 }; } else { g.man = 'face'; } } continue; }
      if (g.man === 'face') { const want = engaging ? aimA : g.att ? -Math.PI / 2 : Math.PI / 2; stop(g, dt); g.hd = angd(g.hd + clamp(angd(want, g.hd), -.45 * dt, .45 * dt), 0); if (Math.abs(angd(want, g.hd)) < .1) { g.man = ''; g.dug = !g.att; } continue; }
      const aligned = engaging && Math.abs(angd(aimA, g.tur)) < (g.type === 'bmp' ? .12 : .035);
      const wantFire = engaging && g.reload <= 0 && aligned;
      if (wantFire && Math.abs(g.spd) < 1.2) { g.reload = ty.rl + B.r() * 2.5; shoot(B, g, near, nd); g.manT = B.t + 1.5;
        if (!g.att && g.dug && T[g.type].k === 'tank' && B.r() < .35) { g.dug = false; g.man = 'back'; g.manP = { x: g.p.x - Math.cos(g.hd) * 40, y: g.p.y - Math.sin(g.hd) * 40 }; } continue; }
      if (wantFire || B.t < g.manT) { stop(g, dt); continue; }
      // المهاجم: قفزات نحو الهدف؛ المنكسر يرجع
      const po = B.pord && B.pord[g.plt];
      if (po && g.side === B.me) {
        if (po.k === 'hold') { stop(g, dt); continue; }
        const goal = po.k === 'back' ? { x: g.home.x, y: g.home.y + (g.att ? 300 : -300) } : { x: po.x + ((g.id % 5) - 2) * 70, y: po.y + ((g.id % 3) - 1) * 50 };
        const halt = engaging && nd < range * .85 && po.k !== 'back' && (g.plt + Math.floor(B.t / 14)) % 2 === 0;
        if (halt) stop(g, dt); else { g.dug = false; drive(B, g, goal, ty.v * (po.k === 'back' ? 1 : engaging ? .6 : .9), dt, po.k === 'back'); }
        continue;
      }
      if (g.att && B.phase === 'attack') {
        if (B.morale[g.side] < .35) { drive(B, g, { x: g.p.x, y: 2600 }, ty.v, dt, true); continue; }
        const halt = engaging && nd < range * .85 && (g.plt + Math.floor(B.t / 14)) % 2 === 0;
        const goal = { x: g.home.x * .6, y: B.obj.y + (g.plt % 3) * 120 };
        if (halt || (engaging && nd < 700)) stop(g, dt); else drive(B, g, goal, ty.v * (engaging ? .55 : .9), dt);
      } else if (!g.att && B.morale[g.side] < .3) { drive(B, g, { x: g.p.x, y: -2500 }, ty.v, dt, true); g.dug = false; }
      else stop(g, dt);
    }
    // ===== المشاة =====
    for (const q of B.inf) {
      if (q.st === 'dead') continue; q.reload -= dt;
      const fv = B.units.filter(u => u.side !== q.side && alive(u)); const fi = B.inf.filter(z => z.side !== q.side && z.st !== 'dead');
      if (q.att && B.phase === 'attack' && B.morale[q.side] >= .35) { const goal = { x: q.p.x, y: B.obj.y + 150 }; const d = goal.y - q.p.y; const near = Math.min(...fv.map(u => D2(u.p, q.p)), ...fi.map(z => D2(z.p, q.p)), 1e9); if (near > 250 && !(B.t % 20 < 8)) q.p.y += Math.sign(d) * Math.min(Math.abs(d), 1.3 * dt); }
      if (!q.att && B.morale[q.side] < .3) q.p.y -= 1.6 * dt;
      // RPG على أقرب دبابة/مدرعة تحت 300 م، صواريخ ضد دروع لحد 3.5 كم، ورصاص على المشاة تحت 450 م
      const arm = fv.map(u => ({ u, d: D2(u.p, q.p) })).sort((a, b) => a.d - b.d)[0];
      if (q.reload <= 0 && arm) {
        if (arm.d < 300 && q.rpg > 0) { q.rpg--; q.reload = 9; const hit = B.r() < .45, kl = hit && B.r() > (T[arm.u.type]?.armS ?? 0) * 1.2; B.shots.push({ k: 'rpg', side: q.side, x: q.p.x, y: q.p.y, tx: arm.u.p.x + (hit ? 0 : (B.r() - .5) * 30), ty: arm.u.p.y + (hit ? 0 : (B.r() - .5) * 30), t: 0, dur: arm.d / 120, hit, kill: kl, tgt: arm.u.id, trail: [] }); emit(B, 'rpg', q.p, {}); continue; }
        if (arm.d < 3500 && arm.d > 500 && q.atgm > 0 && T[arm.u.type]?.k === 'tank') { q.atgm--; q.reload = 25; atgm(B, q, arm.u, arm.d); continue; }
      }
      const ei = fi.map(z => ({ z, d: D2(z.p, q.p) })).sort((a, b) => a.d - b.d)[0];
      if (q.reload <= 0 && ei && ei.d < 450) { q.reload = 2 + B.r() * 2; B.shots.push({ k: 'rifle', side: q.side, x: q.p.x, y: q.p.y, tx: ei.z.p.x + (B.r() - .5) * 20, ty: ei.z.p.y + (B.r() - .5) * 20, t: 0, dur: ei.d / 800 }); if (B.r() < .06 * (ei.z.dug ? .5 : 1)) { ei.z.n--; if (ei.z.n <= 0) { ei.z.st = 'dead'; B.lost[ei.z.side] += .3; } } emit(B, 'rifle', q.p, {}); }
      // دفاع جوي محمول على الطيارات تحت 5 كم
      if (q.manpad > 0) { const j = B.jets.find(j2 => j2.side !== q.side && j2.st !== 'dead' && j2.st !== 'fall' && Math.hypot(j2.p.x - q.p.x, j2.p.y - q.p.y) < 5000 && !B.shots.some(s => s.k === 'manpad' && s.jet === j2)); if (j && B.r() < dt * .5) { q.manpad--; B.shots.push({ k: 'manpad', side: q.side, x: q.p.x, y: q.p.y, jet: j, t: 0, vx: 0, vy: 0, h: Math.atan2(j.p.y - q.p.y, j.p.x - q.p.x), v: 80, trail: [], alt: 0 }); emit(B, 'manpad', q.p, { side: q.side }); } }
    }
    // ===== المدفعية: صفير قبل الوصول، وبعدين انفجار =====
    for (const a of B.arty) {
      if (!a.fired && B.t >= a.at) { a.fired = 1; emit(B, 'artyfire', { x: a.x, y: a.y }, { side: a.side, eta: a.fly }); }
      if (a.fired && !a.done && B.t >= a.at + a.fly - 2.2 && !a.whz) { a.whz = 1; emit(B, 'whistle', a, {}); }
      if (a.fired && !a.done && B.t >= a.at + a.fly) { a.done = 1; emit(B, 'artyhit', a, { cal: a.cal });
        for (const u of B.units) if (alive(u) && u.side !== a.side && D2(u.p, a) < 45) { const k = T[u.type].k; if (B.r() < (k === 'tank' ? .08 : k === 'ifv' ? .3 : .6) * (u.dug ? .5 : 1)) kill(B, u, 'arty'); }
        for (const q of B.inf) if (q.st !== 'dead' && q.side !== a.side && D2(q.p, a) < 60) { q.n -= Math.round(B.r() * (q.dug ? 1 : 3)); if (q.n <= 0) { q.st = 'dead'; B.lost[q.side] += .3; } } }
    }
    // مدفعية مستمرة خفيفة لكل طرف كل ~25 ث بعد التمهيد
    if (B.phase === 'attack' && Math.floor(B.t / 25) !== Math.floor((B.t - dt) / 25)) for (const s of [0, 1]) { const tg = B.units.filter(u => u.side !== s && alive(u)); const z = tg[Math.floor(B.r() * tg.length)]; if (z) for (let i = 0; i < 3; i++) B.arty.push({ side: s, at: B.t + i * 1.5, fly: 30 + B.r() * 10, x: z.p.x + (B.r() - .5) * 300, y: z.p.y + (B.r() - .5) * 250, cal: 152 }); }
    // ===== الطيارات (فيزياء مبسطة من WM10: لفة محدودة، صعود/غطس) =====
    for (const q of B.airQ) if (!q.go && B.t >= q.at) { q.go = 1; const ent = q.side === A ? { x: -3600, y: 2600 } : { x: 3600, y: -2600 }; B.jets.push({ id: B.nid++, side: q.side, type: q.type, p: { x: ent.x, y: ent.y }, z: 150, hd: Math.atan2(-ent.y, -ent.x), spd: 210, st: 'ingress', bank: 0, gam: 0, t: 0, bombs: 2, flares: 16, cm: 0, aim: q.aim || null }); emit(B, 'jetin', ent, { side: q.side }); }
    for (const j of B.jets) {
      if (j.st === 'dead') continue; j.t += dt;
      if (j.st === 'fall') { j.z = Math.max(0, j.z - 90 * dt); j.hd += 1.6 * dt; j.bank += 3 * dt; j.p.x += Math.cos(j.hd) * 140 * dt; j.p.y += Math.sin(j.hd) * 140 * dt; if (j.z <= 0) { j.st = 'dead'; emit(B, 'crash', j.p, {}); } continue; }
      const tgts = B.units.filter(u => u.side !== j.side && alive(u)); const ref = j.aim || j.p; const tg = tgts.sort((a, b) => D2(a.p, ref) - D2(b.p, ref))[0];
      let wantH = j.hd, wantZ = j.z;
      const threat = B.shots.find(s => s.k === 'manpad' && s.jet === j);
      if (threat) { wantH = Math.atan2(threat.y - j.p.y, threat.x - j.p.x) + Math.PI / 2; wantZ = 120; if (j.flares > 0 && B.t - j.cm > .3) { j.cm = B.t; j.flares--; emit(B, 'flare', j.p, { z: j.z }); } }
      else if (j.st === 'ingress' && tg) { wantH = Math.atan2(tg.p.y - j.p.y, tg.p.x - j.p.x); wantZ = 120; if (D2(tg.p, j.p) < 4500) { j.st = 'popup'; emit(B, 'popup', j.p, {}); } }
      else if (j.st === 'popup') { wantZ = 1800; if (j.z > 1300) j.st = 'dive'; }
      else if (j.st === 'dive' && tg) { wantH = Math.atan2(tg.p.y - j.p.y, tg.p.x - j.p.x); wantZ = 0; if (D2(tg.p, j.p) < 1200 || j.z < 400) { j.st = 'pull'; j.pt = B.t; j.pullH = j.hd + 1.6; if (j.bombs > 0) { j.bombs--; const bx = tg.p.x + (B.r() - .5) * 60, by = tg.p.y + (B.r() - .5) * 60; B.shots.push({ k: 'bomb', side: j.side, x: j.p.x, y: j.p.y, z: j.z, tx: bx, ty: by, t: 0, dur: 2.6 }); emit(B, 'release', j.p, {}); } } }
      else if (j.st === 'pull') { wantH = j.pullH; wantZ = 900; if (j.flares > 0 && B.t - j.cm > .35) { j.cm = B.t; j.flares--; emit(B, 'flare', j.p, { z: j.z }); } if (B.t - j.pt > 7) j.st = j.bombs > 0 ? 'ingress' : 'egress'; }
      else { wantH = Math.atan2((j.side === A ? 2600 : -2600) - j.p.y, (j.side === A ? -4000 : 4000) - j.p.x); wantZ = 600; if (Math.abs(j.p.x) > 3900) { j.st = 'dead'; emit(B, 'jetout', j.p, {}); } }
      const err = angd(wantH, j.hd), rate = clamp(err * 1.2, -.35, .35); j.hd = angd(j.hd + rate * dt, 0); j.bank += (Math.atan(rate / .35 * 2.6) - j.bank) * Math.min(1, dt * 3);
      const dz = clamp(wantZ - j.z, -160 * dt, 120 * dt); j.gam = clamp(dz / dt / j.spd * 2, -1, 1); j.z = Math.max(60, j.z + dz);
      j.p.x += Math.cos(j.hd) * j.spd * dt; j.p.y += Math.sin(j.hd) * j.spd * dt;
    }
    // ===== القذائف والصواريخ =====
    for (const s of B.shots) {
      s.t += dt;
      if (s.k === 'manpad') { // يطارد الطيارة، المشاعل تخدعه
        const j = s.jet; if (!j || j.st === 'dead') { s.done = 1; continue; }
        s.v = Math.min(600, s.v + 400 * dt); s.alt = Math.min(j.z, (s.alt || 0) + s.v * .5 * dt);
        const a = Math.atan2(j.p.y - s.y, j.p.x - s.x); s.h += clamp(angd(a, s.h), -4 * dt, 4 * dt); s.x += Math.cos(s.h) * s.v * dt; s.y += Math.sin(s.h) * s.v * dt;
        if (Math.hypot(j.p.x - s.x, j.p.y - s.y) < 40) { s.done = 1; const fooled = B.t - j.cm < 1.2 && B.r() < .55; if (!fooled && B.r() < .6) { j.st = 'fall'; emit(B, 'jetkill', j.p, { z: j.z, side: j.side }); } else emit(B, 'airburst', j.p, { z: j.z }); }
        if (s.t > 12) s.done = 1; continue;
      }
      if (s.t >= s.dur && !s.done) {
        s.done = 1; const tp = { x: s.tx, y: s.ty };
        if (s.k === 'bomb') { emit(B, 'bombhit', tp, {}); for (const u of B.units) if (alive(u) && u.side !== s.side && D2(u.p, tp) < 70) { if (B.r() < (T[u.type].k === 'tank' ? .45 : .8)) kill(B, u, 'bomb'); } for (const q of B.inf) if (q.st !== 'dead' && q.side !== s.side && D2(q.p, tp) < 90) { q.n -= 4; if (q.n <= 0) { q.st = 'dead'; B.lost[q.side] += .3; } } continue; }
        const q = B.units.find(u => u.id === s.tgt);
        if (s.hit && q && alive(q)) { if (s.kill) kill(B, q, s.k); else emit(B, 'ricochet', tp, {}); } else emit(B, s.k === 'rifle' ? 'dust' : 'miss', tp, { k: s.k });
      }
    }
    B.shots = B.shots.filter(s => !s.done || B.t - (s.t + 0) < 0);
    // ===== المعنويات والنهاية =====
    for (const s of [0, 1]) { const lostFrac = B.lost[s] / Math.max(1, B.init[s]); B.morale[s] = clamp(1 - lostFrac * 1.6, 0, 1); }
    if (!B.over && B.phase === 'attack') {
      const aIn = B.units.filter(u => u.att && alive(u) && T[u.type].k !== 'truck' && u.p.y < B.obj.y + 400).length;
      const dLeft = B.units.filter(u => !u.att && alive(u) && T[u.type].k !== 'truck' && u.p.y > -2200).length + B.inf.filter(q => !q.att && q.st !== 'dead' && q.p.y > -2200).length;
      if (aIn >= 2 && dLeft <= 2) B.over = { t: B.t, win: 'att', why: 'وصلوا للهدف والمدافعين انكسروا' };
      else if (B.morale[B.side.def] < .3 && aIn >= 1) B.over = { t: B.t, win: 'att', why: 'المدافعين انكسروا وانسحبوا' };
      else if (B.morale[B.side.att] < .35) B.over = { t: B.t, win: 'def', why: 'الهجوم انكسر بخسائره ورجع' };
      else if (B.t > 600) B.over = { t: B.t, win: 'none', why: 'الهجوم توقف بدون حسم (10 دقايق)' };
      if (B.over) emit(B, 'over', { x: 0, y: 0 }, { win: B.over.win });
    }
  }
  // طلب مدفعية: 6 قذائف حول النقطة، توصل بعد ~30–40 ث (زمن طيرانها)
  function callArty(B, side, x, y) { if ((B.calls?.arty ?? 0) <= 0) return false; B.calls.arty--; const fly = 32 + B.r() * 6; for (let i = 0; i < 6; i++) B.arty.push({ side, at: B.t + i * .8, fly, x: x + (B.r() - .5) * 220, y: y + (B.r() - .5) * 160, cal: 155, mine: 1 }); emit(B, 'artycall', { x, y }, { eta: fly, side }); return true; }
  // طلب طيارات: طيارة إسناد تدخل بعد ~10 ث وتضرب أقرب عدو للنقطة
  function callAir(B, side, x, y) { if ((B.calls?.air ?? 0) <= 0) return false; B.calls.air--; B.airQ.push({ side, at: B.t + 10, type: 'su25', aim: { x, y } }); emit(B, 'aircall', { x, y }, { side }); return true; }
  function order(B, plt, o) { B.pord = B.pord || {}; B.pord[plt] = o; }
  const API = { create, step, T, W_DIM, angd, callArty, callAir, order };
  if (typeof module !== 'undefined') module.exports = API; else root.BV = API;
})(this);
