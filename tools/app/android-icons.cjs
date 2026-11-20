// أيقونات أندرويد (mipmap) من icons/icon-512.png: node tools/app/android-icons.cjs ← mobile/res/
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const SIZES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
(async () => {
  const b = await chromium.launch(), p = await b.newPage(), src = 'data:image/png;base64,' + fs.readFileSync('prototypes/world/icons/icon-512.png').toString('base64');
  for (const [d, s] of Object.entries(SIZES)) for (const [n, round] of [['ic_launcher', 0], ['ic_launcher_round', 1]]) {
    const data = await p.evaluate(async ([src, s, round]) => { const i = new Image(); i.src = src; await i.decode(); const c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
      if (round) { g.beginPath(); g.arc(s / 2, s / 2, s / 2, 0, 7); g.clip(); } g.imageSmoothingQuality = 'high'; g.drawImage(i, 0, 0, s, s); return c.toDataURL('image/png'); }, [src, s, round]);
    const dir = path.join('mobile/res', 'mipmap-' + d); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, n + '.png'), Buffer.from(data.split(',')[1], 'base64'));
  }
  await b.close(); console.log('mobile/res جاهز');
})();
