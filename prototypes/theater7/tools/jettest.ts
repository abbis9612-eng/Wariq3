import sharp from 'sharp';
import { HN, HMIN, HMAX, setHeightData } from '../src/land.ts';
const { data, info } = await sharp(new URL('../../theater/textures/land_h.png', import.meta.url).pathname).raw().toBuffer({ resolveWithObject: true });
const h = new Float32Array(HN * HN); for (let i = 0; i < HN * HN; i++) h[i] = ((data[i * info.channels] << 8) | data[i * info.channels + 1]) / 65535 * (HMAX - HMIN) + HMIN;
setHeightData(h);
const { newWorld, step, order } = await import('../src/sim.ts');
for (const seed of [3, 5, 11]) {
  const w = newWorld(seed); const ev: Record<string, number> = {}; let maxJ = 0; const logs: string[] = [];
  for (let i = 0; i < 12000 && !w.over; i++) { step(w, 0.05); maxJ = Math.max(maxJ, w.jets.length); for (const f of w.fx) if (f.k === 'jet') ev[f.ev] = (ev[f.ev] || 0) + 1; w.fx.length = 0; }
  for (const l of w.log) if (/F-16|سوخوي|بيرقدار|أباتشي|هيلفاير|أسقط|طلعة/.test(l.text)) logs.push(Math.round(l.t) + ' ' + l.text);
  console.log('seed', seed, 'T', Math.round(w.T), w.result, 'maxJets', maxJ, JSON.stringify(ev), 'ammo', JSON.stringify(w.ammo), 'tanksLost en/iq', w.stats.enTanksLost, w.stats.iqTanksLost);
  console.log(logs.slice(0, 14).join('\n'));
}
