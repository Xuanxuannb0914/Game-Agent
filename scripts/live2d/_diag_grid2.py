"""Fine gridded zoom of the original face lower half."""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageDraw

orig = Image.open("public/paimon-pet.png").convert("RGBA")
x0, y0, x1, y1 = 160, 205, 250, 250
S = 7
crop = orig.crop((x0, y0, x1, y1))
big = crop.resize(((x1 - x0) * S, (y1 - y0) * S), Image.NEAREST)
d = ImageDraw.Draw(big)
for gx in range(x0, x1 + 1, 10):
    px = (gx - x0) * S
    d.line([(px, 0), (px, big.height)], fill=(255, 0, 0, 255), width=1)
    d.text((px + 2, 2), str(gx), fill=(255, 0, 0, 255))
for gy in range(y0, y1 + 1, 5):
    py = (gy - y0) * S
    d.line([(0, py), (big.width, py)], fill=(0, 120, 255, 255), width=1)
    d.text((2, py + 2), str(gy), fill=(0, 120, 255, 255))
big.convert("RGB").save("/tmp/grid_mouth2.png")
print("saved", big.size)