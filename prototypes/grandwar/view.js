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
      // ===== R2: مكان كل آلية حسب التكتيك =====
      const c = Math.cos(rot), s = Math.sin(rot); const L = v.veh.filter(q => q.alive);
      const base = [v.ax, v.ay]; const gap = S * 1.25 * kmPx;
      const front = L.filter(z => z.t === 'tank' || z.t === 'bmp'), rear = L.filter(z => z.t === 'truck' || z.t === 'grad');
      if (st.k === 'fight') {
        const bt = WD.battles.get(st.tgt); const win = bt ? (bt.side === d.side ? bt.win : 1 - bt.win) : .5;
        const E = BC.get(st.tgt)?.[st.att ? 1 : 0] || cells[st.tgt].c; const sep = Math.hypot(E[0] - v.ax, E[1] - v.ay);
        v.phase = (v.phase || 0) + dt;
        if (st.att) {
          // قفزات: فصيلين، واحد يتقدّم خطوة والثاني واقف يغطي ويرمي، ويتبادلون كل ~7 ثواني
          if (v.bA == null) { v.bA = 0; v.bB = 0; v.mv = 0; v.phase = 0; }
          const maxAdv = sep * (.12 + .4 * win), step = gap * 1.4;
          if (v.phase > 7) { v.phase = 0; v.mv = 1 - v.mv; }
          if (v.mv === 0) v.bA = Math.min(maxAdv, v.bA + step * dt / 4); else v.bB = Math.min(maxAdv, v.bB + step * dt / 4);
          front.forEach((q, i) => { q.pl = i % 2; const adv = q.pl ? v.bB : v.bA; const j = i - (front.length - 1) / 2; q.fx = adv + (q.pl ? -gap * .5 : 0); q.fy = j * gap * 1.2; q.moving = q.pl === v.mv && adv < maxAdv - 1e-3; });
        } else {
          // دفاع: كل دبابة بساتر (حفرة)، تطلع قدّام ترمي وترجع لورا (اضرب وارجع)
          front.forEach((q, i) => {
            q.pp = (q.pp ?? R() * 8) + dt; const cyc = q.t === 'tank' ? 9 : 6; const ph = q.pp % cyc;
            const out = ph < 1.6 ? ph / 1.6 : ph < 4.4 ? 1 : ph < 6 ? 1 - (ph - 4.4) / 1.6 : 0;
            const j = i - (front.length - 1) / 2; q.fx = out * gap * .7; q.fy = j * gap * 1.2; q.peek = out; q.moving = false; q.bfx = gap * .45; q.bfy = q.fy;
          });
        }
        rear.forEach((q, i) => { const j = i - (rear.length - 1) / 2; q.fx = (st.att ? -gap * 1.2 : -gap * 1.8); q.fy = j * gap * 1.3; });
      } else if (st.k === 'move') { L.forEach((q, i) => { q.fx = -i * gap; q.fy = (i % 2 ? 1 : -1) * gap * .18; }); v.bA = v.bB = null; }
      else { front.forEach((q, i) => { q.fx = 0; q.fy = (i - (front.length - 1) / 2) * gap * 1.05; }); rear.forEach((q, i) => { q.fx = -gap * 1.6; q.fy = (i - (rear.length - 1) / 2) * gap * 1.05; }); v.bA = v.bB = null; }
      for (const q of L) { q.tx = base[0] + q.fx * c - q.fy * s; q.ty = base[1] + q.fx * s + q.fy * c; q.trot = rot; if (v.snap) { q.x = q.tx; q.y = q.ty; q.h = rot; } if (st.k === 'fight' && !st.att && q.bfx != null) { q.bx = base[0] + q.bfx * c - q.bfy * s; q.by = base[1] + q.bfx * s + q.bfy * c; } else q.bx = null; }
      v.rot = rot; v.base = base;
      v.snap = 0;
      // ===== حركة الآلية: تسارع وفرملة، لفّة بسرعة الجنزير، والرجوع لورا والوجه للعدو =====
      for (const q of L) {
        const dx = q.tx - q.x, dy = q.ty - q.y, dist = Math.hypot(dx, dy);
        const maxV = (st.k === 'move' ? 1.2 : st.k === 'fight' ? .7 : 1) * 30 * kmPx;
        if (dist > .35 * kmPx) {
          const want = Math.atan2(dy, dx); let dh = want - q.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
          // إذا المكان الجديد ورا (بعكس وجهه للعدو) وقريب: يرجع لورا بدون ما يلف (مثل الحقيقة تحت النار)
          const away = Math.cos(want - q.trot) < -.3 && dist < S * 6 * kmPx;
          if (away) { let bh = want + Math.PI - q.h; while (bh > Math.PI) bh -= 2 * Math.PI; while (bh < -Math.PI) bh += 2 * Math.PI; q.h += Math.max(-1.2 * dt, Math.min(1.2 * dt, bh)); }
          else q.h += Math.max(-1.2 * dt, Math.min(1.2 * dt, dh));
          const tsp = Math.min(maxV, dist * 1.8) * (away ? -.55 : Math.max(.1, Math.cos(dh)));
          q.sp += (tsp - q.sp) * Math.min(1, dt * 1.6);
        } else { q.sp *= Math.max(0, 1 - dt * 4); let dh = q.trot - q.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI; q.h += Math.max(-.8 * dt, Math.min(.8 * dt, dh)); }
        q.x += Math.cos(q.h) * q.sp * dt; q.y += Math.sin(q.h) * q.sp * dt;
        if (q.rec) { q.rec = Math.max(0, q.rec - dt * 4); }
        if (Math.abs(q.sp) > 6 * kmPx && R() < dt * 7) FX.puff(q.x - Math.cos(q.h) * S * .5 * kmPx, q.y - Math.sin(q.h) * S * .5 * kmPx, S * .22, rr(1.5, 2.6), 'dust', .4, -Math.cos(q.h) * 6, -Math.sin(q.h) * 6, 1.8);
        // البرج يلف بسرعته الحقيقية (~45° بالثانية)
        let tdh = (q.aim ?? q.h) - q.h - q.tur; while (tdh > Math.PI) tdh -= 2 * Math.PI; while (tdh < -Math.PI) tdh += 2 * Math.PI; q.tur += Math.max(-.8 * dt, Math.min(.8 * dt, tdh)); q.aimErr = Math.abs(tdh);
        // المدرعة تنزّل مشاتها لما توقف بالقتال
        if (q.t === 'bmp') q.dis = Math.max(0, Math.min(1, (q.dis || 0) + (st.k === 'fight' && Math.abs(q.sp) < 3 * kmPx ? dt / 2.5 : -dt / 1.5)));
      }
      if (st.k === 'fight') {
        if (!byBattle.has(st.tgt)) byBattle.set(st.tgt, [[], []]); byBattle.get(st.tgt)[st.att ? 0 : 1].push(v);
        // قصف تمهيد أول 14 ثانية من الهجوم، وبعدين مدفعية خفيفة
        if (st.att && live) { v.art = (v.art ?? 0) - dt; const prep = (v.phase0 = (v.phase0 ?? 0) + dt) < 14; if (v.art <= 0) { v.art = prep ? rr(.8, 1.6) : rr(6, 11); artyAt(st.tgt, d.side); } }
      } else v.phase0 = null;
      v.sel = SEL.has(d.id);
    }
    // مراكز كل طرف بكل معركة (للتشكيل بالإطار الجاي)
    BC.clear();
    for (const [tg, sides] of byBattle) BC.set(tg, sides.map(arr => { let x = 0, y = 0, n = 0; for (const v of arr) for (const q of v.veh) if (q.alive) { x += q.x; y += q.y; n++; } return n ? [x / n, y / n] : null; }));
    // ===== الرمي: هدف ← توقف ← تصويب البرج ← رمي ← تلقيم =====
    let near = 0;
    if (live) for (const [tg, [att, def]] of byBattle) {
      if (!att.length || !def.length) continue; near++;
      const shoot = (from, to, isAtt) => {
        const targets = []; for (const v of to) for (const z of v.veh) if (z.alive) targets.push(z);
        if (!targets.length) return;
        for (const v of from) for (const q of v.veh) {
          if (!q.alive) continue; q.rl = (q.rl ?? R() * 4) - dt;
          if (!q.tg || !q.tg.alive || R() < dt * .08) { let best = null, bd = 1e9; for (let k = 0; k < 4; k++) { const z = targets[Math.floor(R() * targets.length)]; const dd = Math.hypot(z.x - q.x, z.y - q.y); if (dd < bd) { bd = dd; best = z; } } q.tg = best; }
          const tq = q.tg; q.aim = Math.atan2(tq.y - q.y, tq.x - q.x);
          if (q.rl > 0) continue;
          const still = Math.abs(q.sp) < 4 / cam.s;
          if (q.t === 'tank' && (!still || q.aimErr > .07 || (!isAtt && (q.peek ?? 1) < .9) || q.moving)) continue;
          if (q.t === 'bmp' && (q.moving || Math.abs(Math.atan2(Math.sin(q.aim - q.h), Math.cos(q.aim - q.h))) > .9)) continue;
          fire(q, tq, v.d);
        }
        // المشاة النازلين من المدرعات وبالخنادق يرمون رشقات
        for (const v of from) for (const q of v.veh) if (q.alive && ((q.t === 'bmp' && q.dis > .8) || (q.t === 'truck' && v.d.kind === 'inf')) && R() < dt * .7) { const z = targets[Math.floor(R() * targets.length)]; const ox = q.x + Math.cos(q.trot) * 10 / cam.s, oy = q.y + Math.sin(q.trot) * 10 / cam.s; for (let i = 0; i < 3; i++) shots.push({ k: 'mg', x0: ox + (R() - .5) * 8 / cam.s, y0: oy + (R() - .5) * 8 / cam.s, x1: z.x + (R() - .5) * 10 / cam.s, y1: z.y + (R() - .5) * 10 / cam.s, t: -i * .06, dur: .12 }); SND.at('mg', q.x, q.y, .22, .2); }
      };
      shoot(att, def, true); shoot(def, att, false);
    }
    return near;
  };
  const BC = new Map();
  // مدفعية من ورا الخط: صفير ثم انفجار على مواقع العدو
  function artyAt(tg, side) {
    const E = BC.get(tg); const p = E && (side === (WD.battles.get(tg)?.side) ? E[1] : E[0]) || cells[tg].c;
    const x = p[0] + rr(-14, 14) / cam.s, y = p[1] + rr(-14, 14) / cam.s;
    SND.at('whiz', x, y, .35, .4); setTimeout(() => { FX.explode(x, y, 'he', .8); SND.at('boom_mid', x, y, .5, .1); }, 650);
  }
  function fire(q, tq, d) {
    const miss = () => [tq.x + (R() - .5) * 3 / cam.s * 8, tq.y + (R() - .5) * 3 / cam.s * 8];
    if (q.t === 'tank') { q.rl = rr(6, 10); q.rec = 1; const [ex, ey] = miss(); const hit = R() < (Math.abs(tq.sp || 0) > 3 / cam.s ? .2 : .35); FX.muzzle(q.x + Math.cos(q.aim) * 9 / cam.s, q.y + Math.sin(q.aim) * 9 / cam.s, q.aim); shots.push({ k: 'shell', x0: q.x, y0: q.y, x1: hit ? tq.x : ex, y1: hit ? tq.y : ey, t: 0, dur: .2, end: hit ? 'spark' : 'dirt' }); SND.at('tank', q.x, q.y, .55, .1); }
    else if (q.t === 'bmp') { q.rl = rr(2.5, 4.5); for (let i = 0; i < 5; i++) { const [ex, ey] = miss(); shots.push({ k: 'burst', x0: q.x, y0: q.y, x1: ex, y1: ey, t: -i * .09, dur: .16, end: i === 4 ? 'puff' : null }); } SND.at('can30', q.x, q.y, .35, .1); }
    else if (q.t === 'truck') { q.rl = rr(1.5, 3); }
    else if (q.t === 'grad') { q.rl = rr(16, 24); for (let i = 0; i < 8; i++) { const [ex, ey] = [tq.x + (R() - .5) * 22 / cam.s, tq.y + (R() - .5) * 22 / cam.s]; shots.push({ k: 'rocket', x0: q.x, y0: q.y, x1: ex, y1: ey, t: -i * .14, dur: 1.1, trail: [] }); } SND.at('rocket', q.x, q.y, .6, .3); }
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
      // ساتر ترابي قدّام كل دبابة مدافعة، وخندق قدّام المشاة
      for (const q of v.veh) if (q.alive && q.bx != null) { const [x, y] = w2s(q.bx, q.by); g.save(); g.translate(x, y); g.rotate(v.rot); g.fillStyle = 'rgba(120,96,62,.85)'; g.beginPath(); g.ellipse(0, 0, S * .16, S * .55, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(80,62,40,.6)'; g.beginPath(); g.ellipse(-S * .06, 0, S * .07, S * .45, 0, 0, 7); g.fill(); g.restore(); }
      if (d.kind === 'inf' && v.st && v.st.k !== 'move' && v.base) { const [x, y] = w2s(v.base[0], v.base[1]); const n = Math.min(3, Math.ceil(v.veh.filter(q => q.alive).length / 2)); g.save(); g.translate(x, y); g.rotate(v.rot); g.setLineDash([S * .5, S * .18]); g.strokeStyle = 'rgba(70,55,38,.85)'; g.lineWidth = Math.max(2, S * .14); g.beginPath(); for (let k = -n; k <= n; k++) { const yy = k * S * .55, xx = S * .35 + (k % 2 ? S * .12 : 0); k === -n ? g.moveTo(xx, yy) : g.lineTo(xx, yy); } g.stroke(); g.setLineDash([]); for (let k = -n; k <= n; k++) { g.beginPath(); g.arc(S * .28 + (k % 2 ? S * .12 : 0), k * S * .55, Math.max(1.4, S * .07), 0, 7); g.fillStyle = d.side ? '#5a2a20' : '#1d3557'; g.fill(); } g.restore(); }
      for (const q of v.veh) {
        if (!q.alive) continue; let [x, y] = w2s(q.x, q.y); if (x < -40 || x > innerWidth + 40 || y < -40 || y > innerHeight + 40) continue;
        if (q.rec) { x -= Math.cos(q.aim) * q.rec * S * .12; y -= Math.sin(q.aim) * q.rec * S * .12; }
        if (q.t === 'bmp' && q.dis > .05) for (let k = 0; k < 4; k++) { const off = (k - 1.5) * S * .38, fwd = S * (.55 + .5 * q.dis); const sx = x + Math.cos(q.trot) * fwd * q.dis - Math.sin(q.trot) * off * q.dis, sy = y + Math.sin(q.trot) * fwd * q.dis + Math.cos(q.trot) * off * q.dis; g.beginPath(); g.arc(sx, sy, Math.max(1.4, S * .07), 0, 7); g.fillStyle = d.side ? '#5a2a20' : '#1d3557'; g.fill(); }
        const sz = q.t === 'tank' ? S : q.t === 'bmp' ? S * .9 : S * .8; const n = sprName(d, q.t);
        g.save(); g.translate(x, y);
        g.beginPath(); g.ellipse(0, 0, sz * .44, sz * .3, q.h, 0, 7); g.fillStyle = ring; g.fill();
        g.rotate(q.h); g.drawImage(IMG[n], -sz / 2, -sz / 2, sz, sz);
        if (q.t === 'tank') { g.rotate(q.tur); g.drawImage(IMG[n + '_t'], -sz / 2, -sz / 2, sz, sz); }
        g.restore();
        if (d.kind === 'inf' && q.t === 'truck' && !(v.st && v.st.k !== 'move')) for (let k = 0; k < 5; k++) { const a = k * 1.25 + q.k, rr = sz * (.55 + (k % 2) * .2); g.beginPath(); g.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, Math.max(1.3, sz * .07), 0, 7); g.fillStyle = d.side ? '#5a2a20' : '#1d3557'; g.fill(); }
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
    // المشاعل الحرارية: نقاط ساطعة تطيح ووراها دخان
    if (A.decoys) for (const f of A.decoys) { const [x, y] = w2s(f.x, f.y); if (x < -20 || x > innerWidth + 20 || y < -20 || y > innerHeight + 20) continue; const k = f.t / 2.2; g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, y, 0, x, y, 7); gr.addColorStop(0, `rgba(255,255,230,${1 - k})`); gr.addColorStop(.4, `rgba(255,190,90,${.8 * (1 - k)})`); gr.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.restore(); if (R() < .4) FX.puff(f.x, f.y, 2.5, 2, 'grey', .4, 0, 0, 2); }
    // الطيارات: صفايح Blender بـ54 وضعية (ميلان × أنف)، وظلها على الأرض حسب ارتفاعها
    for (const p of A.planes) {
      if (p.t < 0) continue;
      const [x, y] = w2s(p.x, p.y); if (x < -60 || x > innerWidth + 60 || y < -60 || y > innerHeight + 60) continue;
      const nm = PL[p.type], sh = IMG[nm + '_sheet']; const flip = nm === 'su25'; // صفيحة السوخوي أنفها لليسار
      const bank = flip ? -p.bank : p.bank; const ri = (((Math.round((-bank * 180 / Math.PI + 180) / 20)) % 18) + 18) % 18, pi = p.gam < -.3 ? 0 : p.gam > .3 ? 2 : 1; const fr = pi * 18 + ri;
      const sz = Math.min(52, Math.max(28, cam.s * 14)) * (.85 + .25 * Math.min(1.2, p.alt)); const alt = p.alt * Math.min(26, 6 + cam.s * 5);
      const H = p.h + (flip ? Math.PI : 0), sx = (fr % 8) * 256, sy = Math.floor(fr / 8) * 256;
      g.save(); g.globalAlpha = .28; g.translate(x + alt * .6, y + alt); g.rotate(H); g.filter = 'brightness(0) blur(1.5px)'; g.drawImage(sh, sx, sy, 256, 256, -sz / 2, -sz / 2, sz, sz); g.restore();
      g.save(); g.translate(x, y); g.rotate(H); g.drawImage(sh, sx, sy, 256, 256, -sz / 2, -sz / 2, sz, sz); g.restore();
      g.beginPath(); g.moveTo(x, y - sz * .58); g.lineTo(x - 4, y - sz * .58 - 6); g.lineTo(x + 4, y - sz * .58 - 6); g.closePath(); g.fillStyle = p.side ? '#e0533f' : '#4f8ff0'; g.fill();
      if (p.st === 'fall') { if (R() < .8) FX.puff(p.x, p.y, 6, rr(3, 5), 'black', .6, 0, 0, 2); if (R() < .3) FX.spark(p.x, p.y, 2, 40); }
      else if (p.st === 'roll' && p.v > 8 && R() < .5) FX.puff(p.x - Math.cos(p.h) * 4 / cam.s, p.y - Math.sin(p.h) * 4 / cam.s, 4, 1.2, 'dust', .3, 0, 0, 1.5);
    }
    // الطيار بالمظلة
    for (let i = chutes.length - 1; i >= 0; i--) { const c = chutes[i]; c.t += dt; if (c.t > 14) { chutes.splice(i, 1); continue; } c.x += 1.2 * dt / Math.max(.5, cam.s) * .2; const [x, y] = w2s(c.x, c.y); const k = Math.max(.6, 1.2 - c.t * .04); g.save(); g.translate(x, y); g.strokeStyle = 'rgba(60,60,60,.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-6 * k, -2 * k); g.lineTo(0, 7 * k); g.lineTo(6 * k, -2 * k); g.stroke(); g.fillStyle = c.side ? '#f2efe8' : '#e8f0ff'; g.beginPath(); g.arc(0, -3 * k, 7 * k, Math.PI, 0); g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.stroke(); g.fillStyle = '#333'; g.beginPath(); g.arc(0, 7 * k, 1.6 * k, 0, 7); g.fill(); g.restore(); }
  };
  const chutes = [];
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
    if (e.k === 'eject') { chutes.push({ x: e.x, y: e.y, t: 0, side: e.side }); }
    if (e.k === 'harmlaunch') { SND.at('woosh', e.x, e.y, .7, .2); toast(e.side === ME ? `🚀 F-16 أطلقت صاروخ HARM على رادار ${e.n}` : `⚠️ إيران أطلقت صاروخ مضاد رادار على ${e.n}`, e.side === ME ? 'good' : 'bad'); }
    if (e.k === 'harmhit') { FX.explode(e.x, e.y, 'big', 1.2); FX.burn(e.x, e.y, .9, 60); SND.at('boom_big', e.x, e.y, .9, .1); toast(e.side === ME ? `💥 دمّرنا رادار ${e.n} (معطّل فترة)` : `⚠️ رادار ${e.n} انضرب`, e.side === ME ? 'good' : 'bad'); }
  };
})();
