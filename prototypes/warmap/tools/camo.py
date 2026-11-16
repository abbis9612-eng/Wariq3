# تمويه صحراوي (مثل F-14 الإيرانية) فوق الصورة المخبوزة + تصغير 256 مع توضيح
import sys, numpy as np
from PIL import Image, ImageFilter
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA'); a = np.asarray(im).astype(np.float32) / 255
H, W = a.shape[:2]; rng = np.random.default_rng(7)
def noise(sc):
    n = rng.random((H // sc + 2, W // sc + 2)).astype(np.float32)
    return np.asarray(Image.fromarray((n * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(sc / 3))).astype(np.float32) / 255
n1, n2 = noise(90), noise(55)
cols = np.array([[0.80, 0.68, 0.47], [0.55, 0.40, 0.25], [0.42, 0.40, 0.30]], np.float32)   # رملي، بني، زيتوني
idx = np.where(n1 > .55, 1, np.where(n2 > .6, 2, 0))
camo = cols[idx]
lum = a[..., :3].mean(-1, keepdims=True)
mask = np.clip((lum - .45) * 3, 0, 1) * (a[..., 3:] > .5)   # الهيكل الفاتح بس (مو الزجاج والمحركات)
rgb = a[..., :3] * (1 - mask * .85) + (camo * lum * 1.25) * mask * .85
out = np.concatenate([np.clip(rgb, 0, 1), a[..., 3:]], -1)
o = Image.fromarray((out * 255).astype(np.uint8), 'RGBA').resize((256, 256), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.2, 60, 2))
o.save(dst)
