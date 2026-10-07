"""Inspect the raw Face / Mouth_Closed layers and the completed Face layer."""
from __future__ import annotations

import numpy as np
from PIL import Image

W, H = 407, 820
BOX = (140, 180, 260, 300)  # around eyes+mouth
x0, y0, x1, y1 = BOX


def zoom(path, out):
    im = Image.open(path).convert("RGBA")
    a = np.asarray(im).astype(np.float32)
    al = a[:, :, 3:4] / 255.0
    comp = (a[:, :, :3] * al + np.array([235, 205, 220]) * (1 - al)).astype(np.uint8)
    crop = comp[y0:y1, x0:x1]
    Image.fromarray(crop).resize(((x1 - x0) * 3, (y1 - y0) * 3), Image.NEAREST).save(out)


zoom("assets/live2d/paimon/layers/Face.png", "/tmp/lay_face_raw.png")
zoom("public/live2d/paimon/rig/Face.png", "/tmp/lay_face_done.png")
zoom("assets/live2d/paimon/layers/Mouth_Closed.png", "/tmp/lay_mouth_closed.png")
zoom("public/live2d/paimon/rig/Mouth_Closed.png", "/tmp/lay_mouth_closed_rig.png")
zoom("public/live2d/paimon/rig/Mouth_Open.png", "/tmp/lay_mouth_open.png")

# raw Face alpha in the mouth box
fa = np.asarray(Image.open("assets/live2d/paimon/layers/Face.png").convert("RGBA"))
mx0, my0, mx1, my1 = 168, 232, 226, 268
sub = fa[my0:my1, mx0:mx1]
print("raw Face mouth-box alpha: min", sub[:, :, 3].min(), "max", sub[:, :, 3].max(),
      "mean", round(float(sub[:, :, 3].mean()), 1))
opaque = sub[:, :, 3] > 16
if opaque.any():
    print("  opaque px color median:", np.median(sub[:, :, :3][opaque], axis=0))
print("raw Face global opaque color median:", np.median(fa[:, :, :3][fa[:, :, 3] > 16], axis=0))
print("saved zooms")