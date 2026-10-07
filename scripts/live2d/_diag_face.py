"""Map the opaque content of the raw Face layer inside the completion boxes."""
from __future__ import annotations

import numpy as np
from PIL import Image

W, H = 407, 820
BOXES = {
    "EYE_L": (138, 166, 182, 212),
    "EYE_R": (214, 164, 256, 210),
    "MOUTH": (168, 232, 226, 268),
}

fa = np.asarray(Image.open("assets/live2d/paimon/layers/Face.png").convert("RGBA"))

for name, (x0, y0, x1, y1) in BOXES.items():
    sub = fa[y0:y1, x0:x1]
    op = sub[:, :, 3] > 16
    print(f"\n{name} box {x1-x0}x{y1-y0}  opaque {op.sum()} ({100*op.mean():.0f}%)")
    if op.any():
        print("  opaque color median:", np.median(sub[:, :, :3][op], axis=0))
    # ascii map: '.' transparent, '#' opaque
    step_y = max(1, (y1 - y0) // 24)
    step_x = max(1, (x1 - x0) // 40)
    for yy in range(0, y1 - y0, step_y):
        line = ""
        for xx in range(0, x1 - x0, step_x):
            line += "#" if op[yy, xx] else "."
        print("   ", line)

# global: how much of the raw Face layer is transparent overall?
tot = fa[:, :, 3] > 16
ys, xs = np.nonzero(tot)
print("\nraw Face bbox:", xs.min(), ys.min(), xs.max(), ys.max())
print("raw Face opaque fraction:", round(float(tot.mean()), 3))