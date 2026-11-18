// «الحرب الكبرى» GW2b (I-082): الجو والصواريخ. بدون رسم؛ يمشي بـ «ثواني جو» (dt) ويأثر على المحاكاة الأرضية (sim.js).
// المواقع تقريبية من معلومات عامة [ASSUMPTION] (نفس بيانات warmap/src/geo.ts).
// السرعات مضغوطة حتى تنشاف: الطيارة ~38 كم بثانية الجو، صاروخ الدفاع الجوي ~110، الباليستي ~55.
(function (root) {
  const LL = (lat, lon) => [(lon - 38.5) * 93.3608, (40.2 - lat) * 110.57];
  const PLANES = {
    //       جو-جو  أرض   تشويش (يقلل إصابة الدفاع الجوي)  الاسم
    f16: { aa: .5, ag: 1, ecm: .8, n: 'F-16' },
    su25: { aa: .08, ag: 1.35, ecm: 1, n: 'سوخوي-25' },
    f14: { aa: .55, ag: .55, ecm: .9, n: 'F-14' },
    su24: { aa: .05, ag: 1.2, ecm: .95, n: 'سوخوي-24', spr: 'su25' },
  };
  const BASES = [
    { n: 'قاعدة بلد', rw: 0.3, ll: [33.94, 44.36], side: 0, type: 'f16', planes: 24 },
    { n: 'عين الأسد', rw: -0.2, ll: [33.79, 42.44], side: 0, type: 'f16', planes: 10 },
    { n: 'الإمام علي', rw: 0.5, ll: [30.94, 46.09], side: 0, type: 'su25', planes: 14 },
    { n: 'كركوك', rw: 0.1, ll: [35.47, 44.35], side: 0, type: 'su25', planes: 8 },
    { n: 'وحدتي (دزفول)', rw: -0.4, ll: [32.43, 48.4], side: 1, type: 'su24', planes: 12 },
    { n: 'أميدية', rw: 0.2, ll: [30.83, 49.53], side: 1, type: 'f14', planes: 10 },
    { n: 'نوجه (همدان)', rw: 0.6, ll: [35.21, 48.65], side: 1, type: 'f14', planes: 16 },
    { n: 'بوشهر', rw: 0.9, ll: [28.94, 50.83], side: 1, type: 'f14', planes: 12 },
    { n: 'شيراز', rw: 0.3, ll: [29.54, 52.59], side: 1, type: 'su24', planes: 10 },
  ];
  const SAMS = [
    { n: 'باتريوت — بغداد', ll: [33.25, 44.5], side: 0, kind: 'patriot', r: 150, ammo: 16, pk: .6, abm: 1 },
    { n: 'باتريوت — البصرة', ll: [30.6, 47.65], side: 0, kind: 'patriot', r: 140, ammo: 16, pk: .6, abm: 1 },
    { n: 'باتريوت — بلد', ll: [34.05, 44.2], side: 0, kind: 'patriot', r: 130, ammo: 12, pk: .6, abm: 1 },
    { n: 'S-300 — الأهواز', ll: [31.4, 48.8], side: 1, kind: 's400', r: 160, ammo: 16, pk: .55, abm: 0 },
    { n: 'S-300 — دزفول', ll: [32.3, 48.55], side: 1, kind: 's400', r: 150, ammo: 16, pk: .55, abm: 0 },
    { n: 'S-300 — كرمانشاه', ll: [34.4, 47.2], side: 1, kind: 's400', r: 150, ammo: 16, pk: .55, abm: 0 },
    { n: 'S-300 — طهران', ll: [35.6, 51.3], side: 1, kind: 's400', r: 180, ammo: 24, pk: .55, abm: 0 },
  ];
  const MBASES = [
    { n: 'قاعدة صواريخ كرمانشاه', ll: [34.2, 47.35], side: 1, ammo: 40 },
    { n: 'قاعدة صواريخ خرم آباد', ll: [33.48, 48.35], side: 1, ammo: 40 },
  ];
  const V = { plane: 38, sam: 110, aam: 130, bm: 55, turn: 1.6 };

  function create(W, opt = {}) {
    const A = {
      t: 0, id: 1, rnd: W.rnd,
      bases: BASES.map(b => ({ ...b, p: LL(...b.ll), n0: b.planes, max: b.planes, rein: 0, ready: b.planes, cd: 3 + W.rnd() * 6, mission: { kind: 'auto' }, plan: null, down: 0 })),
      sams: SAMS.map(s => ({ ...s, p: LL(...s.ll), ammo0: s.ammo, cd: 0, down: 0 })),
      mbases: MBASES.map(m => ({ ...m, p: LL(...m.ll), cd: 25 + W.rnd() * 20 })),
      planes: [], msls: [], ev: [], kills: [0, 0], lostPlanes: [0, 0], aiT: 0,
    };
    return A;
  }
  const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const emit = (A, e) => { A.ev.push(e); if (A.ev.length > 400) A.ev.splice(0, 100); };

  // ===== الذكاء: شنو يسوي كل مطار =====
  function planFor(A, W, b) {
    const side = b.side, T = PLANES[b.type];
    // معارك جارية: إذا إحنا نهاجم نضرب المدافعين، وإذا ندافع نضرب المهاجمين
    const bats = [...W.battles.values()].map(bt => {
      const mine = bt.side === side; const cell = mine ? bt.tg : [...bt.from][0];
      const p = W.cells[cell].c; return { cell, p, w: (bt.na + bt.nd) * (mine ? 1.2 : 1.4), dist: d2(p, b.p) };
    }).filter(x => x.dist < 900).sort((a, c) => c.w / (1 + c.dist / 400) - a.w / (1 + a.dist / 400));
    if (T.aa >= .5 && (A.rnd() < .45 || !bats.length)) {
      // حماية أجواء فوق أكثر مكان بيه معارك (أو فوق الجبهة القريبة)
      const tgt = bats[0] ? bats[0].p : nearestFront(W, side, b.p);
      return tgt && { kind: 'cap', p: tgt };
    }
    // ما ندز إسناد تحت مظلة دفاع جوي كاملة: نضرب البطارية أول (إخماد دفاع جوي)
    const cover = p => A.sams.filter(s => s.side !== side && !s.down && s.ammo > 2 && d2(s.p, p) < s.r);
    for (const bt of bats) {
      const cv = cover(bt.p);
      if (!cv.length) return { kind: 'cas', p: bt.p, cell: bt.cell };
      if (cv.length === 1 && T.ag > .9) return A.rnd() < .5 ? { kind: 'strike', p: cv[0].p, sam: A.sams.indexOf(cv[0]) } : { kind: 'cas', p: bt.p, cell: bt.cell };
    }
    // ما بيه معارك: ضربة على دفاع جوي للعدو قريب
    const sam = A.sams.filter(s => s.side !== side && !s.down && d2(s.p, b.p) < 700).sort((a, c) => d2(a.p, b.p) - d2(c.p, b.p))[0];
    if (sam && T.ag > .9) return { kind: 'strike', p: sam.p, sam: A.sams.indexOf(sam) };
    return null;
  }
  function nearestFront(W, side, p) {
    let best = null, bd = 1e9;
    for (let i = 0; i < W.N; i++) if (W.ctrl[i] === side && W.cells[i].nb.some(j => W.ctrl[j] !== side)) { const dd = d2(W.cells[i].c, p); if (dd < bd) { bd = dd; best = W.cells[i].c; } }
    return best;
  }

  // ===== خطوة =====
  function step(A, W, SIM, dt) {
    A.t += dt;
    // المطارات تطلق طلعات
    for (const b of A.bases) {
      b.down = Math.max(0, b.down - dt); b.cd -= dt;
      // تعويض: طيارة جديدة كل ~100 ثانية جو (≈ 8 أيام) لحد العدد الأصلي
      b.rein += dt; if (b.rein > 100) { b.rein = 0; if (b.n0 < b.max) { b.n0++; b.ready++; } }
      if (b.cd > 0 || b.down > 0 || b.ready < 2) continue;
      const m = b.mission.kind === 'auto' ? planFor(A, W, b) : b.mission;
      b.cd = 9 + A.rnd() * 6;
      if (!m || m.kind === 'idle' || !m.p) continue;
      const k = Math.min(b.ready, m.kind === 'cap' ? 2 : 3); b.ready -= k;
      const fid = A.id++;
      const rh = b.rw, rx = Math.cos(rh), ry = Math.sin(rh);
      for (let i = 0; i < k; i++) A.planes.push({ id: A.id++, fid, slot: i, side: b.side, type: b.type, base: A.bases.indexOf(b), x: b.p[0] - rx * 5, y: b.p[1] - ry * 5, h: rh, v: 0, m: { ...m }, st: 'roll', t: -i * 1.1, shots: m.kind === 'cap' ? 2 : 0, harm: m.kind === 'strike' && b.type === 'f16' ? 1 : 0, bombs: PLANES[b.type].ag > 1.1 ? 2 : 1, alt: 0, altT: 0, bank: 0, gam: 0, flares: 12 });
      emit(A, { k: 'takeoff', side: b.side, x: b.p[0], y: b.p[1], base: b.n, n: k, kind: m.kind });
    }
    // الطيارات: لفّة بالميلان، صعود ونزول، ومناورات حسب المهمة (R3)
    for (const p of A.planes) {
      if (p.st === 'dead') continue;
      p.t += dt; if (p.t < 0) continue;
      if (p.st === 'fall') { p.alt = Math.max(0, p.alt - dt * .5); p.h += dt * 3.2; p.bank += dt * 6; p.gam = -1; p.x += Math.cos(p.h) * 14 * dt; p.y += Math.sin(p.h) * 14 * dt; if (p.alt <= 0) { p.st = 'dead'; emit(A, { k: 'crash', x: p.x, y: p.y, side: p.side }); } continue; }
      const base = A.bases[p.base], T = PLANES[p.type], M = p.m;
      let tx = M.p[0], ty = M.p[1], spd = V.plane, turn = V.turn, d = Math.hypot(tx - p.x, ty - p.y);
      // تهرّب: صاروخ جاي عليه قريب ← لفة حادة ونزول ومشاعل
      const threat = A.msls.find(m => m.tgt === p && !m.done && Math.hypot(m.x - p.x, m.y - p.y) < 32);
      if (threat && p.st !== 'roll' && p.st !== 'land') {
        p.ev = 2.2; const ang = Math.atan2(threat.y - p.y, threat.x - p.x) + Math.PI / 2 * (p.id % 2 ? 1 : -1);
        tx = p.x + Math.cos(ang) * 60; ty = p.y + Math.sin(ang) * 60; turn = 2.6; p.altT = .35;
        p.fl = (p.fl || 0) - dt; if (p.fl <= 0 && p.flares > 0) { p.fl = .22; p.flares--; A.decoys = A.decoys || []; A.decoys.push({ x: p.x, y: p.y, vx: -Math.cos(p.h) * 6, vy: -Math.sin(p.h) * 6, t: 0 }); emit(A, { k: 'flare', x: p.x, y: p.y }); }
      } else if (p.ev > 0) { p.ev -= dt; tx = p.x + Math.cos(p.h) * 50; ty = p.y + Math.sin(p.h) * 50; }
      else if (p.st === 'roll') { // إقلاع: يركض على المدرج ويرتفع
        tx = p.x + Math.cos(base.rw) * 50; ty = p.y + Math.sin(base.rw) * 50; spd = Math.min(V.plane, (p.v || 0) + dt * 22); turn = 0; p.altT = p.v > 20 ? .7 : 0;
        if (p.alt > .4) p.st = 'out';
      } else if (p.st === 'out') {
        p.altT = M.kind === 'cas' ? .35 : M.kind === 'cap' ? 1 : .85; // الإسناد يمشي واطي تحت الرادار
        if (M.kind === 'cas' && d < 48) { p.st = 'popup'; p.ph = 0; }
        if (M.kind === 'strike' && p.harm && d < 75) { p.st = 'harm'; p.ph = 0; }
        else if (M.kind === 'strike' && !p.harm && d < 48) { p.st = 'popup'; p.ph = 0; }
        if (M.kind === 'cap' && d < 20) { p.st = 'orbit'; p.ph = 0; }
      } else if (p.st === 'popup') { p.ph += dt; p.altT = 1.1; if (p.ph > 1.1) p.st = 'dive'; }   // صعود سريع قبل الغطس
      else if (p.st === 'dive') { p.altT = .2; spd = V.plane * 1.15; turn = 2; if (d < 15 && p.bombs > 0) { p.bombs--; attack(A, W, SIM, p); p.st = 'pull'; p.ph = 0; } }   // غطس على الهدف ويرمي
      else if (p.st === 'pull') { // سحب وكسر لجنب ومشاعل
        p.ph += dt; p.altT = .8; const ang = p.h + (p.id % 2 ? 1 : -1) * 1.6; tx = p.x + Math.cos(ang) * 60; ty = p.y + Math.sin(ang) * 60; turn = 2.2;
        p.fl = (p.fl || 0) - dt; if (p.ph < 1.4 && p.fl <= 0 && p.flares > 0) { p.fl = .3; p.flares--; A.decoys = A.decoys || []; A.decoys.push({ x: p.x, y: p.y, vx: -Math.cos(p.h) * 6, vy: -Math.sin(p.h) * 6, t: 0 }); emit(A, { k: 'flare', x: p.x, y: p.y }); }
        if (p.ph > 2.6) { if (p.bombs > 0) { p.st = 'out'; } else p.st = 'back'; }
      } else if (p.st === 'harm') { // F-16: يرفع الأنف ويطلق HARM على رادار الـS-300 من بعيد، وبعدين يبتعد على جنب
        p.ph += dt; p.altT = 1.05;
        if (p.harm && p.ph > .7) { p.harm = 0; const sm = A.sams[M.sam]; A.msls.push({ kind: 'harm', side: p.side, x: p.x, y: p.y, h: p.h, tgtSam: M.sam, tx: sm.p[0], ty: sm.p[1], t: 0, trail: [] }); emit(A, { k: 'harmlaunch', side: p.side, x: p.x, y: p.y, n: sm.n }); }
        if (p.ph > .7) { const ang = Math.atan2(ty - p.y, tx - p.x) + 1.1; tx = p.x + Math.cos(ang) * 60; ty = p.y + Math.sin(ang) * 60; }
        if (p.ph > 3.2) p.st = 'back';
      } else if (p.st === 'orbit') { // حماية أجواء: يلف فوق المنطقة
        p.ph += dt; const a2 = p.ph * .9 + p.slot * 3; tx = M.p[0] + Math.cos(a2) * 26; ty = M.p[1] + Math.sin(a2) * 26; p.altT = 1;
        if (p.ph > 16) p.st = 'back';
      } else if (p.st === 'loft') { p.ph += dt; p.altT = 1.25; tx = p.lt.x; ty = p.lt.y; if (p.ph > .6) { p.shots--; A.msls.push({ kind: 'aam', side: p.side, x: p.x, y: p.y, h: p.h, tgt: p.lt, pk: T.aa * PLANES[p.lt.type].ecm, t: 0, trail: [] }); emit(A, { k: 'aam', side: p.side, x: p.x, y: p.y }); p.st = 'crank'; p.ph = 0; } }
      else if (p.st === 'crank') { p.ph += dt; const ang = Math.atan2(p.lt.y - p.y, p.lt.x - p.x) + .95 * (p.id % 2 ? 1 : -1); tx = p.x + Math.cos(ang) * 60; ty = p.y + Math.sin(ang) * 60; p.altT = .9; if (p.ph > 2) { p.st = p.shots > 0 && M.kind === 'cap' ? 'orbit' : 'back'; } }
      else if (p.st === 'back') { // رجوع: نقطة اقتراب على امتداد المدرج
        const ax = base.p[0] - Math.cos(base.rw) * 34, ay = base.p[1] - Math.sin(base.rw) * 34; tx = ax; ty = ay; p.altT = .7;
        if (Math.hypot(ax - p.x, ay - p.y) < 8) p.st = 'final';
      } else if (p.st === 'final') { tx = base.p[0] + Math.cos(base.rw) * 8; ty = base.p[1] + Math.sin(base.rw) * 8; spd = V.plane * .55; p.altT = 0; turn = 1;
        if (Math.hypot(base.p[0] - p.x, base.p[1] - p.y) < 4) { p.st = 'dead'; base.ready = Math.min(base.n0, base.ready + 1); emit(A, { k: 'land', x: p.x, y: p.y, side: p.side }); continue; } }
      // جو-جو: الحماية تشوف طيارة عدو ← ترفع الأنف وترمي من بعيد
      if (p.shots > 0 && T.aa > .2 && (p.st === 'orbit' || p.st === 'out' || p.st === 'back')) {
        const e = A.planes.find(q => q.side !== p.side && q.st !== 'fall' && q.st !== 'roll' && q.st !== 'dead' && Math.hypot(q.x - p.x, q.y - p.y) < 85 && !A.msls.some(m => m.tgt === q && m.kind === 'aam'));
        if (e && A.rnd() < dt * 1.5) { p.st = 'loft'; p.ph = 0; p.lt = e; }
      }
      // الحركة: الأنف يلف بحد، والجناح يميل حسب سرعة اللفة، والارتفاع يتغير بنعومة
      const want = Math.atan2(ty - p.y, tx - p.x); let dh = want - p.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
      const rate = Math.max(-turn, Math.min(turn, dh * 2.2)); p.h += rate * dt;
      const bankT = Math.atan(rate / 1.6 * 2.75); p.bank += Math.max(-3 * dt, Math.min(3 * dt, bankT - p.bank));
      p.v = spd; const da = Math.max(-.55 * dt, Math.min(.5 * dt, p.altT - p.alt)); p.alt = Math.max(0, p.alt + da); p.gam = Math.max(-1, Math.min(1, da / dt * 2.2));
      p.x += Math.cos(p.h) * spd * dt; p.y += Math.sin(p.h) * spd * dt;
    }
    // المشاعل تطيح وتنطفي
    if (A.decoys) { for (const f of A.decoys) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; } A.decoys = A.decoys.filter(f => f.t < 2.2); }
    A.planes = A.planes.filter(p => p.st !== 'dead');
    // الدفاع الجوي
    for (const s of A.sams) {
      s.down = Math.max(0, s.down - dt); s.cd -= dt; s.rl = (s.rl || 0) + dt; if (s.rl > 7) { s.rl = 0; s.ammo = Math.min(s.ammo0, s.ammo + 1); }
      if (s.cd > 0 || s.down > 0 || s.ammo <= 0) continue;
      // أولوية: الباليستي (للباتريوت)، بعدين الطيارات
      let tgt = null;
      if (s.abm) tgt = A.msls.find(m => m.kind === 'bm' && m.side !== s.side && m.f > .45 && d2([m.x, m.y], s.p) < s.r * .8 && A.msls.filter(q => q.tgt === m).length < 2);
      if (!tgt) tgt = A.planes.find(q => q.side !== s.side && q.st !== 'fall' && d2([q.x, q.y], s.p) < s.r && A.msls.filter(m => m.tgt === q).length < 1);
      if (!tgt) continue;
      s.ammo--; s.cd = 1.6;
      const isBm = tgt.kind === 'bm';
      A.msls.push({ kind: 'sam', side: s.side, x: s.p[0], y: s.p[1], h: Math.atan2(tgt.y - s.p[1], tgt.x - s.p[0]), tgt, pk: isBm ? .55 : s.pk * PLANES[tgt.type].ecm, t: 0, trail: [], from: s.n, abm: isBm });
      emit(A, { k: 'samlaunch', side: s.side, x: s.p[0], y: s.p[1], n: s.n, kind: s.kind });
    }
    // الباليستي
    for (const mb of A.mbases) {
      mb.cd -= dt; mb.rl = (mb.rl || 0) + dt; if (mb.rl > 20) { mb.rl = 0; mb.ammo = Math.min(40, mb.ammo + 1); }
      if (mb.cd > 0 || mb.ammo <= 0) continue; mb.cd = 34 + A.rnd() * 22;
      const tg = bmTarget(A, W, mb); if (!tg) continue;
      for (let i = 0; i < 2 && mb.ammo > 0; i++) { mb.ammo--; const tp = [tg.p[0] + (A.rnd() - .5) * 10, tg.p[1] + (A.rnd() - .5) * 10]; A.msls.push({ kind: 'bm', side: mb.side, x: mb.p[0] + i * 4, y: mb.p[1], x0: mb.p[0] + i * 4, y0: mb.p[1], tx: tp[0], ty: tp[1], f: 0, D: d2(mb.p, tp), t: -i * .7, tg, trail: [] }); }
      emit(A, { k: 'bmlaunch', side: mb.side, x: mb.p[0], y: mb.p[1], n: mb.n, tgt: tg.n });
    }
    // الصواريخ تتحرك
    for (const m of A.msls) {
      m.t += dt; if (m.t < 0) continue;
      if (m.kind === 'bm') {
        m.f = Math.min(1, m.f + V.bm * dt / m.D); m.x = m.x0 + (m.tx - m.x0) * m.f; m.y = m.y0 + (m.ty - m.y0) * m.f; m.alt = Math.sin(m.f * Math.PI);
        if (m.f >= 1) { m.done = 1; impact(A, W, SIM, m); }
      } else if (m.kind === 'harm') {
        const want = Math.atan2(m.ty - m.y, m.tx - m.x); let dh = want - m.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
        m.h += Math.max(-3 * dt, Math.min(3 * dt, dh)); m.x += Math.cos(m.h) * 95 * dt; m.y += Math.sin(m.h) * 95 * dt; m.alt = Math.min(1, m.t * 1.2);
        if (Math.hypot(m.tx - m.x, m.ty - m.y) < 5) { m.done = 1; const sm = A.sams[m.tgtSam]; sm.down = Math.max(sm.down, 45); sm.ammo = Math.max(0, sm.ammo - 6); emit(A, { k: 'harmhit', x: m.tx, y: m.ty, side: m.side, n: sm.n }); }
      } else {
        // المشاعل: صاروخ قريب من طيارة تطلق مشاعل ممكن ينخدع ويلحق المشعل
        if (m.tgt && !m.tgt.kind && A.decoys && !m.fooled) { const f = A.decoys.find(q => Math.hypot(q.x - m.x, q.y - m.y) < 14); if (f && A.rnd() < .3) { m.fooled = 1; m.tgt = { x: f.x, y: f.y, st: 'decoy', decoy: f }; } }
        if (m.tgt && m.tgt.decoy) { m.tgt.x = m.tgt.decoy.x; m.tgt.y = m.tgt.decoy.y; if (Math.hypot(m.tgt.x - m.x, m.tgt.y - m.y) < 6 || m.t > 4) { m.done = 1; emit(A, { k: 'miss', x: m.x, y: m.y, side: m.side, fooled: 1 }); continue; } }
        const T = m.tgt; if (!T || T.st === 'dead' || T.st === 'fall' || T.done) { m.done = 1; emit(A, { k: 'selfd', x: m.x, y: m.y }); continue; }
        const want = Math.atan2(T.y - m.y, T.x - m.x); let dh = want - m.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
        m.h += Math.max(-5 * dt, Math.min(5 * dt, dh)); const v = m.kind === 'sam' ? V.sam : V.aam;
        m.x += Math.cos(m.h) * v * dt; m.y += Math.sin(m.h) * v * dt; m.alt = Math.min(1, m.t * 1.5);
        if (!T.decoy && Math.hypot(T.x - m.x, T.y - m.y) < 5) {
          m.done = 1;
          if (A.rnd() < m.pk * (T.ev > 0 ? .6 : 1)) {
            if (T.kind === 'bm') { T.done = 1; emit(A, { k: 'intercept', x: m.x, y: m.y, side: m.side }); }
            else { T.st = 'fall'; T.t = 0; if (A.rnd() < .7) emit(A, { k: 'eject', x: T.x, y: T.y, side: T.side }); A.kills[m.side]++; A.lostPlanes[T.side]++; A.bases[T.base].n0 = Math.max(0, A.bases[T.base].n0 - 1); emit(A, { k: 'kill', x: m.x, y: m.y, side: m.side, victim: PLANES[T.type].n, vside: T.side, by: m.kind }); }
          } else emit(A, { k: 'miss', x: m.x, y: m.y, side: m.side });
        }
        if (m.t > 4) { m.done = 1; emit(A, { k: 'selfd', x: m.x, y: m.y }); }
      }
      // أثر الدخان
      if (m.trail.length === 0 || Math.hypot(m.trail[m.trail.length - 1][0] - m.x, m.trail[m.trail.length - 1][1] - m.y) > 2.5) m.trail.push([m.x, m.y, A.t, m.alt || 0]);
    }
    // الأثر يبقى شوي بعد ما يخلص الصاروخ
    A.msls = A.msls.filter(m => !m.done || A.t - (m.doneT ?? (m.doneT = A.t)) < 2.5);
    // ذكاء: تحديث خطط المطارات التلقائية
    A.aiT -= dt;
  }
  function bmTarget(A, W, mb) {
    // يفضّل مطارات العدو القريبة، وأحياناً تجمّع فرق
    const bases = A.bases.filter(b => b.side !== mb.side && d2(b.p, mb.p) < 700);
    if (bases.length && A.rnd() < .6) { const b = bases[Math.floor(A.rnd() * bases.length)]; return { kind: 'base', p: b.p, n: b.n, b }; }
    const cnt = new Map(); for (const d of W.divs) if (!d.dead && d.side !== mb.side) cnt.set(d.cell, (cnt.get(d.cell) || 0) + 1);
    let best = null, bv = 0; for (const [c, n] of cnt) { const dd = d2(W.cells[c].c, mb.p); if (dd < 650 && n > bv) { bv = n; best = c; } }
    return best != null ? { kind: 'troops', p: W.cells[best].c, cell: best, n: W.cells[best].city || 'تجمّع قوات' } : null;
  }
  function attack(A, W, SIM, p) {
    const T = PLANES[p.type];
    if (p.m.kind === 'strike' && p.m.sam != null) {
      const s = A.sams[p.m.sam]; if (d2(s.p, [p.x, p.y]) < 40) { s.down = 25; s.ammo = Math.max(0, s.ammo - 4); emit(A, { k: 'bomb', x: s.p[0], y: s.p[1], side: p.side, what: s.n }); }
      return;
    }
    // إسناد: ضرب فرق العدو بالمنطقة الهدف أو أقرب منطقة بيها عدو
    let cell = p.m.cell; const en = c => W.divs.filter(d => !d.dead && d.side !== p.side && d.cell === c);
    if (cell == null || !en(cell).length) { let bd = 40; cell = null; for (const d of W.divs) if (!d.dead && d.side !== p.side) { const dd = d2(W.cells[d.cell].c, [p.x, p.y]); if (dd < bd) { bd = dd; cell = d.cell; } } }
    const c = cell != null ? W.cells[cell].c : [p.x, p.y];
    emit(A, { k: 'bomb', x: c[0] + (A.rnd() - .5) * 8, y: c[1] + (A.rnd() - .5) * 8, side: p.side });
    if (cell != null) SIM.airHit(W, p.side, cell, T.ag);
  }
  function impact(A, W, SIM, m) {
    emit(A, { k: 'bmimpact', x: m.x, y: m.y, side: m.side, tgt: m.tg.n });
    if (m.tg.kind === 'base' && d2(m.tg.p, [m.x, m.y]) < 15) { const b = m.tg.b; if (b.ready > 0 && A.rnd() < .6) { b.ready--; b.n0 = Math.max(0, b.n0 - 1); } b.down = Math.max(b.down, 8); }
    if (m.tg.kind === 'troops') SIM.airHit(W, m.side, m.tg.cell, 1.1);
  }
  const API = { create, step, PLANES, BASES, SAMS, MBASES, LL };
  if (typeof module !== 'undefined') module.exports = API; else root.AIR = API;
})(this);
