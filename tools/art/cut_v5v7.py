# صور السلاح الوطني والترسانة والعائلات ← صور اللعبة (prototypes/grandwar/img):
#  v5-national nt-<نوع>-g<جيل> ← v5_nt_<نوع>_g<جيل> (صورة 960×540)
#  v6-flagship fl-<k>-h ← v6_fl_<k> (960×540)، fl-<k>-t ← v6_flt_<k> (من فوق، شفافة)
#  v7-families fm-<k>-h ← v7_fm_<k>، fm-<k>-t ← v7_fmt_<k>
# python3 tools/art/cut_v5v7.py
import os, glob, importlib.util
from PIL import Image
R = os.path.join(os.path.dirname(__file__), '..', '..'); OUT = os.path.join(R, 'docs/art/out'); DST = os.path.join(R, 'prototypes/grandwar/img')
src = open(os.path.join(os.path.dirname(__file__), 'cut_v4.py')).read(); ns = {}
ns['__file__'] = os.path.join(os.path.dirname(__file__), 'cut_v4.py'); exec(src.split('kb = 0')[0], ns); cut_white = ns['cut_white']
kb = 0
def hero(f, name):
    global kb; p = os.path.join(DST, name + '.webp'); Image.open(f).convert('RGB').resize((960, 540), Image.LANCZOS).save(p, 'WEBP', quality=74, method=6); kb += os.path.getsize(p)
def top(f, name):
    global kb; im = cut_white(Image.open(f), 238); im.thumbnail((300, 1200)); p = os.path.join(DST, name + '.webp'); im.save(p, 'WEBP', quality=80, method=6); kb += os.path.getsize(p)
for f in glob.glob(os.path.join(OUT, 'v5-national', 'nt-*.jpg')): b = os.path.basename(f)[3:-4].replace('-', '_'); hero(f, 'v5_nt_' + b)
for d, pre in (('v6-flagship', 'fl'), ('v7-families', 'fm')):
    for f in glob.glob(os.path.join(OUT, d, pre + '-*.jpg')):
        b = os.path.basename(f)[len(pre) + 1:-4]; k, v = b.rsplit('-', 1); tag = 'v6_fl' if pre == 'fl' else 'v7_fm'
        (hero if v == 'h' else top)(f, tag + ('_' if v == 'h' else 't_') + k)
print('ok', round(kb / 1024), 'KB')
