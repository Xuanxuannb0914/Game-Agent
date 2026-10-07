"""Measure the smile's exact bbox and the chin outline position."""
from __future__ import annotations

import numpy as np
from PIL import Image

orig = np.asarray(Image.open("public/paimon-pet.png").convert("RGBA")).astype(np.float32)
lum = orig[:, :, :3].mean(axis=2)

# smile = dark warm pixels in a generous search window
y0, y1, x0, x1 = 208, 240, 160, 235
win = lum[y0:y1, x0:x1]
m = win < 225
ys, xs = np.nonzero(m)
print("dark pixels bbox:", x0 + xs.min(), y0 + ys.min(), x0 + xs.max(), y0 + ys.max(), "count", len(ys))

# per-row extent of dark pixels
for yy in range(y0, y1):
    row = np.nonzero(lum[yy, x0:x1] < 225)[0]
    if len(row):
        print(f"  y={yy} x[{x0+row.min()}..{x0+row.max()}] n={len(row)} minlum={lum[yy,x0:x1].min():.0f}")

# chin outline: first dark row per column
print("\nchin outline (first y with lum<200):")
for x in range(165, 231, 5):
    col = np.nonzero(lum[228:260, x] < 200)[0]
    print(f"  x={x}: y={228+col.min() if len(col) else None}")