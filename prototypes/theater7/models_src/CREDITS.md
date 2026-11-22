# مصادر models_src (I-172)

- `zu23_mount.glb` و`zu23_elev.glb`: «ZU - 23, зенитная установка» — LuckySkink9661، Sketchfab (uid fdae5a37901941fea3a02578506072a3)، رخصة CC BY 4.0. مقسوم لقاعدة تلف وسبطانتين ترتفع ومصغّر القوام (512، JPEG).
- `zu23_truck.glb` (I-173): «Toyota Land Cruiser J79 Pickup شاص» — DR1KING100K، Sketchfab (uid c3ee542f1e7740ddb340c38f2160f7c8)، CC BY 4.0. ألوان جديدة (أبيض مغبّر، تايرات وزجاج غامق)، بدون الداخل والسبير، مصغّر من 1.74 مليون وجه لـ~51 ألف (`tools/zu23_truck.py` ثم `gltf-transform weld` و`quantize`). `zu23_truck.json`: مركز القاعدة بالمتر وجدول أقل ارتفاع للسبطانة (ZU_ARC).
- تقسيم المدفع: `tools/zu23_compose.py` (بلندر 4.0)؛ `zu23.json` = المحور بإحداثيات بلندر (وحدات المدفع ×0.8 = متر).
