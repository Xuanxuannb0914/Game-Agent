"""For probe points, list which raw layers have opaque pixels there."""
from __future__ import annotations

import os
import numpy as np
from PIL import Image

LAY = "assets/live2d/paimon/layers"
ORDER = [
    "Hair_Back", "Cape_Back", "Body", "Cape_Front",
    "Arm_L", "Arm_R", "Leg_L", "Leg_R", "Boot_L", "Boot_R",
    "Hand_L", "Hand_R", "Face", "Hair_Tip", "Hair_Front",
    "Eye_L", "Eye_R", "Mouth_Closed", "Star_Ornament",
]
imgs = {n: np.asarray(Image.open(f"{LAY}/{n}.png").convert("RGBA")) for n in ORDER}
orig = np.asarray(Image.open("public/paimon-pet.png").convert("RGBA"))

PROBES = [
    ("neck-center", 196, 250),
    ("collar-left", 172, 250),
    ("collar-right", 220, 250),
    ("chin", 196, 240),
    ("below-chin-left", 180, 258),
    ("below-chin-right", 212, 258),
    ("mouth", 196, 222),
    ("cheek", 175, 225),
]
for name, x, y in PROBES:
    hits = [n for n in ORDER if imgs[n][y, x, 3] > 16]
    print(f"{name:18s} ({x},{y}) orig={tuple(int(v) for v in orig[y,x,:3])} -> {hits}")