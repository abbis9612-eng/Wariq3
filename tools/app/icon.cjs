// يرسم أيقونات التطبيق (192، 512، و512 «maskable» بهامش آمن) بـ Chromium: node tools/app/icon.cjs
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  for (const [n, s, mask] of [['icon-192', 192, 0], ['icon-512', 512, 0], ['icon-mask-512', 512, 1]]) {
    const data = await p.evaluate(([s, mask]) => {
      const c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d'), k = s / 512;
      g.fillStyle = '#1b2019'; if (mask) g.fillRect(0, 0, s, s); else { g.beginPath(); g.roundRect(0, 0, s, s, 96 * k); g.fill(); }
      const r = (mask ? 150 : 190) * k, cx = s / 2, cy = s / 2 - 18 * k;
      // كرة أرضية: بحر ويابسة مبسطة وخطوط طول وعرض
      g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.clip(); g.fillStyle = '#22323d'; g.fillRect(0, 0, s, s);
      g.fillStyle = '#3f5232'; for (const [x, y, w, h] of [[-.55, -.45, .55, .5], [.05, -.6, .5, .45], [.15, -.1, .35, .55], [-.45, .15, .3, .45], [.55, .05, .3, .3]]) { g.beginPath(); g.ellipse(cx + x * r + w * r / 2, cy + y * r + h * r / 2, w * r / 2, h * r / 2, .3, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(224,181,88,.55)'; g.lineWidth = 5 * k; for (const f of [-.5, 0, .5]) { g.beginPath(); g.ellipse(cx, cy, r * Math.abs(Math.cos(f * 1.4)) + 1, r, 0, 0, 7); g.stroke(); g.beginPath(); g.moveTo(cx - r, cy + f * r); g.lineTo(cx + r, cy + f * r); g.stroke(); }
      g.restore(); g.strokeStyle = '#e0b558'; g.lineWidth = 12 * k; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
      // «٣» (الحرب العالمية الثالثة)
      g.font = `700 ${150 * k}px Tahoma, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 14 * k; g.strokeStyle = '#1b2019'; g.strokeText('٣', cx, cy + 6 * k); g.fillStyle = '#e0b558'; g.fillText('٣', cx, cy + 6 * k);
      g.fillStyle = '#ece6d3'; g.font = `700 ${(mask ? 44 : 54) * k}px Tahoma, sans-serif`; g.fillText('العالم', cx, cy + r + (mask ? 52 : 58) * k);
      return c.toDataURL('image/png');
    }, [s, mask]);
    fs.writeFileSync(`prototypes/world/icons/${n}.png`, Buffer.from(data.split(',')[1], 'base64'));
  }
  await b.close();
})();
