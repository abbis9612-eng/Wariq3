# يقص صور Grok البحرية (docs/art/out/naval) ← prototypes/grandwar/img/nv_<key>.webp (I-116)
# السفن والصواريخ: خلفية بيضاء ← شفافة. المؤثرات (خلفية سودة): الشفافية من السطوع. البحر: يصير قابل للتكرار (مرآة) 512.
# python3 tools/art/cut_naval.py
import glob, os, re
from collections import deque
import numpy as np
from PIL import Image, ImageFilter
R = os.path.join(os.path.dirname(__file__), '..', '..'); SRC = os.path.join(R, 'docs/art/out/naval'); DST = os.path.join(R, 'prototypes/grandwar/img')
def white_cut(path):
    im = Image.open(path).convert('RGB'); a = np.asarray(im).astype(int); mn, mx = a.min(axis=2), a.max(axis=2)
    bgc = (mn > 232) & ((mx - mn) < 12); h, w = bgc.shape; bg = np.zeros_like(bgc)
    q = deque([(y, x) for x in range(w) for y in (0, h - 1)] + [(y, x) for y in range(h) for x in (0, w - 1)])
    while q:
        y, x = q.popleft()
        if 0 <= y < h and 0 <= x < w and bgc[y, x] and not bg[y, x]: bg[y, x] = 1; q.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    al = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.6))
    o = im.convert('RGBA'); o.putalpha(al); return o.crop(al.point(lambda v: 255 if v > 30 else 0).getbbox())
def black_cut(path, k=1.6, tint=None):
    im = Image.open(path).convert('RGB'); a = np.asarray(im).astype(float); lum = a.max(axis=2)
    al = np.clip((lum - 12) * k, 0, 255)
    rgb = a if tint is None else np.dstack([np.full_like(lum, tint[i]) for i in range(3)])
    rgb = np.where(al[..., None] > 0, np.clip(rgb * 255 / np.maximum(lum[..., None], 1) if tint is None else rgb, 0, 255), 0)
    o = Image.fromarray(np.dstack([rgb, al]).astype(np.uint8), 'RGBA'); bb = Image.fromarray(al.astype(np.uint8)).point(lambda v: 255 if v > 8 else 0).getbbox(); return o.crop(bb)
W = {'carrier': 640, 'cv-china': 640, 'amphib': 512, 'kirov': 512, 'ddg': 384, 't055': 400, 'frigate': 360, 'moudge': 320, 'fac': 200, 'sub': 320, 'c802': 128, 'harpoon': 128, 'sm2': 128, 'tomahawk': 128}
n = kb = 0
for f in sorted(glob.glob(os.path.join(SRC, '*.jpg'))):
    m = re.match(r'n(\d\d)-(.+)\.jpg$', os.path.basename(f)); num, key = int(m[1]), m[2]
    if num <= 14: o = white_cut(f); o.thumbnail((W.get(key, 384), 400), Image.LANCZOS)
    elif key == 'ocean':
        # قابل للتكرار بلا نقش: نزيح الصورة نص حجمها وندمج الحواف بقناع ناعم (الطريقة المعروفة للنسيج)
        A = np.asarray(Image.open(f).convert('RGB').resize((512, 512), Image.LANCZOS)).astype(float); B = np.roll(np.roll(A, 256, 0), 256, 1)
        yy, xx = np.mgrid[0:512, 0:512]; m = np.minimum(np.minimum(xx, 511 - xx), np.minimum(yy, 511 - yy)) / 256; m = np.clip(m * 2.2, 0, 1)[..., None]
        o = Image.fromarray((A * m + B * (1 - m)).astype(np.uint8))
        o = Image.fromarray(np.roll(np.roll(np.asarray(o), 256, 0), 256, 1))
    elif key == 'oil-slick': o = black_cut(f, 3); o.thumbnail((384, 384), Image.LANCZOS)
    elif key in ('smoke-trail', 'splash', 'wake'): o = black_cut(f, 1.3); o.thumbnail((384, 384), Image.LANCZOS)
    else: o = black_cut(f, 2); o.thumbnail((384, 384), Image.LANCZOS)
    p = os.path.join(DST, f'nv_{key}.webp'); o.save(p, 'WEBP', quality=80, method=6); n += 1; kb += os.path.getsize(p)
print(n, 'صورة', kb // 1024, 'KB')
