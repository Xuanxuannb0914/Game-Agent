"""Localize the worst idle diff pixels."""
from __future__ import annotations

import json
import sys
import numpy as np
from PIL import Image

sys.path.insert(0, "scripts/live2d")
from complete_layers import ORDER  # noqa: E402

RIG = "public/live2d/paimon/rig"
W, H = 407, 820
orig = np.asarray(Image.open("public/paimon-pet.png").convert("RGBA")).astype(np.float32)
off = json.load(open(f"{RIG}/rig.json"))

canvas = np.zeros((H, W, 4), np.float32)
for n in ORDER:
    if n not in off:
        continue
    im = np.asarray(Image.open(f"{RIG}/{n}.png").convert("RGBA")).astype(np.float32)
    a = im[:, :, 3:4] / 255.0
    if n.startswith("Eye_Closed") or n == "Mouth_Open":
        a = a * 0.0
    h, w = im.shape[:2]
    x0, y0 = off[n]["x"], off[n]["y"]
    dst = canvas[y0:y0 + h, x0:x0 + w]
    dst[:, :, :3] = im[:, :, :3] * a + dst[:, :, :3] * (1 - a)
    dst[:, :, 3:4] = a * 255 + dst[:, :, 3:4] * (1 - a)

al = canvas[:, :, 3:4] / 255.0
comp = (canvas[:, :, :3] * al + 255 * (1 - al)).astype(np.uint8)
o = (orig[:, :, :3] * (orig[:, :, 3:4] / 255.0) + 255 * (1 - orig[:, :, 3:4] / 255.0)).astype(np.uint8)
d = np.abs(comp.astype(np.int16) - o.astype(np.int16)).max(axis=2)

# cluster of worst pixels
bad = d > 60
ys, xs = np.nonzero(bad)
print("pixels with diff>60:", len(ys))
if len(ys):
    print("  bbox x[%d..%d] y[%d..%d]" % (xs.min(), xs.max(), ys.min(), ys.max()))
    # group roughly
    from collections import Counter
    c = Counter((y // 40 * 40, x // 40 * 40) for y, x in zip(ys, xs))
    for (gy, gx), cnt in c.most_common(10):
        print(f"    block y~{gy} x~{gx}: {cnt}")
# ignore alpha==0 edge pixels
print("\nnote: alpha of comp at bad pixels sample:")
for i in range(0, min(len(ys), 5)):
    y, x = ys[i], xs[i]
    print(f"  ({x},{y}) comp={tuple(int(v) for v in comp[y,x])} orig={tuple(int(v) for v in o[y,x])} alpha={canvas[y,x,3]:.0f}")