// يستخرج حدود الدول من خريطة اللعبة (index.html: MAPD، إسقاط مركاتور 1000×1000) للمنطقة اللي نحتاجها
import fs from 'fs';
const html = fs.readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
const i = html.indexOf('const MAPD='), j = html.indexOf('};', i);
const MAPD = JSON.parse(html.slice(i + 11, j + 1));
const ll = (lon, lat) => [(lon + 180) / 360 * 1000, (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2 * 1000];
const [x0, y1] = ll(22, 8), [x1, y0] = ll(68, 46);
const out = {};
for (const [iso, rings] of Object.entries(MAPD)) {
  const keep = rings.filter(r => { for (let k = 0; k < r.length; k += 2) if (r[k] > x0 && r[k] < x1 && r[k + 1] > y0 && r[k + 1] < y1) return true; return false; });
  if (keep.length) out[iso] = keep;
}
fs.writeFileSync(new URL('../src/mapdata.json', import.meta.url), JSON.stringify(out));
console.log(Object.keys(out).length, 'دولة', (JSON.stringify(out).length / 1024).toFixed(0), 'KB');
