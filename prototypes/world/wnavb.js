// «العالم» W13 (I-116، D-054): المعركة البحرية القريبة — كل صاروخ ضد السفن وكل اعتراض ينحسب لحاله
// المسافات بالكم، الوقت بالثواني، الارتفاع بالمتر. الأرقام من مصادر مفتوحة (مدى، سرعة، ارتفاع الرادار)، والاحتمالات [تقدير].
// التصميم: docs/features/world-navy-battle.md · فحص: node tests/wnavb.test.mjs
(function (root) {
  'use strict';
  // السفن: الطول (كم)، المتانة (عدد إصابات C-802 للغرق تقريباً)، ارتفاع الرادار (م)، قنوات الاعتراض، مخازن،
  // q = جودة منظومة الدفاع (أيجس 1، الحاملة 0.9، الفرقاطة العامة 0.6 لأن أغلبها كورفيتات ومنظومات أقدم)، re = وقت التفاعل (ث) من أول ما يشوف التهديد
  const SHIP = {
    // sonar = مدى السونار (كم)، sp = احتمال يكشف الغواصة كل ثانية داخل المدى، asw = طوربيدات/صواريخ ضد الغواصات [تقدير من مصادر مفتوحة]
    cv:  { n: 'حاملة طائرات', L: .333, hp: 8, radar: 30, ch: 2, sm2: 0, essm: 16, ciws: 3, chaff: 6, q: .9, re: 6 },
    dd:  { n: 'مدمرة', L: .155, hp: 3, radar: 22, ch: 4, sm2: 56, essm: 24, ciws: 1, chaff: 6, q: 1, re: 4, sonar: 10, sp: .05, asw: 6 },
    ff:  { n: 'فرقاطة', L: .135, hp: 2, radar: 16, ch: 1, sm2: 0, essm: 8, ciws: 1, chaff: 4, q: .6, re: 12, sonar: 8, sp: .035, asw: 4 },
    amp: { n: 'سفينة إنزال', L: .257, hp: 4, radar: 18, ch: 1, sm2: 0, essm: 8, ciws: 2, chaff: 4, q: .7, re: 10 },
    fac: { n: 'زورق صواريخ', L: .047, hp: .4, radar: 8, ch: 0, sm2: 0, essm: 0, ciws: 0, chaff: 0 },
    ss:  { n: 'غواصة', L: .07, hp: 2, radar: 0, ch: 0, sm2: 0, essm: 0, ciws: 0, chaff: 0, sub: 1 },
    ssn: { n: 'غواصة نووية', L: .115, hp: 2.5, radar: 0, ch: 0, sm2: 0, essm: 0, ciws: 0, chaff: 0, sub: 1 },
  };
  // الصواريخ: السرعة كم/ث، الارتفاع م، المدى كم، احتمال الإصابة إذا وصل، احتمال التشويش ينخدع
  const MSL = {
    c802:    { n: 'نور / C-802', v: .31, alt: 7, range: 120, pk: .85, decoy: .25, dmg: 1 },
    harpoon: { n: 'هاربون', v: .24, alt: 5, range: 130, pk: .85, decoy: .25, dmg: 1.1 },
    kalibr:  { n: 'كاليبر', v: .27, alt: 10, range: 300, pk: .85, decoy: .2, dmg: 1.6, vt: .85 },   // الطور الأخير (آخر 10 كم) أسرع من الصوت ×2.5
    yj18:    { n: 'YJ-18', v: .27, alt: 8, range: 400, pk: .85, decoy: .2, dmg: 1.6, vt: .9 },
    sm2:     { n: 'SM-2', v: 1.0, alt: 0, range: 150, pk: .65, sam: 1 },
    essm:    { n: 'ESSM', v: 1.2, alt: 0, range: 50, pk: .7, sam: 1 },
    // تحت الماء (uw): الرادار ما يشوفها ولا الاعتراض ولا المدفع؛ بس التشويش الصوتي (Nixie) — الطوربيد الثقيل يكسر ظهر السفينة
    torp:    { n: 'طوربيد ثقيل', v: .028, alt: -30, range: 40, pk: .6, decoy: .3, dmg: 2.6, uw: 1 },
    aswt:    { n: 'طوربيد مضاد للغواصات', v: .022, alt: -30, range: 15, pk: .55, uw: 1, asw: 1 },
  };
  const HOR = (hR, hT) => 4.12 * (Math.sqrt(Math.max(0, hR)) + Math.sqrt(Math.max(0, hT)));   // أفق الرادار (كم)
  const mul = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // تشكيل المجموعة (كم من المركز، المقدمة +x): الحاملة بالنص، المدمرات حواليها، الفرقاطات أبعد، الغواصة قدام
  function formation(s) {
    const out = [], ring = (n, r, a0) => Array.from({ length: n }, (_, i) => [Math.cos(a0 + i * 2 * Math.PI / n) * r, Math.sin(a0 + i * 2 * Math.PI / n) * r]);
    const big = s.cv ? 'cv' : s.amp && !s.dd ? 'amp' : null; if (big) out.push(['cv' === big ? 'cv' : 'amp', 0, 0]);
    const esc = []; for (const k of ['dd', 'ff', 'amp', 'fac']) for (let i = 0; i < (s[k] || 0) - (k === big ? 1 : 0); i++) esc.push(k);
    const fac = esc.filter(k => k === 'fac'), sur = esc.filter(k => k !== 'fac');
    ring(sur.length, big ? 3.5 : 1.8, Math.PI / 4).forEach((p, i) => out.push([sur[i], p[0], p[1]]));
    ring(Math.min(fac.length, 15), 1.2 + fac.length * .08, 0).forEach((p, i) => out.push(['fac', p[0], p[1]]));
    for (const k of ['ssn', 'ss']) for (let i = 0; i < (s[k] || 0); i++) out.push([k, 9 + i * 2, (i - .5) * 3]);
    return out;
  }
  // المشهد: def = مجموعة سفن (s = {cv,dd,...})، att = { from:[x,y] (كم)، n: صواريخ، kind، gap: ثواني بين الإطلاقات }
  function create(def, att, seed = 1) {
    const S = { t: 0, rnd: mul(seed), ships: [], msl: [], ev: [], done: false, stat: { fired: 0, sam: 0, kill: 0, hit: 0, ciws: 0, decoy: 0 } };
    let id = 1;
    for (const [k, x, y] of formation(def.s)) { const T = SHIP[k]; S.ships.push({ id: id++, k, x, y, h: def.h || 0, side: 0, hp: T.hp, sm2: T.sm2, essm: T.essm, ciws: T.ciws ? 1500 * T.ciws : 0, chaff: T.chaff, ch: T.ch, busy: 0, hz: {}, cwT: 0, sunk: 0, burn: 0 }); }
    S.queue = []; const M = MSL[att.kind || 'c802'];
    for (let i = 0; i < att.n; i++) S.queue.push({ t: i * (att.gap ?? 2.5) + S.rnd() * .8, x: att.from[0] + (S.rnd() - .5) * (att.spread || 4), y: att.from[1] + (S.rnd() - .5) * (att.spread || 4), kind: att.kind || 'c802' });
    // غواصات العدو: وصلت بصمت لـ~10 كم (المعركة تبدي من هنا)، تطلق طوربيدين بعد 15–30 ث، وبعدين تنسحب
    S.subs = []; for (let i = 0; i < (att.subs || 0); i++) S.subs.push({ id: id++, x: 10 + (S.rnd() - .5) * 2, y: (i - (att.subs - 1) / 2) * 3, st: 'in', det: 0, tp: 2, t0: 15 + S.rnd() * 15 });
    for (const s of S.ships) s.asw = SHIP[s.k].asw || 0;
    S.stat.torp = 0; S.stat.subKill = 0;
    S.att = att; S.M = M; S.nid = id; return S;
  }
  const alive = S => S.ships.filter(s => !s.sunk);
  function pickTarget(S, m) {   // الباحث يختار أكبر صدى رادار قريب من خط الطيران (الحاملة أكثر)
    const L = alive(S).filter(s => !SHIP[s.k].sub); if (!L.length) return null;
    const w = s => SHIP[s.k].L * (s.k === 'cv' ? 2.5 : 1) / (1 + D(s, m) / 60);
    let tot = L.reduce((t, s) => t + w(s), 0), r = S.rnd() * tot; for (const s of L) { r -= w(s); if (r <= 0) return s; } return L[0];
  }
  function launch(S, q) {
    const m = { id: S.nid++, kind: q.kind, x: q.x, y: q.y, alt: 30, side: 1, tgt: null, st: 'fly', eng: 0, t0: S.t };
    m.tgt = pickTarget(S, m); if (!m.tgt) return; S.msl.push(m); S.stat.fired++; S.ev.push({ t: S.t, k: 'launch', x: m.x, y: m.y, kind: m.kind });
  }
  // الغواصات: تتقدم، السونار يكشفها، السفن تطلق عليها، واللي توصل تطلق طوربيدات
  function subs(S, dt) {
    for (const u of S.subs) { if (u.st === 'dead' || u.st === 'gone') continue;
      const L = alive(S).filter(s => !SHIP[s.k].sub); if (!L.length) { u.st = 'gone'; continue; }
      const c = L.reduce((a, s) => [a[0] + s.x / L.length, a[1] + s.y / L.length], [0, 0]), d = Math.hypot(c[0] - u.x, c[1] - u.y);
      if (u.st === 'in') { const v = .0077 * dt; u.x += (c[0] - u.x) / d * v; u.y += (c[1] - u.y) / d * v;   // 15 عقدة
        if (S.t >= u.t0 && u.tp > 0) { u.st = 'out'; for (; u.tp > 0; u.tp--) { const m = { id: S.nid++, kind: 'torp', x: u.x, y: u.y, alt: -30, side: 1, tgt: null, st: 'fly', eng: 0, t0: S.t };
          m.tgt = pickTarget(S, m); if (m.tgt) { S.msl.push(m); S.stat.torp++; S.ev.push({ t: S.t, k: 'tlaunch', x: u.x, y: u.y, kind: 'torp' }); } } } }
      else { const v = .0077 * dt; u.x -= (c[0] - u.x) / d * v; u.y -= (c[1] - u.y) / d * v; if (d > 22) u.st = 'gone'; }
      // السونار: كل سفينة عندها سونار تكشفها بالمدى، وأول ما تنكشف تطلق طوربيد ضد الغواصات (واحد بكل مرة)
      for (const s of L) { const T = SHIP[s.k]; if (!T.sonar || D(s, u) > T.sonar) continue;
        if (!u.det && S.rnd() < T.sp * dt) { u.det = S.t; S.ev.push({ t: S.t, k: 'sonar', x: u.x, y: u.y, by: s.k }); }
        if (u.det && s.asw > 0 && !S.msl.some(m => m.kind === 'aswt' && m.tgt === u)) { s.asw--; S.msl.push({ id: S.nid++, kind: 'aswt', x: s.x, y: s.y, alt: -30, side: 0, tgt: u, st: 'fly', t0: S.t }); S.ev.push({ t: S.t, k: 'asw', x: s.x, y: s.y, by: s.k }); } } }
  }
  // الدفاع: كل سفينة تشوف التهديدات بأفقها، وتطلق SM-2 بعيد ثم ESSM، والمدفع للأخير، والتشويش قريب
  function defend(S, dt) {
    const threats = S.msl.filter(m => m.side === 1 && m.st === 'fly' && !MSL[m.kind].uw);   // الرادار ما يشوف تحت الماء
    for (const s of alive(S)) {
      const T = SHIP[s.k]; if (!T.radar) continue;
      // الأفق محسوب مرة وحدة لكل ارتفاع (الصواريخ ضد السفن ارتفاعها ثابت تقريباً)؛ القنوات تنحسب بالعداد (busy) مو بالبحث
      const seen = []; for (const m of threats) { const d = D(s, m); if (d < (s.hz[m.kind] ??= HOR(T.radar, MSL[m.kind].alt))) { m._d = d; seen.push(m); } } seen.sort((a, b) => a._d - b._d);
      for (const m of seen) { m.seenAt = m.seenAt || {}; if (m.seenAt[s.id] == null) m.seenAt[s.id] = S.t; }
      for (const m of seen) {
        if (s.busy >= T.ch) break; const d = m._d; if (S.t - m.seenAt[s.id] < (T.re || 5)) continue;   // التعقب والتفاعل
        if (m.eng >= 2 && d > 6) continue;   // أطلق-شوف-أطلق: صاروخين لكل تهديد
        const kind = s.sm2 > 0 && d > 18 ? 'sm2' : s.essm > 0 && d > 3 ? 'essm' : null; if (!kind) continue;
        if (kind === 'sm2') s.sm2--; else s.essm--; m.eng++; s.busy++; S.stat.sam++;
        S.msl.push({ id: S.nid++, kind, x: s.x, y: s.y, alt: 20, side: 0, tgt: m, from: s.id, ship: s, st: 'fly', t0: S.t, boost: 1.2, q: T.q || 1 });
        S.ev.push({ t: S.t, k: 'samlaunch', x: s.x, y: s.y, kind, by: s.k });
      }
      // المدفع (فالانكس): رشقة كل ثانية على أقرب تهديد تحت 1.5 كم
      if (s.ciws > 0 && (s.cwT -= dt) <= 0) { const m = seen.find(q => q._d < 1.5 && q.st === 'fly'); if (m) { s.cwT = 1; s.ciws -= 75; S.stat.ciws++; S.ev.push({ t: S.t, k: 'ciws', x: s.x, y: s.y, tx: m.x, ty: m.y });
        if (S.rnd() < .45 * (T.q || 1)) { m.st = 'dead'; S.stat.kill++; S.ev.push({ t: S.t, k: 'kill', x: m.x, y: m.y, by: 'ciws' }); } } }
      // التشويش: لما تهديد يقرب لـ5 كم
      if (s.chaff > 0) for (const m of seen) if (m.tgt === s && m._d < 5 && !m.chaffed) { m.chaffed = 1; s.chaff--; S.ev.push({ t: S.t, k: 'chaff', x: s.x, y: s.y }); if (S.rnd() < MSL[m.kind].decoy) { m.st = 'decoy'; m.dx = s.x + (S.rnd() - .5) * 2; m.dy = s.y + (S.rnd() - .5) * 2; S.stat.decoy++; } }
    }
  }
  function step(S, dt = .25) {
    if (S.done) return S; S.t += dt;
    while (S.queue.length && S.queue[0].t <= S.t) launch(S, S.queue.shift());
    if (S.subs.length) subs(S, dt);
    defend(S, dt);
    for (const m of S.msl) { if (m.st !== 'fly' && m.st !== 'decoy') continue; const M = MSL[m.kind];
      if (m.side === 1) {   // صاروخ ضد السفن: يصعد شوية ويطير واطي، وآخر 10 كم أسرع إذا عنده طور أخير
        if (!m.tgt || m.tgt.sunk) m.tgt = pickTarget(S, m); if (!m.tgt) { m.st = 'dead'; continue; }
        const tx = m.st === 'decoy' ? m.dx : m.tgt.x, ty = m.st === 'decoy' ? m.dy : m.tgt.y, d = Math.hypot(tx - m.x, ty - m.y), v = (M.vt && d < 10 ? M.vt : M.v) * dt;
        m.alt = Math.max(M.alt, m.alt - 4 * dt); m.h = Math.atan2(ty - m.y, tx - m.x);
        // الخداع الصوتي (Nixie): السفينة اللي عندها خداع تسحب الطوربيد لما يقرب لـ3 كم
        if (M.uw && m.st === 'fly' && d < 3 && !m.chaffed && m.tgt.chaff > 0) { m.chaffed = 1; m.tgt.chaff--; S.ev.push({ t: S.t, k: 'nixie', x: m.tgt.x, y: m.tgt.y }); if (S.rnd() < M.decoy) { m.st = 'decoy'; m.dx = m.tgt.x + (S.rnd() - .5) * 2; m.dy = m.tgt.y + (S.rnd() - .5) * 2; S.stat.decoy++; continue; } }
        if (d <= v) { m.x = tx; m.y = ty;
          if (m.st === 'decoy') { m.st = 'dead'; S.ev.push({ t: S.t, k: 'splash', x: m.x, y: m.y }); continue; }
          m.st = 'dead'; if (S.rnd() < M.pk) { const s = m.tgt; s.hp -= M.dmg * (.7 + S.rnd() * .6); s.burn = Math.min(1, s.burn + .35); S.stat.hit++; S.ev.push({ t: S.t, k: 'hit', x: m.x, y: m.y, ship: s.id, sk: s.k });
            if (m.kind === 'torp') S.ev[S.ev.length - 1].torp = 1;
            if (s.hp <= 0 && !s.sunk) { s.sunk = S.t; S.ev.push({ t: S.t, k: 'sink', x: s.x, y: s.y, ship: s.id, sk: s.k }); } }
          else S.ev.push({ t: S.t, k: 'splash', x: m.x, y: m.y }); continue; }
        m.x += Math.cos(m.h) * v; m.y += Math.sin(m.h) * v;
      } else if (m.kind === 'aswt') {   // طوربيد ضد الغواصة: يلاحقها؛ إذا انسحبت بعيد يخلص وقوده
        const u = m.tgt; if (!u || u.st === 'dead' || u.st === 'gone') { m.st = 'dead'; continue; } const d = D(m, u), v = M.v * dt;
        if ((S.t - m.t0) * M.v > M.range) { m.st = 'dead'; S.ev.push({ t: S.t, k: 'miss', x: m.x, y: m.y, by: 'aswt' }); continue; }
        if (d <= v + .05) { m.st = 'dead'; if (S.rnd() < M.pk) { u.st = 'dead'; S.stat.subKill++; S.ev.push({ t: S.t, k: 'subkill', x: u.x, y: u.y }); } else S.ev.push({ t: S.t, k: 'miss', x: u.x, y: u.y, by: 'aswt' }); continue; }
        m.h = Math.atan2(u.y - m.y, u.x - m.x); m.x += Math.cos(m.h) * v; m.y += Math.sin(m.h) * v;
      } else {   // اعتراض: ملاحقة بالتوجيه للنقطة المتوقعة؛ الصاروخ الواطي فوق الماء أصعب (صدى البحر ×0.75)
        const T = m.tgt; if (!T || T.st !== 'fly' && T.st !== 'decoy') { m.st = 'dead'; continue; }
        const d = D(m, T), tt = d / M.v, vT = MSL[T.kind].v, px = T.x + Math.cos(T.h || 0) * vT * tt * .9, py = T.y + Math.sin(T.h || 0) * vT * tt * .9;
        m.h = Math.atan2(py - m.y, px - m.x); const v = M.v * dt * (m.boost && S.t - m.t0 < 3 ? .5 : 1);
        if ((S.t - m.t0) * M.v > M.range) { m.st = 'dead'; continue; }
        if (d <= v + .15) { m.st = 'dead'; if (S.rnd() < M.pk * (m.q || 1) * (T.alt < 15 ? .75 : 1)) { T.st = 'dead'; S.stat.kill++; S.ev.push({ t: S.t, k: 'kill', x: T.x, y: T.y, by: m.kind }); } else S.ev.push({ t: S.t, k: 'miss', x: T.x, y: T.y, by: m.kind }); continue; }
        m.x += Math.cos(m.h) * v; m.y += Math.sin(m.h) * v; m.alt = Math.min(15000, m.alt + 400 * dt);
      } }
    for (const m of S.msl) if (m.side === 0 && m.st === 'dead' && m.ship && !m.rel) { m.rel = 1; m.ship.busy--; }
    S.msl = S.msl.filter(m => m.st === 'fly' || m.st === 'decoy');
    if (!S.queue.length && !S.msl.length && !S.subs.some(u => u.st === 'in' || u.st === 'out')) S.done = true;
    return S;
  }
  function run(S, maxT = 900, dt = .25) { while (!S.done && S.t < maxT) step(S, dt); return S; }
  // النتيجة للأسطول: كم قطعة غرقت من كل نوع، والضرر
  function result(S) { const sunk = {}; for (const s of S.ships) if (s.sunk) sunk[s.k] = (sunk[s.k] || 0) + 1; return { sunk, stat: S.stat, subLost: S.subs.filter(u => u.st === 'dead').length, dmg: S.ships.filter(s => !s.sunk).reduce((t, s) => t + (SHIP[s.k].hp - s.hp), 0) }; }
  function resolve(def, att, seed, dt = .25) { return result(run(create(def, att, seed), 900, dt)); }
  const API = { SHIP, MSL, HOR, formation, create, step, run, result, resolve };
  if (typeof module !== 'undefined') module.exports = API; else root.WNAVB = API;
})(this);
