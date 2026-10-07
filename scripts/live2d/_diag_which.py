"""Find which layer paints the hard pink rectangle near the mouth."""
from __future__ import annotations

import json
import numpy as np
from PIL import Image

RIG = "public/live2d/paimon/rig"
W, H = 407, 820
ORDER = [
    "Hair_Back", "Cape_Back", "Body", "Cape_Front",
    "Arm_L", "Arm_R", "Leg_L", "Leg_R", "Boot_L", "Boot_R",
    "Hand_L", "Hand_R", "Face", "Hair_Tip", "Hair_Front",
    "Eye_L", "Eye_Closed_L", "Eye_R", "Eye_Closed_R",
    "Mouth_Closed", "Mouth_Open", "Star_Ornament",
]
ALPHA = {"Eye_Closed_L": 0.0, "Eye_Closed_R": 0.0, "Mouth_Open": 0.0}

with open(f"{RIG}/rig.json") as f:
    off = json.load(f)

BOX = (150, 225, 240, 275)  # mouth area
bx0, by0, bx1, by1 = BOX

canvas = np.zeros((H, W, 4), np.float32)
for n in ORDER:
    if n not in off:
        continue
    x0, y0 = off[n]["x"], off[n]["y"]
    im = np.asarray(Image.open(f"{RIG}/{n}.png").convert("RGBA")).astype(np.float32)
    a = im[:, :, 3:4] / 255.0 * ALPHA.get(n, 1.0)
    h, w = im.shape[:2]
    dst = canvas[y0:y0 + h, x0:x0 + w]
    dst[:, :, :3] = im[:, :, :3] * a + dst[:, :, :3] * (1 - a)
    dst[:, :, 3:4] = a * 255 + dst[:, :, 3:4] * (1 - a)
    canvas[y0:y0 + h, x0:x0 + w] = dst

al = canvas[:, :, 3:4] / 255.0
comp = (canvas[:, :, :3] * al + 255 * (1 - al)).astype(np.uint8)
sub = comp[by0:by1, bx0:bx1]
Image.fromarray(sub).resize(((bx1 - bx0) * 4, (by1 - by0) * 4), Image.NEAREST).save("/tmp/which_mouth.png")

# print a horizontal scanline across the rectangle center
row = (by0 + by1) // 2
print("scanline y =", row)
for x in range(bx0, bx1, 4):
    print(f"  x={x:3d} rgb={tuple(int(v) for v in comp[row, x])}")

# report alpha coverage per layer inside the box
print("\nlayers covering the mouth box (alpha>16 count):")
for n in ORDER:
    if n not in off:
        continue
    x0, y0 = off[n]["x"], off[n]["y"]
    im = np.asarray(Image.open(f"{RIG}/{n}.png").convert("RGBA"))
    h, w = im.shape[:2]
    c = 0
    for yy in range(max(by0, y0), min(by1, y0 + h)):
        for xx in range(max(bx0, x0), min(bx1, x0 + w)):
            if im[yy - y0, xx - x0, 3] > 16:
                c += 1
    if c:
        print(f"  {n:15s} {c}")