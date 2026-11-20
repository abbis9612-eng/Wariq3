// «العالم» v3 C0 (I-124): القتال الحي على الخريطة نفسها — بلا مشهد منفصل
// المعارك البحرية تنعاد بمكان الأسطول (wnavb.js بنفس البذرة = نفس النتيجة)، والضربات الصاروخية أقواس من مواقع الإطلاق للأهداف،
// والجبهات ومضات ودخان، والمدن المضروبة تبقى تحترق أيام. الرسم حسب التقريب: بعيد = أقواس ونبض، متوسط = صواريخ وخيوط دخان، قريب = كل التفاصيل.
(function (root) {
  'use strict';
  const L = { list: [], fires: [], api: null };
  let A = null;   // { IMG, SND(), toS(lon,lat), cam(), WD, ar }
  const R = Math.random, KMLAT = 110.57, now = () => performance.now();
  L.init = api => { A = api; };
  L.active = () => L.list.length > 0;
  // ===== الصوت حسب مكان الحدث بالشاشة والتقريب =====
  function snd(n, x, y, vol = 1) {
    const S = A.SND && A.SND(); if (!S || !S.ctx || !S.on || !S.buf[n]) return; const W = innerWidth, H = innerHeight;
    const off = Math.hypot(x - W / 2, y - H / 2) / Math.max(W, H), z = Math.min(1, Math.max(.15, A.cam().s / 4000)); const v = vol * z * Math.max(0, 1.1 - off); if (v < .04) return;
    S.last = S.last || {}; const t = S.ctx.currentTime; if (t - (S.last['lv' + n] || 0) < .07) return; S.last['lv' + n] = t;
    const s = S.ctx.createBufferSource(); s.buffer = S.buf[n]; s.playbackRate.value = .92 + R() * .16; const g = S.ctx.createGain(); g.gain.value = Math.min(1, v);
    const lp = S.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(700, 16000 * Math.exp(-off * 3) * z); let nd = s.connect(lp).connect(g);
    if (S.ctx.createStereoPanner) { const p = S.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, (x - W / 2) / (W / 2))) * .7; nd = nd.connect(p); }
    nd.connect(S.master || S.ctx.destination); s.start(t);
  }
  const img = (n, x, y, w, ang, a = 1, op) => { const im = A.IMG[n]; if (!im || !im.naturalWidth) return; const h = w * im.naturalHeight / im.naturalWidth, c = A.cx;
    c.save(); c.translate(x, y); c.rotate(ang || 0); c.globalAlpha = a; if (op) c.globalCompositeOperation = op; c.drawImage(im, -w / 2, -h / 2, w, h); c.restore(); };
  const boom = (x, y, w, a = 1) => { img(R() < .5 ? 'fx_explo1' : 'fx_explo2', x, y, w, R() * 6, a, 'lighter'); };

  // ================= البحر =================
  // last = G.nav.last، fleetLL = [lon,lat] الأسطول، fromLL = [lon,lat] مصدر الهجوم (ساحل أو زوارق)
  L.addNaval = (B, last, fleetLL, fromLL, mine) => {
    const S = B.create({ s: last.s0 }, last.att, last.seed), b = { k: 'naval', B, S, ll: fleetLL, from: fromLL, t0: now(), acc: 0, P: new Map(), trails: [], fx: [], tracers: [], gid: last.gid, mine, label: last.att.n + ' ' + B.MSL[last.att.kind].n };
    L.list.push(b); return b;
  };
  function navalFrame(b, dt) {
    b.acc += dt * 7;   // 7 ثواني محاكاة بكل ثانية: معركة ~150 ث تخلص بـ ~20 ث
    while (b.acc >= 1 && !b.S.done) { b.acc -= 1; for (const m of b.S.msl) b.P.set(m.id, [m.x, m.y]); const n0 = b.S.ev.length; b.B.step(b.S, 1);
      for (const e of b.S.ev.slice(n0)) b.fx.push({ ...e, at: now() }); }
    if (b.S.done) { b.acc = Math.min(1, b.acc); if (!b.end) b.end = now(); }
    return b.S.done && now() - b.end > 6000;
  }
  function navalDraw(b, c) {
    const cam = A.cam(), [fx, fy] = A.toS(b.ll[0], b.ll[1]), [ax, ay] = A.toS(b.from[0], b.from[1]), th = Math.atan2(ay - fy, ax - fx);
    const real = cam.s / 6371 / Math.cos(b.ll[1] * Math.PI / 180), k = Math.max(5.5 * Math.max(1, Math.min(1.8, cam.s / 2000)), real), ct = Math.cos(th), st = Math.sin(th);
    const P = (x, y) => [fx + (x * ct - y * st) * k, fy + (x * st + y * ct) * k], T = now();
    if (fx < -400 || fx > innerWidth + 400 || fy < -400 || fy > innerHeight + 400) return;
    const far = cam.s < 1400;
    if (far) {   // بعيد: قوس أحمر من المصدر للأسطول ونبض
      c.save(); c.strokeStyle = 'rgba(255,90,70,.75)'; c.lineWidth = 2.2; c.setLineDash([6, 6]); c.lineDashOffset = -(T / 40) % 12; const mx = (fx + ax) / 2 - (ay - fy) * .15, my = (fy + ay) / 2 + (ax - fx) * .15;
      c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(mx, my, fx, fy); c.stroke(); c.setLineDash([]); const pr = (T / 900) % 1; c.strokeStyle = `rgba(255,90,70,${1 - pr})`; c.beginPath(); c.arc(fx, fy, 12 + pr * 30, 0, 7); c.stroke();
      c.font = '700 11px "IBM Plex Sans Arabic",Tahoma'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.6)'; const t = '🚀 ' + b.label + ' ← ' + (b.mine ? 'أسطولنا' : 'أسطول'); c.strokeText(t, fx, fy - 34); c.fillStyle = '#ffd9d2'; c.fillText(t, fx, fy - 34); c.restore(); }
    // السفن (بدل رسم التشكيل الثابت وقت المعركة)
    const SPK = { cv: 'nv_carrier', amp: 'nv_amphib', dd: 'nv_ddg', ff: 'nv_frigate', fac: 'nv_fac', ss: 'nv_sub', ssn: 'nv_sub' }, BASE = { cv: 40, amp: 32, dd: 22, ff: 19, fac: 8, ss: 15, ssn: 18 }, zf = Math.max(1, Math.min(1.8, cam.s / 2000));
    for (const s of b.S.ships) { const [x, y] = P(s.x, s.y), Lw = Math.max(BASE[s.k] * zf, b.B.SHIP[s.k].L * real), sk = s.sunk ? Math.min(1, (b.S.t - s.sunk) / 30) : 0;
      if (sk >= 1) { img('nv_oil-slick', x, y, Lw * 1.4, 0, .85); continue; }
      img(SPK[s.k], x, y, Lw, th + Math.PI + sk * .4, (b.B.SHIP[s.k].sub ? .5 : 1) * (1 - sk * .8));
      if (s.burn > 0) { img('nv_ship-fire', x, y, Lw * .5 * (.6 + s.burn), 0, .75 + .25 * Math.sin(T / 90 + s.id), 'lighter'); smoke(c, x, y, Lw, T, s.burn); } }
    if (far) return;
    // خيوط الدخان والصواريخ
    const f = Math.min(1, b.acc);
    for (const m of b.S.msl) { const p0 = b.P.get(m.id) || [m.x, m.y], px = p0[0] + (m.x - p0[0]) * f, py = p0[1] + (m.y - p0[1]) * f, [x, y] = P(px, py);
      let tr = b.trails.find(q => q.id === m.id); if (!tr) b.trails.push(tr = { id: m.id, sam: m.side === 0, pts: [] }); const q = tr.pts[tr.pts.length - 1]; if (!q || Math.hypot(q[0] - px, q[1] - py) > .1) tr.pts.push([px, py, T]);
      const ang = Math.atan2(P(m.x + Math.cos(m.h || 0), m.y + Math.sin(m.h || 0))[1] - y, P(m.x + Math.cos(m.h || 0), m.y + Math.sin(m.h || 0))[0] - x);
      c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = m.side ? 'rgba(255,170,90,.9)' : 'rgba(220,240,255,.95)'; c.beginPath(); c.arc(x - Math.cos(ang) * 6, y - Math.sin(ang) * 6, m.side ? 3.5 : 2.5, 0, 7); c.fill(); c.restore();
      img(m.side ? 'nv_c802' : 'nv_sm2', x, y, m.side ? 16 : 13, ang); }
    const life = q => q.sam ? 2500 : 5000; c.save(); c.lineCap = 'round';
    for (const tr of b.trails) { tr.pts = tr.pts.filter(p => T - p[2] < life(tr)); for (let i = 1; i < tr.pts.length; i++) { const a = 1 - (T - tr.pts[i][2]) / life(tr), [x1, y1] = P(tr.pts[i - 1][0], tr.pts[i - 1][1]), [x2, y2] = P(tr.pts[i][0], tr.pts[i][1]);
      c.strokeStyle = tr.sam ? `rgba(255,255,255,${a * .5})` : `rgba(215,210,200,${a * .45})`; c.lineWidth = (tr.sam ? 1.4 : 2) + (1 - a) * (tr.sam ? 5 : 9); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); } }
    c.restore(); b.trails = b.trails.filter(q => q.pts.length);
    // الأحداث: انفجارات، فالانكس، تشويش، رشّات، إطلاق
    b.fx = b.fx.filter(e => T - e.at < (e.k === 'sink' ? 4000 : 2200));
    for (const e of b.fx) { const a = 1 - (T - e.at) / 2200, [x, y] = P(e.x, e.y); if (!e.snd) { e.snd = 1;
        snd(({ launch: 'launch', samlaunch: 'launch', kill: 'boom_mid', hit: 'boom_big', sink: 'boom_far', ciws: 'mg', splash: 'boom_far', chaff: 'rocket' })[e.k] || 'whiz', x, y, e.k === 'hit' ? 1 : .7); }
      if (e.k === 'kill') boom(x, y, 26 * (1.3 - a * .4), Math.min(1, a * 1.5));
      if (e.k === 'hit') { boom(x, y, 52 * (1.3 - a * .4), Math.min(1, a * 1.6)); }
      if (e.k === 'splash') img('nv_splash', x, y, 22, 0, a);
      if (e.k === 'launch' || e.k === 'samlaunch') { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,210,140,${a * .7})`; c.beginPath(); c.arc(x, y, 1.5 + 3.5 * a, 0, 7); c.fill(); c.restore(); }
      if (e.k === 'chaff') { c.fillStyle = `rgba(200,200,195,${a * .5})`; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(x + (i - 1.5) * 6, y + (i % 2) * 5, 5 + (1 - a) * 8, 0, 7); c.fill(); } }
      if (e.k === 'ciws' && cam.s > 3000) { const [tx, ty] = P(e.tx, e.ty); c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(255,200,90,.85)'; c.lineWidth = 1;
        for (let i = 0; i < 6; i++) { const q = ((T - e.at) / 600 + i / 6) % 1; c.beginPath(); c.moveTo(x + (tx - x) * q, y + (ty - y) * q); c.lineTo(x + (tx - x) * (q + .07), y + (ty - y) * (q + .07)); c.stroke(); } c.restore(); } }
  }
  function smoke(c, x, y, Lw, T, burn) { for (let i = 0; i < 7; i++) { const f = (T / 2400 + i / 7) % 1, r = Lw * (.1 + f * .4); c.fillStyle = `rgba(25,25,25,${(1 - f) * .4 * burn})`; c.beginPath(); c.arc(x + f * Lw * 1.3, y - f * Lw * .6, r, 0, 7); c.fill(); } }

  // ================= الضربات الصاروخية والمسيّرات (من سجل wsim: strike) =================
  // from = [[lon,lat]...] مواقع إطلاق، to = [[lon,lat]...] أهداف؛ nm صواريخ (im انعترض)، nd مسيّرات (id انعترضت)
  L.addStrike = (o) => {
    const T = now(), items = [], dur = 9000, nM = Math.min(40, o.nm || 0), nD = Math.min(30, o.nd || 0), kM = nM ? Math.round((o.im || 0) / Math.max(1, o.nm) * nM) : 0, kD = nD ? Math.round((o.id || 0) / Math.max(1, o.nd) * nD) : 0;
    // موجات: المسيّرات تطلع أول (بطيئة)، بعدين الباليستي، والكل يوصل تقريباً سوا
    for (let i = 0; i < nD; i++) { const a = o.from[i % o.from.length], t = o.to[i % o.to.length]; items.push({ k: 'uav', a: jit(a, .3), b: jit(t, .25), t0: T + i * 120, d: dur * 1.15, kill: i < kD, kf: .55 + R() * .35 }); }
    for (let i = 0; i < nM; i++) { const a = o.from[i % o.from.length], t = o.to[i % o.to.length]; items.push({ k: 'bm', a: jit(a, .2), b: jit(t, .15), t0: T + 2600 + i * 160, d: dur * .55, kill: i < kM, kf: .6 + R() * .3 }); }
    L.list.push({ k: 'strike', items, mine: o.mine, by: o.by, tgt: o.tgt, label: o.label, t0: T, ll: o.to[0] });
    if (o.city) for (const t of o.to.slice(0, 2)) if (nM - kM + nD - kD > 0) L.fires.push({ ll: t, t: T + dur, until: o.days || 5, day0: o.day });
  };
  const jit = (p, r) => [p[0] + (R() - .5) * r * 2, p[1] + (R() - .5) * r * 2];
  function strikeDraw(b, c) {
    const T = now(), cam = A.cam(), far = cam.s < 900; let alive = 0;
    for (const it of b.items) { const u = (T - it.t0) / it.d; if (u < 0) { alive++; continue; } if (it.done && T - it.done > 2500) continue; alive++;
      const end = it.kill ? it.kf : 1, uu = Math.min(u, end), [x1, y1] = A.toS(it.a[0], it.a[1]), [x2, y2] = A.toS(it.b[0], it.b[1]);
      const H = it.k === 'bm' ? Math.min(160, Math.hypot(x2 - x1, y2 - y1) * .35) : 0, gx = x1 + (x2 - x1) * uu, gy = y1 + (y2 - y1) * uu, h = 4 * H * uu * (1 - uu), x = gx, y = gy - h;
      if (!it.l) { it.l = 1; snd(it.k === 'bm' ? 'launch' : 'woosh', x1, y1, .8); }
      if (u >= end && !it.done) { it.done = T; if (it.kill) { snd('boom_mid', x, y, .7); } else { snd(it.k === 'bm' ? 'boom_big' : 'boom_bomb', x, y, 1); } }
      // الأثر
      c.save(); c.lineCap = 'round';
      if (it.k === 'bm') { c.strokeStyle = b.tgt === A.me() ? 'rgba(255,120,90,.6)' : b.by === A.me() ? 'rgba(140,200,255,.55)' : 'rgba(255,200,140,.45)'; c.lineWidth = far ? 1.6 : 2.4; c.beginPath(); for (let s = 0; s <= 24; s++) { const q = uu * s / 24, qx = x1 + (x2 - x1) * q, qy = y1 + (y2 - y1) * q - 4 * H * q * (1 - q); s ? c.lineTo(qx, qy) : c.moveTo(qx, qy); } c.stroke();
        if (!far && !it.done) { c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(gx, gy, 3, 1.5, 0, 0, 7); c.fill(); } }
      else { c.strokeStyle = 'rgba(230,230,220,.35)'; c.lineWidth = 1.2; c.setLineDash([2, 4]); c.beginPath(); c.moveTo(x1, y1); c.lineTo(gx, gy); c.stroke(); c.setLineDash([]); }
      c.restore();
      if (!it.done) { if (it.k === 'bm') { c.save(); c.globalCompositeOperation = 'lighter'; const gr = c.createRadialGradient(x, y, 0, x, y, 9); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(1, 'rgba(255,140,40,0)'); c.fillStyle = gr; c.beginPath(); c.arc(x, y, 9, 0, 7); c.fill(); c.restore(); }
        else img('u_shahed_t', x, y, far ? 10 : 16, Math.atan2(y2 - y1, x2 - x1)); }
      else { const a = 1 - (T - it.done) / 2500; if (it.kill) { boom(x, y, 22, a); /* اعتراض بالسما */ const [ix, iy] = [x + 30, y + 60]; c.save(); c.strokeStyle = `rgba(255,255,255,${a * .5})`; c.lineWidth = 1.5; c.beginPath(); c.moveTo(gx + 40, gy + 30); c.lineTo(x, y); c.stroke(); c.restore(); }
        else boom(gx, gy, it.k === 'bm' ? 46 : 28, a); }
    }
    if (far) { const [x, y] = A.toS(b.ll[0], b.ll[1]); c.save(); c.font = '700 11px "IBM Plex Sans Arabic",Tahoma'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.6)'; c.strokeText(b.label, x, y - 22); c.fillStyle = b.mine ? '#cfe6ff' : '#ffd9d2'; c.fillText(b.label, x, y - 22); c.restore(); }
    return !alive;
  }
  // ===== المدن اللي تحترق (تبقى أيام) =====
  function firesDraw(c, day) {
    const T = now(), cam = A.cam(); if (cam.s < 600) return;
    L.fires = L.fires.filter(f => day == null || f.day0 == null || day - f.day0 <= f.until);
    for (const f of L.fires) { if (T < f.t) continue; const [x, y] = A.toS(f.ll[0], f.ll[1]); if (x < -60 || x > innerWidth + 60 || y < -60 || y > innerHeight + 60) continue; const w = Math.max(14, Math.min(40, cam.s / 160));
      img('fx_fire', x, y, w, 0, .7 + .3 * Math.sin(T / 120 + x), 'lighter'); smoke(c, x, y, w, T, .9); }
  }
  // ===== الجبهات: ومضات قتال على خطوط التماس =====
  L.front = (pts) => { L.fpts = pts; };   // [[lon,lat,شدة]] من الواجهة كل يوم
  function frontDraw(c) {
    const cam = A.cam(); if (!L.fpts || cam.s < 700) return; const T = now();
    for (const [lon, lat, w] of L.fpts) { const [x, y] = A.toS(lon, lat); if (x < -20 || x > innerWidth + 20 || y < -20 || y > innerHeight + 20) continue;
      const ph = (T / 700 + (lon * 13 + lat * 7)) % 1; if (ph < .25 * w) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,200,120,${(1 - ph / (.25 * w)) * .8})`; c.beginPath(); c.arc(x + Math.sin(lon * 99) * 6, y + Math.cos(lat * 77) * 6, 2.5 + 3 * w, 0, 7); c.fill(); c.restore(); }
      c.fillStyle = `rgba(70,65,60,${.12 * w})`; c.beginPath(); c.arc(x + ((T / 4000 + lon) % 1) * 10, y - ((T / 4000 + lat) % 1) * 12, 5 + 5 * w, 0, 7); c.fill(); }
  }
  // ===== الرسم + أسهم الحواف للأحداث برّا الشاشة =====
  let lastT = 0; L.edge = [];
  L.draw = (c, day) => {
    A.cx = c; const T = now(), dt = Math.min(.1, (T - (lastT || T)) / 1000); lastT = T;
    frontDraw(c); firesDraw(c, day); L.edge = [];
    L.list = L.list.filter(b => { let fin;
      if (b.k === 'naval') { fin = navalFrame(b, dt); navalDraw(b, c); } else fin = strikeDraw(b, c);
      const [x, y] = A.toS(b.ll[0], b.ll[1]); if ((b.mine || b.tgt === A.me()) && (x < 0 || x > innerWidth || y < 90 || y > innerHeight - 90)) L.edge.push({ b, x, y });
      return !fin; });
    // سهم على الحافة يأشّر للمعركة اللي برّا الشاشة
    for (const e of L.edge) { const W = innerWidth, H = innerHeight, cx0 = W / 2, cy0 = H / 2, ang = Math.atan2(e.y - cy0, e.x - cx0), r = Math.min(W / 2 - 26, (H / 2 - 110)), ex = cx0 + Math.cos(ang) * r, ey = cy0 + Math.sin(ang) * r; e.ex = ex; e.ey = ey;
      c.save(); c.translate(ex, ey); c.rotate(ang); c.fillStyle = 'rgba(200,40,30,.92)'; c.beginPath(); c.moveTo(16, 0); c.lineTo(-8, -11); c.lineTo(-3, 0); c.lineTo(-8, 11); c.closePath(); c.fill(); c.restore();
      c.save(); c.font = '700 10px "IBM Plex Sans Arabic",Tahoma'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(120,10,0,.9)'; c.lineWidth = 3; const t = '⚔ ' + (e.b.k === 'naval' ? 'معركة بحرية' : 'ضربة'); c.strokeText(t, ex - Math.cos(ang) * 26, ey - Math.sin(ang) * 26 + 4); c.fillText(t, ex - Math.cos(ang) * 26, ey - Math.sin(ang) * 26 + 4); c.restore(); }
  };
  L.tap = (sx, sy) => { const e = L.edge.find(q => Math.hypot(q.ex - sx, q.ey - sy) < 34); return e ? e.b.ll : null; };
  L.navalGid = gid => L.list.some(b => b.k === 'naval' && b.gid === gid);
  root.LIVEFX = L;
})(this);
