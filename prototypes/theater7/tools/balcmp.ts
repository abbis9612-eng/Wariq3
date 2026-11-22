// I-170: مقارنة نتائج المعركة قبل الطيارات (../theater المجمّد) وبعدها — 10 بذور، قيادة تلقائية
import sharp from 'sharp';
import * as L7 from '../src/land.ts';
import * as L6 from '../../theater/src/land.ts';
const { data, info } = await sharp(new URL('../../theater/textures/land_h.png', import.meta.url).pathname).raw().toBuffer({ resolveWithObject: true });
const h = new Float32Array(L7.HN * L7.HN); for (let i = 0; i < L7.HN * L7.HN; i++) h[i] = ((data[i * info.channels] << 8) | data[i * info.channels + 1]) / 65535 * (L7.HMAX - L7.HMIN) + L7.HMIN;
L7.setHeightData(h); L6.setHeightData(h);
const S7 = await import('../src/sim.ts'), S6 = await import('../../theater/src/sim.ts');
const run = (S: any, seed: number) => { const w = S.newWorld(seed); for (let i = 0; i < 48000 && !w.over; i++) S.step(w, 0.05);   /* I-175: v7 فيها مرحلة المدينة (لحد 40 دقيقة) */ return { r: w.result, T: Math.round(w.T), enT: w.stats.enTanksLost, iqT: w.stats.iqTanksLost, iqMen: w.stats.iqMenLost, enMen: w.stats.enMenLost }; };
const out: string[] = []; const W = { v6: 0, v7: 0 };
for (let s = 1; s <= 10; s++) { const a = run(S6, s), b = run(S7, s); if (a.r === 'win') W.v6++; if (b.r === 'win') W.v7++; out.push(`${s}: v6 ${a.r} ${a.T}s دبابات ${a.enT}/${a.iqT} جنود ${a.enMen}/${a.iqMen}  |  v7 ${b.r} ${b.T}s دبابات ${b.enT}/${b.iqT} جنود ${b.enMen}/${b.iqMen}`); }
console.log(out.join('\n')); console.log('فوز: v6', W.v6, '/10 — v7', W.v7, '/10');
