# يحوّل صور Grok لـ v3 (docs/art/out/v3) ← صور اللعبة (prototypes/grandwar/img):
#  بطاقات المشاريع والبحث pj_*/rs_* ← 640×360 webp
#  الصواريخ والمنصة والحطام (خلفية بيضاء) ← شفافة v3_m_*/v3_w_*
#  الانفجارات (خلفية سوداء) ← v3_x_* (تنرسم بـ lighter)، والدخان والغبار ← شفافية من الإضاءة
# python3 tools/art/cut_v3.py
import os, glob
from collections import deque
import numpy as np
from PIL import Image, ImageFilter
R = os.path.join(os.path.dirname(__file__), '..', '..'); SRC = os.path.join(R, 'docs/art/out/v3'); DST = os.path.join(R, 'prototypes/grandwar/img')

def cut_white(path, lo=200):
    im = Image.open(path).convert('RGB'); a = np.asarray(im).astype(int); mn, mx = a.min(axis=2), a.max(axis=2)
    grey = (mn > lo) & ((mx - mn) < 20); h, w = grey.shape; bg = np.zeros_like(grey)
    q = deque([(y, x) for x in range(w) for y in (0, h - 1)] + [(y, x) for y in range(h) for x in (0, w - 1)])
    while q:
        y, x = q.popleft()
        if 0 <= y < h and 0 <= x < w and grey[y, x] and not bg[y, x]:
            bg[y, x] = 1; q.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    al = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.8))
    out = im.convert('RGBA'); out.putalpha(al)
    return out.crop(al.point(lambda v: 255 if v > 30 else 0).getbbox())

def lum_alpha(path, k=2.2, tint=None):
    a = np.asarray(Image.open(path).convert('RGB')).astype(float); L = a.max(axis=2)
    al = np.clip(L * k, 0, 255); rgb = np.clip(a / np.maximum(L[..., None], 1) * np.maximum(L[..., None], 40) * 1.0, 0, 255)
    if tint is not None: rgb = np.clip(rgb * .5 + np.array(tint) * .5, 0, 255)
    return Image.fromarray(np.dstack([rgb, al]).astype(np.uint8), 'RGBA')

def save(im, name, w):
    im = im.copy(); im.thumbnail((w, w * 4)); im.save(os.path.join(DST, name + '.webp'), 'WEBP', quality=78, method=6)
    return os.path.getsize(os.path.join(DST, name + '.webp'))

kb = 0
for f in sorted(glob.glob(os.path.join(SRC, 'pj_*.jpg')) + glob.glob(os.path.join(SRC, 'rs_*.jpg'))):
    im = Image.open(f).convert('RGB').resize((640, 360), Image.LANCZOS); n = os.path.basename(f)[:-4]
    im.save(os.path.join(DST, n + '.webp'), 'WEBP', quality=72, method=6); kb += os.path.getsize(os.path.join(DST, n + '.webp'))
M = {'m01-shahab3': 'shahab3', 'm02-fattah': 'fattah', 'm03-iskander': 'iskander', 'm04-kinzhal': 'kinzhal', 'm05-atacms': 'atacms', 'm06-tomahawk': 'tomahawk', 'm07-shahed': 'shahed', 'm08-patriot': 'patriot', 'm09-arrow': 'arrow', 'm10-thaad': 'thaad'}
# الصواريخ البيضة (باتريوت، آرو، ثاد، أتاكمز، كينجال): بس الأبيض الصافي خلفية حتى البدن ما ينمسح
WHITE = {'atacms', 'patriot', 'arrow', 'thaad', 'kinzhal'}
for s, n in M.items(): kb += save(cut_white(os.path.join(SRC, s + '.jpg'), 247 if n in WHITE else 200), 'v3_m_' + n, 320)
for s, n in {'m11-launcher': 'launch', 'w01-tank-wreck': 'tank', 'w02-plane-wreck': 'plane', 'w03-building-rubble': 'rubble', 'w04-crater': 'crater'}.items(): kb += save(cut_white(os.path.join(SRC, s + '.jpg'), 215), 'v3_w_' + n, 256)
for s, n in {'x01-explosion-building': 'big', 'x02-explosion-tank': 'tank', 'x03-intercept-sky': 'icpt', 'x04-muzzle-flash': 'flash'}.items(): kb += save(Image.open(os.path.join(SRC, s + '.jpg')).convert('RGB'), 'v3_x_' + n, 256)
kb += save(lum_alpha(os.path.join(SRC, 'x05-black-smoke.jpg'), 6), 'v3_x_smoke', 256)
kb += save(lum_alpha(os.path.join(SRC, 'x06-dust-cloud.jpg'), 1.8), 'v3_x_dust', 256)
print('ok', round(kb / 1024), 'KB')
