# render8: صور 8 اتجاهات من مجسمات 3D (I-164، الخيار ج)

يرسم المجسم (GLB) من فوق بزاوية 48° بثمان اتجاهات (كل 45°، الإطار 0 = يمين، باتجاه عقرب الساعة) بخلفية شفافة.

1. `cd` لمجلد فيه `node_modules/three` (three@0.169.0) ورابط `models` لـ `prototypes/theater/models`، وانسخ `render8.html` و`render8.cjs` له.
2. شغّل خادم: `python3 -m http.server 8765`
3. `node render8.cjs <المجسم> <زاوية_الوجه> s8_<المجسم>` (الزاوية تصحح وين وجه المجسم بملفه: abrams 90، t72 -90، bmp -90، technical 90)
4. حوّل لـWebP 128×1024 (تفتيح 1.18، تباين 1.08) بـ `prototypes/grandwar/img/s8_<المجسم>.webp`.

اللعبة: `S8()` و`s8Draw()` بـ `prototypes/world/index.html`. الرخص بـ⚙ «المصادر والرخص».
