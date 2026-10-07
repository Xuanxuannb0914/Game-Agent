"""Locate color regions precisely via connected components (read-only)."""

import numpy as np
import cv2
from PIL import Image

SRC = "public/paimon-pet.png"
im = Image.open(SRC).convert("RGBA")
a = np.asarray(im).astype(np.float32)
h, w, _ = a.shape
rgb = a[:, :, :3] / 255.0
r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
alpha = a[:, :, 3]
solid = alpha > 16

mx = rgb.max(axis=2)
mn = rgb.min(axis=2)
v = mx
s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)

# hue
hue = np.zeros_like(mx)
d = np.maximum(mx - mn, 1e-6)
m1 = (mx == r)
m2 = (mx == g) & ~m1
m3 = (mx == b) & ~m1 & ~m2
hue[m1] = ((g - b)[m1] / d[m1] * 60) % 360
hue[m2] = ((b - r)[m2] / d[m2] * 60) + 120
hue[m3] = ((r - g)[m3] / d[m3] * 60) + 240

masks = {
    "gold": (hue >= 25) & (hue < 70) & (s > 0.30) & (v > 0.35),
    "blue": (hue >= 175) & (hue < 265) & (s > 0.30) & (v > 0.30),
    "skin": ((hue >= 340) | (hue < 25)) & (s > 0.10) & (v > 0.6),
    "white": (s < 0.14) & (v > 0.80),
}

for name, m in masks.items():
    m = (m & solid).astype(np.uint8)
    n, lbl, stats, cents = cv2.connectedComponentsWithStats(m, connectivity=8)
    order = np.argsort(stats[1:, 4])[::-1] + 1
    print(f"=== {name}: {n - 1} comps, total {int(m.sum())} ===")
    for cid in order[:6]:
        area = stats[cid, 4]
        if area < 60:
            break
        x, y, bw, bh = stats[cid, 0], stats[cid, 1], stats[cid, 2], stats[cid, 3]
        cx, cy = cents[cid]
        print(
            f"  comp{cid} size={area} "
            f"x[{x}..{x + bw - 1}] y[{y}..{y + bh - 1}] "
            f"cx={cx:.0f} cy={cy:.0f}"
        )