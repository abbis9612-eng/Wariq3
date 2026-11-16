# ينزّل بلاطات صور الأقمار الصناعية Sentinel-2 cloudless 2016 (EOX، CC BY 4.0) ويدمجها لصورة وحدة بإسقاط الخريطة نفسه (Web Mercator)
# python3 tools/tiles.py   ← textures/sat{z}.webp + textures/sat.json (حدود كل صورة بوحدات الخريطة 0..1000)
import math, os, subprocess, json, io
from PIL import Image, ImageEnhance
L = 's2cloudless_3857'
def X(lon): return (lon + 180) / 360 * 1000
def Y(lat): return (1 - math.log(math.tan(math.pi / 4 + lat * math.pi / 360)) / math.pi) / 2 * 1000
cache = '/tmp/eox_tiles'; os.makedirs(cache, exist_ok=True)
meta = {}
for z, (lon0, lon1, lat0, lat1), q in [(7, (37, 59, 24, 40.5), 82), (8, (42.2, 51.4, 28.9, 35.9), 84)]:
    n = 2 ** z
    tx0, tx1 = int(X(lon0) / 1000 * n), int(X(lon1) / 1000 * n)
    ty0, ty1 = int(Y(lat1) / 1000 * n), int(Y(lat0) / 1000 * n)
    im = Image.new('RGB', ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256))
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            f = f'{cache}/{z}_{ty}_{tx}.jpg'
            if not os.path.exists(f):
                subprocess.run(['curl', '-sSf', '-o', f, f'https://tiles.maps.eox.at/wmts/1.0.0/{L}/default/g/{z}/{ty}/{tx}.jpg'], check=True)
            im.paste(Image.open(f).convert('RGB'), ((tx - tx0) * 256, (ty - ty0) * 256))
    im = ImageEnhance.Color(ImageEnhance.Contrast(ImageEnhance.Brightness(im).enhance(.86)).enhance(1.12)).enhance(.8)
    im.save(f'textures/sat{z}.webp', quality=q, method=6)
    meta[f'sat{z}'] = [tx0 * 1000 / n, ty0 * 1000 / n, (tx1 + 1) * 1000 / n, (ty1 + 1) * 1000 / n]
    print(z, im.size, (tx1 - tx0 + 1) * (ty1 - ty0 + 1), 'tiles', os.path.getsize(f'textures/sat{z}.webp') // 1024, 'KB')
json.dump(meta, open('textures/sat.json', 'w'))
