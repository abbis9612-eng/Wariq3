import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js'), N = require('../prototypes/world/nation.js'), P = require('../prototypes/world/wpol.js');
const ME = process.argv[2] || 'IRQ', MON = +(process.argv[3] || 24);
const G = S.init(WD, ME, { seed: 3 }); N.init(G, WD);
const e = G.nat.eco[0]; let v = e.cash; const agg = {};
Object.defineProperty(e, 'cash', { get: () => v, set: x => { const d = x - v; v = x; if (!d) return; const st = new Error().stack.split('\n').slice(2, 4).map(l => (l.match(/at (\S+)/) || [])[1] + ':' + ((l.match(/(\w+\.js):(\d+)/) || []).slice(1).join(':'))).join(' < '); agg[st] = (agg[st] || 0) + d; }, enumerable: true, configurable: true });
const day = Q => { const b = Q.log.length; S.step(Q, WD, 1); N.daily(Q, WD, { S, SIM: null, T: null, before: b }); while (Q.pev.length) P.choose(Q, 0, 0); };
const c0 = v; let m = 0, lastM = S.date(G.t).getUTCMonth(); const rows = [];
for (let d = 0; d < MON * 31 && m < MON; d++) { day(G); const mo = S.date(G.t).getUTCMonth(); if (mo !== lastM) { lastM = mo; m++; if (m % 3 === 0) rows.push(`${m}m cash ${v.toFixed(1)} gdp ${G.C[ME].gdp.toFixed(0)} oilP ${(G.oilP||0).toFixed?.(0)} bal ${(G.C[ME].bal||0).toFixed(2)} tax ${G.C[ME].tax} civ ${G.C[ME].civ}`); } }
console.log(rows.join('\n')); console.log('start', c0.toFixed(1), 'end', v.toFixed(1));
Object.entries(agg).sort((a, b) => a[1] - b[1]).slice(0, 25).forEach(([k, x]) => console.log(x.toFixed(2).padStart(8), k));
