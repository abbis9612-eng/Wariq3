// «الحرب الكبرى» R1 (I-083): انفجارات وتدمير حقيقي.
// الصور: Unity Labs Paris (CC0) — انفجار 5×5 (fx_explo1/2)، كرة نار 8×8 (fx_fire)، غيمة دخان 8×8 (fx_cloud).
// كل شي بإحداثيات الكم، والحجم بالبكسل نسبةً لحجم الآلية على الشاشة (U)، فمن تقرّب يكبر ويا الدبابات.
// ترتيب الانفجار: ومضة ← كرة نار (صور) ← موجة ضغط ← شرر ← شظايا وتراب ← دخان يصعد ويمشي ويا الريح ويبقى ← حفرة تبهت ببطء.
(function () {
  const FX = window.FX = {};
  let g, cam, w2s, IMG; const R = Math.random, rr = (a, b) => a + R() * (b - a);
  const L = { decal: [], ex: [], ring: [], spark: [], deb: [], puff: [], fire: [], emit: [], thrown: [], bomb: [] };
  const CAP = { decal: 220, ex: 80, ring: 60, spark: 400, deb: 400, puff: 900, fire: 160, emit: 120, thrown: 60, bomb: 30 };
  FX.WIND = [11, -3]; // بكسل بالثانية (الدخان يمشي ويا الريح)
  let tint = {};
  FX.init = o => {
    ({ g, cam, w2s, IMG } = o);
    // نسخ ملوّنة من غيمة الدخان: أسود (حريق)، رمادي، تراب
    for (const [k, col] of [['black', 'rgba(22,20,18,1)'], ['grey', 'rgba(120,116,110,1)'], ['dust', 'rgba(165,140,100,1)']]) {
      const src = IMG.fx_cloud, c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const x = c.getContext('2d');
      x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = col; x.globalAlpha = k === 'grey' ? .55 : .85; x.fillRect(0, 0, c.width, c.height); tint[k] = c;
    }
  };
  FX.U = () => Math.min(.6, Math.max(.16, cam.s * .26)); // على الخريطة: صغير بمكانه (مثل خريطة عمليات)؛ مشهد المعركة يبدّله بحجمه
  const push = (k, o) => { const a = L[k]; a.push(o); if (a.length > CAP[k]) a.splice(0, a.length - CAP[k]); return o; };
  const vis = (x, y, m = 80) => x > -m && x < innerWidth + m && y > -m && y < innerHeight + m;

  // ===== أساسيات =====
  FX.puff = (x, y, r, life, kind = 'grey', a = .6, vx = 0, vy = 0, grow = 1.2) => push('puff', { x, y, r, life, kind, a, vx, vy, grow, t: 0, f: Math.floor(R() * 64), rot: R() * 6.28 });
  FX.crater = (x, y, r, life = 90) => push('decal', { x, y, r, t: 0, life, k: 'crater', rot: R() * 6.28 });
  FX.scorch = (x, y, r, life = 160) => push('decal', { x, y, r, t: 0, life, k: 'scorch', rot: R() * 6.28 });
  FX.spark = (x, y, n = 8, sp = 90) => { for (let i = 0; i < n; i++) { const a = R() * 6.28, v = rr(.3, 1) * sp; push('spark', { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rr(.15, .45) }); } };
  FX.debris = (x, y, n, sp, col = '#3a332b') => { for (let i = 0; i < n; i++) { const a = R() * 6.28, v = rr(.25, 1) * sp; push('deb', { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, h: 0, vh: rr(20, 60), t: 0, life: rr(.6, 1.4), s: rr(1, 2.6), col }); } };
  FX.muzzle = (x, y, ang, k = 1) => { push('ex', { x, y, t: 0, life: .09, s: 14 * k, k: 'flash', ang }); const U = FX.U(); for (let i = 0; i < 3; i++) FX.puff(x, y, 5 * U * k, rr(.8, 1.6), 'dust', .35, Math.cos(ang + rr(-1.2, 1.2)) * 18 * U, Math.sin(ang + rr(-1.2, 1.2)) * 18 * U, 1.6); };

  // ===== الانفجارات =====
  // kind: 'he' قذيفة، 'big' كبير، 'cookoff' انفجار ذخيرة دبابة، 'bomb' قنبلة طيارة، 'bm' باليستي، 'air' بالجو (بلا حفرة)
  FX.explode = (x, y, kind = 'he', k = 1) => {
    const U = FX.U(); const S = { he: 1, big: 1.7, cookoff: 1.5, bomb: 2.4, bm: 3.4, air: 1.6, small: .6 }[kind] * k * U;
    push('ex', { x, y, t: 0, life: .1, s: 30 * S, k: 'flash' });
    push('ex', { x, y, t: 0, life: kind === 'small' ? .6 : 1.1, s: 40 * S, k: R() < .5 ? 'e1' : 'e2', rot: R() * 6.28 });
    if (kind !== 'small') push('ring', { x, y, t: 0, life: .35 + S * .05, r: 34 * S, air: kind === 'air' });
    FX.spark(x, y, Math.round(8 + 6 * S), 120 * S);
    if (kind !== 'air') {
      FX.debris(x, y, Math.round(6 + 8 * S), 70 * S, kind === 'cookoff' ? '#2a2420' : '#5b4a36');
      for (let i = 0; i < 3 + S * 2; i++) { const a = R() * 6.28; FX.puff(x, y, 9 * S, rr(1.5, 3), 'dust', .45, Math.cos(a) * 26 * S, Math.sin(a) * 26 * S, 1.8); }
      FX.crater(x, y, 7 * S, kind === 'bm' || kind === 'bomb' ? 240 : 90);
    }
    const n = kind === 'air' ? 4 : 5 + S * 3;
    for (let i = 0; i < n; i++) FX.puff(x + rr(-6, 6) * S / cam.s * .2, y + rr(-6, 6) * S / cam.s * .2, rr(6, 10) * S, rr(5, 10) * (kind === 'bm' ? 1.6 : 1), kind === 'he' ? 'grey' : 'black', .38, rr(-6, 6), rr(-12, -3) * S, 2.2);
  };
  // نافورة تراب (قذيفة تخطي، صاروخ راجمة)
  FX.dirt = (x, y, k = 1) => { const U = FX.U() * k; push('ex', { x, y, t: 0, life: .08, s: 12 * U, k: 'flash' }); FX.debris(x, y, 10, 55 * U, '#6b5638'); for (let i = 0; i < 4; i++) { const a = R() * 6.28; FX.puff(x, y, 7 * U, rr(1.2, 2.6), 'dust', .55, Math.cos(a) * 14 * U, Math.sin(a) * 14 * U, 2); } FX.crater(x, y, 4 * U, 60); };
  // حريق يبقى (حطام): نار تهتز + عمود دخان أسود يصعد ويمشي ويا الريح
  FX.burn = (x, y, k = 1, dur = 80) => { push('fire', { x, y, k, t: 0, life: dur * .55, f: Math.floor(R() * 64) }); push('emit', { x, y, k, t: 0, life: dur, acc: 0 }); FX.scorch(x, y, 9 * FX.U() * k, dur * 2); };
  // برج يطير من الدبابة وينزل جنبها
  FX.throwPart = (img, x, y, h, size) => { const a = R() * 6.28, d = rr(18, 34) * FX.U(); push('thrown', { img, x, y, x1: x + Math.cos(a) * d / cam.s, y1: y + Math.sin(a) * d / cam.s, h, spin: rr(-9, 9), t: 0, dur: rr(.9, 1.3), size, landed: false }); };
  // قنبلة تنزل من الطيارة للهدف
  FX.bomb = (x0, y0, x1, y1, onHit) => push('bomb', { x0, y0, x1, y1, t: 0, dur: .7, onHit });

  // ===== التحديث والرسم =====
  FX.update = dt => {
    for (const k in L) { const a = L[k]; for (let i = a.length - 1; i >= 0; i--) { const p = a[i]; p.t += dt; if (p.t > (p.life ?? p.dur ?? 1e9) && k !== 'thrown') a.splice(i, 1); } }
    for (const p of L.spark) { p.x += p.vx * dt / cam.s; p.y += p.vy * dt / cam.s; p.vx *= .9; p.vy *= .9; }
    for (const p of L.deb) { p.x += p.vx * dt / cam.s; p.y += p.vy * dt / cam.s; p.vx *= Math.pow(.25, dt); p.vy *= Math.pow(.25, dt); p.h += p.vh * dt; p.vh -= 120 * dt; if (p.h < 0) { p.h = 0; p.vh = 0; p.vx *= .5; p.vy *= .5; } }
    for (const p of L.puff) { p.x += (p.vx + FX.WIND[0] * Math.min(1, p.t / 2)) * dt / cam.s; p.y += (p.vy + FX.WIND[1] * Math.min(1, p.t / 2)) * dt / cam.s; p.vx *= Math.pow(.45, dt); p.vy *= Math.pow(.6, dt); }
    for (const e of L.emit) { e.acc += dt; const rate = .16 + e.t / e.life * .5; while (e.acc > rate) { e.acc -= rate; const U = FX.U() * e.k; const life = 1 - e.t / e.life; FX.puff(e.x + rr(-1, 1) / cam.s, e.y + rr(-1, 1) / cam.s, 3.2 * U, rr(7, 12), life > .35 ? 'black' : 'grey', .3 * Math.max(.35, life), rr(-2, 2), -rr(16, 24) * U, 3.4); } }
    for (const b of L.bomb) if (b.t >= b.dur && !b.done) { b.done = 1; b.onHit && b.onHit(); }
    L.bomb = L.bomb.filter(b => !b.done);
    for (const p of L.thrown) if (!p.landed && p.t >= p.dur) { p.landed = true; FX.puff(p.x1, p.y1, 8 * FX.U(), 2, 'dust', .5, 0, 0, 1.6); FX.burn(p.x1, p.y1, .4, 30); }
    if (L.thrown.length > CAP.thrown) L.thrown.splice(0, L.thrown.length - CAP.thrown);
  };
  // طبقة الأرض (قبل الآليات): حفر، حروق، قطع طايحة
  FX.drawGround = () => {
    for (const p of L.decal) {
      const [x, y] = w2s(p.x, p.y); if (!vis(x, y)) continue; const f = 1 - p.t / p.life; const r = p.r * Math.max(.6, cam.s / 2.5);
      g.save(); g.translate(x, y); g.rotate(p.rot); g.scale(1, .8);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * (p.k === 'scorch' ? 1.6 : 1));
      if (p.k === 'crater') { gr.addColorStop(0, `rgba(30,24,18,${.55 * f})`); gr.addColorStop(.55, `rgba(60,48,34,${.35 * f})`); gr.addColorStop(.8, `rgba(120,100,70,${.25 * f})`); gr.addColorStop(1, 'rgba(120,100,70,0)'); }
      else { gr.addColorStop(0, `rgba(15,12,10,${.5 * f})`); gr.addColorStop(1, 'rgba(15,12,10,0)'); }
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * (p.k === 'scorch' ? 1.6 : 1), 0, 7); g.fill(); g.restore();
    }
    for (const p of L.thrown) {
      const f = Math.min(1, p.t / p.dur); const x0 = p.x + (p.x1 - p.x) * f, y0 = p.y + (p.y1 - p.y) * f; const [x, y] = w2s(x0, y0); if (!vis(x, y)) continue;
      const lift = p.landed ? 0 : Math.sin(f * Math.PI); const s = p.size * (1 + lift * .6);
      if (!p.landed) { g.save(); g.globalAlpha = .3; g.translate(x + lift * 8, y + lift * 12); g.rotate(p.h + p.spin * f); g.filter = 'brightness(0) blur(1px)'; g.drawImage(p.img, -s / 2, -s / 2, s, s); g.restore(); }
      g.save(); g.translate(x, y - lift * 10); g.rotate(p.h + p.spin * f); g.drawImage(p.img, -s / 2, -s / 2, s, s); g.restore();
    }
  };
  // طبقة الجو (بعد الآليات): نار، انفجارات، دخان، شرر، شظايا، قنابل نازلة
  FX.draw = () => {
    const sc = Math.min(1.4, Math.max(.55, cam.s / 2.6));
    for (const p of L.deb) { const [x, y] = w2s(p.x, p.y); if (!vis(x, y)) continue; g.fillStyle = p.col; g.globalAlpha = Math.min(1, 2 * (1 - p.t / p.life)); g.fillRect(x - p.s / 2, y - p.s / 2 - p.h * .15, p.s, p.s); } g.globalAlpha = 1;
    for (const p of L.fire) {
      const [x, y] = w2s(p.x, p.y); if (!vis(x, y)) continue; const f = 1 - p.t / p.life; const s = 26 * FX.U() * p.k * (.6 + .4 * f) * (.85 + .3 * Math.sin(p.t * 9));
      const fr = (p.f + Math.floor(p.t * 24)) % 64; g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, f * 1.4);
      g.drawImage(IMG.fx_fire, (fr % 8) * 64, Math.floor(fr / 8) * 64, 64, 64, x - s / 2, y - s * .7, s, s); g.restore();
    }
    for (const p of L.puff) {
      const [x, y] = w2s(p.x, p.y); const k = p.t / p.life; const r = p.r * sc * (1 + k * p.grow) * 1.6; if (!vis(x, y, r)) continue;
      const a = p.a * (k < .1 ? k / .1 : 1 - (k - .1) / .9); if (a <= .01) continue; const fr = p.f; const tc = tint[p.kind]; if (!tc || !tc.width || !tc.height) continue;   // الصورة لسه ما تحمّلت
      g.save(); g.globalAlpha = a; g.translate(x, y); g.rotate(p.rot + p.t * .15); g.drawImage(tint[p.kind], (fr % 8) * 128, Math.floor(fr / 8) * 128, 128, 128, -r / 2, -r / 2, r, r); g.restore();
    }
    for (const p of L.ex) {
      const [x, y] = w2s(p.x, p.y); if (!vis(x, y)) continue; const k = p.t / p.life;
      if (p.k === 'flash') { const r = p.s * (1 + k); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,255,235,${1 - k})`); gr.addColorStop(.35, `rgba(255,210,120,${.8 * (1 - k)})`); gr.addColorStop(1, 'rgba(255,140,40,0)'); g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.restore(); continue; }
      const fr = Math.min(24, Math.floor(k * 25)), src = p.k === 'e1' ? IMG.fx_explo1 : IMG.fx_explo2, s = p.s * sc * (1 + k * .35);
      g.save(); g.translate(x, y); g.rotate(p.rot); g.drawImage(src, (fr % 5) * 200, Math.floor(fr / 5) * 200, 200, 200, -s / 2, -s / 2, s, s); g.restore();
    }
    for (const p of L.ring) { const [x, y] = w2s(p.x, p.y); if (!vis(x, y)) continue; const k = p.t / p.life; g.strokeStyle = p.air ? `rgba(255,250,240,${.5 * (1 - k)})` : `rgba(235,220,190,${.55 * (1 - k)})`; g.lineWidth = 3 * (1 - k) + 1; g.beginPath(); g.arc(x, y, p.r * sc * (.2 + k), 0, 7); g.stroke(); }
    g.save(); g.globalCompositeOperation = 'lighter'; for (const p of L.spark) { const [x, y] = w2s(p.x, p.y); if (!vis(x, y)) continue; const k = p.t / p.life; g.strokeStyle = `rgba(255,${220 - k * 120},120,${1 - k})`; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x - p.vx * .03, y - p.vy * .03); g.stroke(); } g.restore();
    for (const b of L.bomb) { const f = b.t / b.dur; const [x0, y0] = w2s(b.x0, b.y0), [x1, y1] = w2s(b.x1, b.y1); const x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f; const s = 7 * (1.4 - f * .6); g.save(); g.globalAlpha = .3 * f; g.fillStyle = '#000'; g.beginPath(); g.ellipse(x1 + (x0 - x1) * (1 - f) * .3, y1 + (y0 - y1) * (1 - f) * .3, s * .5, s * .3, 0, 0, 7); g.fill(); g.restore(); g.save(); g.translate(x, y - (1 - f) * 18); g.rotate(Math.atan2(y1 - y0, x1 - x0)); g.fillStyle = '#3d4038'; g.beginPath(); g.ellipse(0, 0, s, s * .38, 0, 0, 7); g.fill(); g.restore(); }
  };
  FX.clear = () => { for (const k in L) L[k].length = 0; };
  FX.U0 = FX.U;
  FX.count = () => Object.fromEntries(Object.entries(L).map(([k, a]) => [k, a.length]));
})();
