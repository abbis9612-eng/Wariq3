# بيانات تجربة الشرح: تضاريس حقيقية (Terrarium، AWS Terrain Tiles) + صور أقمار (Sentinel-2 2016) لمنطقة دزفول
import math, os, subprocess, json, numpy as np
from PIL import Image
LON0, LON1, LAT0, LAT1 = 48.15, 48.95, 31.95, 32.65
def tx(lon, z): return (lon + 180) / 360 * 2 ** z
def ty(lat, z): return (1 - math.log(math.tan(math.pi / 4 + lat * math.pi / 360)) / math.pi) / 2 * 2 ** z
def grab(z, url, ext):
    x0, x1, y0, y1 = int(tx(LON0, z)), int(tx(LON1, z)), int(ty(LAT1, z)), int(ty(LAT0, z))
    im = Image.new('RGB', ((x1 - x0 + 1) * 256, (y1 - y0 + 1) * 256))
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            f = f'/tmp/mock_{z}_{y}_{x}_{ext}'
            if not os.path.exists(f): subprocess.run(['curl', '-sSf', '-o', f, url.format(z=z, x=x, y=y)], check=True)
            im.paste(Image.open(f).convert('RGB'), ((x - x0) * 256, (y - y0) * 256))
    return im, [x0 / 2 ** z, y0 / 2 ** z, (x1 + 1) / 2 ** z, (y1 + 1) / 2 ** z]
sat, bs = grab(12, 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg', 'jpg')
sat.save('data/sat.jpg', quality=88)
el, be = grab(11, 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png', 'png')
a = np.asarray(el).astype(np.float32); h = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
np.save('data/h.npy', h); json.dump({'sat': bs, 'el': be, 'hmin': float(h.min()), 'hmax': float(h.max()), 'hw': h.shape[1], 'hh': h.shape[0]}, open('data/meta.json', 'w'))
Image.fromarray(np.clip((h - h.min()) / (h.max() - h.min()) * 65535, 0, 65535).astype(np.uint16)).save('data/h16.png')
print(sat.size, h.shape, h.min(), h.max())
