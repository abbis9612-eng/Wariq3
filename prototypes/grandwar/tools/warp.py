# يحوّل صور الأرض المظللة (ميركاتور) لنفس إسقاط الخريطة (كم) — صورة للمنطقة كلها وصورة أدق للجبهة الجنوبية
import sys, json, math, numpy as np
from PIL import Image
T = sys.argv[1]  # مجلد world3d/terrain
L = json.load(open(T + '/levels.json'))['levels']
LON0, LAT1, KX, KY = 38.5, 40.2, 93.3608, 110.57
def warp(level, x0, y0, x1, y1, ppk, out):
    m = L[level]['m']; im = np.asarray(Image.open(f'{T}/{level}_light.webp').convert('RGB')); S = im.shape[0]
    W, H = int((x1 - x0) * ppk), int((y1 - y0) * ppk)
    xs = x0 + (np.arange(W) + .5) / ppk; ys = y0 + (np.arange(H) + .5) / ppk
    lon = xs / KX + LON0; lat = LAT1 - ys / KY
    u = (lon + 180) / 360; v = .5 - np.log(np.tan(math.pi / 4 + np.radians(lat) / 2)) / (2 * math.pi)
    px = (u - m[0]) / (m[2] - m[0]) * S; py = (v - m[1]) / (m[3] - m[1]) * S
    PX, PY = np.meshgrid(px, py)
    x0i = np.clip(np.floor(PX - .5).astype(int), 0, S - 2); y0i = np.clip(np.floor(PY - .5).astype(int), 0, S - 2)
    fx = np.clip(PX - .5 - x0i, 0, 1)[..., None]; fy = np.clip(PY - .5 - y0i, 0, 1)[..., None]
    a = im[y0i, x0i]; b = im[y0i, x0i + 1]; c = im[y0i + 1, x0i]; d = im[y0i + 1, x0i + 1]
    r = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
    Image.fromarray(r.astype(np.uint8)).save(out, quality=82); print(out, W, H)
warp('me', -200, -100, 2534, 1836, 1.25, 'img/base_me.webp')
warp('fr', 760, 900, 1040, 1180, 5, 'img/base_south.webp')
