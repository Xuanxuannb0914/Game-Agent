"""Inspect the raw Mouth_Closed layer."""
from __future__ import annotations

import numpy as np
from PIL import Image

im = np.asarray(Image.open("assets/live2d/paimon/layers/Mouth_Closed.png").convert("RGBA"))
a = im[:, :, 3]
ys, xs = np.nonzero(a > 16)
print("Mouth_Closed bbox:", xs.min(), ys.min(), xs.max(), ys.max(), "px:", len(ys))
print("color median:", np.median(im[:, :, :3][a > 16], axis=0))

# overlay the mouth on the original for reference
orig = np.asarray(Image.open("public/paimon-pet.png").convert("RGBA")).astype(np.float32)
al = im[:, :, 3:4].astype(np.float32) / 255.0
comp = (im[:, :, :3].astype(np.float32) * al + orig[:, :, :3] * (1 - al)).astype(np.uint8)
x0, y0, x1, y1 = 160, 230, 240, 275
Image.fromarray(comp[y0:y1, x0:x1]).resize(((x1 - x0) * 5, (y1 - y0) * 5), Image.NEAREST).save("/tmp/mouth_over_orig.png")
Image.fromarray(orig[y0:y1, x0:x1].astype(np.uint8)).resize(((x1 - x0) * 5, (y1 - y0) * 5), Image.NEAREST).save("/tmp/orig_mouth.png")

# mouth-only on checker
bg = np.zeros_like(orig[:, :, :3])
bg[:] = (235, 205, 220)
comp2 = (im[:, :, :3].astype(np.float32) * al + bg * (1 - al)).astype(np.uint8)
Image.fromarray(comp2[y0:y1, x0:x1]).resize(((x1 - x0) * 5, (y1 - y0) * 5), Image.NEAREST).save("/tmp/mouth_only.png")
print("saved")