import { newWorld, step } from '../src/sim.ts';
const seed = +(process.argv[2] || 11), dt = 1 / 60;
const w = newWorld(seed); const t0 = performance.now(); let maxStep = 0, fxCount = 0;
while (w.T < 260 && !w.over) { const s = performance.now(); step(w, dt); maxStep = Math.max(maxStep, performance.now() - s); fxCount += w.fx.length; w.fx.length = 0; }
const mm = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
if (!process.argv.includes('-q')) for (const l of w.log) console.log(mm(l.t), l.good === true ? '✓' : l.good === false ? '✗' : '•', l.text);
console.log(`seed ${seed} end T=${w.T.toFixed(0)}s over=${w.over} | ${JSON.stringify(w.stats)} | ms total ${(performance.now() - t0).toFixed(0)} maxStep ${maxStep.toFixed(2)} fx ${fxCount}`);
const alive = (s: string) => w.units.filter(u => u.side === s && u.alive).map(u => u.kind).join(',');
console.log('iq alive:', alive('iq'), '| en alive:', alive('en'));
