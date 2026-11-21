# صور الوحدات الناقصة (I-141) ← صور اللعبة (prototypes/grandwar/img)، خلفية شفافة:
#  v8-units <k>-v.jpg ← v8_<k>_v (من الجنب، المقدمة لليسار)، <k>-t.jpg ← v8_<k>_t (من فوق، المقدمة لليمين)
# python3 tools/art/cut_v8.py
import os, glob
from PIL import Image
R = os.path.join(os.path.dirname(__file__), '..', '..'); OUT = os.path.join(R, 'docs/art/out/v8-units'); DST = os.path.join(R, 'prototypes/grandwar/img')
src = open(os.path.join(os.path.dirname(__file__), 'cut_v4.py')).read(); ns = {'__file__': os.path.join(os.path.dirname(__file__), 'cut_v4.py')}
exec(src.split('kb = 0')[0], ns); cut_white = ns['cut_white']
kb = 0
for f in sorted(glob.glob(os.path.join(OUT, '*-[vt].jpg'))):
    b = os.path.basename(f)[:-4]; k, v = b.rsplit('-', 1); k = k.replace('-', '_')
    im = cut_white(Image.open(f), 238)
    if v == 't':   # مربعة حتى تدور بالمعركة القريبة بدون تشويه
        s = max(im.size); sq = Image.new('RGBA', (s, s), (0, 0, 0, 0)); sq.paste(im, ((s - im.width) // 2, (s - im.height) // 2)); im = sq; im.thumbnail((256, 256))
    else: im.thumbnail((420, 300))
    p = os.path.join(DST, f'v8_{k}_{v}.webp'); im.save(p, 'WEBP', quality=80, method=6); kb += os.path.getsize(p); print(os.path.basename(p), im.size)
print('ok', round(kb / 1024), 'KB')
