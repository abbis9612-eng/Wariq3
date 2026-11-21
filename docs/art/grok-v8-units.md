# «توحيد صور الوحدات» — 10 صور ناقصة (لـ Grok) — I-141

**المشكلة:** الوحدات باللعبة مرسومة بثلاث أنماط: صور قديمة كارتونية من فوق (المشاة = بيكب أزرق)، وصور واقعية من الجنب، ورموز خرائط زرقاء للدفاع الجوي. راح نوحّد كلشي على الصور الواقعية. الموجود يكفي للدبابات والطيارات والسفن، بس هاي ناقصة.

**للمالك:** انطي هذا الملف لـ Grok وقله:
> سوّي كل الصور اللي بهذا الملف، كل نص بصورة لحاله، بالترتيب، وسمّي كل صورة باسمها.

وحط الصور بمجلد `docs/art/out/v8-units/`. إذا صورة طلعت مثل رسم أو لعبة، ارجعها وقله: «make it look like a real military press photograph, not a 3D render».

---

## INSTRUCTIONS FOR GROK (apply to every image)

- **Real military photograph look**: real light, real dust, real paint wear. **NOT a 3D render, NOT a toy, NOT cartoon, NOT clean CGI.**
- **No text, no letters, no numbers, no flags, no logos, no watermark. No faces close up, no blood.**
- **V = side view (card/counter):** the vehicle seen from the LEFT SIDE, slightly from above (about 15°), front pointing LEFT, the whole vehicle visible, **pure flat white background**, no shadow, 1536×1024.
- **T = map sprite:** STRICTLY top-down view from directly above, front pointing to the RIGHT, **pure flat white background**, no shadow, 1024×1024. The vehicle fills about 70% of the image.
- Paint: realistic **desert tan / sand** military paint, dusty, unless the prompt says otherwise.

---

## 🪖 المشاة (أهم شي — بدل البيكب الأزرق)

**I1V — `inf-west-v.jpg`** — `Side view of a real infantry squad with their armored Humvee (M1151 HMMWV with a roof machine gun), six soldiers in desert camouflage with rifles and helmets standing and walking beside it, desert tan paint, dusty, white background.`

**I1T — `inf-west-t.jpg`** — `STRICTLY top-down view from directly above of an armored Humvee (M1151 with roof gun turret) with four infantry soldiers in desert camouflage walking around it, front pointing right, white background.`

**I2V — `inf-east-v.jpg`** — `Side view of a real infantry squad with a military Toyota Land Cruiser pickup (technical) carrying a heavy machine gun in the back, six soldiers in desert camouflage with rifles beside it, sand paint, dusty, white background.`

**I2T — `inf-east-t.jpg`** — `STRICTLY top-down view from directly above of a military Toyota Land Cruiser pickup with a heavy machine gun mounted in the back and four soldiers in desert camouflage around it, front pointing right, white background.`

**I3T — `truck-t.jpg`** — `STRICTLY top-down view from directly above of a military 6x6 cargo truck (like Ural-4320 or M35) with a canvas-covered cargo bed, desert sand paint, front pointing right, white background.`

## 🛡 الدفاع الجوي (بدل المربع الأزرق)

**D1V — `hawk-v.jpg`** — `Side view of a real MIM-23 Hawk surface-to-air missile launcher on its towed trailer with three white missiles on the rails, desert tan paint, white background.`

**D2V — `shorad-v.jpg`** — `Side view of a real short-range air defense vehicle: an armored truck with a turret carrying eight short-range anti-aircraft missiles in two pods and a small radar (like Avenger or Strela-10), desert tan paint, white background.`

**D3V — `zu23-v.jpg`** — `Side view of a real ZU-23-2 twin 23mm anti-aircraft gun mounted on the back of a military pickup truck, desert sand paint, white background.`

## 🚀 المدفعية والراجمات

**R1T — `grad-t.jpg`** — `STRICTLY top-down view from directly above of a real BM-21 Grad multiple rocket launcher truck with the 40-tube launcher on the back, desert sand paint, front pointing right, white background.`

**R2T — `howitzer-t.jpg`** — `STRICTLY top-down view from directly above of a real self-propelled tracked howitzer (like M109 or 2S3) with its long barrel pointing right, desert sand paint, white background.`

---

**بعد ما توصل:** أقصّها وأحطها مثل الصور اللي قبلها (`tools/art/`)، وأربطها: المشاة بالقطع وبالمعركة القريبة (الغربية لجيوش السلاح الغربي، والشرقية للباقي)، والدفاع الجوي بدل الرمز الأزرق.
