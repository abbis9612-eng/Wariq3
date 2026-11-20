# يقص صور Grok (docs/art/out) ← صور اللعبة (prototypes/grandwar/img/u_<key>_v.webp و u_<key>_t.webp)
# الخلفية البيضاء ← شفافة (ملء من الحواف، فالأبيض داخل المركبة ما ينمسح)، وظل الأرض الرمادي ← ظل أسود نص شفاف.
# python3 tools/art/cut.py
import glob, os, re
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

R = os.path.join(os.path.dirname(__file__), '..', '..'); SRC = os.path.join(R, 'docs/art/out'); DST = os.path.join(R, 'prototypes/grandwar/img')
# صور B اللي طلعت فعلاً من فوق (الطيارات والدبابات وبعض المنصات)؛ صور B للدفاع الجوي والسفن طلعت من الجنب فما تنستعمل
TOP_OK = set(range(21, 38)) | set(range(45, 55)) | {55, 56, 58}

def cut(path, shadow=True, lo=120):
    im = Image.open(path).convert('RGB'); a = np.asarray(im).astype(int); mn, mx = a.min(axis=2), a.max(axis=2)
    # lo: أفتح لون ينحسب خلفية/ظل (الطيارات والسفن الرمادية: 226 حتى ما ينمسح بدنها)
    grey = (mn > lo) & ((mx - mn) < 16); h, w = grey.shape; bg = np.zeros_like(grey)
    q = deque([(y, x) for x in range(w) for y in (0, h - 1)] + [(y, x) for y in range(h) for x in (0, w - 1)])
    while q:
        y, x = q.popleft()
        if 0 <= y < h and 0 <= x < w and grey[y, x] and not bg[y, x]:
            bg[y, x] = 1; q.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    sh = np.clip((238 - mn) * 2.2, 0, 150) if shadow else np.zeros_like(mn)
    alpha = np.where(bg, sh, 255).astype(np.uint8); rgb = a.copy(); rgb[bg] = [10, 12, 10]
    out = Image.fromarray(np.dstack([rgb, alpha]).astype(np.uint8), 'RGBA')
    hard = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))
    al = np.where(np.asarray(hard) > 0, 255, alpha).astype(np.uint8); out.putalpha(Image.fromarray(al).filter(ImageFilter.GaussianBlur(.7)))
    return out.crop(Image.fromarray(al).point(lambda v: 255 if v > 20 else 0).getbbox())

n = 0; kb = 0
for f in sorted(glob.glob(os.path.join(SRC, '*.jpg'))):
    m = re.match(r'(\d\d)([ab])-(.+)\.jpg$', os.path.basename(f))
    if not m or '-v2' in f: continue   # 01a-siper-v2.jpg وغيرها: نسخ قديمة
    num, v, key = int(m[1]), m[2], m[3]
    if v == 'a':
        grey_obj = 21 <= num <= 44   # طيارات وسفن: رمادي فاتح وبلا ظل أرض
        o = cut(f, shadow=not grey_obj, lo=226 if grey_obj else 120); o.thumbnail((320, 320), Image.LANCZOS); p = os.path.join(DST, f'u_{key}_v.webp')
    else:
        if num not in TOP_OK: continue
        o = cut(f, shadow=False, lo=226 if 21 <= num <= 44 else 120); s = max(o.size); sq = Image.new('RGBA', (s, s)); sq.paste(o, ((s - o.width) // 2, (s - o.height) // 2)); o = sq.resize((192, 192), Image.LANCZOS)
        p = os.path.join(DST, f'u_{key}_t.webp')
    o.save(p, 'WEBP', quality=82, method=6); n += 1; kb += os.path.getsize(p)
print(n, 'صورة', kb // 1024, 'KB')
