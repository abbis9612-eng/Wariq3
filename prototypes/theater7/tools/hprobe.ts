import sharp from 'sharp';
import { HN, HMIN, HMAX, setHeightData, groundH } from '../src/land.ts';
const { data, info } = await sharp(new URL('../../theater/textures/land_h.png', import.meta.url).pathname).raw().toBuffer({ resolveWithObject: true });
const h = new Float32Array(HN * HN); for (let i = 0; i < HN * HN; i++) h[i] = ((data[i * info.channels] << 8) | data[i * info.channels + 1]) / 65535 * (HMAX - HMIN) + HMIN;
setHeightData(h);
for (let z = -800; z <= 100; z += 100) { let row = ''; for (let x = -1200; x <= -200; x += 100) row += groundH(x, z).toFixed(0).padStart(5); console.log(String(z).padStart(5), row); }
