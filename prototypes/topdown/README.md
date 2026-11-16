# من فوق، قريب وواضح (WM8، I-060، I-061، D-032)

المرحلة الأولى: **عيّنة شكل ثابتة** (`sample.html?view=far|mid|close&theme=light|dark`)، حتى المالك يوافق قبل البناء.
- `sample_light.png` و `sample_dark.png`: من بعيد (~190 كم)، متوسط (~30 كم)، قريب (~3 كم).

## الأدوات
- **PixiJS 8.23 + pixi-filters 6.1:** رسم بكرت الشاشة، وتوهج (AdvancedBloom) على طبقة المؤثرات.
- **Blender (bpy 5.3، Cycles):**
  - `tools/bl_bake.py` يخبز صور من فوق بإضاءة شمس وسما، وظل ناعم على الأرض (shadow catcher) وخلفية شفافة.
  - `HIDE=` يشيل أجزاء بالاسم.
  - كل صورة ~4 ث على المعالج.
- **الخريطة المرسومة:**
  - `tools/basemap.py`: تضاريس مظللة من الارتفاعات (AWS Terrain Tiles)، ومياه ومزارع مستخرجة من صور Sentinel-2 cloudless 2016 (EOX، CC BY 4.0).
  - `tools/style.py`: يركّبها بثيمين فاتح وغامق.
  - `tools/mapdata.py`: أنهار وطرق وحدود من Natural Earth (ملكية عامة)، ومدن بأسماء عربية من OpenStreetMap (ODbL).

## تشغيل
```
npm install && npm run dev        # http://localhost:5173/sample.html?view=mid&theme=dark
node tools/sample_shots.mjs       # الصور الست (vite على 5185)
```
