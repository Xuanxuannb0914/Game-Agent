"""Verify the rig composite against the original artwork, idle and talking."""
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

# alpha rules from paimonRig.applyParams: eyeOpen=1, mouth=variable
def composite(eye_open=1.0, mouth=0.0):
    """Premultiplied 'over', the way the GPU/Pixi actually blends."""
    pr = np.zeros((H, W, 3), np.float32)   # premultiplied rgb
    pa = np.zeros((H, W, 1), np.float32)   # alpha
    for n in ORDER:
        if n not in off:
            continue
        im = np.asarray(Image.open(f"{RIG}/{n}.png").convert("RGBA")).astype(np.float32)
        a = im[:, :, 3:4] / 255.0
        if n.startswith("Eye_Closed"):
            a = a * (1 - eye_open)
        elif n.startswith("Eye_"):
            a = a * eye_open
        elif n == "Mouth_Open":
            a = a * mouth
        elif n == "Mouth_Closed":
            a = a * (1 - mouth)
        h, w = im.shape[:2]
        x0, y0 = off[n]["x"], off[n]["y"]
        srgb = im[:, :, :3] * a
        dpr = pr[y0:y0 + h, x0:x0 + w]
        dpa = pa[y0:y0 + h, x0:x0 + w]
        pr[y0:y0 + h, x0:x0 + w] = srgb + dpr * (1 - a)
        pa[y0:y0 + h, x0:x0 + w] = a + dpa * (1 - a)
    return pr, pa


def to_rgb(pr, pa, bg=255.0):
    return (pr + bg * (1 - pa)).astype(np.uint8)


oa = orig[:, :, 3:4] / 255.0
o = to_rgb(orig[:, :, :3] * oa, oa)
for label, eo, mo in [("idle", 1.0, 0.0), ("half-blink", 0.5, 0.0), ("talking", 1.0, 1.0)]:
    c = to_rgb(*composite(eo, mo))
    d = np.abs(c.astype(np.int16) - o.astype(np.int16)).max(axis=2)
    head = d[40:300, 90:320]
    mouth = d[205:245, 160:235]
    print(f"{label:11s} global mean={d.mean():.3f} max={d.max():3d} | head mean={head.mean():.3f} max={head.max():3d} | mouthbox mean={mouth.mean():.3f} max={mouth.max():3d}")
    if label == "idle":
        Image.fromarray(c).save("/tmp/v_idle_full.png")
        Image.fromarray(c[40:300, 90:320]).resize((460, 520), Image.NEAREST).save("/tmp/v_idle_head.png")
        Image.fromarray(o[40:300, 90:320]).resize((460, 520), Image.NEAREST).save("/tmp/v_orig_head.png")
    if label == "talking":
        Image.fromarray(c[200:250, 160:235]).resize((600, 400), Image.NEAREST).save("/tmp/v_talking_mouth.png")