// مشهد المعركة (WD6، I-079): بدل أرقام وتقرير، تشوف المعركة نفسها بصور حقيقية من فوق (من مجسمات Blender الحقيقية):
// دبابات وبرجها يلف، مدرعات، حضائر مشاة، مدفعية ورا، طيارات تمر وتقصف؛ طلقات وانفجارات، والآلية اللي تنضرب تحترگ وتصير حطام،
// والعدادات تنزل قدامك. الخسائر نفسها اللي حسبتها معادلة المعركة (مو عشوائية).
'use strict';
const BattleScene = (() => {
  const IM = {}; ['abrams', 'abrams_t', 't72', 't72_t', 'bmp', 'grad', 'truck', 'f16', 'su25', 'f14', 'land_a', 'land_b'].forEach(n => { const i = new Image(); i.src = `img/${n}.webp`; IM[n] = i; });
  let el, cv, g, W, H, raf, T, last, E, ents, fx, shots, done, opt, speed = 1, ended;
  const R = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  function ui() {
    if (el) return; el = document.createElement('div'); el.id = 'battle'; el.innerHTML = `<canvas></canvas>
      <div class="bt top"><div class="side" id="bsD"></div></div><div class="bt title" id="bTitle"></div>
      <div class="bt bot"><div class="side" id="bsA"></div><div class="res" id="bRes"></div><div class="bwhy" id="bWhy"></div>
      <div class="btns"><button id="bSkip">⏭ تخطّي</button><button id="bFast">×1</button><button id="bOk" class="go" hidden>تمام ▶</button></div></div>`;
    document.body.appendChild(el); cv = el.querySelector('canvas'); g = cv.getContext('2d');
    el.querySelector('#bSkip').onclick = () => { T = 11.5; };
    el.querySelector('#bFast').onclick = e => { speed = speed === 1 ? 2 : 1; e.target.textContent = `×${speed}`; };
    el.querySelector('#bOk').onclick = close;
    const st = document.createElement('style'); st.textContent = `
#battle{position:fixed;inset:0;z-index:9;background:#2a2620}#battle canvas{position:absolute;inset:0;width:100%;height:100%}
#battle .bt{position:absolute;inset-inline:0;padding:8px 12px;color:#fff;text-shadow:0 1px 3px #000;font-family:"IBM Plex Sans Arabic",sans-serif}
#battle .top{top:0;background:linear-gradient(rgba(0,0,0,.75),transparent);padding-bottom:26px}#battle .bot{bottom:0;background:linear-gradient(transparent,rgba(0,0,0,.85) 30%);padding-top:30px;padding-bottom:calc(10px + env(safe-area-inset-bottom,0))}
#battle .title{top:96px;text-align:center;font:700 18px "Reem Kufi","IBM Plex Sans Arabic",sans-serif;padding:2px}
#battle .side{display:flex;align-items:center;gap:8px;font-size:13px;flex-wrap:wrap}#battle .side .f{font-size:22px}#battle .side b{font-size:14px}
#battle .side .c{background:rgba(255,255,255,.14);border-radius:8px;padding:1px 8px;font-variant-numeric:tabular-nums}#battle .side .c.dn{background:rgba(220,70,50,.55)}
#battle .side .sb{flex:1 1 100%;height:7px;background:rgba(255,255,255,.2);border-radius:4px;overflow:hidden}#battle .side .sb i{display:block;height:100%;background:#52c46a;transition:width .3s}
#battle .res{font:700 18px "Reem Kufi","IBM Plex Sans Arabic",sans-serif;text-align:center;margin:6px 0 2px;min-height:26px}
#battle .bwhy{font-size:12.5px;line-height:1.7;min-height:20px}#battle .bwhy .p{color:#8fd0ff}#battle .bwhy .n{color:#ff9a8a}
#battle .btns{display:flex;gap:8px;justify-content:center;margin-top:6px}#battle .btns button{min-height:42px;padding:6px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.12);color:#fff;font:600 14px "IBM Plex Sans Arabic",sans-serif}#battle .btns .go{background:#b8871e;border-color:#b8871e}`;
    document.head.appendChild(st);
  }
  // ---------- الأرض حسب نوعها ----------
  let ground;
  function makeGround(terr, city, dug) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const tex = terr === 'marsh' || terr === 'mount' ? IM.land_b : IM.land_a; const pat = x.createPattern(tex, 'repeat'); x.fillStyle = pat; x.fillRect(0, 0, W, H);
    const tint = { desert: 'rgba(230,200,140,.30)', plain: 'rgba(200,180,120,.18)', hills: 'rgba(150,130,90,.25)', mount: 'rgba(90,80,70,.35)', marsh: 'rgba(80,120,90,.25)', city: 'rgba(170,160,140,.25)' }[terr] || 'rgba(0,0,0,0)';
    x.fillStyle = 'rgba(255,245,220,.28)'; x.fillRect(0, 0, W, H); x.fillStyle = tint; x.fillRect(0, 0, W, H);
    if (terr === 'marsh') for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(60,110,140,${R(.35, .6)})`; x.beginPath(); x.ellipse(R(0, W), R(0, H), R(20, 70), R(10, 30), R(0, 3), 0, 7); x.fill(); x.strokeStyle = 'rgba(90,120,60,.6)'; for (let k = 0; k < 14; k++) { const a = R(0, W), b = R(0, H); x.beginPath(); x.moveTo(a, b); x.lineTo(a + R(-3, 3), b - R(6, 14)); x.stroke(); } }
    if (terr === 'mount' || terr === 'hills') for (let i = 0; i < (terr === 'mount' ? 40 : 18); i++) { const a = R(0, W), b = R(0, H), r = R(25, 80), gr = x.createRadialGradient(a - r * .3, b - r * .3, 2, a, b, r); gr.addColorStop(0, 'rgba(255,240,210,.25)'); gr.addColorStop(.6, 'rgba(90,75,55,.25)'); gr.addColorStop(1, 'rgba(60,50,40,0)'); x.fillStyle = gr; x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }
    if (city) { for (let i = 0; i < 70; i++) { const a = R(0, W), b = R(H * .05, H * .38), s = R(10, 22); x.fillStyle = `rgba(${R(170, 220)},${R(160, 205)},${R(140, 180)},.95)`; x.fillRect(a, b, s, s * R(.7, 1.2)); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(a + 3, b + s * .9, s, 3); } }
    // طرق ترابية
    x.strokeStyle = 'rgba(120,100,70,.35)'; x.lineWidth = 10; x.beginPath(); x.moveTo(W * R(.3, .7), H); x.bezierCurveTo(W * R(.2, .8), H * .6, W * R(.2, .8), H * .4, W * R(.3, .7), 0); x.stroke();
    // سواتر المدافع (إذا متحصن)
    if (dug > .25) { x.strokeStyle = 'rgba(110,85,55,.95)'; x.lineWidth = 7; x.lineCap = 'round'; for (let i = 0; i < 9; i++) { const a = W * (i + .5) / 9 + R(-10, 10), b = H * .36 + R(-8, 8); x.beginPath(); x.arc(a, b - 14, 22, .35, 2.8); x.stroke(); } }
    ground = c;
  }
  // ---------- الكيانات: كل أيقونة تمثل عدد ----------
  function build(side, u, top) {
    const out = [], y0 = top ? H * .25 : H * .74, dir = top ? 1 : -1, tkSpr = u.gen >= 3 && side === 0 ? 'abrams' : side === 0 && u.gen >= 3.5 ? 'abrams' : 't72';
    const nTk = Math.min(12, Math.round(u.tk / 9)), nIfv = Math.min(8, Math.round(u.ifv / 14)), nInf = Math.min(14, Math.max(1, Math.round(u.men / 900))), nGun = Math.min(5, Math.round(u.gun / 12));
    const row = (n, y, type, sp) => { for (let i = 0; i < n; i++) out.push({ side, type, spr: sp, x: W * (i + .5) / n + R(-10, 10), y: y + R(-8, 8), rot: dir * Math.PI / 2 + R(-.12, .12), tur: 0, alive: true, die: 1e9, wreck: false, cd: R(.2, 2.5), adv: 0 }); };
    row(nTk, y0 + dir * -30, 'tank', tkSpr); row(nIfv, y0, 'ifv', 'bmp'); row(nInf, y0 + dir * 26, 'inf', null); row(nGun, y0 + dir * 120, 'gun', 'grad');
    return out;
  }
  function sched(list, kills) { const alive = list.filter(e => e.type === kills.type); const k = Math.min(alive.length, kills.n); const sh = alive.sort(() => Math.random() - .5).slice(0, k); sh.forEach((e, i) => e.die = 2.2 + (i + R(0, .9)) * 7 / Math.max(1, k)); }
  // ---------- التشغيل ----------
  function play(o, cb) {
    ui(); opt = o; done = cb; el.hidden = false; ended = false; speed = 1; el.querySelector('#bFast').textContent = '×1';
    const dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    makeGround(o.terr, o.city, o.dug);
    const A = build(o.att.side, o.att.b, false), D = build(o.def.side, o.def.b, true); ents = [...A, ...D]; fx = []; shots = [];
    // الخسائر من نتيجة المعادلة: كم أيقونة تنضرب
    const k = (b, a, per) => Math.round((b - a) / per);
    for (const [L, s] of [[A, o.att], [D, o.def]]) { sched(L, { type: 'tank', n: k(s.b.tk, s.a.tk, 9) }); sched(L, { type: 'ifv', n: k(s.b.ifv, s.a.ifv, 14) }); sched(L, { type: 'inf', n: k(s.b.men, s.a.men, 900) }); sched(L, { type: 'gun', n: k(s.b.gun, s.a.gun, 12) }); }
    E = { jets: [] }; for (const [s, n] of [[o.att.side, o.air?.att || 0], [o.def.side, o.air?.def || 0]]) for (let i = 0; i < n; i++) E.jets.push({ side: s, t0: R(.3, 4), x: R(W * .2, W * .8), spr: s === 0 ? (i % 2 ? 'su25' : 'f16') : 'f14', bombed: false, att: s === o.att.side });
    T = 0; last = performance.now(); el.querySelector('#bOk').hidden = true; el.querySelector('#bRes').textContent = ''; el.querySelector('#bWhy').innerHTML = '';
    el.querySelector('#bTitle').textContent = `⚔ ${o.title}`; panels(0); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  const cnt = (b, a, k) => Math.round(b + (a - b) * k);
  function panels(k) {
    for (const [id, s] of [['#bsD', opt.def], ['#bsA', opt.att]]) { const kk = Math.min(1, k), str = (cnt(s.b.men, s.a.men, kk) / s.b.men0) * .5 + (s.b.tk0 ? cnt(s.b.tk, s.a.tk, kk) / s.b.tk0 : 1) * .5;
      el.querySelector(id).innerHTML = `<span class="f">${SIDE[s.side].f}</span><b>${s.name}</b>${s.b.tk >= 1 ? `<span class="c ${kk > 0 && s.a.tk < s.b.tk ? 'dn' : ''}">🛡 ${cnt(s.b.tk, s.a.tk, kk)} دبابة</span>` : ''}${s.b.ifv >= 1 ? `<span class="c">🚙 ${cnt(s.b.ifv, s.a.ifv, kk)} مدرعة</span>` : ''}<span class="c ${kk > 0 && s.a.men < s.b.men ? 'dn' : ''}">👥 ${fmt(cnt(s.b.men, s.a.men, kk))} جندي</span><span class="sb"><i style="width:${Math.round(clamp(str, 0, 1) * 100)}%;background:${str > .66 ? '#52c46a' : str > .4 ? '#e3b53a' : '#d9503e'}"></i></span>`; }
  }
  function boom(x, y, s = 1) { fx.push({ k: 'flash', x, y, t: 0, life: .18, s }); fx.push({ k: 'fire', x, y, t: 0, life: .7, s }); for (let i = 0; i < 5; i++) fx.push({ k: 'smoke', x: x + R(-6, 6) * s, y: y + R(-6, 6) * s, vx: R(-6, 6), vy: R(-14, -4), t: 0, life: R(1.5, 3), s: s * R(.8, 1.4) }); }
  function loop(now) {
    const dt = Math.min(.05, (now - last) / 1000) * speed; last = now; T += dt; step(dt); draw(); if (!ended) raf = requestAnimationFrame(loop);
  }
  function step(dt) {
    const A = opt.att.side, win = opt.res === 'take';
    for (const e of ents) {
      if (!e.alive) { if (e.wreck && Math.random() < dt * 3) fx.push({ k: 'smoke', x: e.x + R(-4, 4), y: e.y, vx: R(-3, 3), vy: R(-16, -8), t: 0, life: R(2, 3.5), s: 1.1, dark: true }); continue; }
      if (T >= e.die) { e.alive = false; e.wreck = e.type !== 'inf'; boom(e.x, e.y, e.type === 'tank' ? 1.3 : e.type === 'inf' ? .6 : 1); if (e.type !== 'inf' && typeof SND !== 'undefined') SND.boom(.12); continue; }
      // التقدم: المهاجم يتقدم شوي للنص، وبالنهاية الفايز يتقدم والخسران يرجع
      const atk = e.side === A, dir = atk ? -1 : 1;
      if (T < 9.5) { if (atk && e.type !== 'gun' && T > 1.5) e.y += dir * 7 * dt; }
      else if (win) e.y -= 42 * dt;            // نجح الهجوم: المهاجم يتقدم لفوق والمدافع ينسحب لفوق
      else if (atk) e.y += 45 * dt;            // فشل: المهاجم يرجع لتحت
      // الرمي
      e.cd -= dt; if (e.cd <= 0 && T > .6 && T < 10) { const foes = ents.filter(q => q.alive && q.side !== e.side); if (foes.length) { const t = pick(foes), kind = e.type === 'gun' ? 'arc' : e.type === 'inf' ? 'mg' : 'shell';
        if (e.type === 'tank') e.tur = Math.atan2(t.y - e.y, t.x - e.x) - e.rot;
        shots.push({ x: e.x, y: e.y, tx: t.x + R(-14, 14), ty: t.y + R(-14, 14), t: 0, life: kind === 'arc' ? 1.1 : kind === 'mg' ? .18 : .22, kind }); if (kind !== 'mg') fx.push({ k: 'flash', x: e.x, y: e.y, t: 0, life: .1, s: .6 }); }
        e.cd = e.type === 'inf' ? R(.15, .6) : e.type === 'gun' ? R(1.2, 2.4) : R(1.2, 3); }
    }
    for (const s of shots) { s.t += dt; if (s.t >= s.life && !s.hit) { s.hit = true; if (s.kind !== 'mg') boom(s.tx, s.ty, s.kind === 'arc' ? 1.1 : .55); } }
    shots = shots.filter(s => s.t < s.life + .05);
    for (const j of E.jets) if (T > j.t0) { j.y = j.att ? H + 60 - (T - j.t0) * 520 : -60 + (T - j.t0) * 520; if (!j.bombed && (j.att ? j.y < H * .32 : j.y > H * .7)) { j.bombed = true; for (let i = 0; i < 4; i++) setTimeout(() => boom(j.x + R(-40, 40), (j.att ? H * .25 : H * .74) + R(-30, 30), 1.6), i * 90 / speed); if (typeof SND !== 'undefined') SND.boom(.3); } }
    for (const f of fx) { f.t += dt; if (f.vx !== undefined) { f.x += f.vx * dt; f.y += f.vy * dt; } } fx = fx.filter(f => f.t < f.life);
    panels(clamp((T - 1.5) / 8, 0, 1));
    if (T > 10.4 && !ended && !el.querySelector('#bRes').textContent) result();
    if (T > 12.5) { ended = true; draw(); }
  }
  function result() {
    const o = opt, me = o.me, mine = o.att.side === me, win = o.res === 'take';
    const txt = win ? (mine ? '🏆 نجح هجومنا — العدو انسحب' : '💔 العدو اخترق — انسحبنا') : o.res === 'push' ? (mine ? 'تقدمنا شوية بس ما كسرناهم' : 'صمدنا بصعوبة') : (mine ? '❌ هجومنا انصد' : '🛡 صدّينا الهجوم');
    el.querySelector('#bRes').textContent = txt; el.querySelector('#bRes').style.color = (win === mine) && o.res !== 'push' ? '#8fe0a0' : o.res === 'push' ? '#ffe08a' : '#ff9a8a';
    // ليش؟ بكلام بسيط: أكبر 3 عوامل
    const NAMES = { 'العدد والمعدات والجيل': 'العدد والسلاح والجيل', 'الأرض': `الأرض (${o.city ? 'مدينة' : TERR[o.terr]?.n || ''})`, 'التحصين': 'تحصين المدافع', 'الجو والصواريخ': 'الطيران والصواريخ', 'الإمداد': 'الإمداد', 'الأجناب': 'الهجوم من أكثر من جهة', 'العاصمة': 'دفاع العاصمة' };
    const e = Object.entries(o.f || {}).filter(([k]) => k !== 'الحظ').map(([k, v]) => [k, Math.log(v)]).filter(([, v]) => Math.abs(v) > .05).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3);
    el.querySelector('#bWhy').innerHTML = e.length ? '<b>ليش؟</b>' + e.map(([k, v]) => { const good = v > 0 ? o.att.side : o.def.side; return `<div class="${good === me ? 'p' : 'n'}">• ${NAMES[k] || k} لصالح ${SIDE[good].f} ${SIDE[good].n} (×${Math.exp(Math.abs(v)).toFixed(1)})</div>`; }).join('') : '';
    el.querySelector('#bOk').hidden = false;
  }
  function close() { ended = true; cancelAnimationFrame(raf); el.hidden = true; const f = done; done = null; f && f(); }
  // ---------- الرسم ----------
  function sprite(n, x, y, rot, s, alpha = 1) { const im = IM[n]; if (!im || !im.complete) return; g.save(); g.globalAlpha = alpha; g.translate(x, y); g.rotate(rot); g.drawImage(im, -s / 2, -s / 2, s, s); g.restore(); }
  function draw() {
    g.drawImage(ground, 0, 0, W, H);
    const S = Math.min(W, H) / 5.2;   // حجم صورة الآلية (الصورة بيها فراغ حوالينها)
    // حطام أول (تحت)
    for (const e of ents) if (e.wreck) { g.save(); g.filter = 'brightness(.25) saturate(.3)'; sprite(e.spr, e.x, e.y, e.rot + .4, e.type === 'gun' ? S * .85 : S, .95); g.restore(); }
    for (const e of ents) { if (!e.alive) continue;
      if (e.type === 'inf') { // حضيرة: 5 جنود صغار
        for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28 + e.x, x = e.x + Math.cos(a) * 9, y = e.y + Math.sin(a) * 6; g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(x + 2, y + 2, 4, 3, 0, 0, 7); g.fill(); g.fillStyle = e.side === opt.me ? '#3b4a2a' : '#5a4a30'; g.beginPath(); g.ellipse(x, y, 4, 3.2, e.rot, 0, 7); g.fill(); g.fillStyle = e.side === opt.me ? '#56663a' : '#7a6442'; g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); } continue; }
      const s = e.type === 'gun' ? S * .85 : e.type === 'ifv' ? S * .9 : S; sprite(e.spr, e.x, e.y, e.rot, s);
      if (e.type === 'tank') sprite(e.spr + '_t', e.x, e.y, e.rot + e.tur, s);
      // علم صغير للتمييز: إطار ملون حوالين الآلية
      g.fillStyle = e.side === opt.me ? 'rgba(70,140,235,.9)' : 'rgba(225,70,55,.9)'; g.beginPath(); g.arc(e.x - s * .22, e.y - s * .14, 3.5, 0, 7); g.fill(); }
    // الطلقات
    for (const s of shots) { const k = Math.min(1, s.t / s.life);
      if (s.kind === 'arc') { const x = s.x + (s.tx - s.x) * k, y = s.y + (s.ty - s.y) * k - Math.sin(k * Math.PI) * 60; g.fillStyle = '#ffe2a0'; g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill(); }
      else { const x = s.x + (s.tx - s.x) * k, y = s.y + (s.ty - s.y) * k, bx = s.x + (s.tx - s.x) * Math.max(0, k - .25), by = s.y + (s.ty - s.y) * Math.max(0, k - .25); g.strokeStyle = s.kind === 'mg' ? 'rgba(255,230,140,.8)' : 'rgba(255,200,90,.95)'; g.lineWidth = s.kind === 'mg' ? 1.2 : 2.6; g.beginPath(); g.moveTo(bx, by); g.lineTo(x, y); g.stroke(); } }
    // الطيارات
    for (const j of E.jets) if (T > j.t0 && j.y > -80 && j.y < H + 80) { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(j.x + 30, j.y + 40, 26, 10, 0, 0, 7); g.fill(); sprite(j.spr, j.x, j.y, j.att ? -Math.PI / 2 : Math.PI / 2, S * 1.5); }
    // المؤثرات
    for (const f of fx) { const u = f.t / f.life;
      if (f.k === 'flash') { const r = 16 * f.s * (1 + u); const gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, r); gr.addColorStop(0, `rgba(255,255,230,${1 - u})`); gr.addColorStop(1, 'rgba(255,200,80,0)'); g.fillStyle = gr; g.beginPath(); g.arc(f.x, f.y, r, 0, 7); g.fill(); }
      else if (f.k === 'fire') { const r = 14 * f.s * (.6 + u); g.fillStyle = `rgba(255,${120 + 100 * (1 - u)},40,${.85 * (1 - u)})`; g.beginPath(); g.arc(f.x, f.y, r, 0, 7); g.fill(); }
      else { const r = 9 * f.s * (1 + u * 2); g.fillStyle = f.dark ? `rgba(30,28,26,${.45 * (1 - u)})` : `rgba(120,110,100,${.4 * (1 - u)})`; g.beginPath(); g.arc(f.x, f.y, r, 0, 7); g.fill(); } }
  }
  /** صورة مجمّعة لجيش (عدة فرق) قبل/بعد المعركة */
  function snap(us) { const n = us.length || 1, sum = k => us.reduce((a, u) => a + (u[k] || 0), 0); return { tk: sum('tk'), ifv: sum('ifv'), gun: sum('gun'), men: sum('men'), tk0: sum('tk0'), men0: sum('men0') || 1, gen: us.reduce((a, u) => a + (u.gen || 1), 0) / n }; }
  /** يشغّل مجموعة معارك وحدة ورا الثانية، وبعدين done */
  function queue(list, cb) { const L = list.slice(); const next = () => { const o = L.shift(); if (!o) return cb && cb(); play(o, next); }; next(); }
  return { play, snap, queue, get busy() { return el && !el.hidden; } };
})();
