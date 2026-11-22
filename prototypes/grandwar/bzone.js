// «منطقة القتال» I-166: مشهد المعركة الجديد فوق نفس محرك bv.js (الحركة والرمي والإصابة بالمتر والثانية الحقيقية، مثل «الحرب الكبرى»).
// الجديد: منظر مايل 50° (2.5D) بنفس زاوية كاميرا Blender، آليات مرسومة بـBlender (Cycles) بـ16 اتجاه وظل حقيقي، البرج يلف لحاله على هدفه،
// مشاة متحركين (ركض، رمي، جثو، موت) من مجسم بحركات Mixamo، حطام محروق يدخّن، حفر وآثار جنزير، ارتجاج الشاشة، وأصوات بالمكان (تأخير سرعة الصوت).
// الصور: tools/art/bz_render16.py وbz_infantry.py → img/bz_*.webp (مجسمات CC BY 4.0، أسماء مصمميها بـ⚙ المصادر). أي صوت bz_*.mp3 بمجلد sounds يتحمّل لحاله ويتقدّم على الأصوات القديمة.
(function () {
  const shadowOf = im => { if (im._sh) return im._sh; const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.filter = 'brightness(0) blur(2px)'; x.drawImage(im, 0, 0); return im._sh = c; };

  const BW = window.BZONE = {};
  const META = {"abrams": {"t": true, "rows": 3, "toff": [[-13.11, 7.17], [-12.53, 3.27], [-10.05, -0.17], [-6.03, -2.63], [-1.1, -3.71], [4.0, -3.27], [8.49, -1.37], [11.69, 1.71], [13.11, 5.49], [12.53, 9.39], [10.05, 12.83], [6.03, 15.29], [1.1, 16.37], [-4.0, 15.93], [-8.49, 14.03], [-11.69, 10.95]]}, "t72": {"t": true, "rows": 3, "toff": [[-8.36, 6.35], [-7.73, 3.89], [-5.93, 1.81], [-3.22, 0.42], [-0.03, -0.08], [3.18, 0.4], [5.89, 1.79], [7.72, 3.86], [8.36, 6.31], [7.73, 8.77], [5.93, 10.85], [3.22, 12.24], [0.03, 12.73], [-3.18, 12.25], [-5.89, 10.87], [-7.72, 8.8]]}, "bmp": {"t": false, "rows": 2, "toff": null}, "technical": {"t": false, "rows": 2, "toff": null}, "grad": {"t": false, "rows": 2, "toff": null}, "d30": {"t": false, "rows": 2, "toff": null}};
  const SPR = { abrams: 'bz_abrams', t72: 'bz_t72', bmp: 'bz_bmp', truck: 'bz_technical' };
  const EL = 50 * Math.PI / 180, KY = Math.sin(EL), KZ = Math.cos(EL);   // نفس زاوية رسم الصور
  const sh = [0, 0]; let trauma = 0;
  let B = null, el, cv, g, IMG, SND, onExit, spd = 1, last = 0, raf = 0, info = null;
  const cam = { x: 0, y: 1200, s: .9 }; // s = بكسل/متر
  // منظر مايل: العمق (y) ينضغط بـsin(50°)، والارتفاع (z) يصعد بـcos(50°)
  const w2s = (x, y, z = 0) => [(x - cam.x) * cam.s + innerWidth / 2 + sh[0], (y - cam.y) * cam.s * KY - z * cam.s * KZ + innerHeight / 2 + sh[1]];
  const s2w = (x, y) => [(x - innerWidth / 2) / cam.s + cam.x, (y - innerHeight / 2) / (cam.s * KY) + cam.y];
  const E = 6, EI = 9; // تكبير الآليات والمشاة حتى تنشاف على التلفون (التباعد حقيقي)
  const TEX = { plain: 'dirt_aerial_02', desert: 'aerial_sand', marsh: 'aerial_mud_1', city: 'aerial_asphalt_01', hills: 'rocky_terrain_02', mount: 'rocky_terrain_02' };
  const R = Math.random;
  BW.init = o => ({ IMG, SND } = o);
  BW.cam = cam; Object.defineProperty(BW, 'B', { get: () => B });
  // حجم الرسم ما ينزل بنفس سرعة التبعيد (جذر): لما الكاميرا تبعد حتى تأطّر اشتباك 3 كم، الدبابات تبقى مبيّنة
  const zs = () => { const r = 1.15 * innerWidth / 412; return cam.s >= r ? cam.s : Math.sqrt(cam.s * r); };
  const sizePx = len => Math.max(10, len * E * zs());
  // صوت بالمتر: تأخير سرعة الصوت، يخفت بالبعد عن نص الشاشة، والبعيد مكتوم
  // أصوات «منطقة القتال»: إذا المالك حط bz_*.mp3 بمجلد الأصوات تتحمل وتتقدّم، وإلا القديمة
  // FB: الصوت البديل إذا ملف bz_ مو موجود (null = سكوت)
  const FB = { rifle: 'mg' };
  const XS = { rifle: 'bz_rifle', ricochet: 'bz_ricochet', debris: 'bz_debris', engine: 'bz_engine', tank: 'bz_tank_fire', can30: 'bz_autocannon', mg: 'bz_mg', woosh: 'bz_atgm', boom_big: 'bz_explosion', boom_mid: 'bz_arty_hit', whiz: 'bz_whistle', boom_bomb: 'bz_bomb', jet_roar: 'bz_jet', launch: 'bz_rpg', howitzer: 'bz_howitzer' };
  const XTRA = ['bz_tank_fire', 'bz_autocannon', 'bz_mg', 'bz_atgm', 'bz_rpg', 'bz_explosion', 'bz_arty_hit', 'bz_whistle', 'bz_bomb', 'bz_jet', 'bz_howitzer', 'bz_engine', 'bz_ambience', 'bz_rifle', 'bz_ricochet', 'bz_debris'];
  function loadExtra() { if (!SND || !SND.ctx || SND._bz) return; SND._bz = 1; const base = (window.VIEW && VIEW.sndBase) || 'sounds/';
    for (const n of XTRA) fetch(base + n + '.mp3').then(r => r.ok ? r.arrayBuffer() : Promise.reject()).then(b => SND.ctx.decodeAudioData(b)).then(d => { SND.buf[n] = d; }).catch(() => { }); }
  function snd(n, x, y, vol = 1) {
    if (SND && SND.buf) n = SND.buf[XS[n]] ? XS[n] : SND.buf[n] ? n : FB[n] || n;
    if (!SND || !SND.ctx || !SND.on || !SND.buf[n]) return; const now = SND.ctx.currentTime; SND.last = SND.last || {};
    if (now - (SND.last['bv' + n] || 0) < .06) return; SND.last['bv' + n] = now;
    const d = Math.hypot(x - cam.x, y - cam.y), view = innerWidth / cam.s; const v = vol * Math.max(0, 1 - d / (view * 2.2)); if (v < .03) return;
    const s = SND.ctx.createBufferSource(); s.buffer = SND.buf[n]; s.playbackRate.value = .93 + R() * .14;
    const gn = SND.ctx.createGain(); gn.gain.value = Math.min(1, v); const lp = SND.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(700, 15000 * Math.exp(-d / 1800));
    s.connect(lp).connect(gn).connect(SND.master); s.start(now + Math.min(4, d / 343) / Math.max(1, spd));
  }
  BW.open = (battle, o) => {
    B = battle; info = o; onExit = o.onExit; spd = 1; lastHot = -99; mode = ''; selPlt = null; marks = []; INF.clear(); corpses.length = 0; tracks.length = 0; trauma = 0; loadExtra();
    el = document.getElementById('bv'); el.hidden = false; cv = document.getElementById('bvc'); g = cv.getContext('2d');
    el.querySelector('#bvT').textContent = o.title; el.querySelector('#bvRes').hidden = true;
    el.querySelectorAll('#bvSpd button').forEach(b => { b.classList.toggle('on', +b.dataset.k === 1); b.onclick = () => { spd = +b.dataset.k; el.querySelectorAll('#bvSpd button').forEach(z => z.classList.toggle('on', z === b)); }; });
    el.querySelector('#bvX').onclick = close;
    // الكاميرا على المهاجمين
    const A = B.units.filter(u => u.att); cam.x = A.reduce((s, u) => s + u.p.x, 0) / A.length; cam.y = A.reduce((s, u) => s + u.p.y, 0) / A.length - 400; cam.s = .85 * innerWidth / 412; shot = null; follow = true;
    FX.init({ g, cam: { get s() { return cam.s; }, get x() { return cam.x; }, get y() { return cam.y; } }, w2s, IMG }); FX.clear && FX.clear();
    FX.U = () => sizePx(9.8) / 30; FX.WIND = [6, -4];
    if (o.note) banner('ℹ ' + o.note, 9000);
    const nt = document.getElementById('bvNote'); nt.style.opacity = 1; clearTimeout(BW._nt); BW._nt = setTimeout(() => nt.style.opacity = 0, 8000);
    input(); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  };
  // جو المعركة (bz_ambience) يدور طول ما انت داخل، وهدير محركات من الآليات الماشية قرب الكاميرا
  let amb = null, engT = 0;
  function sounds(rdt) {
    if (!SND || !SND.ctx) return;
    if (!amb && SND.buf.bz_ambience) { const s = SND.ctx.createBufferSource(); s.buffer = SND.buf.bz_ambience; s.loop = true; const gn = SND.ctx.createGain(); gn.gain.value = 0; s.connect(gn).connect(SND.master); s.start(); amb = { s, gn }; }
    if (amb) amb.gn.gain.value = SND.on ? .55 : 0;
    engT -= rdt; if (engT <= 0 && spd > 0) { engT = 3.5 + R() * 2; const m = B.units.filter(u => u.st !== 'dead' && u.spd > 1).sort((a, b) => Math.hypot(a.p.x - cam.x, a.p.y - cam.y) - Math.hypot(b.p.x - cam.x, b.p.y - cam.y))[0]; if (m) snd('engine', m.p.x, m.p.y, .4); }
  }
  function close() { if (amb) { try { amb.s.stop(); } catch (e) { } amb = null; } cancelAnimationFrame(raf); el.hidden = true; FX.clear && FX.clear(); const b = B; B = null; onExit && onExit(b); }
  // ===== إدخال: سحب وتكبير =====
  let ptrs = new Map(), pinch = null, down = null;
  function input() {
    if (cv._in) return; cv._in = 1;
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); down = [e.clientX, e.clientY, 0]; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: cam.s, w: s2w((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) }; } if (!mode) follow = false; });
    cv.addEventListener('pointermove', e => { if (!ptrs.has(e.pointerId)) return; const p = ptrs.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1]; ptrs.set(e.pointerId, [e.clientX, e.clientY]); if (down) down[2] += Math.abs(dx) + Math.abs(dy); if (down && down[2] < 8) return;
      if (ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()]; cam.s = Math.min(3, Math.max(.06, pinch.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d)); const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; cam.x = pinch.w[0] - (m[0] - innerWidth / 2) / cam.s; cam.y = pinch.w[1] - (m[1] - innerHeight / 2) / cam.s; return; }
      cam.x -= dx / cam.s; cam.y -= dy / cam.s; });
    const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size && down && down[2] < 8) tapAt(down[0], down[1]); if (!ptrs.size) down = null; };
    document.querySelectorAll('#bvOrd button').forEach(b => b.onclick = () => setMode(b.dataset.m)); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); const w = s2w(e.clientX, e.clientY); cam.s = Math.min(3, Math.max(.06, cam.s * Math.exp(-e.deltaY * .0015))); cam.x = w[0] - (e.clientX - innerWidth / 2) / cam.s; cam.y = w[1] - (e.clientY - innerHeight / 2) / cam.s; }, { passive: false });
    document.getElementById('bvFol').onclick = () => { follow = true; };
  }
  let follow = true, mode = '', selPlt = null, marks = [];
  const myUnitAt = (x, y) => { const [wx, wy] = s2w(x, y); let best = null, bd = 40 / cam.s; for (const u of B.units) { if (u.side !== info.me || u.st === 'dead' || BV.T[u.type].k === 'truck') continue; const d = Math.hypot(u.p.x - wx, u.p.y - wy); if (d < bd) { bd = d; best = u; } } return best; };
  function setMode(m) { mode = mode === m ? '' : m; selPlt = null; document.querySelectorAll('#bvOrd button').forEach(b => b.classList.toggle('on', b.dataset.m === mode)); hint(); }
  function hint() { const h = { move: selPlt == null ? 'اضغط دبابة من فصيلك' : 'اضغط المكان اللي تريده يروح له', hold: 'اضغط فصيل حتى يثبت بمكانه', back: 'اضغط فصيل حتى ينسحب لورا', arty: 'اضغط مكان القصف (يوصل بعد ~35 ثانية)', air: 'اضغط الهدف (الطيارة توصل بعد ~10 ثواني)' }[mode]; const el2 = document.getElementById('bvHint'); el2.hidden = !h; el2.textContent = h || ''; }
  function tapAt(x, y) {
    if (!mode) return; const [wx, wy] = s2w(x, y);
    if (mode === 'arty') { if (BV.callArty(B, info.me, wx, wy)) marks.push({ k: 'arty', x: wx, y: wy, t: B.t, eta: 36 }); setMode('arty'); return; }
    if (mode === 'air') { if (BV.callAir(B, info.me, wx, wy)) marks.push({ k: 'air', x: wx, y: wy, t: B.t, eta: 12 }); setMode('air'); return; }
    const u = myUnitAt(x, y);
    if (mode === 'move') { if (selPlt == null) { if (u) { selPlt = u.plt; hint(); } return; } BV.order(B, selPlt, { k: 'move', x: wx, y: wy }); marks.push({ k: 'move', x: wx, y: wy, t: B.t, plt: selPlt }); setMode('move'); return; }
    if ((mode === 'hold' || mode === 'back') && u) { BV.order(B, u.plt, { k: mode }); marks.push({ k: mode, x: u.p.x, y: u.p.y, t: B.t, plt: u.plt }); setMode(mode); }
  }
  function drawMarks() {
    for (let i = marks.length - 1; i >= 0; i--) { const m = marks[i]; const age = B.t - m.t; if (age > (m.k === 'arty' ? 45 : 20)) { marks.splice(i, 1); continue; } const [x, y] = w2s(m.x, m.y);
      if (m.k === 'arty') { const left = Math.max(0, m.eta - age); g.strokeStyle = 'rgba(255,120,60,.9)'; g.setLineDash([6, 5]); g.lineWidth = 2; g.beginPath(); g.arc(x, y, 130 * cam.s, 0, 7); g.stroke(); g.setLineDash([]); if (left > 0) txt(`💥 ${Math.ceil(left)}ث`, x, y - 130 * cam.s - 10); }
      else if (m.k === 'air') { g.strokeStyle = 'rgba(120,180,255,.9)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 60 * cam.s + 6, 0, 7); g.stroke(); txt('✈ هدف', x, y - 60 * cam.s - 14); }
      else if (m.k === 'move') { g.fillStyle = '#ffd65a'; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 22); g.lineTo(x + 14, y - 17); g.lineTo(x, y - 12); g.fill(); g.strokeStyle = '#333'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 22); g.stroke(); }
    }
    if (selPlt != null) for (const u of B.units) if (u.plt === selPlt && u.st !== 'dead') { const [x, y] = w2s(u.p.x, u.p.y); g.strokeStyle = '#ffd65a'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, sizePx(9.8) * .7, 0, 7); g.stroke(); }
    // القذيفة النازلة: ظلها يكبر آخر ثانيتين قبل ما توصل
    for (const a of B.arty) if (a.fired && !a.done) { const left = a.at + a.fly - B.t; if (left < 2.5) { const [x, y] = w2s(a.x, a.y); const k = 1 - left / 2.5; g.fillStyle = `rgba(0,0,0,${.15 + .25 * k})`; g.beginPath(); g.ellipse(x, y, (4 + 10 * k) * Math.max(.6, cam.s), (2 + 5 * k) * Math.max(.6, cam.s), 0, 0, 7); g.fill(); } }
    // الطلبات الباقية
    const c = document.getElementById('bvOrd'); if (c) { c.querySelector('[data-m="arty"]').textContent = `💥 مدفعية (${B.calls.arty})`; c.querySelector('[data-m="air"]').textContent = `✈ طيارات (${B.calls.air})`; }
  }
  const txt = (t, x, y) => { g.font = '700 12px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(t, x, y); g.fillStyle = '#fff'; g.fillText(t, x, y); };
  // ===== الحلقة =====
  function frame(now) {
    if (!B) return; const rdt = Math.min(.1, (now - last) / 1000); last = now;
    const DPR = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    if (cv.width !== Math.round(W * DPR)) { cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); }
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    // خطوات بالثانية الحقيقية × السرعة المختارة
    // تقدّم سريع: ماكو اشتباك (ولا رمية بالجو ولا حدث قتال آخر 4 ث) ← ×4 لحد ما يبدي الضرب، وبعدها السرعة اللي اخترتها
    const far = gap() > 4300 && !B.jets.some(j => j.st === 'dive' || j.st === 'attack');
    const quiet = !B.over && (far || (!B.shots.some(z => !z.done) && B.t - lastHot > 4)); const k = quiet ? (far ? 6 : 4) : 1; fastBadge(quiet);
    let left = rdt * spd * k; while (left > 1e-6) { const h = Math.min(.05, left); BV.step(B, h); left -= h; }
    for (const e of B.ev) if (!e.seen) { e.seen = 1; onEv(e); if (follow) pick(e); }
    // كاميرا «مخرج»: تتابع مركز القتال بنعومة
    if (follow) director(rdt);
    sounds(rdt);
    FX.update(rdt * spd);
    trauma = Math.max(0, trauma - rdt * 1.6); const sk = trauma * trauma * 14; sh[0] = (R() - .5) * 2 * sk; sh[1] = (R() - .5) * 2 * sk;
    drawGround(); FX.drawGround(); drawTracks(rdt); drawScene(rdt); drawShots(); FX.draw(); drawJets(); drawMarks(); mini(); hud();
    raf = requestAnimationFrame(frame);
  }
  // ===== المخرج: يقطع لأهم لحظة من قريب (صاروخ ضد دروع بالجو، دبابة تنضرب، غطس طيارة، قصف) =====
  let shot = null; // {k, x, y, s, until, track}
  function pick(e) {
    // الرمي العادي والمدفعية داخل إطار الجبهة أصلاً؛ نقطع بس للحظات الكبيرة
    const P = { kill: 9, release: 8, jetkill: 8, atgm: 7, manpad: 7, bombhit: 6 }[e.k]; if (!P) return; if (shot && B.t < shot.until && shot.p >= P) return; const s0 = shot; pick2(e, P); if (shot && shot !== s0) shot.cut = 1;
  }
  function pick2(e, P) {
    if (shot && B.t < shot.until && shot.p >= P) return;
    if (e.k === 'atgm') { const m = B.shots.filter(z => z.k === 'atgm' && !z.done).pop(); if (m) { shot = { p: P, k: 'atgm', track: m, s: .75, until: B.t + Math.min(16, m.dur + 2) }; return; } }
    if (e.k === 'release' || e.k === 'manpad') { const j = B.jets.filter(z => z.st !== 'dead').sort((a, b) => Math.hypot(a.p.x - e.x, a.p.y - e.y) - Math.hypot(b.p.x - e.x, b.p.y - e.y))[0]; if (j) { shot = { p: P, k: 'jet', jet: j, s: .5, until: B.t + 7 }; return; } }
    if (e.k === 'gun' || e.k === 'can30') { const sh = B.shots.filter(z => (z.k === 'shell' || z.k === 'can30') && !z.done).pop(); if (sh) { shot = { p: P, k: 'pair', a: [sh.x, sh.y], b: [sh.tx, sh.ty], until: B.t + 4 }; return; } }
    shot = { p: P, k: 'pt', x: e.x, y: e.y, s: e.k === 'kill' ? .9 : e.k === 'artyhit' ? .55 : .7, until: B.t + (e.k === 'kill' ? 3.5 : 3) };
  }
  // أقرب زوج (مهاجم حي ↔ مدافع حي) وتأطير نقطتين بالشاشة (مقياس نسبي مثل ts)
  function pair() { let best = null; const A = B.units.filter(u => u.st !== 'dead' && u.att), D = B.units.filter(u => u.st !== 'dead' && !u.att); for (const a of A) for (const b of D) { const d = Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y); if (!best || d < best.d) best = { a, b, d }; } return best; }
  function gap() { const p = pair(); return p ? p.d : 0; }
  function fit(ax, ay, bx, by) { const dx = Math.abs(ax - bx) + 220, dy = Math.abs(ay - by) + 220; const s = Math.min((innerWidth - 40) / dx, (innerHeight - 300) / (dy * KY)) / (1.35 * innerWidth / 412); return [(ax + bx) / 2, (ay + by) / 2 + 40, s]; }
  function director(rdt) {
    let tx, ty, ts;
    if (shot && B.t < shot.until) {
      if (shot.k === 'atgm') { const m = shot.track; const f = Math.min(1, m.t / m.dur); tx = m.x + (m.tx - m.x) * f; ty = m.y + (m.ty - m.y) * f; ts = Math.max(shot.s * .7, fit(m.x, m.y, m.tx, m.ty)[2]); }
      else if (shot.k === 'pair') [tx, ty, ts] = fit(shot.a[0], shot.a[1], shot.b[0], shot.b[1]);
      else if (shot.k === 'jet') { tx = shot.jet.p.x; ty = shot.jet.p.y; ts = shot.s; }
      else { tx = shot.x; ty = shot.y; ts = shot.s; }
    } else { // ماكو لقطة: المهاجمين وهم يتقدمون (أقرب من قبل)
      const att = B.units.filter(u => u.att && u.st !== 'dead' && BV.T[u.type].k !== 'truck'); const pr0 = pair(); if (pr0) { let L = att.filter(u => Math.hypot(u.p.x - pr0.a.p.x, u.p.y - pr0.a.p.y) < 500); if (!L.length) L = [pr0.a]; tx = L.reduce((s, u) => s + u.p.x, 0) / L.length; ty = L.reduce((s, u) => s + u.p.y, 0) / L.length + Math.sign(pr0.b.p.y - pr0.a.p.y) * 220; } else if (att.length) { tx = att[0].p.x; ty = att[0].p.y; } ts = .85;
      // الجبهة: إذا الطرفين قراب (بمدى السلاح، < 4.3 كم) نأطّر أقرب مهاجم وأقرب مدافع سوا حتى تشوف الاشتباك كله
      const pr = pair(); if (pr && pr.d < 4300) [tx, ty, ts] = fit(pr.a.p.x, pr.a.p.y, pr.b.p.x, pr.b.p.y);
    }
    if (tx == null) return;
    // قطع (مو لفّة) إذا اللقطة الجديدة بعيدة عن اللي بالشاشة
    if (shot && shot.cut) { shot.cut = 0; const [sx, sy] = w2s(tx, ty); if (sx < 0 || sx > innerWidth || sy < 100 || sy > innerHeight - 60) { cam.x = tx; cam.y = ty; } }
    const k = Math.min(1, rdt * (shot && shot.k === 'atgm' ? 3 : 1.4));
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.s += (Math.min(1.3, Math.max(.13, ts)) * 1.35 * innerWidth / 412 - cam.s) * Math.min(1, rdt * .9);
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
    const W = innerWidth, H = innerHeight, tex = IMG['bv_' + (TEX[B.terr] || 'dirt_aerial_02')]; const tile = 520 * zs(), tileY = 520 * zs() * KY;
    g.fillStyle = '#8a7a5c'; g.fillRect(0, 0, W, H);
    if (tex && tex.complete) { const [ox, oy] = w2s(0, 0); const sx = ((ox % tile) + tile) % tile - tile, sy = ((oy % tileY) + tileY) % tileY - tileY; for (let x = sx; x < W; x += tile) for (let y = sy; y < H; y += tileY) g.drawImage(tex, x, y, tile + 1, tileY + 1);
      const t2 = IMG.bv_aerial_grass_rock || tex, tl2 = 830 * zs(), tl2y = tl2 * KY, sx2 = ((ox * .97 % tl2) + tl2) % tl2 - tl2, sy2 = ((oy * .97 % tl2y) + tl2y) % tl2y - tl2y; g.globalAlpha = .28; for (let x = sx2; x < W; x += tl2) for (let y = sy2; y < H; y += tl2y) g.drawImage(t2, x, y, tl2 + 1, tl2y + 1); g.globalAlpha = 1; }
    // تظليل خفيف بالأفق (الأبعد أفتح وأضبب شوية) حتى يبين العمق
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(210,200,180,.22)'); gr.addColorStop(.35, 'rgba(210,200,180,0)'); gr.addColorStop(1, 'rgba(40,30,20,.12)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // أهوار: مي هنا وهناك
    if (B.terr === 'marsh') { g.fillStyle = 'rgba(70,110,120,.45)'; for (const c of B.cover) if (c.kind === 'reed') { const [x, y] = w2s(c.x + 40, c.y + 30); g.beginPath(); g.ellipse(x, y, c.rad * 1.6 * cam.s, c.rad * cam.s * KY, .4, 0, 7); g.fill(); } }
    // خط الدفاع (سواتر) وخط الهدف
    const [, oy] = w2s(0, B.obj.y); g.strokeStyle = 'rgba(120,90,50,.55)'; g.lineWidth = Math.max(2, 14 * cam.s); g.setLineDash([22 * cam.s + 4, 10 * cam.s + 3]); g.beginPath(); g.moveTo(0, oy - 40 * cam.s); g.lineTo(W, oy - 40 * cam.s); g.stroke(); g.setLineDash([]);
  }
  // ===== المشهد: كل شي مرتب بالعمق (الأبعد أول) حتى الدبابة اللي قدام تغطي اللي وراها =====
  const fr16 = a => ((Math.round(Math.atan2(Math.sin(a) * KY, Math.cos(a)) / (Math.PI / 8)) % 16) + 16) % 16;   // اتجاه بالأرض ← إطار من 16 (0 = يمين، عقرب الساعة)
  const fr8 = a => ((Math.round(Math.atan2(Math.sin(a) * KY, Math.cos(a)) / (Math.PI / 4)) % 8) + 8) % 8;
  const INF = new Map(), corpses = [], tracks = [], smokes = [];
  function drawTracks(rdt) {   // آثار الجنزير: خطين باهتين ورا كل آلية ماشية
    for (const u of B.units) if (u.st !== 'dead' && Math.abs(u.spd) > 1.5 && BV.T[u.type].k !== 'truck') { const L = u._tl; if (!L || Math.hypot(L[0] - u.p.x, L[1] - u.p.y) > 6) { u._tl = [u.p.x, u.p.y]; tracks.push([u.p.x, u.p.y, u.hd, B.t]); } }
    if (tracks.length > 1400) tracks.splice(0, tracks.length - 1400);
    g.fillStyle = 'rgba(60,45,30,.16)'; const w = Math.max(1, 1.2 * E * zs() * .35);
    for (const [x, y, h] of tracks) { const [sx, sy] = w2s(x, y); if (sx < -20 || sx > innerWidth + 20 || sy < -20 || sy > innerHeight + 20) continue; const ox = -Math.sin(h) * 1.6 * E * zs() * .5, oy = Math.cos(h) * 1.6 * E * zs() * .5 * KY; g.fillRect(sx + ox - w / 2, sy + oy - w / 2, w, w); g.fillRect(sx - ox - w / 2, sy - oy - w / 2, w, w); }
  }
  function drawScene(rdt) {
    const L = [];
    for (const c of B.cover) L.push([c.y, 0, c]);
    for (const u of B.units) L.push([u.p.y, 1, u]);
    for (const q of B.inf) L.push([q.p.y, 2, q]);
    for (const c of corpses) L.push([c.y - 1, 3, c]);
    L.sort((a, b) => a[0] - b[0]);
    for (const [, k, o] of L) k === 0 ? cover(o) : k === 1 ? unit(o, rdt) : k === 2 ? squad(o) : corpse(o);
    // حطام يدخّن: عمود دخان أسود يصعد ويمشي ويا الريح
    for (let i = smokes.length - 1; i >= 0; i--) { const m = smokes[i]; m.t += rdt * spd; if (m.t > m.life) { smokes.splice(i, 1); continue; } if (R() < .35 * Math.min(1, spd)) FX.puff(m.x + (R() - .5) * 4, m.y + (R() - .5) * 4 - 6, sizePx(9.8) * .28, 6 + R() * 4, R() < .7 ? 'black' : 'grey', .55 * (1 - m.t / m.life), 0, -9, 2.4); }
  }
  // أشياء الأرض من بلندر (bz_props): 7 بيوت، نخلة، سدرة، 3 سيارات متروكة، سواتر رمل — كل وحدة بتدويرين
  const PROPS = { oy: [143.5, 148.5, 149.7, 142.1, 149.4, 144.1, 142.5, 160, 145.3, 140.2, 138.9, 137.6, 135.9] };
  function cover(c) {
    const im = IMG.bz_props, h = Math.abs(Math.round(c.x * 7 + c.y * 13)), [x, y] = w2s(c.x, c.y);
    let row, s; // s = حجم 10 وحدات بلندر على الشاشة
    if (c.kind === 'house') { row = h % 7; s = Math.max(14, c.rad * 1.5 * zs()); }
    else if (c.kind === 'palm' || c.kind === 'reed') { row = 7; s = Math.max(14, c.rad * 1.7 * zs()); }
    else if (c.kind === 'rock' && h % 10 < 4) { row = 9 + h % 3; s = 4.6 * E * zs(); }
    else if (c.kind === 'rock' && h % 10 < 6) { row = 12; s = 3.4 * E * zs(); }
    else if (c.kind !== 'rock') { row = 8; s = Math.max(14, c.rad * 1.4 * zs()); }
    const D = s * 1.8; if (x < -D || x > innerWidth + D || y < -D || y > innerHeight + D) return;
    if (row != null && im && im.naturalWidth) { const k = D / 256; g.drawImage(im, (h >> 3) % 2 * 256, row * 256, 256, 256, x - 128 * k, y - PROPS.oy[row] * k, D, D); return; }
    s = Math.max(14, c.rad * 1.5 * zs()); g.fillStyle = 'rgba(95,82,66,.75)'; g.beginPath(); g.ellipse(x, y, s * .34, s * .22, c.x % 3, 0, 7); g.fill(); g.fillStyle = 'rgba(140,125,100,.6)'; g.beginPath(); g.ellipse(x - s * .06, y - s * .05, s * .22, s * .13, c.x % 3, 0, 7); g.fill();
  }
  function unit(u, rdt) {
    const T = BV.T[u.type], [x, y] = w2s(u.p.x, u.p.y), D = 1.3 * T.len * E * zs(); if (x < -D || x > innerWidth + D || y < -D || y > innerHeight + D) return;
    const key = SPR[u.type] || 'bz_technical', im = IMG[key], M = META[key.slice(3)] || {}; if (!im || !im.naturalWidth) return;
    if (u.st === 'dead') { const f = fr8(u.hd), r = (M.rows || 2) - 1; g.drawImage(im, f * 128, r * 128, 128, 128, x - D / 2, y - D / 2, D, D); return; }
    // دائرة الطرف تحت الآلية (أزرق إحنا، أحمر العدو)
    g.save(); g.globalAlpha = .45; g.beginPath(); g.ellipse(x, y, D * .3, D * .3 * KY, 0, 0, 7); g.fillStyle = u.side === info.me ? '#3d7bff' : '#ff4a35'; g.fill(); g.restore();
    if (u.dug) { g.fillStyle = 'rgba(120,92,58,.9)'; g.beginPath(); g.ellipse(x, y + D * .04, D * .38, D * .18, 0, 0, 7); g.fill(); }
    const f = fr16(u.hd); g.drawImage(im, f * 128, 0, 128, 128, x - D / 2, y - D / 2, D, D);
    if (M.t && M.toff) { const ft = fr16(u.tur), o = M.toff[f], k = D / 128; g.drawImage(im, ft * 128, 128, 128, 128, x - D / 2 + o[0] * k, y - D / 2 + o[1] * k, D, D); }
    if (Math.abs(u.spd) > 2 && R() < .35 * Math.min(1, spd)) FX.puff(u.p.x - Math.cos(u.hd) * 7, u.p.y - Math.sin(u.hd) * 7, D * .16, 2.6, 'dust', .4, 0, 0, 2.2);   // غبار ورا الآلية
  }
  // المشاة: كل جندي بصورته واتجاهه وحالته (يركض، يرمي، جاثي بالحفرة)، والقتلى يوقعون بمكانهم
  const IS = { run: [0, 6], shoot: [8, 4], crouch: [16, 4], die: [24, 6] };
  function squad(q) {
    let S = INF.get(q.id); if (!S) INF.set(q.id, S = { n: q.n, p: [q.p.x, q.p.y], hd: q.att ? -Math.PI / 2 : Math.PI / 2, fire: -9, rl: q.reload, mv: 0 });
    const dx = q.p.x - S.p[0], dy = q.p.y - S.p[1]; S.mv = Math.hypot(dx, dy) > .05 ? B.t : S.mv; if (Math.hypot(dx, dy) > .05) S.hd = Math.atan2(dy, dx); S.p = [q.p.x, q.p.y];
    if ((q.reload || 0) > (S.rl || 0) + .5) { S.fire = B.t; const e = enemyNear(q); if (e) S.hd = Math.atan2(e.p.y - q.p.y, e.p.x - q.p.x); } S.rl = q.reload;
    const n = q.st === 'dead' ? 0 : Math.max(0, q.n);
    if (n < S.n) { for (let k = n; k < S.n; k++) { const o = slot(q, k, S.hd); corpses.push({ x: o[0], y: o[1], d: fr8(S.hd), t: B.t, side: q.side }); } if (corpses.length > 260) corpses.splice(0, corpses.length - 260); } S.n = n;
    if (!n) return;
    const im = IMG.bz_inf; if (!im || !im.naturalWidth) return; const D = 3.6 * EI * zs(), d = fr8(S.hd);
    const st = B.t - S.fire < 1.2 ? (q.dug ? 'crouch' : 'shoot') : B.t - S.mv < .6 ? 'run' : q.dug ? 'crouch' : 'shoot', [r0, nf] = IS[st];
    for (let k = 0; k < Math.min(8, n); k++) { const [wx, wy] = slot(q, k, S.hd), [x, y] = w2s(wx, wy); if (x < -D || x > innerWidth + D || y < -D || y > innerHeight + D) continue;
      const fi = st === 'run' ? Math.floor(B.t * 9 + k * 1.7) % nf : st === 'shoot' || st === 'crouch' ? (B.t - S.fire < 1.2 ? Math.floor(B.t * 10 + k) % nf : 0) : 0;
      g.drawImage(im, fi * 64, (r0 + d) * 64, 64, 64, x - D / 2, y - D * .62, D, D);
      if (st !== 'run' && B.t - S.fire < .15 && k % 3 === 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,220,140,.9)'; g.beginPath(); g.arc(x + Math.cos(S.hd) * D * .2, y - D * .25 + Math.sin(S.hd) * D * .1, Math.max(1.2, D * .05), 0, 7); g.fill(); g.restore(); } }
    if (q.side === info.me) { const [x, y] = w2s(q.p.x, q.p.y); g.fillStyle = 'rgba(61,123,255,.8)'; g.beginPath(); g.moveTo(x, y - D * .9); g.lineTo(x - 3, y - D * .9 - 5); g.lineTo(x + 3, y - D * .9 - 5); g.fill(); }
  }
  const slot = (q, k, h) => { const c = (k % 4) - 1.5, r = Math.floor(k / 4) - .5, ox = r * 7, oy = c * 6.5; return [q.p.x + Math.cos(h) * ox - Math.sin(h) * oy, q.p.y + Math.sin(h) * ox + Math.cos(h) * oy]; };
  const enemyNear = q => { let b = null, bd = 900; for (const u of B.units) if (u.side !== q.side && u.st !== 'dead') { const d = Math.hypot(u.p.x - q.p.x, u.p.y - q.p.y); if (d < bd) { bd = d; b = u; } } for (const z of B.inf) if (z.side !== q.side && z.st !== 'dead') { const d = Math.hypot(z.p.x - q.p.x, z.p.y - q.p.y); if (d < bd) { bd = d; b = z; } } return b; };
  function corpse(c) { const im = IMG.bz_inf; if (!im || !im.naturalWidth) return; const [x, y] = w2s(c.x, c.y), D = 3.6 * EI * zs(); if (x < -D || x > innerWidth + D || y < -D || y > innerHeight + D) return;
    const fi = Math.min(5, Math.floor((B.t - c.t) * 6)); g.drawImage(im, fi * 64, (24 + c.d) * 64, 64, 64, x - D / 2, y - D * .62, D, D); }
  // ===== الرمي =====
  function drawShots() {
    for (const s of B.shots) {
      if (s.k === 'manpad') { const [x, y] = w2s(s.x, s.y, s.alt); FX.puff(s.x, s.y, 3, 4, 'grey', .5, 0, 0, 3); g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill(); continue; }
      const f = Math.min(1, s.t / s.dur); const x = s.x + (s.tx - s.x) * f, y = s.y + (s.ty - s.y) * f; const [sx, sy] = w2s(x, y);
      if (s.k === 'shell' || s.k === 'can30') { const back = Math.min(f, s.k === 'shell' ? 120 / Math.hypot(s.tx - s.x, s.ty - s.y) : 60 / Math.hypot(s.tx - s.x, s.ty - s.y)); const [bx, by] = w2s(s.x + (s.tx - s.x) * (f - back), s.y + (s.ty - s.y) * (f - back)); g.strokeStyle = s.k === 'shell' ? 'rgba(255,236,170,.95)' : 'rgba(255,190,110,.9)'; g.lineWidth = s.k === 'shell' ? 2.4 : 1.6; g.beginPath(); g.moveTo(bx, by); g.lineTo(sx, sy); g.stroke(); }
      else if (s.k === 'atgm' || s.k === 'rpg') { const zz = s.k === 'atgm' ? 3 + Math.sin(f * Math.PI) * 6 : 1.5, [mx, my] = w2s(x, y, zz); if (R() < .85) FX.puff(x, y - zz * KZ / KY, 2.8, s.k === 'atgm' ? 7 : 3.5, 'grey', .55, 0, 0, 2.8); g.save(); g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(mx, my, 0, mx, my, 9); gl.addColorStop(0, 'rgba(255,245,200,1)'); gl.addColorStop(.4, 'rgba(255,170,60,.7)'); gl.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = gl; g.beginPath(); g.arc(mx, my, 9, 0, 7); g.fill(); g.restore(); }
      else if (s.k === 'rifle') { g.strokeStyle = 'rgba(255,240,190,.6)'; g.lineWidth = .8; const [bx, by] = w2s(s.x + (s.tx - s.x) * Math.max(0, f - .15), s.y + (s.ty - s.y) * Math.max(0, f - .15)); g.beginPath(); g.moveTo(bx, by); g.lineTo(sx, sy); g.stroke(); }
      else if (s.k === 'bomb') { const z = s.z * (1 - f); const [bx, by] = w2s(x, y, z); g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(sx, sy, 3, 0, 7); g.fill(); g.fillStyle = '#3d4038'; g.beginPath(); g.ellipse(bx, by, 4, 1.8, Math.atan2(s.ty - s.y, s.tx - s.x), 0, 7); g.fill(); }
    }
  }
  function drawJets() {
    for (const j of B.jets) { if (j.st === 'dead') continue; const [x, y] = w2s(j.p.x, j.p.y, j.z), [sx, sy] = w2s(j.p.x, j.p.y); const s = Math.max(22, 15.5 * E * zs());
      const sh = IMG.su25_sheet, ri = (((Math.round((j.bank * 180 / Math.PI + 180) / 20)) % 18) + 18) % 18, pi = j.gam < -.3 ? 0 : j.gam > .3 ? 2 : 1, fr = pi * 18 + ri, H = j.hd + Math.PI;
      g.save(); g.globalAlpha = .28; g.translate(sx, sy); g.rotate(H); g.drawImage(shadowOf(sh), (fr % 8) * 256, Math.floor(fr / 8) * 256, 256, 256, -s / 2, -s / 2, s, s); g.restore();
      g.save(); g.translate(x, y); g.rotate(H); g.drawImage(sh, (fr % 8) * 256, Math.floor(fr / 8) * 256, 256, 256, -s / 2, -s / 2, s, s); g.restore();
      g.beginPath(); g.moveTo(x, y - s * .6); g.lineTo(x - 4, y - s * .6 - 6); g.lineTo(x + 4, y - s * .6 - 6); g.closePath(); g.fillStyle = j.side ? '#e0533f' : '#4f8ff0'; g.fill();
      if (j.st === 'fall' && R() < .8) FX.puff(j.p.x, j.p.y - j.z * KZ / KY, 6, 4, 'black', .6, 0, 0, 2); }
  }
  // ===== الأحداث → مؤثرات وأصوات =====
  // شريط خبر صغير تحت الرأس (تعزيزات، مقياس المشهد)
  let bnr = null; function banner(t, ms = 4500) { if (!bnr) { bnr = document.createElement('div'); bnr.style.cssText = 'position:absolute;left:50%;top:190px;transform:translateX(-50%);max-width:92%;background:rgba(20,30,20,.78);color:#e8f5d0;padding:5px 12px;border-radius:12px;font:600 12px "IBM Plex Sans Arabic";pointer-events:none;z-index:3;text-align:center;transition:opacity .4s'; el.append(bnr); } bnr.textContent = t; bnr.style.opacity = 1; clearTimeout(bnr._t); bnr._t = setTimeout(() => { if (bnr) bnr.style.opacity = 0; }, ms); }
  let lastHot = -99, fb = null;
  function fastBadge(on) { if (!fb) { fb = document.createElement('div'); fb.style.cssText = 'position:absolute;left:50%;top:158px;transform:translateX(-50%);background:rgba(0,0,0,.55);color:#ffd65a;padding:4px 12px;border-radius:12px;font:700 12px "IBM Plex Sans Arabic";pointer-events:none;z-index:3'; fb.textContent = '⏩ تقدّم سريع… لحد أول اشتباك'; el.append(fb); } fb.style.display = on ? 'block' : 'none'; }
  function onEv(e) {
    if ({ gun: 1, can30: 1, atgm: 1, rpg: 1, rifle: 1, artyhit: 1, kill: 1, bombhit: 1, release: 1 }[e.k]) lastHot = B.t;
    const U = sizePx(9.8);
    const near = (x, y) => Math.max(0, 1 - Math.hypot(x - cam.x, y - cam.y) * cam.s / innerWidth);
    if (e.k === 'gun') { const u = B.units.find(z => z.id === e.id); const a = u ? u.tur : 0; FX.muzzle(e.x + Math.cos(a) * 9, e.y + Math.sin(a) * 9, a, 1.5); for (let i = 0; i < 4; i++) FX.puff(e.x + Math.cos(a) * 4, e.y + Math.sin(a) * 4, sizePx(9.8) * .22, 2.2, 'dust', .45, (R() - .5) * 40, (R() - .5) * 40, 2.6); snd('tank', e.x, e.y, .85); trauma = Math.min(1, trauma + .18 * near(e.x, e.y)); }
    else if (e.k === 'can30') snd('can30', e.x, e.y, .9);
    else if (e.k === 'atgm' || e.k === 'rpg') { for (let i = 0; i < 5; i++) FX.puff(e.x, e.y, 6, 3, 'grey', .6, (R() - .5) * 30, (R() - .5) * 30, 2.2); snd(e.k === 'atgm' ? 'woosh' : 'launch', e.x, e.y, .7); }
    else if (e.k === 'rifle') snd('rifle', e.x, e.y, .35);
    else if (e.k === 'dismount') snd('mg', e.x, e.y, .15);
    else if (e.k === 'kill') { FX.spark(e.x, e.y, 18, 160); const big = e.type === 'abrams' || e.type === 't72' || e.type === 'bmp'; setTimeout(() => { if (!B) return; FX.explode(e.x, e.y, big ? 'cookoff' : 'big', big ? 1.4 : 1); FX.burn(e.x, e.y, 1.2, 140); FX.scorch(e.x, e.y, 26, 400); smokes.push({ x: e.x, y: e.y, t: 0, life: 240 }); snd('boom_big', e.x, e.y, 1); trauma = Math.min(1, trauma + .55 * near(e.x, e.y)); setTimeout(() => B && snd('debris', e.x, e.y, .55), 380 / spd); }, 450 / spd); }
    else if (e.k === 'ricochet') { FX.spark(e.x, e.y, 10, 120); snd('ricochet', e.x, e.y, .6); }
    else if (e.k === 'miss') { FX.dirt(e.x, e.y, .7); }
    else if (e.k === 'dust') { FX.puff(e.x, e.y, 2, 1, 'dust', .4, 0, 0, 1.5); }
    else if (e.k === 'whistle') snd('whiz', e.x, e.y, .6);
    else if (e.k === 'artyhit') { FX.explode(e.x, e.y, 'he', 1.25); FX.crater(e.x, e.y, 9, 600); snd('boom_mid', e.x, e.y, .9); trauma = Math.min(1, trauma + .35 * near(e.x, e.y)); }
    else if (e.k === 'bombhit') { FX.explode(e.x, e.y, 'bomb', 1.4); FX.crater(e.x, e.y, 16, 800); snd('boom_bomb', e.x, e.y, 1); trauma = Math.min(1, trauma + .7 * near(e.x, e.y)); }
    else if (e.k === 'jetin') snd('jet_roar', e.x, e.y, .8);
    else if (e.k === 'flare') { FX.spark(e.x, e.y - (e.z || 0) * .25, 4, 40); FX.puff(e.x, e.y - (e.z || 0) * .25, 3, 3, 'grey', .5, 0, 0, 2); }
    else if (e.k === 'manpad') { FX.puff(e.x, e.y, 5, 3, 'grey', .6, 0, 0, 2); snd('launch', e.x, e.y, .6); }
    else if (e.k === 'jetkill') { FX.explode(e.x, e.y - (e.z || 0) * .25, 'air', 1.2); snd('boom_big', e.x, e.y, .9); }
    else if (e.k === 'airburst') FX.explode(e.x, e.y - (e.z || 0) * .25, 'air', .5);
    else if (e.k === 'crash') { FX.explode(e.x, e.y, 'big', 1.3); FX.burn(e.x, e.y, 1, 70); snd('boom_big', e.x, e.y, 1); }
    else if (e.k === 'reinf') { const mine = e.side === info.me; banner(`🚚 ${mine ? 'وصلت تعزيزاتنا' : 'وصلت تعزيزات العدو'}: ${e.n}`, 5000); snd('engine', e.x, e.y, .8); if (follow) { shot = { p: 7, k: 'pt', x: e.x, y: e.y, s: .7, until: B.t + 4, cut: 1 }; } }
    else if (e.k === 'over') showRes();
    else if (e.k === 'artyfire' && e.side === info.me) snd('howitzer', cam.x, cam.y + 2500, .35);
  }
  function hud() {
    const cnt = (s, k) => B.units.filter(u => u.side === s && u.st !== 'dead' && BV.T[u.type].k === k).length, all = (s, k) => B.units.filter(u => u.side === s && BV.T[u.type].k === k).length;
    const me = info.me, foe = 1 - me; const t = Math.floor(B.t);
    document.getElementById('bvC').innerHTML = `⏱ ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} · ${B.phase === 'prep' ? 'تمهيد مدفعية' : 'قتال'}<br>${(info && info.names && info.names[0]) || '🇮🇶'} دبابات ${cnt(0, 'tank')}/${all(0, 'tank')} · مدرعات ${cnt(0, 'ifv')}/${all(0, 'ifv')} &nbsp;|&nbsp; ${(info && info.names && info.names[1]) || '🇮🇷'} دبابات ${cnt(1, 'tank')}/${all(1, 'tank')} · مدرعات ${cnt(1, 'ifv')}/${all(1, 'ifv')}`;
  }
  function showRes() {
    const r = document.getElementById('bvRes'), o = B.over, attMe = B.side.att === info.me; const weWon = (o.win === 'att') === attMe && o.win !== 'none';
    r.hidden = false; r.innerHTML = `<b style="font:700 20px 'Reem Kufi';color:${weWon ? '#7fb0ff' : o.win === 'none' ? '#e2b552' : '#ff8a7a'}">${o.win === 'none' ? 'بدون حسم' : weWon ? 'انتصرنا بالمعركة' : 'خسرنا المعركة'}</b><div>${o.why}</div><div style="font-size:12px;color:#cfe2ff">النتيجة والخسائر تنطبق على الخريطة لما ترجع.</div><div style="opacity:.8;font-size:12px">خسائرنا ${Math.round(B.lost[info.me])} · خسائرهم ${Math.round(B.lost[1 - info.me])}</div><button id="bvBack">↩ رجوع للخريطة</button>`;
    document.getElementById('bvBack').onclick = close;
  }
})();
