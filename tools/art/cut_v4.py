# يحوّل صور Grok لـ v4 ← صور اللعبة (prototypes/grandwar/img):
#  حياة البحر s0* ← v4_s_* (شفافة)، المنتجات p01–p13 من فوق ← v4_p_*، p14–p20 من الجنب ← v4_ps_*،
#  بطاقات البحث rs_* ← 640×360، والسلاح الوطني (docs/art/out/v4-islam، تمويه صحراوي على أخضر، D-056) ← v4_nd_<نوع>_g<جيل>_t (من فوق) و _s (من الجنب)
# python3 tools/art/cut_v4.py
import os, glob, sys
from PIL import Image
R = os.path.join(os.path.dirname(__file__), '..', '..'); SRC = os.path.join(R, 'docs/art/out/v4'); NAT = os.path.join(R, 'docs/art/out/v4-islam'); DST = os.path.join(R, 'prototypes/grandwar/img')
from collections import deque
import numpy as np
from PIL import ImageFilter
def cut_white(im, lo=230):
    im = im.convert('RGB'); a = np.asarray(im).astype(int); mn, mx = a.min(axis=2), a.max(axis=2)
    grey = (mn > lo) & ((mx - mn) < 20); h, w = grey.shape; bg = np.zeros_like(grey)
    q = deque([(y, x) for x in range(w) for y in (0, h - 1)] + [(y, x) for y in range(h) for x in (0, w - 1)])
    while q:
        y, x = q.popleft()
        if 0 <= y < h and 0 <= x < w and grey[y, x] and not bg[y, x]:
            bg[y, x] = 1; q.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    al = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.8))
    out = im.convert('RGBA'); out.putalpha(al); bb = al.point(lambda v: 255 if v > 30 else 0).getbbox()
    return out.crop(bb) if bb else out
def save(im, name, w, q=80):
    im = im.copy(); im.thumbnail((w, w * 4)); p = os.path.join(DST, name + '.webp'); im.save(p, 'WEBP', quality=q, method=6); return os.path.getsize(p)
kb = 0
S = {'s01-tanker': 'tanker', 's02-container': 'container', 's03-lng': 'lng', 's04-bulk': 'bulk', 's05-dhow': 'dhow', 's06-heli-navy': 'heli', 's07-oil-platform': 'platform', 's08-fast-boats': 'boats'}
for f, n in S.items(): kb += save(cut_white(Image.open(os.path.join(SRC, f + '.jpg')), 240), 'v4_s_' + n, 256)
for f in sorted(glob.glob(os.path.join(SRC, 'p*.jpg'))):
    b = os.path.basename(f)[:-4]; num = int(b[1:3]); n = b.split('-', 1)[1].replace('-side', '')
    kb += save(cut_white(Image.open(f), 238), ('v4_p_' if num <= 13 else 'v4_ps_') + n, 256 if num <= 13 else 360)
for f in sorted(glob.glob(os.path.join(SRC, 'rs_*.jpg'))):
    n = os.path.basename(f)[:-4]; Image.open(f).convert('RGB').resize((640, 360), Image.LANCZOS).save(os.path.join(DST, n + '.webp'), 'WEBP', quality=72, method=6); kb += os.path.getsize(os.path.join(DST, n + '.webp'))
# السلاح الوطني: الصورة بيها لقطتين (من فوق ومن الجنب) — نفصلهن كقطع متصلة (مو بنص الصورة، لأن أحياناً يتداخلن)
def pieces(im):
    a = np.asarray(im.convert('RGB').resize((im.width // 4, im.height // 4))).astype(int); mn, mx = a.min(axis=2), a.max(axis=2)
    fg = ~((mn > 236) & ((mx - mn) < 18)); fg = np.asarray(Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    h, w = fg.shape; lab = np.zeros((h, w), int); comps = []
    for y0 in range(h):
        for x0 in range(w):
            if fg[y0, x0] and not lab[y0, x0]:
                n = len(comps) + 1; q = deque([(y0, x0)]); lab[y0, x0] = n; xs = []; ys = []
                while q:
                    y, x = q.popleft(); xs.append(x); ys.append(y)
                    for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                        if 0 <= yy < h and 0 <= xx < w and fg[yy, xx] and not lab[yy, xx]: lab[yy, xx] = n; q.append((yy, xx))
                comps.append((len(xs), min(xs) * 4, min(ys) * 4, (max(xs) + 1) * 4, (max(ys) + 1) * 4, n))
    pieces.lab = lab; return sorted(comps, reverse=True)
for f in sorted(glob.glob(os.path.join(NAT, 'nd-*.jpg'))):
    b = os.path.basename(f)[:-4].replace('nd-', '').replace('-', '_'); im = Image.open(f).convert('RGB')
    big = [c for c in pieces(im) if c[0] > pieces(im)[0][0] * .12]
    # نقسمهن لمجموعتين: إذا يتداخلن بالعرض (فوق/جوه) نقسم بالارتفاع، وإلا باليسار/اليمين
    def box(cs): return (max(0, min(c[1] for c in cs) - 6), max(0, min(c[2] for c in cs) - 6), min(im.width, max(c[3] for c in cs) + 6), min(im.height, max(c[4] for c in cs) + 6))
    if len(big) >= 2:
        A, B = big[0], big[1]; ovx = min(A[3], B[3]) - max(A[1], B[1])
        key = (lambda c: (c[2] + c[4]) / 2) if ovx > .3 * min(A[3] - A[1], B[3] - B[1]) else (lambda c: (c[1] + c[3]) / 2)
        mid = (key(A) + key(B)) / 2; g1 = [c for c in big if key(c) < mid]; g2 = [c for c in big if key(c) >= mid]
        # بكل لقطة: نخلي القطع الكبيرة بس (الشظايا الصغيرة من اللقطة الثانية تنشال)
        g1 = [c for c in g1 if c[0] >= .3 * max(x[0] for x in g1)]; g2 = [c for c in g2 if c[0] >= .3 * max(x[0] for x in g2)]
        # نبيّض كل شي مو من هاللقطة قبل القص
        def only(g):
            keep = np.isin(pieces.lab, [c[5] for c in g]); m = Image.fromarray((keep * 255).astype(np.uint8)).resize(im.size).filter(ImageFilter.MaxFilter(9))
            out = Image.composite(im, Image.new('RGB', im.size, (255, 255, 255)), m); return out.crop(box(g))
        allc = pieces(im); top, side = only(g1), only(g2)
    else: W, H = im.size; top, side = im.crop((0, 0, W // 2, H)), im.crop((W // 2, 0, W, H))
    top = cut_white(top, 238)
    if top.height > top.width * 1.3: top = top.rotate(90, expand=True)   # من فوق طالعة عمودية: المقدمة لليمين
    kb += save(top, 'v4_nd_' + b + '_t', 256) + save(cut_white(side, 238), 'v4_nd_' + b + '_s', 360)
print('ok', round(kb / 1024), 'KB')
