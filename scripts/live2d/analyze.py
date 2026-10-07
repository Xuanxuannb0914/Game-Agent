"""Probe paimon-pet.png: alpha bbox, coarse color buckets, and per-row/col extents.

Read-only analysis used to design the layering rules. Not part of the app build.
"""

import numpy as np
from PIL import Image

SRC = "public/paimon-pet.png"

im = Image.open(SRC).convert("RGBA")
a = np.asarray(im).astype(np.float32)
h, w, _ = a.shape
print(f"size = {w}x{h}")

rgb = a[:, :, :3]
alpha = a[:, :, 3]
solid = alpha > 16

ys, xs = np.nonzero(solid)
print(f"alpha bbox: x[{xs.min()}..{xs.max()}] y[{ys.min()}..{ys.max()}]")
print(f"opaque px = {solid.sum()} ({solid.sum() / (w * h) * 100:.1f}% of canvas)")


def bucket(r, g, b):
    mx, mn = max(r, g, b), min(r, g, b)
    v = mx / 255.0
    s = 0.0 if mx == 0 else (mx - mn) / mx
    # hue
    if mx == mn:
        hue = 0.0
    elif mx == r:
        hue = (60 * ((g - b) / (mx - mn)) + 360) % 360
    elif mx == g:
        hue = 60 * ((b - r) / (mx - mn)) + 120
    else:
        hue = 60 * ((r - g) / (mx - mn)) + 240
    if s < 0.12 and v > 0.75:
        return "white"
    if s < 0.12:
        return "gray"
    if 20 <= hue < 70 and s > 0.25:
        return "gold"
    if 70 <= hue < 170:
        return "green"
    if 170 <= hue < 260:
        return "blue"
    if hue >= 260 or hue < 20:
        return "red_skin"
    return "other"


# coarse 8x16 grid dump to locate body parts
rows, cols = 16, 8
buckets = {}
for gy in range(rows):
    line = []
    for gx in range(cols):
        y0, y1 = h * gy // rows, h * (gy + 1) // rows
        x0, x1 = w * gx // cols, w * (gx + 1) // cols
        cell_a = alpha[y0:y1, x0:x1]
        m = cell_a > 16
        if m.sum() < 30:
            line.append("....")
            continue
        px = rgb[y0:y1, x0:x1][m]
        cnt = {}
        for p in px[:: max(1, len(px) // 400)]:
            k = bucket(*p)
            cnt[k] = cnt.get(k, 0) + 1
        top = max(cnt, key=cnt.get)
        buckets[top] = buckets.get(top, 0) + int(m.sum())
        line.append(f"{top[:4]:>4}")
    print(f"y{gy:02d} " + " ".join(line))

print("--- bucket totals (opaque px) ---")
for k, v in sorted(buckets.items(), key=lambda kv: -kv[1]):
    print(f"  {k:10s} {v}")