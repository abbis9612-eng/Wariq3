# الخريطة المرسومة (طبقة الأساس): تضاريس مظللة من الارتفاعات (AWS Terrain Tiles) + مياه ومزارع مستخرجة من Sentinel-2 cloudless 2016 (EOX، CC BY 4.0)
# ← textures/relief.png (ظل)، textures/water.png (قناع)، textures/veg.png (قناع)، textures/basemap.json (الحدود بالمتر)
import math, os, subprocess, json, numpy as np
from PIL import Image, ImageFilter
LON0, LON1, LAT0, LAT1 = 46.2, 49.7, 29.8, 33.1
REF = (31.45, 47.95); MPU = 40075016 * math.cos(math.radians(REF[0]))
MX = lambda lo: (lo + 180) / 360
MY = lambda la: (1 - math.log(math.tan(math.pi / 4 + la * math.pi / 360)) / math.pi) / 2
def grab(url, z, ext, cache):
    n = 2 ** z; tx0, tx1, ty0, ty1 = int(MX(LON0) * n), int(MX(LON1) * n), int(MY(LAT1) * n), int(MY(LAT0) * n)
    im = Image.new('RGB', ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256)); os.makedirs(cache, exist_ok=True)
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            f = f'{cache}/{z}_{ty}_{tx}.{ext}'
            if not os.path.exists(f): subprocess.run(['curl', '-sSf', '--retry', '3', '-o', f, url.format(z=z, x=tx, y=ty)], check=True)
            im.paste(Image.open(f).convert('RGB'), ((tx - tx0) * 256, (ty - ty0) * 256))
    b = [tx0 / n, ty0 / n, (tx1 + 1) / n, (ty1 + 1) / n]
    return im, b
Z = 11
sat, b = grab('https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg', Z, 'jpg', '/tmp/eox_tiles')
dem, b2 = grab('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png', Z - 1, 'png', '/tmp/terr_tiles')
W, H = sat.size
a = np.asarray(dem).astype(np.float32); h = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768; h = np.maximum(h, 0)
h = np.asarray(Image.fromarray(h).resize((W, H), Image.BICUBIC)).astype(np.float32)
mpp = (b[2] - b[0]) * MPU / W
gy, gx = np.gradient(h, mpp)
az, alt = math.radians(315), math.radians(42)
slope = np.arctan(np.hypot(gx, gy) * 1.6); aspect = np.arctan2(-gx, gy)
shade = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
shade = np.clip(shade, 0, 1)
Image.fromarray((shade * 255).astype(np.uint8)).save('textures/relief.png', optimize=True)
s = np.asarray(sat).astype(np.float32) / 255; R, G, B_ = s[..., 0], s[..., 1], s[..., 2]
lum = (R + G + B_) / 3
water = ((B_ > R * 1.02) & (lum < .42)) | ((B_ > R + .04) & (G > R) & (lum < .5))
water = np.asarray(Image.fromarray((water * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(3)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(.8)))   # فتح: يشيل البقع الصغيرة
veg = (G > R * 1.03) & (G > B_ * 1.05) & (lum < .55)
veg = np.asarray(Image.fromarray((veg * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.5)))
Image.fromarray(water).save('textures/water.png', optimize=True); Image.fromarray(veg).save('textures/veg.png', optimize=True)
def xy(mx, my): return [round((mx - MX(REF[1])) * MPU), round(-(my - MY(REF[0])) * MPU)]
json.dump({'b': [*xy(b[0], b[1]), *xy(b[2], b[3])], 'size': [W, H], 'mpp': mpp}, open('textures/basemap.json', 'w'))
print('size', W, H, 'mpp', round(mpp), 'h', h.min(), h.max(), 'water%', round((water > 128).mean() * 100, 1), 'veg%', round((veg > 128).mean() * 100, 1))
