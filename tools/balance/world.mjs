// موازنة «العالم» (W9، strategy-balance): بوتات تلعب سنين بلا واجهة وتطلع تقرير بالأرقام.
// node tools/balance/world.mjs [سنين=10] [بذور=6] [دول=IRQ,USA,...]
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../../prototypes/world/wsim.js'), N = require('../../prototypes/world/nation.js'), P = require('../../prototypes/world/wpol.js'), M = require('../../prototypes/world/wmkt.js');
const HOME = require('../../prototypes/world/gwhome.js'), FUND = require('../../prototypes/world/wfund.js'), RES = require('../../prototypes/world/wres.js');
const YEARS = +(process.argv[2] || 10), SEEDS = +(process.argv[3] || 6);
const CS = (process.argv[4] || 'IRQ,USA,IRN,EGY,TUR,DEU,LBN,YEM,JOR,BRA').split(',');
// ===== البوتات =====
// idle: ولا شي (القضايا المستشارين يحلوها، الأحداث أول خيار)
// manager: يدير: الخزينة سالبة ← ضرايب عالية وتقشف؛ فائض كبير ← ضرايب عادية؛ القضايا: الخيار اللي يرفع أزعل فئة؛ يقبل العروض؛ قمة كل ما يقدر
// warmonger: مثل manager + يعلن حرب على أضعف جار (قوته أقل من 40٪ منا) كل ما يقدر
let CUR = '';
const BOTS = {
  idle: () => {},
  manager: (G, ev) => {
    const c = G.C[G.me], e = G.nat.eco[0], H = G.nat.home;
    if (ev.month) {
      // I-140: يستعمل الصندوق السيادي — الفائض يروح سندات، والعجز يتسدد منه قبل الضرايب
      if (!process.env.NOFUND) { const F = FUND.ensure(G); if (e.cash < 0) for (const k of ['bonds', 'stocks']) if (e.cash < 0 && F[k] > 0) FUND.take(G, k, Math.min(F[k], -e.cash + G.nat.lim * .5));
        if (e.cash < 0 && !FUND.borrowOk(G, WD, S)) FUND.borrow(G, WD, S);
        if (e.cash > G.nat.lim * 3) FUND.put(G, 'bonds', +((e.cash - G.nat.lim * 2) * .5).toFixed(2));
        if (e.cash > G.nat.lim) RES.fill(G, WD); }
      if (e.cash < 0) { c.tax = 'high'; c.civ = e.cash < -G.nat.lim * .5 ? 'cut' : 'mid'; } else if (e.cash > G.nat.lim * 2) { c.tax = 'mid'; c.civ = 'more'; } else { c.tax = 'mid'; c.civ = 'mid'; }
      e.prio = c.stab < 40 ? 'civ' : 'bal';
      while (G.offers.length) S.answerOffer(G, WD, 0, true); while (G.mkt.offers.length) M.answer(G, WD, S, 0, true);
      if (G.ap >= 2 && G.t - G.unT >= 180) S.unSummit(G);
      // v3 E: يبني مشروع إذا الخزينة تتحمّل (كهرباء أول إذا ناقصة، بعدين نفط، بعدين مصانع)
      { const EC = S.ECO, run = G.eco3 ? G.eco3.proj.filter(q => q.id === G.me && !q.done).length : 9; if (EC && run < 2 && !process.env.NOBUILD) { const k = EC.elecDef(G, G.me) > .1 ? 'power' : c.oil > 0 ? 'oil' : 'fact', cd = EC.card(G, WD, G.me, k); if (e.cash > cd.cost + G.nat.lim * (process.env.NOFUND ? .5 : 1.5) && !EC.can(G, WD, G.me, k)) EC.start(G, WD, G.me, k); } }
      for (const w of G.wars.filter(w => w.offer && (w.a.includes(G.me) || w.b.includes(G.me)))) { if (G.ap >= 1) S.offerPeace(G, WD, w.id); }
      if (CUR !== 'warmonger') for (const w of G.wars.filter(w => (w.a.includes(G.me) || w.b.includes(G.me)) && (w.a.includes(G.me) ? w.score : -w.score) < 0)) if (G.ap >= 1) S.offerPeace(G, WD, w.id); }
    while (H.iss.length) { const q = H.iss[0], I = HOME.ISS[q.k]; const j = e.cash > G.nat.lim * .2 ? 0 : I.o.length - 1; HOME.choose(G.nat, 0, Math.min(j, I.o.length - 1)); }
    while (G.pev.length) P.choose(G, 0, e.cash > 0 ? 0 : P.PEV[G.pev[0].id].o.length - 1);
  },
  warmonger: (G, ev) => { BOTS.manager(G, ev); if (!ev.month || G.ap < 3 || G.wars.some(w => w.a.includes(G.me) || w.b.includes(G.me))) return;
    const me = G.me, nb = G.ids.filter(x => x !== me && G.C[x] && !S.allied(G, me, x) && !S.napOf(G, me, x) && G.C[x].pw < G.C[me].pw * .4 && !G.C[x].nuke).filter(x => { for (let i = 0; i < WD.r.length; i++) if (G.ctl[i] === me && WD.r[i][7].some(n => G.ctl[G.idx.get(n)] === x)) return true; return false; });
    if (nb.length) S.act(G, WD, 'war', nb.sort((a, b) => G.C[a].pw - G.C[b].pw)[0]); },
};
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const rows = [], world = { aiW: 0, aiWpeace24: 0, elim: 0, ms: [] };
for (const me of CS) for (const bot of Object.keys(BOTS)) {
  const R = [];
  for (let sd = 1; sd <= SEEDS; sd++) {
    const G = S.init(WD, me, { seed: sd * 101 }); N.init(G, WD); const rank0 = S.rank(G, 'gdp').indexOf(me) + 1, gdp0 = G.C[me].gdp, stabs = [];
    let d = 0; const aiWar = new Map();
    for (; d < 365 * YEARS && !G.over; d++) { const b = G.log.length, m0 = G.t; const t0 = performance.now(); S.step(G, WD, 1); const dt = performance.now() - t0;
      const month = G.log.some(l => l.t === G.t && l.k === 'month'); if (month && bot === 'idle' && me === CS[0]) world.ms.push(dt);
      N.daily(G, WD, { S, SIM: null, T: null, before: b });
      if (bot === 'idle') { while (G.pev.length) P.choose(G, 0, 0); }
      CUR = bot; BOTS[bot](G, { month });
      if (month) stabs.push(G.C[me].stab);
      if (month && process.env.TRACE && sd === 1 && G.t % 180 < 31) console.error(me, bot, Math.round(G.t / 30), Object.entries(G.nat.home.fac).map(([k, v]) => k + Math.round(v)).join(' '), 'stab', Math.round(G.C[me].stab), 'cash', G.nat.eco[0].cash.toFixed(1), 'tax', G.C[me].tax, G.C[me].civ, 'wars', G.wars.filter(w => w.a.includes(me) || w.b.includes(me)).map(w => w.id + ':' + Math.round(w.score)).join(','));
      for (const l of G.log) if (l.t === G.t && l.k === 'elect' && l.me) (world.el ||= []).push(me + ':' + bot + ':' + l.sc + ' ' + JSON.stringify(Object.fromEntries(Object.entries(G.nat.home.fac).map(([k, v]) => [k, Math.round(v)]))) + ' mor' + Math.round(G.nat.eco[0].mor) + ' cash' + Math.round(G.nat.eco[0].cash) + ' g' + G.C[me].g.toFixed(1) + ' tax ' + G.C[me].tax + ' civ ' + G.C[me].civ);
      if (bot === 'idle' && sd === 1) for (const l of G.log) if (l.t === G.t) { if (l.k === 'war' && l.byAI) { aiWar.set(l.id, G.t); world.aiW++; world.aiWn = (world.aiWn || []).concat(WD.cs[l.a].ar + '←' + WD.cs[l.b].ar); } if (l.k === 'peace' && aiWar.has(l.war)) { if (G.t - aiWar.get(l.war) <= 730) world.aiWpeace24++; aiWar.delete(l.war); } }
    }
    const c = G.C[me], g = G.nat.grade = N.grade(G, WD, S);
    R.push({ over: G.over ? G.over.why : null, yr: G.over ? +(G.over.t / 365).toFixed(1) : YEARS, cagr: (Math.pow(c.gdp / gdp0, 1 / Math.max(.5, d / 365)) - 1) * 100,
      rank: rank0 - (S.rank(G, 'gdp').indexOf(me) + 1), stab: pct(stabs, .5), stabLo: pct(stabs, .1), cash: G.nat.eco[0].cash, dp: c.debt / c.gdp * 100, grade: g.g, score: g.score });
  }
  const lost = R.filter(r => r.over), why = {}; for (const r of lost) why[r.over] = (why[r.over] || 0) + 1;
  rows.push({ me, bot, n: R.length, lose: lost.length / R.length, why, yr: pct(lost.map(r => r.yr), .5), cagr: pct(R.map(r => r.cagr), .5), rank: pct(R.map(r => r.rank), .5),
    stab: pct(R.map(r => r.stab), .5), stabLo: pct(R.map(r => r.stabLo), .5), dp: pct(R.map(r => r.dp), .5), grade: R.map(r => r.grade).join(''), score: pct(R.map(r => r.score), .5) });
  const x = rows[rows.length - 1]; console.error(`${me} ${bot}: خسارة ${Math.round(x.lose * 100)}٪ ${JSON.stringify(x.why)} · نمو ${x.cagr.toFixed(1)}٪ · ترتيب ${x.rank >= 0 ? '+' : ''}${x.rank} · استقرار ${Math.round(x.stab)} (p10 ${Math.round(x.stabLo)}) · دين ${Math.round(x.dp)}٪ · تقييم ${x.grade}`);
}
const ms = world.ms; console.log(JSON.stringify({ years: YEARS, seeds: SEEDS, rows, world: { aiWars: world.aiW, aiWarList: world.aiWn, elect: world.el, aiWarsPeace24: world.aiWpeace24, monthMs: { p50: pct(ms, .5), p90: pct(ms, .9), max: Math.max(...ms) } } }, null, 1));
