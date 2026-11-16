# صور أرض للمشهد المايل: Sentinel-2 cloudless 2016 (EOX، CC BY 4.0)، بإسقاط ميركاتور
# أساس للمنطقة (z10) + رقع أدق حوالين المواقع (z12 بعرض ~30 كم و z14 بعرض ~6 كم) ← textures/*.webp + textures/tiles.json
import math, os, subprocess, json
from PIL import Image, ImageEnhance
def X(lon): return (lon + 180) / 360
def Y(lat): return (1 - math.log(math.tan(math.pi / 4 + lat * math.pi / 360)) / math.pi) / 2
cache = '/tmp/eox_tiles'; os.makedirs(cache, exist_ok=True); out = {}
def grab(name, z, lon0, lon1, lat0, lat1, q):
    n = 2 ** z; tx0, tx1, ty0, ty1 = int(X(lon0) * n), int(X(lon1) * n), int(Y(lat1) * n), int(Y(lat0) * n)
    im = Image.new('RGB', ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256))
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            f = f'{cache}/{z}_{ty}_{tx}.jpg'
            if not os.path.exists(f): subprocess.run(['curl', '-sSf', '-o', f, f'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{ty}/{tx}.jpg'], check=True)
            im.paste(Image.open(f).convert('RGB'), ((tx - tx0) * 256, (ty - ty0) * 256))
    im = ImageEnhance.Color(ImageEnhance.Contrast(im).enhance(1.08)).enhance(.9)
    im.save(f'textures/{name}.webp', quality=q, method=6)
    out[name] = {'z': z, 'b': [tx0 / n, ty0 / n, (tx1 + 1) / n, (ty1 + 1) / n]}
    print(name, im.size, os.path.getsize(f'textures/{name}.webp') // 1024, 'KB')
grab('base', 10, 47.4, 49.5, 30.1, 32.9, 80)
SITES = {'s400': (31.30, 48.80), 'zolf': (32.42, 48.45), 'pat': (30.58, 47.72)}
for k, (la, lo) in SITES.items():
    d = .16; grab(k + '12', 12, lo - d, lo + d, la - d * .86, la + d * .86, 82)
    d = .03; grab(k + '14', 14, lo - d, lo + d, la - d * .86, la + d * .86, 84)
json.dump({'tiles': out, 'sites': SITES}, open('textures/tiles.json', 'w'), indent=1)
