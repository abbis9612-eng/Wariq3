// «العالم» W13 (I-116، D-054): مشهد المعركة البحرية القريب — صور من فوق (Grok)، بحر متحرك، دخان، اعتراض، فالانكس، انفجارات، أصوات
// يعيد نفس المعركة اللي انحسبت باللعبة (wnavb.js بنفس البذرة وخطوة ثانية)، ويرسمها بنعومة بين الخطوات.
// الحجم: لما نبعّد السفن تنرسم أكبر من حجمها (أقل طول للصورة) حتى تنشاف؛ لما نقرّب تصير بحجمها الحقيقي.
(function (root) {
  'use strict';
  const NV = {}; let el, cv, g, IMG, SNDp, S, P, info, cam, spd = 4, acc = 0, last = 0, raf = 0, fx = [], trails = [], tracers = [], shake = 0, follow = null, onExit = null, sea = null, seaOff = 0, done = false, endT = 0;
  const SPR = { cv: 'nv_carrier', dd: 'nv_ddg', ff: 'nv_frigate', amp: 'nv_amphib', fac: 'nv_fac', ss: 'nv_sub', ssn: 'nv_sub' };
  const MSPR = { c802: 'nv_c802', harpoon: 'nv_harpoon', kalibr: 'nv_tomahawk', yj18: 'nv_c802', sm2: 'nv_sm2', essm: 'nv_sm2' };
  const MINPX = { cv: 90, amp: 70, dd: 52, ff: 46, fac: 20, ss: 34, ssn: 40 };
  const R = Math.random;
  NV.init = o => { IMG = o.IMG; SNDp = o.SND; };
  // ===== الصوت (نفس أصوات «الحرب الكبرى») =====
  function snd(n, x, y, vol = 1) {
    const SND = SNDp && SNDp(); if (!SND || !SND.ctx || !SND.on || !SND.buf[n]) return;
    const [sx] = w2s(x, y), W = innerWidth, dkm = Math.hypot(x - cam.x, y - cam.y), v = vol * Math.max(.08, Math.min(1, 1.2 - dkm / (W / cam.k) * .9)); if (v < .05) return;
    const s = SND.ctx.createBufferSource(); s.buffer = SND.buf[n]; s.playbackRate.value = .92 + R() * .16; const gn = SND.ctx.createGain(); gn.gain.value = Math.min(1, v);
    const lp = SND.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(700, 16000 * Math.exp(-dkm / 12));
    let node = s.connect(lp).connect(gn); if (SND.ctx.createStereoPanner) { const p = SND.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, (sx - W / 2) / (W / 2))) * .7; node = node.connect(p); }
    node.connect(SND.master || SND.ctx.destination); s.start(SND.ctx.currentTime + Math.min(1.5, dkm / .343 / Math.max(4, spd * 6)));
  }
  // ===== الكاميرا (كم) =====
  // الشاشة طولية: اتجاه العدو (+x بالمحاكاة) = فوق الشاشة، والسفن مقدمتها لفوق
  const w2s = (x, y) => [(y - cam.y) * cam.k + innerWidth / 2 + (shake ? (R() - .5) * shake : 0), -(x - cam.x) * cam.k + innerHeight / 2 + (shake ? (R() - .5) * shake : 0)];
  const A0 = -Math.PI / 2;   // زاوية المحاكاة ← زاوية الشاشة
  // ===== الفتح =====
  NV.open = (B, last, title, exit) => {
    onExit = exit; done = false; endT = 0; fx = []; trails = []; tracers = []; follow = null; spd = 4; acc = 0;
    S = B.create({ s: last.s0 }, last.att, last.seed); P = new Map(); info = { title, by: last.by, def: last.def };
    cam = { x: 14, y: 0, k: innerHeight / 52 };
    if (!el) build(); el.hidden = false; resize(); last0(); raf = requestAnimationFrame(frame);
  };
  function last0() { last = performance.now(); }
  function build() {
    el = document.createElement('div'); el.id = 'navscene'; el.innerHTML = `<canvas></canvas><div class="nh"><b id="nvt"></b><span id="nvs"></span></div>
      <div class="nvb"><button data-s="1">×1</button><button data-s="4" class="on">×4</button><button data-s="16">×16</button><button id="nvf">🎯 تابع صاروخ</button><button id="nvz">⤢</button><button id="nvx">✕ رجوع</button></div><div id="nvr" hidden></div>`;
    document.body.append(el); cv = el.querySelector('canvas'); g = cv.getContext('2d');
    el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { spd = +b.dataset.s; el.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('on', x === b)); });
    el.querySelector('#nvf').onclick = () => { const L = S.msl.filter(m => m.side === 1); follow = L.length ? L[Math.floor(R() * L.length)] : null; };
    el.querySelector('#nvz').onclick = () => { follow = null; cam.x = 14; cam.y = 0; cam.k = innerHeight / 52; };
    el.querySelector('#nvx').onclick = close;
    // سحب وتقريب
    const pts = new Map(); let pinch = null;
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: cam.k }; } });
    cv.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; const p = pts.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1]; pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1) { follow = null; cam.y -= dx / cam.k; cam.x += dy / cam.k; } else if (pinch) { const [a, b] = [...pts.values()]; cam.k = Math.max(4, Math.min(3000, pinch.k * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d)); } });
    const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); cam.k = Math.max(4, Math.min(3000, cam.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); }, { passive: false });
    addEventListener('resize', resize);
  }
  function resize() { if (!cv) return; const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px'; g.setTransform(d, 0, 0, d, 0, 0); }
  function close() { cancelAnimationFrame(raf); el.hidden = true; if (onExit) onExit(); }
  // ===== المحاكاة: خطوة ثانية (نفس اللعبة)، والرسم يستوفي بين الخطوات =====
  function simStep() {
    for (const m of S.msl) P.set(m.id, [m.x, m.y]);
    const n0 = S.ev.length; S.constructor; const B = root.WNAVB; B.step(S, 1);
    for (const e of S.ev.slice(n0)) event(e);
    if (S.done && !endT) endT = performance.now();
  }
  function event(e) {
    const T = (performance.now());
    if (e.k === 'launch') { fx.push({ k: 'flash', x: e.x, y: e.y, t: T, d: 600 }); snd('launch', e.x, e.y, .9); }
    if (e.k === 'samlaunch') { fx.push({ k: 'puff', x: e.x + (R() - .5) * .08, y: e.y + (R() - .5) * .08, t: T, d: 2500, s: .06 }); snd('launch', e.x, e.y, .7); snd('woosh', e.x, e.y, .5); }
    if (e.k === 'kill') { fx.push({ k: 'boom', x: e.x, y: e.y, t: T, d: 1400, s: e.by === 'ciws' ? .12 : .22 }); snd(e.by === 'ciws' ? 'boom_mid' : 'boom_mid', e.x, e.y, .8); }
    if (e.k === 'miss') snd('whiz', e.x, e.y, .4);
    if (e.k === 'ciws') { tracers.push({ x: e.x, y: e.y, tx: e.tx, ty: e.ty, t: T, d: 700 }); snd('mg', e.x, e.y, .9); }
    if (e.k === 'chaff') { for (let i = 0; i < 4; i++) fx.push({ k: 'puff', x: e.x + (R() - .5) * .6, y: e.y + (R() - .5) * .6, t: T, d: 6000, s: .18, grey: 1 }); snd('rocket', e.x, e.y, .4); }
    if (e.k === 'splash') { fx.push({ k: 'splash', x: e.x, y: e.y, t: T, d: 2500, s: .15 }); snd('boom_far', e.x, e.y, .5); }
    if (e.k === 'hit') { fx.push({ k: 'boom', x: e.x, y: e.y, t: T, d: 1800, s: .35 }); shake = 10; snd('boom_big', e.x, e.y, 1); }
    if (e.k === 'sink') { fx.push({ k: 'oil', x: e.x, y: e.y, t: T, d: 1e9, s: .6 }); snd('boom_far', e.x, e.y, 1); }
  }
  // ===== الرسم =====
  function frame(now) {
    const dt = Math.min(.1, (now - last) / 1000); last = now; acc += dt * spd;
    while (acc >= 1 && !S.done) { acc -= 1; simStep(); }
    if (S.done) acc = Math.min(acc, 1);
    shake = Math.max(0, shake - dt * 20); seaOff += dt * spd * .0083;   // السفن تمشي ~30 كم/ساعة: البحر يتحرك وراها
    if (follow) { if (follow.st === 'fly') { const a = lerpPos(follow); cam.x += (a[0] - cam.x) * .1; cam.y += (a[1] - cam.y) * .1; cam.k += (Math.max(cam.k, 40) - cam.k) * .05; } else follow = null; }
    draw(now); hud(); raf = requestAnimationFrame(frame);
  }
  const lerpPos = m => { const p = P.get(m.id); if (!p) return [m.x, m.y]; const f = Math.min(1, acc); return [p[0] + (m.x - p[0]) * f, p[1] + (m.y - p[1]) * f]; };
  function drawImg(n, x, y, w, ang, alpha = 1, op) {
    const im = IMG[n]; if (!im || !im.naturalWidth) return; const h = w * im.naturalHeight / im.naturalWidth;
    g.save(); g.translate(x, y); g.rotate(ang || 0); g.globalAlpha = alpha; if (op) g.globalCompositeOperation = op; g.drawImage(im, -w / 2, -h / 2, w, h); g.restore();
  }
  function draw(now) {
    const W = innerWidth, H = innerHeight;
    // البحر: نسيج يتكرر ويتحرك (طبقتين بسرعتين = موج)، حجم النسيج = ~300 م
    const oc = IMG.nv_ocean; g.fillStyle = '#16304f'; g.fillRect(0, 0, W, H);
    if (oc && oc.naturalWidth) { if (!sea) sea = g.createPattern(oc, 'repeat');
      for (const [sc, off, a] of [[1, 1, 1], [.63, -.6, .35]]) { const tile = Math.max(90, .3 * cam.k) * sc / 512, ox = (-cam.y * cam.k + now * .003 * off) % (512 * tile), oy = ((cam.x + seaOff * off) * cam.k) % (512 * tile);
        g.save(); g.globalAlpha = a; g.translate(W / 2 + ox, H / 2 + oy); g.scale(tile, tile); g.fillStyle = sea; g.fillRect(-W / tile - 1024, -H / tile - 1024, W * 2 / tile + 2048, H * 2 / tile + 2048); g.restore(); } }
    // أفق الرادار (دائرة خفيفة حول المجموعة)
    const sh = S.ships.find(s => !s.sunk && root.WNAVB.SHIP[s.k].radar);
    if (sh) { const [x, y] = w2s(0, 0), r = root.WNAVB.HOR(root.WNAVB.SHIP[sh.k].radar, 7) * cam.k; g.save(); g.setLineDash([6, 10]); g.strokeStyle = 'rgba(160,220,255,.25)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.restore(); }
    // بقع الزيت والرشّات (تحت السفن)
    for (const f of fx) if (f.k === 'oil' || f.k === 'splash') { const a = Math.max(0, 1 - (now - f.t) / f.d), [x, y] = w2s(f.x, f.y); drawImg(f.k === 'oil' ? 'nv_oil-slick' : 'nv_splash', x, y, Math.max(f.k === 'oil' ? 70 : 26, f.s * cam.k), 0, f.k === 'oil' ? .9 : a); }
    // السفن: رغوة ورا كل سفينة، والصورة، والنار، والغرق (تميل وتختفي)
    for (const s of S.ships) {
      const T = root.WNAVB.SHIP[s.k], [x, y] = w2s(s.x, s.y), L = Math.max(MINPX[s.k] || 30, T.L * cam.k); if (x < -200 || x > W + 200 || y < -200 || y > H + 200) continue;
      const sinkF = s.sunk ? Math.min(1, (S.t - s.sunk) / 25) : 0; if (sinkF >= 1) continue;
      if (!sinkF && !T.sub) drawImg('nv_wake', x, y + L * .62, L * 1.05, A0, .55);
      if (T.sub) drawImg(SPR[s.k], x, y, L, A0, .55); else drawImg(SPR[s.k], x, y, L, A0 + sinkF * .35, 1 - sinkF * .8);
      if (s.burn > 0) { const fl = .75 + .25 * Math.sin(now / 90 + s.id); drawImg('nv_ship-fire', x, y + (s.id % 3 - 1) * L * .12, L * .45 * (.6 + s.burn * .6), 0, fl, 'lighter'); drawSmoke(x, y, L, now, s.burn); }
    }
    // دخان الصواريخ
    // خيوط الدخان: لكل صاروخ خط متصل يتسع ويتلاشى (الاعتراض أبيض ساطع وقصير العمر، صاروخ الهجوم رمادي وأطول)
    for (const m of S.msl) { const p = lerpPos(m); let T = trails.find(t => t.id === m.id); if (!T) { T = { id: m.id, sam: m.side === 0, pts: [] }; trails.push(T); } const q = T.pts[T.pts.length - 1]; if (!q || Math.hypot(q[0] - p[0], q[1] - p[1]) > .05) T.pts.push([p[0], p[1], now]); }
    const life = t => t.sam ? 3000 : 6000;
    for (const t of trails) { t.pts = t.pts.filter(q => now - q[2] < life(t)); }
    trails = trails.filter(t => t.pts.length);
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const t of trails) for (let i = 1; i < t.pts.length; i++) { const a = 1 - (now - t.pts[i][2]) / life(t), [x1, y1] = w2s(t.pts[i - 1][0], t.pts[i - 1][1]), [x2, y2] = w2s(t.pts[i][0], t.pts[i][1]);
      g.strokeStyle = t.sam ? `rgba(255,255,255,${a * .5})` : `rgba(215,212,205,${a * .45})`; g.lineWidth = (t.sam ? 1.8 : 2.4) + (1 - a) * (t.sam ? 7 : 12); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
    g.restore();
    // الصواريخ: الصورة باتجاهها + شعلة المحرك
    for (const m of S.msl) { const p = lerpPos(m), [x, y] = w2s(p[0], p[1]), ang = -(m.h || 0) + A0, w = m.side === 1 ? 26 : 22;
      g.save(); g.translate(x, y); g.rotate(ang); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(-w * .55, 0, 0, -w * .55, 0, 9); gr.addColorStop(0, 'rgba(255,230,160,.95)'); gr.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = gr; g.beginPath(); g.arc(-w * .55, 0, 9, 0, 7); g.fill(); g.restore();
      drawImg(MSPR[m.kind] || 'nv_c802', x, y, w, ang);
      if (m === follow) { g.strokeStyle = '#ffd34d'; g.lineWidth = 1.5; g.strokeRect(x - 16, y - 16, 32, 32); } }
    // رشقات فالانكس: خطوط مضيئة
    tracers = tracers.filter(t => now - t.t < t.d);
    for (const t of tracers) { const [x, y] = w2s(t.x, t.y), [tx, ty] = w2s(t.tx, t.ty); g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,200,90,.85)'; g.lineWidth = 1.2;
      for (let i = 0; i < 7; i++) { const f = ((now - t.t) / t.d + i / 7) % 1, j = (R() - .5) * 8; g.beginPath(); g.moveTo(x + (tx - x) * f + j, y + (ty - y) * f + j); g.lineTo(x + (tx - x) * (f + .06) + j, y + (ty - y) * (f + .06) + j); g.stroke(); } g.restore(); }
    // الانفجارات والسحب
    fx = fx.filter(f => f.k === 'oil' || now - f.t < f.d);
    for (const f of fx) { if (f.k === 'oil' || f.k === 'splash') continue; const a = 1 - (now - f.t) / f.d, [x, y] = w2s(f.x, f.y);
      if (f.k === 'boom') drawImg('nv_explosion', x, y, Math.max(40, f.s * cam.k) * (1.2 - a * .4), 0, Math.min(1, a * 1.6), 'lighter');
      if (f.k === 'flash') { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,220,150,${a})`; g.beginPath(); g.arc(x, y, 14 * a + 4, 0, 7); g.fill(); g.restore(); }
      if (f.k === 'puff') { const r = Math.max(4, f.s * cam.k) * (1.6 - a * .8); g.fillStyle = f.grey ? `rgba(190,190,185,${a * .5})` : `rgba(245,245,240,${a * .35})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } }
  }
  function drawSmoke(x, y, L, now, burn) {   // عمود دخان أسود يمشي ويا الريح (لليمين ولفوق)
    for (let i = 0; i < 9; i++) { const f = ((now / 2200 + i / 9) % 1), r = L * (.08 + f * .35) * (.6 + burn * .5);
      g.fillStyle = `rgba(25,25,25,${(1 - f) * .45 * burn})`; g.beginPath(); g.arc(x + f * L * 1.4, y - f * L * .5, r, 0, 7); g.fill(); }
  }
  function hud() {
    const st = S.stat, att = S.msl.filter(m => m.side === 1).length;
    el.querySelector('#nvt').textContent = info.title;
    el.querySelector('#nvs').textContent = ` · ⏱ ${Math.floor(S.t / 60)}:${String(Math.floor(S.t % 60)).padStart(2, '0')} · 🚀 أطلقوا ${st.fired}/${S.att.n} · بالجو ${att} · 🛡 اعترضنا ${st.kill} (${st.sam} صاروخ دفاع، ${st.ciws} رشقة مدفع، ${st.decoy} خدعها التشويش) · 💥 أصابت ${st.hit}`;
    const r = el.querySelector('#nvr');
    if (S.done && endT && performance.now() - endT > 1500) { const sunk = S.ships.filter(s => s.sunk).map(s => root.WNAVB.SHIP[s.k].n); r.hidden = false;
      r.innerHTML = `<b>انتهت المعركة</b><div>${st.fired} صاروخ: انعترض ${st.kill}، خدعها التشويش ${st.decoy}، أصاب ${st.hit}.</div><div>${sunk.length ? '⚓ غرقت: ' + sunk.join('، ') : 'ما غرقت ولا سفينة.'}</div><button id="nvx2">✕ رجوع للخريطة</button>`; r.querySelector('#nvx2').onclick = close; }
    else r.hidden = true;
  }
  root.NAVVIEW = NV;
})(this);
