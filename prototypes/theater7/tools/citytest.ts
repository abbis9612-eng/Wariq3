// فحص حرب المدن (I-175) بدون رسم: node tools/citytest.ts [seeds] [-v]
import sharp from 'sharp';
import { HN, HMIN, HMAX, setHeightData } from '../src/land.ts';
const { data, info } = await sharp(new URL('../../theater/textures/land_h.png', import.meta.url).pathname).raw().toBuffer({ resolveWithObject: true });
const h = new Float32Array(HN * HN); for (let i = 0; i < HN * HN; i++) h[i] = ((data[i * info.channels] << 8) | data[i * info.channels + 1]) / 65535 * (HMAX - HMIN) + HMIN;
setHeightData(h);
const { newWorld, step, CITY_HOUSES } = await import('../src/sim.ts');
const seeds = (process.argv[2] || '3,5,11').split(',').map(Number), V = process.argv.includes('-v');
const rows: any[] = [];
for (const seed of seeds) {
  const w = newWorld(seed); let vilEnd = '', worst = 0; const t0 = performance.now();
  while (!w.over && w.T < 2400) { const a = performance.now(); const z0 = w.zone; step(w, 1 / 20); worst = Math.max(worst, performance.now() - a); w.fx.length = 0; if (z0 === 'village' && w.zone === 'city') vilEnd = w.log[w.log.length - 1].text.slice(0, 22); }
  const st = w.stats, held = CITY_HOUSES.filter(h => w.houseOwner[h.i] === 'en').length, iqH = CITY_HOUSES.filter(h => w.houseOwner[h.i] === 'iq').length;
  rows.push({ seed, cityAt: Math.round(w.cityT), vil: vilEnd, T: Math.round(w.T), res: w.result || '—', dur: Math.round(w.T - w.cityT), t72: `${st.enTanksLost}/${st.enTanks}`, bmp: `${st.enBmpLost}/${st.enBmp}`, enMen: `${st.enMenLost}/${st.enMen}`, abr: `${st.iqTanksLost}/${st.iqTanks}`, iqMen: `${st.iqMenLost}/${st.iqMen}`, cityEn: held, cityIq: iqH, rpg: st.rpg, ms: Math.round(performance.now() - t0), worst: worst.toFixed(1) });
  if (V) console.log(w.log.filter(l => l.t >= w.cityT - 1).map(l => `${Math.round(l.t)} ${l.text}`).join('\n'));
}
console.table(rows);
