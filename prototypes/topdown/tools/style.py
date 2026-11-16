# يركّب الخريطة المرسومة بثيمين (فاتح/غامق) من الأقنعة ← textures/map_<theme>_<lvl>.webp + قطع 1024 للمستوى الأدق
import json, numpy as np, os, sys
from PIL import Image, ImageFilter
Image.MAX_IMAGE_PIXELS = None
rel = np.asarray(Image.open('textures/relief.png')).astype(np.float32) / 255
wat = np.asarray(Image.open('textures/water.png')).astype(np.float32) / 255
veg = np.asarray(Image.open('textures/veg.png')).astype(np.float32) / 255
TH = {
  'light': dict(land=(222, 208, 176), land2=(206, 188, 150), veg=(170, 182, 128), water=(110, 160, 196), shade=(120, 100, 80), hi=(255, 248, 230), shore=(70, 110, 140)),
  'dark':  dict(land=(58, 64, 70), land2=(48, 54, 60), veg=(48, 70, 56), water=(18, 62, 98), shade=(10, 12, 16), hi=(120, 132, 146), shore=(40, 110, 150)),
}
H, W = rel.shape
rng = np.random.default_rng(3)
noise = np.asarray(Image.fromarray((rng.random((H // 8 + 1, W // 8 + 1)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)).astype(np.float32) / 255
def comp(t):
    c = TH[t]; C = lambda k: np.array(c[k], np.float32)
    img = C('land')[None, None] * (1 - noise[..., None] * .5) + C('land2')[None, None] * (noise[..., None] * .5)
    img = img * (1 - veg[..., None] * .75) + C('veg')[None, None] * veg[..., None] * .75
    s = (rel - .7)[..., None]   # ظل وضوء التضاريس
    img = np.where(s < 0, img * (1 + s * 1.1) + C('shade') * (-s * .4), img + (C('hi') - img) * s * .9)
    edge = np.asarray(Image.fromarray((wat * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))).astype(np.float32) / 255 - wat
    img = img * (1 - wat[..., None]) + C('water')[None, None] * wat[..., None]
    img = img * (1 - edge[..., None] * .7) + C('shore')[None, None] * edge[..., None] * .7
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
os.makedirs('textures/tiles', exist_ok=True)
for t in TH:
    im = comp(t)
    for lv, f in [(0, 4), (1, 2)]:
        im.resize((W // f, H // f), Image.LANCZOS).save(f'textures/map_{t}_{lv}.webp', quality=86, method=6)
    # المستوى الأدق: قطع 1024
    for ty in range(0, H, 1024):
        for tx in range(0, W, 1024):
            im.crop((tx, ty, min(W, tx + 1024), min(H, ty + 1024))).save(f'textures/tiles/{t}_{tx // 1024}_{ty // 1024}.webp', quality=84, method=6)
    im.resize((W // 6, H // 6)).save(f'/tmp/claude-0/-home-user-Wariq3/6a9506ac-76e9-5785-b040-4ec2f8d61677/scratchpad/map_{t}.jpg', quality=85)
print('ok', W, H)
