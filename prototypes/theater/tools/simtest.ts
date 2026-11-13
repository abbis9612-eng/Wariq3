import { newWorld, step, order } from '../src/sim.ts';
const seed = +(process.argv[2] || 11), dt = 1 / 60, quiet = process.argv.includes('-q'), orders = process.argv.includes('-o');
const w = newWorld(seed); const t0 = performance.now(); let maxStep = 0; const fxc: Record<string, number> = {};
let phase = '';
while (w.T < 300 && !w.over) {
  if (orders && Math.abs(w.T - 40) < dt / 2) console.log('order barrage:', order(w, 'barrage'));
  if (orders && Math.abs(w.T - 50) < dt / 2) console.log('order aa:', order(w, 'aaPriority'));
  const s = performance.now(); step(w, dt); maxStep = Math.max(maxStep, performance.now() - s);
  for (const f of w.fx) fxc[f.k] = (fxc[f.k] || 0) + 1; w.fx.length = 0;
  if (w.columnPhase !== phase) { phase = w.columnPhase; if (!quiet) console.log(`   [${w.T.toFixed(0)}s] column → ${phase}`); }
}
const mm = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
if (!quiet) for (const l of w.log) console.log(mm(l.t), l.good === true ? '✓' : l.good === false ? '✗' : '•', l.text);
console.log(`seed ${seed} T=${w.T.toFixed(0)} over=${w.over} ${JSON.stringify(w.stats)} | ${(performance.now() - t0).toFixed(0)}ms max ${maxStep.toFixed(1)}ms`);
if (!quiet) console.log('fx', JSON.stringify(fxc));
const alive = (s: string) => w.units.filter(u => u.side === s && u.alive).map(u => u.kind).join(',');
if (!quiet) console.log('iq:', alive('iq'), '| en:', alive('en'));
