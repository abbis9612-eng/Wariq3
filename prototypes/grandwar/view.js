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
    // المسافة عن نص الشاشة بالكم: الصوت يتأخر (سرعة الصوت مضغوطة بنفس نسبة الوقت) والبعيد مكتوم
    const dkm = Math.hypot(wx - cam.x, wy - cam.y), rel = dkm * cam.s / Math.max(W, H);
    const delay = Math.min(2.2, dkm / (.343 * Math.max(20, V.gs || 60)));
    const s = SND.ctx.createBufferSource(); s.buffer = SND.buf[name]; s.playbackRate.value = .92 + R() * .16;
    const gn = SND.ctx.createGain(); gn.gain.value = Math.min(1, v);
    const lp = SND.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(600, 16000 * Math.exp(-rel * 2.4) * Math.min(1, cam.s / 1.2));
    const pan = SND.ctx.createStereoPanner ? SND.ctx.createStereoPanner() : null;
    let node = s.connect(lp).connect(gn); if (pan) { pan.pan.value = Math.max(-1, Math.min(1, (x - W / 2) / (W / 2))) * .7; node = node.connect(pan); } node.connect(SND.master);
    s.start(now + delay);
    // الانفجارات الكبيرة: طبقة هدير بعيد وراها
    if ((n === 'boom_big' || n === 'boom_bomb') && SND.buf.boom_far && name !== 'boom_far') { const s2 = SND.ctx.createBufferSource(); s2.buffer = SND.buf.boom_far; const g2 = SND.ctx.createGain(); g2.gain.value = Math.min(.6, v * .5); s2.connect(g2).connect(SND.master); s2.start(now + delay + .12); }
  };
  V.soundTick = (dt, nBattlesNear) => { SND.budget = Math.max(0, SND.budget - dt * 12); if (SND.amb) SND.amb.gain.value += ((SND.on ? Math.min(.55, nBattlesNear * .12) * Math.min(1, cam.s / 2) : 0) - SND.amb.gain.value) * Math.min(1, dt * 2); };

  // ===== الآليات =====
  const VIS = new Map(); // divId → {veh:[...], s}
  const wrecks = [], shots = [], dying = [];
  const DARK = {}; const dark = n => { if (DARK[n]) return DARK[n]; const im = IMG[n], c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.filter = 'brightness(.26) saturate(.15) sepia(.3)'; x.drawImage(im, 0, 0); return DARK[n] = c; };
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
      while (alive > want) {
        const q = combat.filter(q => q.alive).sort((a, b) => b.k - a.k)[0]; q.alive = false; alive--;
        if (live) { dying.push({ q, n: sprName(d, q.t), t: 0, cook: q.t === 'tank' ? rr(.7, 1.3) : rr(.4, .8), side: d.side }); hitBy(q, v); }
        else wrecks.push({ x: q.x, y: q.y, h: q.h, tur: q.tur, n: sprName(d, q.t), t: 0, tank: q.t === 'tank' });
      }
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
        if (Math.abs(q.sp) > 6 * kmPx && R() < dt * 7) FX.puff(q.x - Math.cos(q.h) * S * .5 * kmPx, q.y - Math.sin(q.h) * S * .5 * kmPx, S * .22, rr(1.5, 2.6), 'dust', .4, -Math.cos(q.h) * 6, -Math.sin(q.h) * 6, 1.8);
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
    if (q.t === 'tank') { q.cd = 3 + R() * 3; const [ex, ey] = miss(); const hit = R() < .3; FX.muzzle(q.x + Math.cos(q.aim) * 9 / cam.s, q.y + Math.sin(q.aim) * 9 / cam.s, q.aim); shots.push({ k: 'shell', x0: q.x, y0: q.y, x1: hit ? tq.x : ex, y1: hit ? tq.y : ey, t: 0, dur: .18, end: hit ? 'spark' : 'dirt' }); SND.at('tank', q.x, q.y, .55, .12); }
    else if (q.t === 'bmp') { q.cd = 1.6 + R() * 2; for (let i = 0; i < 4; i++) { const [ex, ey] = miss(); shots.push({ k: 'burst', x0: q.x, y0: q.y, x1: ex, y1: ey, t: -i * .07, dur: .14, end: i === 3 ? 'puff' : null }); } SND.at('can30', q.x, q.y, .35, .1); }
    else if (q.t === 'truck') { q.cd = 1 + R() * 1.5; for (let i = 0; i < 3; i++) { const [ex, ey] = miss(); shots.push({ k: 'mg', x0: q.x + (R() - .5) * 4 / cam.s, y0: q.y + (R() - .5) * 4 / cam.s, x1: ex, y1: ey, t: -i * .05, dur: .12 }); } SND.at('mg', q.x, q.y, .25, .15); }
    else if (q.t === 'grad') { q.cd = 7 + R() * 5; for (let i = 0; i < 6; i++) { const [ex, ey] = [tq.x + (R() - .5) * 18 / cam.s, tq.y + (R() - .5) * 18 / cam.s]; shots.push({ k: 'rocket', x0: q.x, y0: q.y, x1: ex, y1: ey, t: -i * .12, dur: .9, trail: [] }); } SND.at('rocket', q.x, q.y, .6, .3); }
  }
  const rr = (a, b) => a + R() * (b - a);
  function boomAt(x, y, k = 1) { FX.explode(x, y, k > 1.2 ? 'big' : 'he', k); }
  V.boomAt = boomAt;
  // الآلية اللي تموت: قذيفة جاية من دبابة عدو بنفس المعركة (إذا موجودة) وشرارة بمكان الإصابة
  function hitBy(q, v) {
    const foes = []; for (const [, w] of VIS) if (w.d && w.d.side !== v.d.side && performance.now() - w.seen < 200) for (const z of w.veh) if (z.alive && z.t === 'tank' && Math.hypot(z.x - q.x, z.y - q.y) < 60 / cam.s * 4) foes.push(z);
    const f = foes[Math.floor(R() * foes.length)];
    if (f) { f.aim = Math.atan2(q.y - f.y, q.x - f.x); FX.muzzle(f.x + Math.cos(f.aim) * 9 / cam.s, f.y + Math.sin(f.aim) * 9 / cam.s, f.aim); shots.push({ k: 'shell', x0: f.x, y0: f.y, x1: q.x, y1: q.y, t: 0, dur: .16 }); SND.at('tank', f.x, f.y, .55, .1); }
    setTimeout(() => FX.spark(q.x, q.y, 14, 140), f ? 160 : 0);
  }
  function updDying(dt) {
    for (let i = dying.length - 1; i >= 0; i--) {
      const z = dying[i], q = z.q; z.t += dt;
      if (R() < dt * 14) FX.puff(q.x, q.y, 4 * FX.U(), rr(1.5, 3), 'black', .55, 0, -6, 2); // دخان من الفتحات
      if (z.t >= z.cook) {
        const tank = q.t === 'tank', S = Math.min(38, Math.max(14, cam.s * 9.5));
        FX.explode(q.x, q.y, tank ? 'cookoff' : q.t === 'bmp' ? 'big' : 'he', tank ? 1.1 : .8);
        if (tank) FX.throwPart(dark(z.n + '_t'), q.x, q.y, q.h + q.tur, S);
        FX.burn(q.x, q.y, tank ? 1 : .7, tank ? rr(70, 110) : rr(40, 70));
        wrecks.push({ x: q.x, y: q.y, h: q.h, tur: q.tur, n: z.n, t: 0, tank, noTur: tank });
        SND.at('boom_big', q.x, q.y, 1, .08); dying.splice(i, 1);
      }
    }
  }
  // رسم الآليات
  V.drawDivs = (labels) => {
    const S = Math.min(38, Math.max(14, cam.s * 9.5));
    for (const w of wrecks) { const [x, y] = w2s(w.x, w.y); if (x < -40 || x > innerWidth + 40 || y < -40 || y > innerHeight + 40) continue; g.save(); g.translate(x, y); g.rotate(w.h); g.drawImage(dark(w.n), -S / 2, -S / 2, S, S); if (w.tank && !w.noTur) { g.rotate(w.tur || 0); g.drawImage(dark(w.n + '_t'), -S / 2, -S / 2, S, S); } g.restore(); }
    for (const z of dying) { const q = z.q; const [x, y] = w2s(q.x, q.y); const sz = q.t === 'tank' ? S : S * .9; g.save(); g.translate(x, y); g.rotate(q.h); g.drawImage(IMG[z.n], -sz / 2, -sz / 2, sz, sz); if (q.t === 'tank') { g.rotate(q.tur); g.drawImage(IMG[z.n + '_t'], -sz / 2, -sz / 2, sz, sz); } g.restore(); }
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
    updDying(dt);
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; s.t += dt; if (s.t < 0) continue; const f = s.t / s.dur;
      if (f > 1) { if (s.k === 'rocket') { FX.dirt(s.x1, s.y1, .9); FX.explode(s.x1, s.y1, 'small'); SND.at('boom_mid', s.x1, s.y1, .35, .12); } else if (s.end === 'dirt') FX.dirt(s.x1, s.y1, .6); else if (s.end === 'spark') FX.spark(s.x1, s.y1, 10, 110); else if (s.end === 'puff') FX.puff(s.x1, s.y1, 4 * FX.U(), 1.2, 'dust', .5, 0, 0, 1.5); shots.splice(i, 1); continue; }
      const [x0, y0] = w2s(s.x0, s.y0), [x1, y1] = w2s(s.x1, s.y1);
      if (s.k === 'rocket') { const ff = f, arc = Math.sin(ff * Math.PI) * Math.hypot(x1 - x0, y1 - y0) * .25; const x = x0 + (x1 - x0) * ff, y = y0 + (y1 - y0) * ff - arc; s.trail.push([x, y]); if (R() < .5) FX.puff(s.x0 + (s.x1 - s.x0) * ff, s.y0 + (s.y1 - s.y0) * ff - arc / cam.s, 3 * FX.U(), 2.5, 'grey', .45, 0, 0, 2); g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); continue; }
      const a = Math.max(0, f - (s.k === 'shell' ? .35 : .25)), x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f, xa = x0 + (x1 - x0) * a, ya = y0 + (y1 - y0) * a;
      g.strokeStyle = s.k === 'shell' ? 'rgba(255,236,170,.95)' : s.k === 'burst' ? 'rgba(255,200,110,.9)' : 'rgba(255,240,190,.75)'; g.lineWidth = s.k === 'shell' ? 2.4 : s.k === 'burst' ? 1.7 : 1; g.beginPath(); g.moveTo(xa, ya); g.lineTo(x, y); g.stroke();
    }
    while (wrecks.length > 160) wrecks.shift();
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
      if (p.st === 'fall') { if (R() < .7) FX.puff(p.x, p.y, 6, rr(3, 5), 'black', .6, 0, 0, 2); if (R() < .3) FX.spark(p.x, p.y, 2, 40); }
    }
  };
  // أحداث الجو → مؤثرات وأصوات وتنبيهات
  V.airEvent = (e, toast, ME) => {
    if (e.k === 'samlaunch') { const sm = A.sams.find(q => q.n === e.n); if (sm) sm.flash = 2.5; FX.muzzle(e.x, e.y, -Math.PI / 2, 1.6); for (let i = 0; i < 6; i++) FX.puff(e.x + rr(-2, 2) / cam.s, e.y + rr(-2, 2) / cam.s, 10, rr(3, 6), 'grey', .6, rr(-14, 14), rr(-14, 14), 2); SND.at('launch', e.x, e.y, .8, .3); }
    if (e.k === 'aam') SND.at('woosh', e.x, e.y, .5, .2);
    if (e.k === 'kill') { FX.explode(e.x, e.y, 'air', 1); SND.at('boom_big', e.x, e.y, .9, .1); toast(e.vside === ME ? `💥 انضربت طيارتنا ${e.victim} (${e.by === 'aam' ? 'صاروخ جو-جو' : 'دفاع جوي'})` : `🎯 أسقطنا ${e.victim} إيرانية`, e.vside === ME ? 'bad' : 'good'); }
    if (e.k === 'miss') FX.puff(e.x, e.y, 6, 2, 'grey', .5, 0, 0, 1.5);
    if (e.k === 'bomb') {
      const sx = e.x - 14 / cam.s, sy = e.y - 20 / cam.s;
      FX.bomb(sx, sy, e.x, e.y, () => { FX.explode(e.x, e.y, 'bomb', 1); SND.at('boom_bomb', e.x, e.y, .95, .08); });
      FX.bomb(sx + 4 / cam.s, sy, e.x + 6 / cam.s, e.y - 3 / cam.s, () => FX.explode(e.x + 6 / cam.s, e.y - 3 / cam.s, 'big', .9));
      if (e.what) toast(e.side === ME ? `💥 ضربنا ${e.what}` : `⚠️ إيران ضربت ${e.what}`, e.side === ME ? 'good' : 'bad');
    }
    if (e.k === 'takeoff') SND.at('jet_roar', e.x, e.y, .7, 1);
    if (e.k === 'bmlaunch') { FX.explode(e.x, e.y, 'small', 1.4); for (let i = 0; i < 10; i++) FX.puff(e.x + rr(-3, 3) / cam.s, e.y + rr(-3, 3) / cam.s, 14, rr(5, 9), i < 4 ? 'dust' : 'grey', .65, rr(-25, 25), rr(-25, 25), 2.4); SND.at('launch', e.x, e.y, 1, .3); toast(`🚀 إيران أطلقت صواريخ باليستية على ${e.tgt}`, 'bad'); }
    if (e.k === 'intercept') { FX.explode(e.x, e.y - 20 / cam.s, 'air', 1.3); SND.at('boom_mid', e.x, e.y, .8, .1); toast('✅ باتريوت اعترض صاروخ باليستي', 'good'); }
    if (e.k === 'bmimpact') { FX.explode(e.x, e.y, 'bm', 1); FX.burn(e.x, e.y, 1.2, 60); SND.at('boom_big', e.x, e.y, 1, .1); }
    if (e.k === 'crash') { FX.explode(e.x, e.y, 'big', 1); FX.burn(e.x, e.y, .8, 45); }
  };
})();
