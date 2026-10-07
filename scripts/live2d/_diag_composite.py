"""Diagnostic: composite the rig layers back-to-front and diff vs the original art."""
from __future__ import annotations

import json
import os

import numpy as np
from PIL import Image

RIG = "public/live2d/paimon/rig"
SRC = "public/paimon-pet.png"
W, H = 407, 820

ORDER = [
    "Hair_Back", "Cape_Back", "Body", "Cape_Front",
    "Arm_L", "Arm_R", "Leg_L", "Leg_R", "Boot_L", "Boot_R",
    "Hand_L", "Hand_R", "Face", "Hair_Tip", "Hair_Front",
    "Eye_L", "Eye_Closed_L", "Eye_R", "Eye_Closed_R",
    "Mouth_Closed", "Mouth_Open", "Star_Ornament",
]

# head-closed-eye state: alphas the runtime uses when idle (blink=0, mouth=0)
ALPHA = {
    "Eye_Closed_L": 0.0, "Eye_Closed_R": 0.0, "Mouth_Open": 0.0,
    "Eye_L": 1.0, "Eye_R": 1.0, "Mouth_Closed": 1.0,
}


def main() -> None:
    with open(f"{RIG}/rig.json") as f:
        offsets = json.load(f)

    canvas = np.zeros((H, W, 4), np.float32)
    for n in ORDER:
        if n not in offsets:
            continue
        x0, y0 = offsets[n]["x"], offsets[n]["y"]
        im = np.asarray(Image.open(f"{RIG}/{n}.png").convert("RGBA")).astype(np.float32)
        a = im[:, :, 3:4] / 255.0 * ALPHA.get(n, 1.0)
        h, w = im.shape[:2]
        dst = canvas[y0:y0 + h, x0:x0 + w]
        sa = a
        dst[:, :, :3] = im[:, :, :3] * sa + dst[:, :, :3] * (1 - sa)
        dst[:, :, 3:4] = sa * 255 + dst[:, :, 3:4] * (1 - sa)
        canvas[y0:y0 + h, x0:x0 + w] = dst

    src = np.asarray(Image.open(SRC).convert("RGBA")).astype(np.float32)
    if src.shape[:2] != (H, W):
        src = np.asarray(Image.open(SRC).convert("RGBA").resize((W, H))).astype(np.float32)

    # composite over white
    def over_white(a):
        al = a[:, :, 3:4] / 255.0
        return (a[:, :, :3] * al + 255 * (1 - al)).astype(np.uint8)

    comp = over_white(canvas)
    orig = over_white(src)
    Image.fromarray(comp).save("/tmp/diag_composite.png")
    Image.fromarray(orig).save("/tmp/diag_original.png")

    # diff heat
    d = np.abs(comp.astype(np.int16) - orig.astype(np.int16)).max(axis=2)
    heat = np.zeros((H, W, 3), np.uint8)
    heat[:, :, 0] = np.clip(d * 4, 0, 255)
    heat[:, :, 1] = np.clip((d - 20) * 4, 0, 255)
    Image.fromarray(heat).save("/tmp/diag_diff.png")

    # focus: head region
    Image.fromarray(comp[40:300, 90:320]).resize((460, 520), Image.NEAREST).save("/tmp/diag_head_comp.png")
    Image.fromarray(orig[40:300, 90:320]).resize((460, 520), Image.NEAREST).save("/tmp/diag_head_orig.png")
    print("saved /tmp/diag_composite.png /tmp/diag_original.png /tmp/diag_diff.png")
    print("head diff max:", int(d[40:300, 90:320].max()), "mean:", float(d[40:300, 90:320].mean()))


if __name__ == "__main__":
    main()