// «العالم» W12 (I-109، D-053): البحرية الحقيقية — أساطيل تتحرك على شبكة البحار وتتقاتل يومياً
// التصميم: docs/features/world-navy.md · فحص: node tests/wnav.test.mjs
// الأرقام [تقدير] إلا أعداد السفن (IISS، `cs.nv` = [حاملات، مدمرات/طرادات، فرقاطات/كورفيتات، غواصات نووية، غواصات، إنزال، زوارق صواريخ])
(function (root) {
  // v3 C1: طاقم السفن الغارقة ينحسب بالخسائر (wcas.js)
  const CASN = () => root.WCAS || (typeof require !== 'undefined' ? require('./wcas.js') : null);
  'use strict';
  const T = ['cv', 'dd', 'ff', 'ssn', 'ss', 'amp', 'fac'];
  const TN = { cv: 'حاملة طائرات', dd: 'مدمرة', ff: 'فرقاطة', ssn: 'غواصة نووية', ss: 'غواصة', amp: 'سفينة إنزال', fac: 'زورق صواريخ' };
  const PW = { cv: 8, dd: 3, ff: 1.5, ssn: 3.5, ss: 2.5, amp: .5, fac: .6 };          // القوة لكل سفينة
  const SPD = { cv: 550, dd: 600, ff: 550, ssn: 450, ss: 400, amp: 450, fac: 700 };   // كم باليوم
  const SINK = ['fac', 'amp', 'ff', 'ss', 'dd', 'ssn', 'cv'];                          // ترتيب الغرق (الحاملة آخر شي)
  const mul = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const KM = (a, b) => { const R = 6371, r = Math.PI / 180, dLa = (b[1] - a[1]) * r, dLo = (b[0] - a[0]) * r, x = Math.sin(dLa / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  // انتشار حقيقي معروف (تشرين الثاني 2026، حرب إيران) [تقدير]: أول مجموعات أمريكا الضاربة
  const DEP = { USA: ['S115', 'S123', 'S086'] };

  // ===== الشبكة (ثابتة، من البيانات) =====
  let NET = null;
  function net(WD) {
    if (NET && NET.WD === WD) return NET;
    const id = new Map(WD.s.map((z, i) => [z[0], i])), adj = WD.s.map(z => (z[3] || []).map(n => id.get(n)).filter(i => i != null));
    const c = WD.s.map(z => z[2]), coast = WD.s.map(() => []);   // coast[z] = مناطق اليابسة اللي تلامس البحر z
    WD.r.forEach((r, i) => { for (const zz of r[8] || []) { const z = id.get(zz); if (z != null) coast[z].push(i); } });
    return NET = { WD, id, adj, c, coast, n: WD.s.length };
  }
  const PC = new Map();   // الشبكة ثابتة، فالطرق تنحفظ
  function path(WD, a, b) {   // Dijkstra بالمسافة الحقيقية
    const N = net(WD); if (a === b) return []; const key = a * 1000 + b; if (PC.has(key)) { const c = PC.get(key); return c && c.slice(); }
    const d = new Float64Array(N.n).fill(Infinity), p = new Int32Array(N.n).fill(-1), done = new Uint8Array(N.n); d[a] = 0;
    for (;;) { let u = -1, bd = Infinity; for (let i = 0; i < N.n; i++) if (!done[i] && d[i] < bd) { bd = d[i]; u = i; }
      if (u < 0 || u === b) break; done[u] = 1; for (const v of N.adj[u]) { const nd = d[u] + KM(N.c[u], N.c[v]); if (nd < d[v]) { d[v] = nd; p[v] = u; } } }
    if (p[b] < 0) { PC.set(key, null); return null; } const out = []; for (let v = b; v !== a; v = p[v]) out.unshift(v); PC.set(key, out); return out.slice();
  }
  const plen = (WD, a, b) => { const p = path(WD, a, b); if (!p) return 1e9; let d = 0, u = a; for (const v of p) { d += KM(net(WD).c[u], net(WD).c[v]); u = v; } return d; };   // طول الطريق البحري الحقيقي
  const ctlOf = (G, WD, i) => (G.ctl ? G.ctl[i] : WD.r[i][2]);
  const touches = (G, WD, z, cc) => net(WD).coast[z].some(i => ctlOf(G, WD, i) === cc);
  const CZ = { t: -1, m: new Map() };   // تنحسب من جديد كل شهر (السيطرة تتغير بالحرب)
  const coastZones = (G, WD, cc) => { const tm = Math.floor((G.t || 0) / 30); if (CZ.t !== tm || CZ.G !== G) { CZ.t = tm; CZ.G = G; CZ.m.clear(); } if (CZ.m.has(cc)) return CZ.m.get(cc); const N = net(WD), out = []; for (let z = 0; z < N.n; z++) if (touches(G, WD, z, cc)) out.push(z); CZ.m.set(cc, out); return out; };
  // وزن البحر للتجارة: المدن + النفط (موانئ التصدير)؛ البحر المسكّر (قزوين) ×0.3 لأن تجارته قليلة
  const zoneW = (WD, z, cc) => { const N = net(WD); if (!N.open) { N.open = new Uint8Array(N.n); const q = [0]; N.open[0] = 1; while (q.length) { const u = q.pop(); for (const v of N.adj[u]) if (!N.open[v]) { N.open[v] = 1; q.push(v); } } }
    let w = 0; for (const i of N.coast[z]) if (WD.r[i][1] === cc) w += .3 + (WD.r[i][9] || []).reduce((s, x) => s + x[1], 0) / 1e5 + (WD.r[i][10] || 0) / 100; return w * (N.open[z] ? 1 : .3); };
  const atWar = (G, a, b) => (G.wars || []).some(w => (w.a.includes(a) && w.b.includes(b)) || (w.b.includes(a) && w.a.includes(b)));
  const gen = (WD, cc) => 1 + ((((WD.cs[cc] || {}).gen || {}).navy || 2) - 2) / 4;
  const pw = (g, WD) => T.reduce((t, k) => t + (g.s[k] || 0) * PW[k], 0) * gen(WD, g.cc);
  const asw = g => (g.s.dd || 0) + (g.s.ff || 0) * .7;
  const speed = g => Math.min(...T.filter(k => g.s[k] > 0 && k !== 'amp').map(k => SPD[k]).concat([700]));
  const main = g => g.s.cv ? 'cv' : g.s.dd ? 'dd' : g.s.ff ? 'ff' : g.s.ssn ? 'ssn' : g.s.ss ? 'ss' : g.s.fac ? 'fac' : 'amp';
  const sub = g => !T.some(k => k !== 'ssn' && k !== 'ss' && g.s[k] > 0);
  const count = g => T.reduce((t, k) => t + (g.s[k] || 0), 0);

  // ===== البناء =====
  function build(G, WD) {
    const N = net(WD), groups = [], res = {}; let gid = 1;
    for (const cc of G.ids) {
      const nv = (WD.cs[cc] || {}).nv; if (!nv) continue; const R = Object.fromEntries(T.map((k, i) => [k, nv[i] || 0])), tot = T.reduce((t, k) => t + R[k], 0); if (tot < 2) continue;
      const cap = tot >= 150 ? 8 : tot >= 40 ? 5 : tot >= 12 ? 3 : 1, L = [];
      const take = (k, n) => { const m = Math.min(n, R[k]); R[k] -= m; return m; };
      for (let i = 0; i < R.cv && L.length < cap; ) L.push({ cv: take('cv', 1), dd: take('dd', 2), ssn: take('ssn', 1) });
      const order = ['surf', 'sub', 'fac', 'surf', 'sub', 'surf', 'fac', 'sub'];
      for (let j = 0; L.length < cap && j < 40; j++) { const k = order[j % order.length];
        if (k === 'surf' && R.dd + R.ff > 0) L.push({ dd: take('dd', 2), ff: take('ff', R.dd > 0 ? 2 : 4) });
        else if (k === 'sub' && R.ssn + R.ss > 0) L.push(R.ssn ? { ssn: take('ssn', 2) } : { ss: take('ss', 2) });
        else if (k === 'fac' && R.fac > 0) L.push({ fac: take('fac', 15) });
        if (j > 20 && !(R.dd + R.ff + R.ssn + R.ss + R.fac)) break; }
      if (!L.length) L.push({ amp: take('amp', Math.min(4, R.amp)), ff: take('ff', 2) });
      // الموانئ: بحار السواحل بالأوزان (المدن)، أكبر 4
      const Z = coastZones(G, WD, cc).map(z => ({ z, w: zoneW(WD, z, cc) })).filter(o => o.w > 0).sort((a, b) => b.w - a.w).slice(0, 4); if (!Z.length) continue;
      const dep = (DEP[cc] || []).map(k => N.id.get(k)).filter(z => z != null);
      L.forEach((s, i) => { const home = Z[i % Z.length].z, z = s.cv && dep.length && i < dep.length ? dep[i] : home;
        for (const k of T) if (!s[k]) delete s[k]; groups.push({ id: gid++, cc, s, s0: { ...s }, z, home, path: [], prog: 0, mode: 'patrol', dmg: 0, man: 0 }); });
      res[cc] = R;
    }
    return { g: groups, res, gid, t: G.t || 0 };
  }
  // الحروب الجارية من البداية (حرب إيران، أوكرانيا...): الأساطيل تبدي بمواقعها، والحصار محسوب من أول يوم (الاقتصاد ياخذ خط أساسه من أول شهر)
  function ensure(G, WD) { if (!G.nav) { G.nav = build(G, WD); if ((G.wars || []).length) { ai(G, WD); for (const g of G.nav.g) if (g.path.length) { g.z = g.path[g.path.length - 1]; g.path = []; } month(G, WD); } } return G.nav; }
  const portName = (WD, g) => { const N = net(WD); let best = null, bp = -1; for (const i of N.coast[g.home]) if (WD.r[i][1] === g.cc) for (const [n, p] of WD.r[i][9] || []) if (p > bp) { bp = p; best = n; } return best || WD.s[g.home][1]; };
  const name = (WD, g) => TN[main(g)] + (count(g) > 1 ? ` +${count(g) - 1}` : '') + ' — ' + portName(WD, g);

  // ===== أوامر =====
  function order(G, WD, g, o) {
    if (o.go != null) { const p = path(WD, g.z, o.go); if (!p) return 'ماكو طريق بحري'; g.path = p; g.prog = 0; }
    if (o.mode) g.mode = o.mode; if (o.home) { g.path = path(WD, g.z, g.home) || []; g.prog = 0; g.mode = 'patrol'; }
    if (g.cc === G.me) g.man = 1; return true;
  }

  // ===== الذكاء (كل 5 أيام) =====
  function ai(G, WD) {
    const NV = G.nav, byCC = {}; for (const g of NV.g) (byCC[g.cc] ||= []).push(g);
    for (const cc in byCC) {
      const L = byCC[cc]; const foes = [...new Set((G.wars || []).flatMap(w => w.a.includes(cc) ? w.b : w.b.includes(cc) ? w.a : []))];
      const auto = L.filter(g => !(cc === G.me && g.man));
      if (!foes.length) { for (const g of auto) if (g.z !== g.home && !g.path.length && !(DEP[cc] && g.s.cv)) { g.path = path(WD, g.z, g.home) || []; g.mode = 'patrol'; } continue; }
      const mine = L.reduce((t, g) => t + pw(g, WD), 0), theirs = NV.g.filter(g => foes.includes(g.cc)).reduce((t, g) => t + pw(g, WD), 0);
      const targets = foes.flatMap(f => coastZones(G, WD, f)); if (!targets.length) continue;
      // البحريات الكبيرة توصل لأي مكان، بس نص مجموعاتها بالأكثر تروح بعيد (فوك 6000 كم)؛ الباقي يحمي البيت
      const blue = L.some(o => o.s0.cv) || L.reduce((t, o) => t + (o.s0.dd || 0) + (o.s0.ff || 0), 0) >= 30, farMax = Math.ceil(L.length / 2); let far = L.filter(o => KM(net(WD).c[o.z], net(WD).c[o.home]) > 6000 || (o.path.length && KM(net(WD).c[o.path[o.path.length - 1]], net(WD).c[o.home]) > 6000)).length;
      for (const g of auto) {
        if (g.path.length) continue;
        if (mine < theirs * .35 && !sub(g)) { if (g.z !== g.home) g.path = path(WD, g.z, g.home) || []; g.mode = 'def'; continue; }   // الأضعف بكثير يحمي سواحله
        if (pw(g, WD) < .5 * pw({ cc: g.cc, s: g.s0 }, WD)) { g.path = path(WD, g.z, g.home) || []; g.mode = 'patrol'; continue; }   // تعبانة ← الميناء
        if (targets.includes(g.z)) { g.mode = 'block'; continue; }
        // يتوزعون على سواحل العدو: البحر الأثقل (مدن وموانئ) والأقرب، واللي ما بيه أسطول منا
        const taken = new Set(L.filter(o => o !== g).map(o => o.path.length ? o.path[o.path.length - 1] : o.z));
        let best = null, bs = -1; for (const z of targets) { const d = blue ? KM(net(WD).c[g.z], net(WD).c[z]) : plen(WD, g.z, z), dh = KM(net(WD).c[g.home], net(WD).c[z]); if (d > (blue ? 20000 : 4000) || (dh > 6000 && far >= farMax)) continue; const f = foes.find(x => touches(G, WD, z, x)), sc = (zoneW(WD, z, f) + .5) / (1 + d / 2500) * (taken.has(z) ? .25 : 1); if (sc > bs) { bs = sc; best = z; } }
        const bp = best != null ? path(WD, g.z, best) : null; if (bp) { g.path = bp; g.mode = 'block'; if (KM(net(WD).c[g.home], net(WD).c[best]) > 6000) far++; }
      }
    }
  }

  // ===== يوم =====
  function day(G, WD) {
    const NV = ensure(G, WD), N = net(WD), rnd = mul(((G.rs || 1) * 31 + (G.t || 0) * 7919) | 0), log = [];   // عشوائية خاصة بالبحرية حتى ما تغيّر أحداث باقي اللعبة
    const inWar = new Set((G.wars || []).flatMap(w => [...w.a, ...w.b]));
    // الحركة
    for (const g of NV.g) { if (!g.path.length) continue; g.prog += speed(g);
      while (g.path.length) { const nx = g.path[0], d = KM(N.c[g.z], N.c[nx]); if (g.prog < d) break; g.prog -= d; g.z = g.path.shift(); }
      if (!g.path.length) g.prog = 0; }
    // تصليح وتعويض بالميناء (كل 30 يوم) من الاحتياط
    if (G.t % 30 === 0) for (const g of NV.g) if (g.z === g.home && !g.path.length) { g.dmg = 0; g.fired = 0; const R = NV.res[g.cc] || {}; for (const k of T) { const need = (g.s0[k] || 0) - (g.s[k] || 0); if (need > 0 && R[k] > 0) { const m = Math.min(need, R[k]); R[k] -= m; g.s[k] = (g.s[k] || 0) + m; } } }
    if (!(G.wars || []).length) return log;
    const byZ = new Map(); for (const g of NV.g) { if (!byZ.has(g.z)) byZ.set(g.z, []); byZ.get(g.z).push(g); }
    const hit = (g, dmg, by, why) => { g.dmg += dmg; while (count(g) && g.dmg >= PW[SINK.find(k => g.s[k] > 0)] * 1.6) { const k = SINK.find(q => g.s[q] > 0); g.dmg -= PW[k] * 1.6; g.s[k]--; log.push({ t: G.t, k: 'navsink', cc: g.cc, ty: k, by, z: g.z, why }); if (CASN()) CASN().sink(G, g.cc, k, g.z); } };
    // 1) سطح وغواصات بنفس البحر
    for (const [z, L] of byZ) { if (L.length < 2 || !L.some(g => inWar.has(g.cc))) continue;
      for (const g of L) { const E = L.filter(e => e !== g && atWar(G, g.cc, e.cc) && count(e)); if (!E.length || !count(g)) continue;
        const myAsw = L.filter(o => o.cc === g.cc || !atWar(G, g.cc, o.cc)).reduce((t, o) => t + asw(o), 0);
        for (const e of E) { const seen = !sub(e) || myAsw >= 2 || rnd() < .15;   // الغواصة تنكشف بس بمضادات الغواصات
          const out = seen ? pw(g, WD) * .05 * (.5 + rnd()) : 0, inn = pw(e, WD) * .05 * (.5 + rnd()) * (sub(e) && !seen ? 1.6 : 1);
          // دفاع المجموعة: المدمرات (أيجس) والحاملة تقلل الضرر الجاي (الزوارق والصواريخ تنضرب قبل ما توصل)
          const shield = q => 1 / (1 + .35 * (q.s.dd || 0) + .15 * (q.s.ff || 0) + .3 * (q.s.cv || 0));
          if (out) hit(e, out * shield(e) / E.length, g.cc, 'sea'); if (inn) hit(g, inn * (sub(e) && !seen ? 1 : shield(g)) / E.length, e.cc, sub(e) ? 'sub' : 'sea'); } } }
    // 2) صواريخ الساحل (دولة بحرب عندها صواريخ وساحلها يلامس البحر) — المدمرات تعترض
    for (const [z, L] of byZ) for (const g of L) { if (!count(g) || sub(g) || !inWar.has(g.cc)) continue;
      for (const i of N.coast[z]) { const cc = ctlOf(G, WD, i), C = (G.C || {})[cc]; if (!C || !atWar(G, g.cc, cc)) continue;
        // صواريخ ضد السفن: مخزون منفصل (NV.asm) مو الباليستي، حتى ما يستنزف اقتصاد الدولة
        const A = asmOf(G, NV, cc); NV.cd = NV.cd || {}; if (A < 4 || (NV.cd[cc] || 0) > G.t || rnd() > .35) continue; NV.cd[cc] = G.t + 4; const salvo = Math.min(16, Math.round(A * .05) + 4); NV.asm[cc] = A - salvo;   // رشقة كل ~4 أيام بالأكثر لكل دولة
        // W13: الرشقة تنحسب صاروخ صاروخ (wnavb.js: أفق الرادار، SM-2/ESSM، فالانكس، تشويش)، والبذرة تنحفظ حتى مشهد المعركة يعيدها بالضبط
        battle(G, WD, NV, g, cc, { from: [45, (rnd() - .5) * 30], n: salvo, kind: mslOf(cc), gap: 1.5, spread: 10 }, 'coast', log); break; } }
    // 2ب) زوارق الصواريخ تهاجم سفن العدو بنفس البحر (كل زورق صاروخين، مرة وحدة لحد ما يرجع للميناء)
    for (const [z, L] of byZ) for (const f of L) { if (!f.s.fac || f.fired || !inWar.has(f.cc)) continue; const tg = L.find(g => g !== f && atWar(G, f.cc, g.cc) && count(g) && !sub(g)); if (!tg) continue;
      f.fired = 1; battle(G, WD, NV, tg, f.cc, { from: [25, (rnd() - .5) * 10], n: Math.min(30, f.s.fac * 2), kind: mslOf(f.cc), gap: .6, spread: 8 }, 'fac', log); }
    // 3) ضربات الحاملات على ساحل العدو (البحر نفسه أو جاره)
    for (const g of NV.g) { if (!g.s.cv || !inWar.has(g.cc)) continue; const near = [g.z, ...N.adj[g.z]];
      for (const w of G.wars) { const side = w.a.includes(g.cc) ? 'a' : w.b.includes(g.cc) ? 'b' : null; if (!side) continue; const foes = side === 'a' ? w.b : w.a;
        const f = foes.find(x => near.some(z => touches(G, WD, z, x))); if (!f) continue;
        w.score = (w.score || 0) + (side === 'a' ? 1 : -1) * .012 * g.s.cv; if (G.C && G.C[f] && G.C[f].pw) G.C[f].pw *= 1 - .0001 * g.s.cv; } }   // ~0.4 نقطة سير حرب بالشهر لكل حاملة [تقدير، مضبوط بالموازنة]
    NV.g = NV.g.filter(g => count(g) > 0);   // الأسطول اللي غرق كله ينشال
    return log;
  }

  // ===== شهر: الحصار وقوة البحرية (تقراها المضائق والواجهة) =====
  function month(G, WD) {
    const NV = ensure(G, WD), N = net(WD);
    for (const id of G.ids) { const c = G.C[id]; if (!c) continue; c.blk = 0; c.nav = 0; }
    for (const cc in NV.asm || {}) { const cap = Math.min(400, Math.round(((G.C[cc] || {}).msl || 0) * .3)); NV.asm[cc] = Math.min(cap, NV.asm[cc] + Math.max(1, Math.round(cap * .05))); }
    for (const g of NV.g) if (G.C[g.cc]) G.C[g.cc].nav += pw(g, WD) * 6;
    for (const cc in NV.res) if (G.C[cc]) G.C[cc].nav += T.reduce((t, k) => t + (NV.res[cc][k] || 0) * PW[k], 0) * gen(WD, cc) * 3;
    for (const w of G.wars || []) for (const [M, O] of [[w.a, w.b], [w.b, w.a]]) for (const x of O) {
      const Z = coastZones(G, WD, x); if (!Z.length || !G.C[x]) continue; let tot = 0, cov = 0;
      // محاصر = أسطول حصار بنفس البحر، أو البحر «مخنوق»: كل طرقه للمحيط تمر ببحر بيه أسطول حصار (مثل خليج عمان يقفل الخليج العربي)
      const B = new Set(NV.g.filter(g => M.includes(g.cc) && g.mode === 'block' && !sub(g) && count(g)).map(g => g.z));
      const bottled = z => { if (B.has(z)) return true; const seen = new Set([z]), q = [z]; while (q.length) { const u = q.pop(); if (WD.s[u][4] === 'ocean') return false; for (const v of N.adj[u]) if (!seen.has(v) && !B.has(v)) { seen.add(v); q.push(v); } } return N.open && N.open[z] ? true : false; };
      for (const z of Z) { const wt = zoneW(WD, z, x) || 1; tot += wt; if (bottled(z)) cov += wt; }
      const def = (G.C[x].navMode === 'def' ? .6 : 1) / (1 + (G.C[x].drn || 0) / 4000), b = Math.min(1, cov / tot) * def;
      if (b > G.C[x].blk) { const was = G.C[x].blk; G.C[x].blk = +b.toFixed(3); if (b > .2 && was <= .2 && !w['_blk' + x]) { w['_blk' + x] = 1; G.log.push({ t: G.t, k: 'blockade', on: x, by: M[0], f: Math.round(b * 100) }); } }
    }
  }
  // نوع صاروخ ضد السفن لكل دولة [تقدير]
  const mslOf = cc => ({ IRN: 'c802', CHN: 'yj18', RUS: 'kalibr', USA: 'harpoon', PRK: 'c802', YEM: 'c802' })[cc] || 'harpoon';
  // معركة وحدة: النتيجة من wnavb (أو تقدير بسيط إذا ما محمّل)، والغرق ينخصم من الأسطول، وآخر معركة تنحفظ للمشهد
  function battle(G, WD, NV, g, by, att, why, log) {
    const B = root.WNAVB || (typeof require !== 'undefined' ? require('./wnavb.js') : null); if (!B) return;
    const seed = ((G.rs || 1) * 131 + (G.t || 0) * 977 + g.id * 31) | 0, r = B.resolve({ s: { ...g.s } }, att, seed, 1);   // بدون رسم: خطوة ثانية (فحصت: الإصابات ضمن ~10٪ من خطوة ربع ثانية)
    for (const k in r.sunk) { const n = Math.min(g.s[k] || 0, r.sunk[k]); g.s[k] -= n; for (let i = 0; i < n; i++) { log.push({ t: G.t, k: 'navsink', cc: g.cc, ty: k, by, z: g.z, why }); if (CASN()) CASN().sink(G, g.cc, k, g.z); } }
    g.dmg += r.dmg * .5; NV.last = { t: G.t, z: g.z, def: g.cc, gid: g.id, s0: { ...g.s }, att, by, seed, why, res: r.stat, sunk: r.sunk };
    for (const k of Object.keys(g.s)) if (g.s[k] <= 0) delete g.s[k];
    NV.last.s0 = Object.fromEntries(Object.entries(NV.last.s0).map(([k, v]) => [k, v + (r.sunk[k] || 0)]));
    NV.seq = (NV.seq || 0) + 1; NV.rec = (NV.rec || []).concat([{ ...NV.last, seq: NV.seq }]).slice(-12);   // C0: آخر المعارك حتى الخريطة تعيدها كلها
    log.push({ t: G.t, k: 'navbattle', cc: by, on: g.cc, z: g.z, n: att.n, kill: r.stat.kill, hit: r.stat.hit, why });
  }
  // مخزون صواريخ ضد السفن لكل دولة: 30٪ من صواريخها (أقصى 400)، ويتعوّض 5٪ بالشهر [تقدير]
  function asmOf(G, NV, cc) { NV.asm = NV.asm || {}; if (NV.asm[cc] == null) { const C = G.C[cc] || {}; NV.asm[cc] = Math.min(400, Math.round((C.msl || 0) * .3)); } return NV.asm[cc]; }
  function daily(G, WD) { const NV = ensure(G, WD); if (G.t % 5 === 0) ai(G, WD); const L = day(G, WD); for (const l of L) G.log.push(l); NV.t = G.t; return L; }
  const API = { T, TN, PW, ensure, build, net, path, order, daily, day, month, ai, pw, count, main, sub, name, portName, coastZones, KM };
  if (typeof module !== 'undefined') module.exports = API; else root.WNAV = API;
})(this);
