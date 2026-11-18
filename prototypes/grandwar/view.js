// «الحرب الكبرى» GW2a + GW2b: الرسم الحي (I-081، I-082).
//  - كل آلية بحالها: تلف وتسرّع وتمشي لمكانها بالتشكيل (رتل بالمسير، خط بالقتال، انتشار بالراحة)، وتثير غبار.
//  - الرمي حسب السلاح: دبابة (وميض + قذيفة سريعة)، مدرعة (رشقات مدفع 30مم)، مشاة (رصاص)، راجمة (صواريخ بدخان).
//  - الخسائر نفسها من المحاكاة: كل ما تنزل قوة الفرقة، آلية تنفجر وتبقى حطام يحترق.
//  - الجو: مطارات، دفاع جوي، قواعد صواريخ، طيارات بظلها، صواريخ بدخان يبقى، باليستي يصعد وينزل، اعتراض.
//  - الصوت: أصوات حقيقية (SoundBible، CC BY 3.0)، أعلى كل ما تقرّب، والبعيد يطلع مكتوم.
(function () {
  const V = window.VIEW = {};
  let g, cam, w2s, IMG, WD, cells, A, text;
  V.init = o => ({ g, cam, w2s, IMG, WD, cells, A, text } = o);
  const R = Math.random;
  // ===== الصوت =====
  const SND = V.SND = { ctx: null, buf: {}, on: true, last: {}, budget: 0 };
  const NAMES = ['tank', 'mg', 'can30', 'rocket', 'boom_mid', 'boom_big', 'boom_far', 'launch', 'whiz', 'jet_roar', 'woosh', 'boom_bomb', 'battle_amb', 'howitzer', 'sonic'];
  SND.init = () => {
    if (SND.ctx) return; try { SND.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    SND.master = SND.ctx.createGain(); SND.master.gain.value = .8; SND.master.connect(SND.ctx.destination);
    for (const n of NAMES) fetch(`sounds/${n}.mp3`).then(r => r.arrayBuffer()).then(b => SND.ctx.decodeAudioData(b)).then(d => { SND.buf[n] = d; if (n === 'battle_amb') ambient(); }).catch(() => { });
  };
  function ambient() { const s = SND.ctx.createBufferSource(); s.buffer = SND.buf.battle_amb; s.loop = true; SND.amb = SND.ctx.createGain(); SND.amb.gain.value = 0; s.connect(SND.amb).connect(SND.master); s.start(); }
  // صوت بمكان (كم): يعلى ويا التقريب ويخفت ويا البعد عن نص الشاشة
  SND.at = (n, wx, wy, vol = 1, gap = .05) => {
    if (!SND.ctx || !SND.on || !SND.buf[n]) return; const now = SND.ctx.currentTime;
    if (now - (SND.last[n] || 0) < gap || SND.budget > 9) return;
    const [x, y] = w2s(wx, wy); const W = innerWidth, H = innerHeight;
    const off = Math.hypot(x - W / 2, y - H / 2) / Math.max(W, H);
    const z = Math.min(1, Math.max(.06, (cam.s - .35) / 2.2));
    let v = vol * z * Math.max(0, 1 - off * 1.1); if (v < .03) return;
    let name = n; if (z < .25 && (n === 'boom_mid' || n === 'boom_big' || n === 'boom_bomb' || n === 'tank')) name = 'boom_far';
    SND.last[n] = now; SND.budget++;
    const s = SND.ctx.createBufferSource(); s.buffer = SND.buf[name]; s.playbackRate.value = .92 + R() * .16;
    const gn = SND.ctx.createGain(); gn.gain.value = Math.min(1, v);
    const pan = SND.ctx.createStereoPanner ? SND.ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = Math.max(-1, Math.min(1, (x - W / 2) / (W / 2))) * .7; s.connect(gn).connect(pan).connect(SND.master); } else s.connect(gn).connect(SND.master);
    s.start();
  };
  V.soundTick = (dt, nBattlesNear) => { SND.budget = Math.max(0, SND.budget - dt * 12); if (SND.amb) SND.amb.gain.value += ((SND.on ? Math.min(.55, nBattlesNear * .12) * Math.min(1, cam.s / 2) : 0) - SND.amb.gain.value) * Math.min(1, dt * 2); };

  // ===== الآليات =====
  const VIS = new Map(); // divId → {veh:[...], s}
  const wrecks = [], dust = [], shots = [], booms = [], smokes = [];
  const KIT = {
    arm: side => [['tank', 6], ['truck', 1]], mec: side => [['bmp', 3], ['tank', 1], ['truck', 1]], inf: side => [['truck', 3], ['grad', 1]],
  };
  const sprName = (d, t) => t === 'tank' ? (d.side ? 't72' : 'abrams') : t === 'truck' || t === 'grad' ? (d.side ? t + '_r' : t) : t;
  function visOf(d, cx, cy, rot) {
    let v = VIS.get(d.id);
    if (!v) {
      v = { veh: [], seen: 0 }; let k = 0;
      for (const [t, n] of KIT[d.kind](d.side)) for (let i = 0; i < n; i++) v.veh.push({ t, x: cx + (R() - .5) * 2, y: cy + (R() - .5) * 2, h: rot, tur: 0, alive: true, cd: R() * 2, k: k++, sp: 0 });
      v.n0 = v.veh.filter(q => q.t !== 'truck').length; VIS.set(d.id, v);
    }
    return v;
  }
  // حالة الفرقة: مسير، قتال، راحة
  function stateOf(d) {
    if (d.path.length && WD.battles.has(d.path[0]) && WD.t - d.lastFight < 2) return { k: 'fight', tgt: d.path[0], att: 1 };
    if (WD.battles.has(d.cell) && WD.t - d.lastFight < 2) return { k: 'fight', tgt: d.cell, att: 0 };
    if (d.path.length && d.prog > 0) return { k: 'move' };
    return { k: 'rest' };
  }
  V.divs = (list, posOf, facing, SEL, dt, live) => {
    const S = Math.min(38, Math.max(14, cam.s * 9.5)); const kmPx = 1 / cam.s;
    const byBattle = new Map();
    for (const d of list) {
      const [wx, wy] = posOf(d); const rot0 = facing(d); const st0 = stateOf(d);
      const v = visOf(d, wx, wy, rot0); v.seen = performance.now(); v.d = d;
      // الحالة (مسير/قتال/راحة) ما تتبدل إلا إذا ثبتت: الدخول للقتال فوري، الطلوع منه بعد 3 ساعات لعبة، والباقي بعد ساعة
      if (!v.st) v.st = st0;
      if (st0.k !== v.st.k || st0.tgt !== v.st.tgt) { if (v.cand && v.cand.k === st0.k && v.cand.tgt === st0.tgt) { if (st0.k === 'fight' || WD.t - v.candT >= (v.st.k === 'fight' ? 3 : 1)) v.st = st0; } else { v.cand = st0; v.candT = WD.t; if (st0.k === 'fight') v.st = st0; } } else v.cand = null;
      const st = v.st;
      // مرساة التشكيل: تمشي بنعومة لمكان الفرقة وتلف بالتدريج، والآليات مرتبة حولها (التشكيل يتحرك كتلة وحدة)
      let bx = wx, by = wy; if (st.k === 'fight' && st.att) { const t = cells[st.tgt].c; bx = wx + (t[0] - wx) * .22; by = wy + (t[1] - wy) * .22; }
      if (v.ax == null || Math.hypot(bx - v.ax, by - v.ay) > 160) { v.ax = bx; v.ay = by; v.ah = rot0; }
      { const dx = bx - v.ax, dy = by - v.ay, dist = Math.hypot(dx, dy), vmax = 30 / cam.s * dt; if (dist > 1e-6) { const k2 = Math.min(1, vmax / dist, dt * 2.5); v.ax += dx * k2; v.ay += dy * k2; } }
      { let dh = rot0 - v.ah; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI; v.ah += Math.max(-.7 * dt, Math.min(.7 * dt, dh)); }
      const rot = v.ah;
      if (Math.abs((v.s || cam.s) - cam.s) / cam.s > .08) { v.snap = 1; v.s = cam.s; }
      // كم آلية لازم تبقى (من قوة الفرقة)
      const combat = v.veh.filter(q => q.t !== 'truck');
      const want = Math.max(1, Math.round(d.str * v.n0));
      let alive = combat.filter(q => q.alive).length;
      while (alive > want) { const q = combat.filter(q => q.alive).sort((a, b) => b.k - a.k)[0]; q.alive = false; alive--; if (live) { boomAt(q.x, q.y, 1.4); wrecks.push({ x: q.x, y: q.y, h: q.h, n: sprName(d, q.t), t: 0 }); SND.at('boom_big', q.x, q.y, .9, .15); } }
      // مكان كل آلية بالتشكيل
      const c = Math.cos(rot), s = Math.sin(rot); const L = v.veh.filter(q => q.alive);
      const base = [v.ax, v.ay];
      L.forEach((q, i) => {
        let fx, fy; const gap = S * 1.25 * kmPx;
        if (st.k === 'move') { fx = -i * gap; fy = (i % 2 ? 1 : -1) * gap * .18; }
        else if (st.k === 'fight') { const n = L.length, col = i < Math.ceil(n * .7) ? 0 : 1; const idx = col ? i - Math.ceil(n * .7) : i; const m = col ? n - Math.ceil(n * .7) : Math.ceil(n * .7); fx = q.t === 'truck' || q.t === 'grad' ? -gap * 2.2 : -col * gap * 1.3; fy = (idx - (m - 1) / 2) * gap * 1.15; }
        else { const front = L.filter(z => z.t !== 'truck' && z.t !== 'grad'), back = L.filter(z => z.t === 'truck' || z.t === 'grad'); const isB = back.includes(q); const arr = isB ? back : front; const j = arr.indexOf(q); fx = isB ? -gap * 1.6 : 0; fy = (j - (arr.length - 1) / 2) * gap * 1.05; }
        q.tx = base[0] + fx * c - fy * s; q.ty = base[1] + fx * s + fy * c; q.trot = rot;
        if (v.snap) { q.x = q.tx; q.y = q.ty; q.h = rot; }
      });
      v.snap = 0;
      // حركة طبيعية: تلف بالتدريج وتسرّع وتبطّي
      for (const q of L) {
        const dx = q.tx - q.x, dy = q.ty - q.y, dist = Math.hypot(dx, dy);
        const maxV = (st.k === 'move' ? 1.2 : 1) * 30 * kmPx; // ~جسم الدبابة بالثانية (مثل 30 كم/س بالحقيقة) // كم بالثانية الحقيقية (بكسل/ثانية ثابت)
        if (dist > .4 * kmPx) {
          const want = Math.atan2(dy, dx); let dh = want - q.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
          const back = Math.abs(dh) > 2.4 && dist < S * 2 * kmPx; // قريب وبالعكس: يرجع لورا بدل ما يلف
          if (!back) q.h += Math.max(-2.6 * dt, Math.min(2.6 * dt, dh));
          const tsp = Math.min(maxV, dist * 2.2) * (back ? -.5 : Math.max(.15, Math.cos(dh)));
          q.sp += (tsp - q.sp) * Math.min(1, dt * 3);
        } else { q.sp *= Math.max(0, 1 - dt * 5); let dh = q.trot - q.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI; q.h += Math.max(-1.5 * dt, Math.min(1.5 * dt, dh)); }
        q.x += Math.cos(q.h) * q.sp * dt; q.y += Math.sin(q.h) * q.sp * dt;
        if (Math.abs(q.sp) > 6 * kmPx && R() < dt * 9) dust.push({ x: q.x - Math.cos(q.h) * S * .5 * kmPx, y: q.y - Math.sin(q.h) * S * .5 * kmPx, t: 0, r: S * .25 });
        let tdh = (q.aim ?? q.h) - q.h - q.tur; while (tdh > Math.PI) tdh -= 2 * Math.PI; while (tdh < -Math.PI) tdh += 2 * Math.PI; q.tur += Math.max(-2 * dt, Math.min(2 * dt, tdh));
      }
      if (st.k === 'fight') { if (!byBattle.has(st.tgt)) byBattle.set(st.tgt, [[], []]); byBattle.get(st.tgt)[st.att ? 0 : 1].push(v); }
      v.sel = SEL.has(d.id);
    }
    // الرمي: كل آلية تقاتل ترمي على آلية من العدو بنفس المعركة
    let near = 0;
    if (live) for (const [tg, [att, def]] of byBattle) {
      if (!att.length || !def.length) continue; near++;
      const shoot = (from, to) => {
        for (const v of from) for (const q of v.veh) {
          if (!q.alive) continue; q.cd -= dt; if (q.cd > 0) continue;
          const tv = to[Math.floor(R() * to.length)], tq = tv.veh.filter(z => z.alive)[Math.floor(R() * tv.veh.filter(z => z.alive).length)]; if (!tq) continue;
          q.aim = Math.atan2(tq.y - q.y, tq.x - q.x);
          fire(q, tq, v.d);
        }
      };
      shoot(att, def); shoot(def, att);
    }
    return near;
  };
  function fire(q, tq, d) {
    const miss = () => [tq.x + (R() - .5) * 3 / cam.s * 8, tq.y + (R() - .5) * 3 / cam.s * 8];
    if (q.t === 'tank') { q.cd = 2.2 + R() * 2.5; const [ex, ey] = miss(); shots.push({ k: 'shell', x0: q.x, y0: q.y, x1: ex, y1: ey, t: 0, dur: .18 }); booms.push({ x: q.x + Math.cos(q.aim) * 6 / cam.s, y: q.y + Math.sin(q.aim) * 6 / cam.s, t: 0, r: 5, k: 'flash' }); SND.at('tank', q.x, q.y, .55, .12); setTimeout(() => { boomAt(ex, ey, .55); }, 180); }
    else if (q.t === 'bmp') { q.cd = 1.6 + R() * 2; for (let i = 0; i < 4; i++) { const [ex, ey] = miss(); shots.push({ k: 'burst', x0: q.x, y0: q.y, x1: ex, y1: ey, t: -i * .07, dur: .14 }); } SND.at('can30', q.x, q.y, .35, .1); }
    else if (q.t === 'truck') { q.cd = 1 + R() * 1.5; for (let i = 0; i < 3; i++) { const [ex, ey] = miss(); shots.push({ k: 'mg', x0: q.x + (R() - .5) * 4 / cam.s, y0: q.y + (R() - .5) * 4 / cam.s, x1: ex, y1: ey, t: -i * .05, dur: .12 }); } SND.at('mg', q.x, q.y, .25, .15); }
    else if (q.t === 'grad') { q.cd = 7 + R() * 5; for (let i = 0; i < 6; i++) { const [ex, ey] = [tq.x + (R() - .5) * 18 / cam.s, tq.y + (R() - .5) * 18 / cam.s]; shots.push({ k: 'rocket', x0: q.x, y0: q.y, x1: ex, y1: ey, t: -i * .12, dur: .9, trail: [] }); } SND.at('rocket', q.x, q.y, .6, .3); }
  }
  function boomAt(x, y, k = 1) { booms.push({ x, y, t: 0, r: 9 * k, k: 'boom' }); for (let i = 0; i < 3; i++) smokes.push({ x: x + (R() - .5) * 2 / cam.s, y: y + (R() - .5) * 2 / cam.s, t: 0, r: 6 * k, life: 3 + R() * 3 }); }
  V.boomAt = boomAt;
  // رسم الآليات
  V.drawDivs = (labels) => {
    const S = Math.min(38, Math.max(14, cam.s * 9.5));
    for (const w of wrecks) { const [x, y] = w2s(w.x, w.y); if (x < -40 || x > innerWidth + 40 || y < -40 || y > innerHeight + 40) continue; g.save(); g.translate(x, y); g.rotate(w.h + .5); g.globalAlpha = .9; g.filter = 'brightness(.28) saturate(.2)'; g.drawImage(IMG[w.n], -S / 2, -S / 2, S, S); g.restore(); if (w.t < 25 && R() < .08) smokes.push({ x: w.x, y: w.y, t: 0, r: 4, life: 3 }); }
    for (const [id, v] of VIS) {
      if (performance.now() - v.seen > 100) continue; const d = v.d;
      const ring = d.side ? 'rgba(215,60,45,.75)' : 'rgba(45,115,235,.75)';
      for (const q of v.veh) {
        if (!q.alive) continue; const [x, y] = w2s(q.x, q.y); if (x < -40 || x > innerWidth + 40 || y < -40 || y > innerHeight + 40) continue;
        const sz = q.t === 'tank' ? S : q.t === 'bmp' ? S * .9 : S * .8; const n = sprName(d, q.t);
        g.save(); g.translate(x, y);
        g.beginPath(); g.ellipse(0, 0, sz * .44, sz * .3, q.h, 0, 7); g.fillStyle = ring; g.fill();
        g.rotate(q.h); g.drawImage(IMG[n], -sz / 2, -sz / 2, sz, sz);
        if (q.t === 'tank') { g.rotate(q.tur); g.drawImage(IMG[n + '_t'], -sz / 2, -sz / 2, sz, sz); }
        g.restore();
        if (d.kind === 'inf' && q.t === 'truck') for (let k = 0; k < 5; k++) { const a = k * 1.25 + q.k, rr = sz * (.55 + (k % 2) * .2); g.beginPath(); g.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, Math.max(1.3, sz * .07), 0, 7); g.fillStyle = d.side ? '#5a2a20' : '#1d3557'; g.fill(); }
      }
      if (v.sel || labels) {
        let cx = 0, cy = 0, n = 0; for (const q of v.veh) if (q.alive) { cx += q.x; cy += q.y; n++; } const [x, y] = w2s(cx / n, cy / n);
        if (v.sel) { g.save(); g.beginPath(); g.ellipse(x, y, S * 2.4, S * 2, 0, 0, 7); g.setLineDash([5, 4]); g.lineWidth = 2; g.strokeStyle = '#ffd65a'; g.stroke(); g.restore(); }
        if (labels || v.sel) { const ty = y - S * 2.2; g.font = '700 11px "IBM Plex Sans Arabic"'; const tw = g.measureText(d.n).width + 14; g.fillStyle = d.side ? 'rgba(150,40,30,.9)' : 'rgba(30,70,150,.9)'; g.beginPath(); g.roundRect(x - tw / 2, ty - 9, tw, 18, 6); g.fill(); text(d.n, x, ty, 11, '#fff', null, 700); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x - tw / 2, ty + 10, tw, 3); g.fillStyle = d.str > .6 ? '#5fd06f' : d.str > .35 ? '#e7c03f' : '#e2553f'; g.fillRect(x - tw / 2, ty + 10, tw * d.str, 3); }
      }
    }
  };
  V.forget = () => { for (const [id, v] of VIS) if (performance.now() - v.seen > 3000) VIS.delete(id); };
  // المؤثرات: رمي، انفجارات، غبار، دخان
  V.drawFx = dt => {
    for (let i = dust.length - 1; i >= 0; i--) { const p = dust[i]; p.t += dt; if (p.t > 1.6) { dust.splice(i, 1); continue; } const [x, y] = w2s(p.x, p.y); g.fillStyle = `rgba(190,170,130,${.35 * (1 - p.t / 1.6)})`; g.beginPath(); g.arc(x, y, p.r * (1 + p.t * 1.5), 0, 7); g.fill(); }
    for (let i = smokes.length - 1; i >= 0; i--) { const p = smokes[i]; p.t += dt; if (p.t > p.life) { smokes.splice(i, 1); continue; } const [x, y] = w2s(p.x + p.t * .8 / cam.s * 3, p.y - p.t * 1.2 / cam.s * 3); const r = p.r * (1 + p.t * .6) * Math.min(1.3, Math.max(.5, cam.s / 3)); g.fillStyle = `rgba(70,65,60,${.3 * (1 - p.t / p.life)})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; s.t += dt; if (s.t < 0) continue; const f = s.t / s.dur; if (f > 1) { if (s.k === 'rocket') { boomAt(s.x1, s.y1, .6); SND.at('boom_mid', s.x1, s.y1, .35, .12); } shots.splice(i, 1); continue; }
      const [x0, y0] = w2s(s.x0, s.y0), [x1, y1] = w2s(s.x1, s.y1);
      if (s.k === 'rocket') { const ff = f, arc = Math.sin(ff * Math.PI) * Math.hypot(x1 - x0, y1 - y0) * .25; const x = x0 + (x1 - x0) * ff, y = y0 + (y1 - y0) * ff - arc; s.trail.push([x, y]); g.strokeStyle = 'rgba(220,215,205,.6)'; g.lineWidth = 1.6; g.beginPath(); s.trail.forEach(([a, b], k) => k ? g.lineTo(a, b) : g.moveTo(a, b)); g.stroke(); g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); continue; }
      const a = Math.max(0, f - (s.k === 'shell' ? .35 : .25)), x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f, xa = x0 + (x1 - x0) * a, ya = y0 + (y1 - y0) * a;
      g.strokeStyle = s.k === 'shell' ? 'rgba(255,236,170,.95)' : s.k === 'burst' ? 'rgba(255,200,110,.9)' : 'rgba(255,240,190,.75)'; g.lineWidth = s.k === 'shell' ? 2.4 : s.k === 'burst' ? 1.7 : 1; g.beginPath(); g.moveTo(xa, ya); g.lineTo(x, y); g.stroke();
    }
    for (let i = booms.length - 1; i >= 0; i--) {
      const b = booms[i]; b.t += dt; const life = b.k === 'flash' ? .09 : .7; if (b.t > life) { booms.splice(i, 1); continue; }
      const [x, y] = w2s(b.x, b.y), f = b.t / life, r = b.r * Math.min(2.4, Math.max(.7, cam.s / 1.6)) * (b.k === 'flash' ? 1 : (.5 + f));
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,245,200,${1 - f})`); gr.addColorStop(.4, `rgba(255,150,50,${.85 * (1 - f)})`); gr.addColorStop(1, 'rgba(120,60,20,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    for (const w of wrecks) w.t += dt; while (wrecks.length > 160) wrecks.shift();
  };

  // ===== الجو =====
  const PL = { f16: 'f16', su25: 'su25', f14: 'f14', su24: 'su25' };
  V.drawBases = (selB) => {
    const k = Math.min(1.25, Math.max(.75, cam.s * .9));
    A.bases.forEach((b, i) => {
      const [x, y] = w2s(...b.p); if (x < -60 || x > innerWidth + 60 || y < -60 || y > innerHeight + 60) return;
      g.save(); g.translate(x, y); g.rotate(.4 + i);
      g.fillStyle = 'rgba(40,40,40,.85)'; g.fillRect(-18 * k, -3.5 * k, 36 * k, 7 * k); g.strokeStyle = 'rgba(255,255,255,.7)'; g.setLineDash([3 * k, 3 * k]); g.lineWidth = 1; g.beginPath(); g.moveTo(-15 * k, 0); g.lineTo(15 * k, 0); g.stroke(); g.setLineDash([]); g.restore();
      g.save(); g.translate(x, y - 12 * k); g.beginPath(); g.arc(0, 0, 10 * k, 0, 7); g.fillStyle = b.side ? '#c8402f' : '#2f6fd0'; g.fill(); g.lineWidth = selB === i ? 3 : 1.3; g.strokeStyle = selB === i ? '#ffd65a' : '#fff'; g.stroke();
      text('✈', 0, 1, 12 * k, '#fff', null, 700); g.restore();
      if (cam.s > .75 || b.side === 0) text(`${b.n} · ${b.ready}/${b.n0}`, x, y + 12 * k, 10.5 * k, b.side ? '#5a1a10' : '#102a5a');
    });
    A.sams.forEach((s, i) => {
      const [x, y] = w2s(...s.p); if (x < -300 || x > innerWidth + 300 || y < -300 || y > innerHeight + 300) return;
      const hot = s.flash > 0; s.flash = Math.max(0, (s.flash || 0) - .016);
      if (hot || selB === 'sam' + i) { g.save(); g.setLineDash([6, 6]); g.lineWidth = 1.5; g.strokeStyle = s.side ? 'rgba(200,60,40,.6)' : 'rgba(40,100,220,.6)'; g.beginPath(); g.arc(x, y, s.r * cam.s, 0, 7); g.stroke(); g.restore(); }
      const sz = Math.min(34, Math.max(20, cam.s * 9));
      g.save(); g.translate(x, y); g.beginPath(); g.arc(0, 0, sz * .55, 0, 7); g.fillStyle = s.side ? 'rgba(200,64,47,.55)' : 'rgba(47,111,208,.55)'; g.fill(); g.rotate(-.6); g.drawImage(IMG[s.kind], -sz / 2, -sz / 2, sz, sz); g.restore();
      if (s.down) text('💥', x + sz * .4, y - sz * .4, 12, '#000', null);
      if (cam.s > 1) text(`${s.n} · ${s.ammo}`, x, y + sz * .7, 10, s.side ? '#5a1a10' : '#102a5a');
    });
    A.mbases.forEach(m => { const [x, y] = w2s(...m.p); const sz = Math.min(32, Math.max(20, cam.s * 9)); g.save(); g.translate(x, y); g.beginPath(); g.arc(0, 0, sz * .55, 0, 7); g.fillStyle = 'rgba(200,64,47,.55)'; g.fill(); g.rotate(-1.2); g.drawImage(IMG.zolf, -sz / 2, -sz / 2, sz, sz); g.restore(); if (cam.s > 1) text(`${m.n} · ${m.ammo}`, x, y + sz * .7, 10, '#5a1a10'); });
  };
  V.drawAir = dt => {
    // دخان الصواريخ
    for (const m of A.msls) {
      if (m.t < 0 || !m.trail.length) continue;
      const age = A.t;
      g.lineCap = 'round';
      for (let i = 1; i < m.trail.length; i++) {
        const [ax, ay, ta, al] = m.trail[i - 1], [bx, by] = m.trail[i]; const f = Math.max(0, 1 - (age - ta) / (m.kind === 'bm' ? 6 : 3.5)); if (f <= 0) continue;
        const [x0, y0] = w2s(ax, ay - (al || 0) * (m.kind === 'bm' ? 30 : 4)), [x1, y1] = w2s(bx, by - (m.trail[i][3] || 0) * (m.kind === 'bm' ? 30 : 4));
        g.strokeStyle = `rgba(235,232,225,${.55 * f})`; g.lineWidth = (m.kind === 'bm' ? 4 : 2.2) * (1 + (1 - f) * 2); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      }
      if (!m.done) {
        const hy = m.kind === 'bm' ? m.y - (m.alt || 0) * 30 : m.y - (m.alt || 0) * 4; const [x, y] = w2s(m.x, hy);
        if (m.kind === 'bm') { const [sx, sy] = w2s(m.x, m.y); g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(sx, sy, 3, 0, 7); g.fill(); }
        const gr = g.createRadialGradient(x, y, 0, x, y, m.kind === 'bm' ? 9 : 6); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(.4, 'rgba(255,170,60,.9)'); gr.addColorStop(1, 'rgba(255,120,30,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, m.kind === 'bm' ? 9 : 6, 0, 7); g.fill();
        if (m.kind === 'bm') { g.save(); g.translate(x, y); g.rotate(Math.atan2(m.ty - m.y0, m.tx - m.x0) + (m.f < .5 ? -.5 : .5)); const L = 10 + (m.alt || 0) * 8; g.fillStyle = '#e8e4da'; g.fillRect(-L / 2, -1.6, L, 3.2); g.restore(); }
      }
    }
    // الطيارات (بظلها)
    for (const p of A.planes) {
      const [x, y] = w2s(p.x, p.y); if (x < -60 || x > innerWidth + 60 || y < -60 || y > innerHeight + 60) continue;
      const sz = Math.min(46, Math.max(26, cam.s * 13)) * (p.st === 'fall' ? Math.max(.4, 1 - p.t * .25) : 1); const im = IMG[PL[p.type]]; const alt = p.alt * Math.min(22, 8 + cam.s * 4);
      const H = p.h + (PL[p.type] === 'su25' ? Math.PI : 0); // صورة السوخوي أنفها لليسار (R0.1)
      g.save(); g.globalAlpha = .3; g.translate(x + alt * .6, y + alt); g.rotate(H); g.filter = 'brightness(0) blur(1.5px)'; g.drawImage(im, -sz / 2, -sz / 2, sz, sz); g.restore();
      g.save(); g.translate(x, y); g.rotate(H); g.drawImage(im, -sz / 2, -sz / 2, sz, sz); g.restore();
      g.beginPath(); g.moveTo(x, y - sz * .62); g.lineTo(x - 4, y - sz * .62 - 6); g.lineTo(x + 4, y - sz * .62 - 6); g.closePath(); g.fillStyle = p.side ? '#e0533f' : '#4f8ff0'; g.fill();
      if (p.st === 'fall') { if (R() < .6) smokes.push({ x: p.x, y: p.y, t: 0, r: 5, life: 2.5 }); }
    }
  };
  // أحداث الجو → مؤثرات وأصوات وتنبيهات
  V.airEvent = (e, toast, ME) => {
    if (e.k === 'samlaunch') { const s = A.sams.find(q => q.n === e.n); if (s) s.flash = 2.5; for (let i = 0; i < 4; i++) smokes.push({ x: e.x + (R() - .5) * 3, y: e.y + (R() - .5) * 3, t: 0, r: 7, life: 3 }); SND.at('launch', e.x, e.y, .8, .3); }
    if (e.k === 'aam') SND.at('woosh', e.x, e.y, .5, .2);
    if (e.k === 'kill') { booms.push({ x: e.x, y: e.y, t: 0, r: 14, k: 'boom' }); SND.at('boom_big', e.x, e.y, .9, .1); toast(e.vside === ME ? `💥 انضربت طيارتنا ${e.victim} (${e.by === 'aam' ? 'صاروخ جو-جو' : 'دفاع جوي'})` : `🎯 أسقطنا ${e.victim} إيرانية`, e.vside === ME ? 'bad' : 'good'); }
    if (e.k === 'miss') booms.push({ x: e.x, y: e.y, t: 0, r: 4, k: 'boom' });
    if (e.k === 'bomb') { boomAt(e.x, e.y, 1.3); setTimeout(() => boomAt(e.x + 3, e.y - 2, 1), 150); SND.at('boom_bomb', e.x, e.y, .9, .1); if (e.what) toast(e.side === ME ? `💥 ضربنا ${e.what}` : `⚠️ إيران ضربت ${e.what}`, e.side === ME ? 'good' : 'bad'); }
    if (e.k === 'takeoff') SND.at('jet_roar', e.x, e.y, .7, 1);
    if (e.k === 'bmlaunch') { for (let i = 0; i < 6; i++) smokes.push({ x: e.x + (R() - .5) * 5, y: e.y + (R() - .5) * 5, t: 0, r: 9, life: 4 }); SND.at('launch', e.x, e.y, 1, .3); toast(`🚀 إيران أطلقت صواريخ باليستية على ${e.tgt}`, 'bad'); }
    if (e.k === 'intercept') { booms.push({ x: e.x, y: e.y - 20, t: 0, r: 16, k: 'boom' }); SND.at('boom_mid', e.x, e.y, .8, .1); toast('✅ باتريوت اعترض صاروخ باليستي', 'good'); }
    if (e.k === 'bmimpact') { boomAt(e.x, e.y, 2.2); SND.at('boom_big', e.x, e.y, 1, .1); }
    if (e.k === 'crash') { boomAt(e.x, e.y, 1); }
  };
})();
