"""Dump the completed rig Face layer inside the mouth box."""
from __future__ import annotations

import numpy as np
from PIL import Image

MX0, MY0, MX1, MY1 = 168, 232, 226, 268
face = np.asarray(Image.open("public/live2d/paimon/rig/Face.png").convert("RGBA"))
OX, OY = 125, 157
sub = face[MY0 - OY:MY1 - OY, MX0 - OX:MX1 - OX]
print("completed Face mouth-box local shape", sub.shape)
print("alpha: min", sub[:, :, 3].min(), "max", sub[:, :, 3].max())
op = sub[:, :, 3] > 16
print("opaque color median:", np.median(sub[:, :, :3][op], axis=0) if op.any() else None)

# print colors along center row
r = sub.shape[0] // 2
for x in range(0, sub.shape[1], 4):
    print(f"  x={MX0+x:3d} rgb={tuple(int(v) for v in sub[r, x, :3])} a={sub[r,x,3]}")

print("\nraw Face mouth box colors (for reference):")
raw = np.asarray(Image.open("assets/live2d/paimon/layers/Face.png").convert("RGBA"))
rsub = raw[MY0:MY1, MX0:MX1]
r = rsub.shape[0] // 2
for x in range(0, rsub.shape[1], 4):
    print(f"  x={MX0+x:3d} rgb={tuple(int(v) for v in rsub[r, x, :3])} a={rsub[r,x,3]}")