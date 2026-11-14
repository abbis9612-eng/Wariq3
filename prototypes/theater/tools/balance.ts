// مسح التوازن (TH6.9): node tools/balance.ts '{"enInf":1.5}' [seeds=10]
// يشغّل نفس البذور بوضعين: يدوي بدون أوامر (أسوأ لاعب) وتلقائي (القائد الآلي)، ويطلع نسبة الفوز والمدة والخسائر
import sharp from 'sharp';
import { HN, HMIN, HMAX, setHeightData } from '../src/land.ts';
const { data, info } = await sharp(new URL('../textures/land_h.png', import.meta.url).pathname).raw().toBuffer({ resolveWithObject: true });
const h = new Float32Array(HN * HN); for (let i = 0; i < HN * HN; i++) h[i] = ((data[i * info.channels] << 8) | data[i * info.channels + 1]) / 65535 * (HMAX - HMIN) + HMIN;
setHeightData(h);
const S = await import('../src/sim.ts');
Object.assign(S.BAL, JSON.parse(process.argv[2] || '{}'));
const N = +(process.argv[3] || 10);
for (const mode of ['manual', 'auto'] as const) {
  const res: Record<string, number> = {}; let T = 0, iqMen = 0, enMen = 0, abr = 0;
  for (let seed = 1; seed <= N; seed++) { const w = S.newWorld(seed); w.cmd = mode; while (!w.over && w.T < 1300) { S.step(w, 1 / 30); w.fx.length = 0; }
    res[w.result || 'none'] = (res[w.result || 'none'] ?? 0) + 1; T += w.T; iqMen += w.stats.iqMenLost; enMen += w.stats.enMenLost; abr += w.stats.iqTanksLost; }
  console.log(mode.padEnd(6), JSON.stringify(res), 'مدة', Math.round(T / N), 'خسائرنا', (iqMen / N).toFixed(1), 'جنود', (abr / N).toFixed(1), 'أبرامز | العدو', (enMen / N).toFixed(1), 'جنود');
}
