# تجربة 3D رقم 1 — اعتراض الباتريوت

صاروخ كروز Kh-101 يطير ملاصق للتضاريس، ومنظومة باتريوت تطلق معترضين بتوجيه تناسبي (N=4) وصاعق تقاربي.
الهدف: نثبت إن التقنيات المختارة (TypeScript + Babylon.js) تعطي 3D واقعي وسلس على التلفون، قبل ما نبني عليها اللعبة.

- **شوفها:** https://claude.ai/artifact/Djczu3gP9aFmBrk1uPyygG
- **شغّلها محلياً:** `npm install` ثم `npm run dev` وافتح `http://localhost:5173`
- **ابنِها:** `npm run build` (المجسمات تتحول تلقائياً لـ glTF نصي حتى تنقبل بالنشر)
- **افحص الفيزياء:** `npm run test:sim` (لازم يطبع HIT ومسافة الخطأ < 9 م)
- **افحص المشهد كامل:** شغّل `npm run dev` ثم `npm run test:scene` (يلتقط صور كل مرحلة ويفشل عند أي خطأ)
- `?auto=1` يبدأ بدون ضغطة، `?q=low` جودة منخفضة.

## الملفات
| الملف | الدور |
|---|---|
| `src/sim.ts` | المنطق بدون رسم: الأرض، طيران الكروز، التوجيه، الحطام (يتفحص بـ Node) |
| `src/main.ts` | الرسم: الإضاءة، السماء، الجسيمات (دخان/نار/شرر)، الكاميرا السينمائية، الصوت، الواجهة |
| `models/*.glb` | المجسمات الأصلية من Sketchfab |
| `tools/` | أدوات الفحص والتصوير والتحويل |

## المصادر (CC BY 4.0 — لازم يبقى ذكرها داخل اللعبة)
- «Kh-101 Cruise Missile – Textured» — xFORTUNAx — https://sketchfab.com/3d-models/kh-101-cruise-missile-textured-6e67414d02f348d28fbe65fa0b6d2de2
- «MIM-104 Patriot Surface-To-Air Missile (SAM)» — Muhamad Mirza Arrafi — https://sketchfab.com/3d-models/mim-104-patriot-surface-to-air-missile-sam-7a64d0af78514a159877edab1ab2bccb
