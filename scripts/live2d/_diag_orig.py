"""Compare original artwork vs completed Face in the mouth box + eye boxes."""
from __future__ import annotations

import numpy as np
from PIL import Image

MX0, MY0, MX1, MY1 = 168, 232, 226, 268
orig = np.asarray(Image.open("public/paimon-pet.png").convert("RGBA"))
print("orig size", orig.shape)

sub = orig[MY0:MY1, MX0:MX1]
r = sub.shape[0] // 2
print("original mouth-box center row:")
for x in range(0, sub.shape[1], 4):
    print(f"  x={MX0+x:3d} rgb={tuple(int(v) for v in sub[r, x, :3])} a={sub[r,x,3]}")

# vertical profile at the mouth center x
cx = (MX0 + MX1) // 2
print(f"\noriginal vertical profile x={cx}:")
for y in range(MY0 - 20, MY1 + 10, 3):
    print(f"  y={y:3d} rgb={tuple(int(v) for v in orig[y, cx, :3])}")

# original colors around the chin, below the mouth
print("\noriginal chin samples:")
for (x, y) in [(196, 255), (196, 260), (196, 265), (180, 255), (212, 255), (196, 245)]:
    print(f"  ({x},{y}) rgb={tuple(int(v) for v in orig[y, x, :3])}")

# where exactly is the mouth in the original? find dark-ish rows in the box
print("\noriginal mouth-box: min-luma per row")
lum = orig[:, :, :3].astype(np.float32).mean(axis=2)
for y in range(MY0, MY1):
    row = lum[y, MX0:MX1]
    print(f"  y={y:3d} min={row.min():.0f} mean={row.mean():.0f} argmin_x={MX0+int(row.argmin())}")