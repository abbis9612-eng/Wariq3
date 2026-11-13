// فحص المحاكاة بدون رسم (D-011): node tools/simtest.ts [seed|all] [-q] [-o]
// all = 20 معركة ويطلع ملخص: المدة، النتيجة، وقت الانسحاب والهجوم المعاكس، الخسائر.
import sharp from 'sharp';
import { HN, HMIN, HMAX, setHeightData } from '../src/land.ts';
const { data, info } = await sharp(new URL('../textures/land_h.png', import.meta.url).pathname).raw().toBuffer({ resolveWithObject: true });
const h = new Float32Array(HN * HN); for (let i = 0; i < HN * HN; i++) h[i] = ((data[i * info.channels] << 8) | data[i * info.channels + 1]) / 65535 * (HMAX - HMIN) + HMIN;
setHeightData(h);
const { newWorld, step, order } = await import('../src/sim.ts');

const arg = process.argv[2] || '11', quiet = process.argv.includes('-q'), orders = process.argv.includes('-o');
const seeds = arg === 'all' ? Array.from({ length: 20 }, (_, i) => i + 1) : [+arg];
const rows: Record<string, number | string>[] = []; const dbgAll: Record<string, number> = {};
for (const seed of seeds) {
  const w = newWorld(seed), dt = 1 / 60, t0 = performance.now(); let maxStep = 0, logN = 0; const phases: string[] = []; let lastEn = '', lastIq = '';
  while (!w.over && w.T < 900) {
    const a = performance.now(); step(w, dt); maxStep = Math.max(maxStep, performance.now() - a);
    if (orders && Math.abs(w.T - 200) < dt / 2) order(w, 'smoke');
    if (orders && Math.abs(w.T - 260) < dt / 2) order(w, 'barrage');
    if (w.en !== lastEn) { phases.push(`en:${w.en}@${w.T.toFixed(0)}`); lastEn = w.en; }
    if (w.iq !== lastIq) { phases.push(`iq:${w.iq}@${w.T.toFixed(0)}`); lastIq = w.iq; }
    if (!quiet && seeds.length === 1) while (logN < w.log.length) { const l = w.log[logN++]; console.log(`${Math.floor(l.t / 60)}:${String(Math.floor(l.t % 60)).padStart(2, '0')} ${l.good === true ? '✓' : l.good === false ? '✗' : '•'} ${l.text}`); }
    w.fx.length = 0;
  }
  const s = w.stats, held = w.houseOwner.filter(o => o === 'en').length;
  rows.push({ seed, T: Math.round(w.T), res: w.result, fb: Math.round(s.fallbackT), ctr: Math.round(s.counterT), t72: `${s.enTanksLost}/${s.enTanks}`, bmp: `${s.enBmpLost}/${s.enBmp}`, enMen: `${s.enMenLost}/${s.enMen}`,
    abrams: `${s.iqTanksLost}/${s.iqTanks}`, iqMen: `${s.iqMenLost}/${s.iqMen}`, houses: s.housesLost, held, atgm: s.atgm, rpg: s.rpg, drones: `${s.dronesDown}/${s.drones}`, ms: +(performance.now() - t0).toFixed(0), max: +maxStep.toFixed(1) });
  if (seeds.length === 1) console.log(phases.join('  '));
  for (const [k, v] of Object.entries(w.dbg)) dbgAll[k] = (dbgAll[k] ?? 0) + v;
}
console.table(rows);
if (seeds.length > 1) {
  const T = rows.map(r => r.T as number), res = rows.reduce((m, r) => (m[r.res as string] = (m[r.res as string] || 0) + 1, m), {} as Record<string, number>);
  console.log('المدة: أقل', Math.min(...T), 'أكثر', Math.max(...T), 'معدل', Math.round(T.reduce((a, b) => a + b, 0) / T.length), '| النتائج', JSON.stringify(res), '| هجوم معاكس صار', rows.filter(r => (r.ctr as number) > 0).length, '/', rows.length);
}
console.log('من قتل المشاة:', JSON.stringify(Object.fromEntries(Object.entries(dbgAll).sort((a, b) => b[1] - a[1]))));
