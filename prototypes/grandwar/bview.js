// «مشهد المعركة الحقيقي» BV2 (I-085): رسم المعركة بالمتر والثانية الحقيقية، مثل لقطات المسيّرة من فوق.
// الخريطة الاستراتيجية توقف وانت داخل. الآليات مكبّرة ×4 بس (مو ×1000)، والتباعد حقيقي فما يصير تراكب.
// الصوت يتأخر بسرعة الصوت الحقيقية (343 م/ث): تشوف الوميض وبعدين تسمع. المؤثرات من fx.js (Unity CC0).
(function () {
  const BW = window.BVIEW = {};
  let B = null, el, cv, g, IMG, SND, onExit, spd = 1, last = 0, raf = 0, info = null;
  const cam = { x: 0, y: 1200, s: .42 }; // s = بكسل/متر
  const w2s = (x, y) => [(x - cam.x) * cam.s + innerWidth / 2, (y - cam.y) * cam.s + innerHeight / 2];
  const s2w = (x, y) => [(x - innerWidth / 2) / cam.s + cam.x, (y - innerHeight / 2) / cam.s + cam.y];
  const E = 5; // تكبير الآليات (×5 حتى تنشاف على التلفون)
  const TEX = { plain: 'dirt_aerial_02', desert: 'aerial_sand', marsh: 'aerial_mud_1', city: 'aerial_asphalt_01', hills: 'rocky_terrain_02', mount: 'rocky_terrain_02' };
  const R = Math.random;
  BW.init = o => ({ IMG, SND } = o);
  BW.cam = cam; Object.defineProperty(BW, 'B', { get: () => B });
  const sizePx = len => Math.max(10, len * E * cam.s);
  // صوت بالمتر: تأخير سرعة الصوت، يخفت بالبعد عن نص الشاشة، والبعيد مكتوم
  function snd(n, x, y, vol = 1) {
    if (!SND || !SND.ctx || !SND.on || !SND.buf[n]) return; const now = SND.ctx.currentTime; SND.last = SND.last || {};
    if (now - (SND.last['bv' + n] || 0) < .06) return; SND.last['bv' + n] = now;
    const d = Math.hypot(x - cam.x, y - cam.y), view = innerWidth / cam.s; const v = vol * Math.max(0, 1 - d / (view * 2.2)); if (v < .03) return;
    const s = SND.ctx.createBufferSource(); s.buffer = SND.buf[n]; s.playbackRate.value = .93 + R() * .14;
    const gn = SND.ctx.createGain(); gn.gain.value = Math.min(1, v); const lp = SND.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(700, 15000 * Math.exp(-d / 1800));
    s.connect(lp).connect(gn).connect(SND.master); s.start(now + Math.min(4, d / 343) / Math.max(1, spd));
  }
  BW.open = (battle, o) => {
    B = battle; info = o; onExit = o.onExit; spd = 1;
    el = document.getElementById('bv'); el.hidden = false; cv = document.getElementById('bvc'); g = cv.getContext('2d');
    el.querySelector('#bvT').textContent = o.title; el.querySelector('#bvRes').hidden = true;
    el.querySelectorAll('#bvSpd button').forEach(b => { b.classList.toggle('on', +b.dataset.k === 1); b.onclick = () => { spd = +b.dataset.k; el.querySelectorAll('#bvSpd button').forEach(z => z.classList.toggle('on', z === b)); }; });
    el.querySelector('#bvX').onclick = close;
    // الكاميرا على المهاجمين
    const A = B.units.filter(u => u.att); cam.x = A.reduce((s, u) => s + u.p.x, 0) / A.length; cam.y = A.reduce((s, u) => s + u.p.y, 0) / A.length - 500; cam.s = .5 * innerWidth / 412; shot = null; follow = true;
    FX.init({ g, cam: { get s() { return cam.s; }, get x() { return cam.x; }, get y() { return cam.y; } }, w2s, IMG }); FX.clear && FX.clear();
    FX.U = () => sizePx(9.8) / 30; FX.WIND = [6, -2];
    input(); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  };
  function close() { cancelAnimationFrame(raf); el.hidden = true; FX.clear && FX.clear(); const b = B; B = null; onExit && onExit(b); }
  // ===== إدخال: سحب وتكبير =====
  let ptrs = new Map(), pinch = null;
  function input() {
    if (cv._in) return; cv._in = 1;
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: cam.s, w: s2w((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) }; } follow = false; });
    cv.addEventListener('pointermove', e => { if (!ptrs.has(e.pointerId)) return; const p = ptrs.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1]; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()]; cam.s = Math.min(3, Math.max(.06, pinch.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d)); const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; cam.x = pinch.w[0] - (m[0] - innerWidth / 2) / cam.s; cam.y = pinch.w[1] - (m[1] - innerHeight / 2) / cam.s; return; }
      cam.x -= dx / cam.s; cam.y -= dy / cam.s; });
    const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); const w = s2w(e.clientX, e.clientY); cam.s = Math.min(3, Math.max(.06, cam.s * Math.exp(-e.deltaY * .0015))); cam.x = w[0] - (e.clientX - innerWidth / 2) / cam.s; cam.y = w[1] - (e.clientY - innerHeight / 2) / cam.s; }, { passive: false });
    document.getElementById('bvFol').onclick = () => { follow = true; };
  }
  let follow = true;
  // ===== الحلقة =====
  function frame(now) {
    if (!B) return; const rdt = Math.min(.1, (now - last) / 1000); last = now;
    const DPR = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    if (cv.width !== Math.round(W * DPR)) { cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); }
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    // خطوات بالثانية الحقيقية × السرعة المختارة
    let left = rdt * spd; while (left > 1e-6) { const h = Math.min(.05, left); BV.step(B, h); left -= h; }
    for (const e of B.ev) if (!e.seen) { e.seen = 1; onEv(e); if (follow) pick(e); }
    // كاميرا «مخرج»: تتابع مركز القتال بنعومة
    if (follow) director(rdt);
    FX.update(rdt * spd);
    drawGround(); FX.drawGround(); drawCover(); drawUnits(); drawShots(); FX.draw(); drawJets(); mini(); hud();
    raf = requestAnimationFrame(frame);
  }
  // ===== المخرج: يقطع لأهم لحظة من قريب (صاروخ ضد دروع بالجو، دبابة تنضرب، غطس طيارة، قصف) =====
  let shot = null; // {k, x, y, s, until, track}
  function pick(e) {
    const P = { kill: 9, release: 8, jetkill: 8, atgm: 7, manpad: 7, bombhit: 6, gun: 3, artyhit: 2, can30: 1 }[e.k]; if (!P) return;
    if (shot && B.t < shot.until && shot.p >= P) return;
    if (e.k === 'atgm') { const m = B.shots.filter(z => z.k === 'atgm' && !z.done).pop(); if (m) { shot = { p: P, k: 'atgm', track: m, s: .75, until: B.t + Math.min(16, m.dur + 2) }; return; } }
    if (e.k === 'release' || e.k === 'manpad') { const j = B.jets.filter(z => z.st !== 'dead').sort((a, b) => Math.hypot(a.p.x - e.x, a.p.y - e.y) - Math.hypot(b.p.x - e.x, b.p.y - e.y))[0]; if (j) { shot = { p: P, k: 'jet', jet: j, s: .5, until: B.t + 7 }; return; } }
    if (e.k === 'gun') { const sh = B.shots.filter(z => z.k === 'shell' && !z.done).pop(); if (sh) { shot = { p: P, k: 'pt', x: sh.tx, y: sh.ty, s: .7, until: B.t + 4 }; return; } }
    shot = { p: P, k: 'pt', x: e.x, y: e.y, s: e.k === 'kill' ? .9 : e.k === 'artyhit' ? .55 : .7, until: B.t + (e.k === 'kill' ? 6 : 4) };
  }
  function director(rdt) {
    let tx, ty, ts;
    if (shot && B.t < shot.until) {
      if (shot.k === 'atgm') { const m = shot.track; const f = Math.min(1, m.t / m.dur); tx = m.x + (m.tx - m.x) * f; ty = m.y + (m.ty - m.y) * f; ts = shot.s; }
      else if (shot.k === 'jet') { tx = shot.jet.p.x; ty = shot.jet.p.y; ts = shot.s; }
      else { tx = shot.x; ty = shot.y; ts = shot.s; }
    } else { // ماكو لقطة: المهاجمين وهم يتقدمون
      const att = B.units.filter(u => u.att && u.st !== 'dead' && BV.T[u.type].k !== 'truck'); if (att.length) { tx = att.reduce((s, u) => s + u.p.x, 0) / att.length; ty = att.reduce((s, u) => s + u.p.y, 0) / att.length - 250; } ts = .5;
    }
    if (tx == null) return; const k = Math.min(1, rdt * (shot && shot.k === 'atgm' ? 3 : 1.4));
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.s += (ts * innerWidth / 412 - cam.s) * Math.min(1, rdt * .9);
  }
  // خريطة صغيرة بالزاوية: كل المعركة، ومستطيل اللي تشوفه
  function mini() {
    const mw = 112, mh = 120, mx = 10, my = innerHeight - mh - 42, W = BV.W_DIM.w, H = BV.W_DIM.h + 1600; const k = Math.min(mw / W, mh / H);
    const X = x => mx + mw / 2 + x * k, Y = y => my + mh / 2 + (y - 800) * k;
    g.fillStyle = 'rgba(20,18,15,.72)'; g.beginPath(); g.roundRect(mx - 4, my - 4, mw + 8, mh + 8, 8); g.fill();
    g.strokeStyle = 'rgba(120,90,50,.8)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(mx, Y(B.obj.y - 40)); g.lineTo(mx + mw, Y(B.obj.y - 40)); g.stroke();
    for (const u of B.units) { if (u.st === 'dead') continue; g.fillStyle = u.side ? '#ff6a55' : '#5d9bff'; g.fillRect(X(u.p.x) - 1.3, Y(u.p.y) - 1.3, 2.6, 2.6); }
    for (const s2 of B.shots) if (!s2.done && (s2.k === 'shell' || s2.k === 'atgm')) { g.strokeStyle = s2.k === 'atgm' ? 'rgba(255,230,160,.9)' : 'rgba(255,240,190,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(X(s2.x), Y(s2.y)); g.lineTo(X(s2.tx), Y(s2.ty)); g.stroke(); }
    const vw = innerWidth / cam.s, vh = innerHeight / cam.s; g.strokeStyle = '#ffd65a'; g.lineWidth = 1.2; g.strokeRect(X(cam.x - vw / 2), Y(cam.y - vh / 2), vw * k, vh * k);
  }
  // ===== الأرض =====
  function drawGround() {
    const W = innerWidth, H = innerHeight, tex = IMG['bv_' + (TEX[B.terr] || 'dirt_aerial_02')]; const tile = 520 * cam.s;
    g.fillStyle = '#8a7a5c'; g.fillRect(0, 0, W, H);
    if (tex && tex.complete) { const [ox, oy] = w2s(0, 0); const sx = ((ox % tile) + tile) % tile - tile, sy = ((oy % tile) + tile) % tile - tile; for (let x = sx; x < W; x += tile) for (let y = sy; y < H; y += tile) g.drawImage(tex, x, y, tile + 1, tile + 1);
      const t2 = IMG.bv_aerial_grass_rock || tex, tl2 = 830 * cam.s, sx2 = ((ox * .97 % tl2) + tl2) % tl2 - tl2, sy2 = ((oy * .97 % tl2) + tl2) % tl2 - tl2; g.globalAlpha = .28; for (let x = sx2; x < W; x += tl2) for (let y = sy2; y < H; y += tl2) g.drawImage(t2, x, y, tl2 + 1, tl2 + 1); g.globalAlpha = 1; }
    // أهوار: مي هنا وهناك
    if (B.terr === 'marsh') { g.fillStyle = 'rgba(70,110,120,.45)'; for (const c of B.cover) if (c.kind === 'reed') { const [x, y] = w2s(c.x + 40, c.y + 30); g.beginPath(); g.ellipse(x, y, c.rad * 1.6 * cam.s, c.rad * cam.s, .4, 0, 7); g.fill(); } }
    // خط الدفاع (سواتر) وخط الهدف
    const [, oy] = w2s(0, B.obj.y); g.strokeStyle = 'rgba(120,90,50,.55)'; g.lineWidth = Math.max(2, 14 * cam.s); g.setLineDash([22 * cam.s + 4, 10 * cam.s + 3]); g.beginPath(); g.moveTo(0, oy - 40 * cam.s); g.lineTo(W, oy - 40 * cam.s); g.stroke(); g.setLineDash([]);
  }
  function drawCover() {
    for (const c of B.cover) { const [x, y] = w2s(c.x, c.y); const s = Math.max(12, c.rad * 1.4 * cam.s); if (x < -s || x > innerWidth + s || y < -s || y > innerHeight + s) continue;
      const n = c.kind === 'house' ? ['h1', 'h2', 'h3', 'h4'][Math.abs(Math.round(c.x)) % 4] : c.kind === 'palm' ? 'palm' : c.kind === 'reed' ? 'tree' : c.kind === 'rock' ? null : 'acacia';
      if (n && IMG['bv_' + n]) g.drawImage(IMG['bv_' + n], x - s / 2, y - s / 2, s, s); else { g.fillStyle = 'rgba(90,80,65,.5)'; g.beginPath(); g.ellipse(x, y, s * .35, s * .25, c.x % 3, 0, 7); g.fill(); } }
  }
  // ===== الوحدات =====
  const DARK = {}; const dark = n => { if (DARK[n]) return DARK[n]; const im = IMG[n], c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.filter = 'brightness(.25) saturate(.15)'; x.drawImage(im, 0, 0); return DARK[n] = c; };
  function drawUnits() {
    for (const u of B.units) {
      const [x, y] = w2s(u.p.x, u.p.y); const s = sizePx(BV.T[u.type].len); if (x < -s || x > innerWidth + s || y < -s || y > innerHeight + s) continue;
      const n = u.spr === 'truck' && u.side ? 'truck_r' : u.spr;
      if (u.st === 'dead') { g.save(); g.translate(x, y); g.rotate(u.hd); g.drawImage(dark(u.spr), -s / 2, -s / 2, s, s); g.restore(); continue; }
      // حفرة/ساتر للمدافع
      if (u.dug) { g.save(); g.translate(x, y); g.rotate(u.hd); g.fillStyle = 'rgba(110,85,55,.85)'; g.beginPath(); g.ellipse(s * .55, 0, s * .16, s * .55, 0, 0, 7); g.fill(); g.restore(); }
      g.save(); g.translate(x, y); g.beginPath(); g.ellipse(0, 0, s * .46, s * .32, u.hd, 0, 7); g.fillStyle = u.side ? 'rgba(215,60,45,.55)' : 'rgba(45,115,235,.55)'; g.fill();
      g.rotate(u.hd); g.drawImage(IMG[n], -s / 2, -s / 2, s, s);
      if (u.type === 'abrams' || u.type === 't72') { g.rotate(u.tur - u.hd); g.drawImage(IMG[u.spr + '_t'], -s / 2, -s / 2, s, s); }
      g.restore();
      if (Math.abs(u.spd) > 2 && R() < .25) FX.puff(u.p.x - Math.cos(u.hd) * 6, u.p.y - Math.sin(u.hd) * 6, s * .2, 2.4, 'dust', .35, 0, 0, 2);
    }
    // المشاة: نقاط بعددهم
    for (const q of B.inf) { if (q.st === 'dead') continue; const [x, y] = w2s(q.p.x, q.p.y); if (x < -30 || x > innerWidth + 30 || y < -30 || y > innerHeight + 30) continue; const r = Math.max(1.6, 1.2 * E * cam.s * .5);
      for (let k = 0; k < q.n; k++) { const a = k * 2.4 + q.id, rr = (6 + (k % 3) * 5) * cam.s * 1.6; g.beginPath(); g.arc(x + Math.cos(a) * rr * 2, y + Math.sin(a) * rr, r, 0, 7); g.fillStyle = q.side ? '#5a2a20' : '#1d3557'; g.fill(); }
      if (q.dug) { g.strokeStyle = 'rgba(80,60,40,.8)'; g.lineWidth = Math.max(1.5, 3 * cam.s); g.beginPath(); g.moveTo(x - 30 * cam.s * 1.6, y + 6 * cam.s); g.lineTo(x + 30 * cam.s * 1.6, y + 6 * cam.s); g.stroke(); } }
  }
  // ===== الرمي =====
  function drawShots() {
    for (const s of B.shots) {
      if (s.k === 'manpad') { const [x, y] = w2s(s.x, s.y - s.alt * .25); FX.puff(s.x, s.y - s.alt * .25, 3, 4, 'grey', .5, 0, 0, 3); g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill(); continue; }
      const f = Math.min(1, s.t / s.dur); const x = s.x + (s.tx - s.x) * f, y = s.y + (s.ty - s.y) * f; const [sx, sy] = w2s(x, y);
      if (s.k === 'shell' || s.k === 'can30') { const back = Math.min(f, s.k === 'shell' ? 120 / Math.hypot(s.tx - s.x, s.ty - s.y) : 60 / Math.hypot(s.tx - s.x, s.ty - s.y)); const [bx, by] = w2s(s.x + (s.tx - s.x) * (f - back), s.y + (s.ty - s.y) * (f - back)); g.strokeStyle = s.k === 'shell' ? 'rgba(255,236,170,.95)' : 'rgba(255,190,110,.9)'; g.lineWidth = s.k === 'shell' ? 2.4 : 1.6; g.beginPath(); g.moveTo(bx, by); g.lineTo(sx, sy); g.stroke(); }
      else if (s.k === 'atgm' || s.k === 'rpg') { if (R() < .7) FX.puff(x, y, 2.6, s.k === 'atgm' ? 6 : 3, 'grey', .5, 0, 0, 2.6); g.fillStyle = '#ffe2a0'; g.beginPath(); g.arc(sx, sy, 2.4, 0, 7); g.fill(); }
      else if (s.k === 'rifle') { g.strokeStyle = 'rgba(255,240,190,.6)'; g.lineWidth = .8; const [bx, by] = w2s(s.x + (s.tx - s.x) * Math.max(0, f - .15), s.y + (s.ty - s.y) * Math.max(0, f - .15)); g.beginPath(); g.moveTo(bx, by); g.lineTo(sx, sy); g.stroke(); }
      else if (s.k === 'bomb') { const z = s.z * (1 - f); const [bx, by] = w2s(x, y - z * .25); g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(sx, sy, 3, 0, 7); g.fill(); g.fillStyle = '#3d4038'; g.beginPath(); g.ellipse(bx, by, 4, 1.8, Math.atan2(s.ty - s.y, s.tx - s.x), 0, 7); g.fill(); }
    }
  }
  function drawJets() {
    for (const j of B.jets) { if (j.st === 'dead') continue; const [x, y] = w2s(j.p.x, j.p.y - j.z * .25), [sx, sy] = w2s(j.p.x, j.p.y); const s = Math.max(22, 15.5 * E * cam.s);
      const sh = IMG.su25_sheet, ri = (((Math.round((j.bank * 180 / Math.PI + 180) / 20)) % 18) + 18) % 18, pi = j.gam < -.3 ? 0 : j.gam > .3 ? 2 : 1, fr = pi * 18 + ri, H = j.hd + Math.PI;
      g.save(); g.globalAlpha = .28; g.translate(sx, sy); g.rotate(H); g.filter = 'brightness(0) blur(1.5px)'; g.drawImage(sh, (fr % 8) * 256, Math.floor(fr / 8) * 256, 256, 256, -s / 2, -s / 2, s, s); g.restore();
      g.save(); g.translate(x, y); g.rotate(H); g.drawImage(sh, (fr % 8) * 256, Math.floor(fr / 8) * 256, 256, 256, -s / 2, -s / 2, s, s); g.restore();
      g.beginPath(); g.moveTo(x, y - s * .6); g.lineTo(x - 4, y - s * .6 - 6); g.lineTo(x + 4, y - s * .6 - 6); g.closePath(); g.fillStyle = j.side ? '#e0533f' : '#4f8ff0'; g.fill();
      if (j.st === 'fall' && R() < .8) FX.puff(j.p.x, j.p.y - j.z * .25, 6, 4, 'black', .6, 0, 0, 2); }
  }
  // ===== الأحداث → مؤثرات وأصوات =====
  function onEv(e) {
    const U = sizePx(9.8);
    if (e.k === 'gun') { const u = B.units.find(z => z.id === e.id); const a = u ? u.tur : 0; FX.muzzle(e.x + Math.cos(a) * 7, e.y + Math.sin(a) * 7, a, 1); snd('tank', e.x, e.y, .7); }
    else if (e.k === 'can30') snd('can30', e.x, e.y, .45);
    else if (e.k === 'atgm' || e.k === 'rpg') { FX.puff(e.x, e.y, 6, 3, 'grey', .6, 0, 0, 2); snd('woosh', e.x, e.y, .5); }
    else if (e.k === 'rifle') snd('mg', e.x, e.y, .25);
    else if (e.k === 'kill') { FX.spark(e.x, e.y, 14, 140); setTimeout(() => { if (!B) return; FX.explode(e.x, e.y, e.type === 'abrams' || e.type === 't72' ? 'cookoff' : 'big', 1); FX.burn(e.x, e.y, 1, 90); snd('boom_big', e.x, e.y, 1); }, 600 / spd); }
    else if (e.k === 'ricochet') { FX.spark(e.x, e.y, 10, 120); }
    else if (e.k === 'miss') { FX.dirt(e.x, e.y, .7); }
    else if (e.k === 'dust') { FX.puff(e.x, e.y, 2, 1, 'dust', .4, 0, 0, 1.5); }
    else if (e.k === 'whistle') snd('whiz', e.x, e.y, .6);
    else if (e.k === 'artyhit') { FX.explode(e.x, e.y, 'he', 1.1); snd('boom_mid', e.x, e.y, .8); }
    else if (e.k === 'bombhit') { FX.explode(e.x, e.y, 'bomb', 1); snd('boom_bomb', e.x, e.y, 1); }
    else if (e.k === 'jetin') snd('jet_roar', e.x, e.y, .8);
    else if (e.k === 'flare') { FX.spark(e.x, e.y - (e.z || 0) * .25, 4, 40); FX.puff(e.x, e.y - (e.z || 0) * .25, 3, 3, 'grey', .5, 0, 0, 2); }
    else if (e.k === 'manpad') { FX.puff(e.x, e.y, 5, 3, 'grey', .6, 0, 0, 2); snd('launch', e.x, e.y, .6); }
    else if (e.k === 'jetkill') { FX.explode(e.x, e.y - (e.z || 0) * .25, 'air', 1.2); snd('boom_big', e.x, e.y, .9); }
    else if (e.k === 'airburst') FX.explode(e.x, e.y - (e.z || 0) * .25, 'air', .5);
    else if (e.k === 'crash') { FX.explode(e.x, e.y, 'big', 1.3); FX.burn(e.x, e.y, 1, 70); snd('boom_big', e.x, e.y, 1); }
    else if (e.k === 'over') showRes();
  }
  function hud() {
    const cnt = (s, k) => B.units.filter(u => u.side === s && u.st !== 'dead' && BV.T[u.type].k === k).length, all = (s, k) => B.units.filter(u => u.side === s && BV.T[u.type].k === k).length;
    const me = info.me, foe = 1 - me; const t = Math.floor(B.t);
    document.getElementById('bvC').innerHTML = `⏱ ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} · ${B.phase === 'prep' ? 'تمهيد مدفعية' : 'قتال'}<br>🇮🇶 دبابات ${cnt(0, 'tank')}/${all(0, 'tank')} · مدرعات ${cnt(0, 'ifv')}/${all(0, 'ifv')} &nbsp;|&nbsp; 🇮🇷 دبابات ${cnt(1, 'tank')}/${all(1, 'tank')} · مدرعات ${cnt(1, 'ifv')}/${all(1, 'ifv')}`;
  }
  function showRes() {
    const r = document.getElementById('bvRes'), o = B.over, attMe = B.side.att === info.me; const weWon = (o.win === 'att') === attMe && o.win !== 'none';
    r.hidden = false; r.innerHTML = `<b style="font:700 20px 'Reem Kufi';color:${weWon ? '#7fb0ff' : o.win === 'none' ? '#e2b552' : '#ff8a7a'}">${o.win === 'none' ? 'بدون حسم' : weWon ? 'انتصرنا بالمعركة' : 'خسرنا المعركة'}</b><div>${o.why}</div><div style="opacity:.8;font-size:12px">خسائرنا ${Math.round(B.lost[info.me])} · خسائرهم ${Math.round(B.lost[1 - info.me])}</div><button id="bvBack">↩ رجوع للخريطة</button>`;
    document.getElementById('bvBack').onclick = close;
  }
})();
