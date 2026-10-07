"""Experiment 3: opaque mouth patches over an inpainted Face hole."""
from __future__ import annotations

import json
import sys
import numpy as np
from PIL import Image

sys.path.insert(0, "scripts/live2d")
import complete_layers as cl  # noqa: E402

W, H = cl.W, cl.H
ORDER = cl.ORDER
RIG = "public/live2d/paimon/rig"
LAY = "assets/live2d/paimon/layers"
orig = np.asarray(Image.open("public/paimon-pet.png").convert("RGBA")).astype(np.float32)
raw_face = np.asarray(Image.open(f"{LAY}/Face.png").convert("RGBA")).copy()

BOX = (176, 214, 218, 232)
bx0, by0, bx1, by1 = BOX


def build_face():
    masks = {n: np.asarray(Image.open(f"{LAY}/{n}.png").convert("RGBA"))[:, :, 3] > 16
             for n in ORDER if n not in cl.GENERATED}
    region = cl.region_for({"extra": [cl.EYE_L, cl.EYE_R, BOX]}, masks)
    return cl.complete(raw_face.copy(), region)


def patch_closed():
    """opaque copy of the original mouth box"""
    out = np.zeros((H, W, 4), np.uint8)
    out[by0:by1, bx0:bx1] = orig[by0:by1, bx0:bx1].astype(np.uint8)
    return out


def composite(face_arr, mouth_closed, mouth_alpha):
    off = json.load(open(f"{RIG}/rig.json"))
    canvas = np.zeros((H, W, 4), np.float32)

    def blit(im, px, py, alpha):
        a = im[:, :, 3:4] / 255.0 * alpha
        h, w = im.shape[:2]
        dst = canvas[py:py + h, px:px + w]
        dst[:, :, :3] = im[:, :, :3] * a + dst[:, :, :3] * (1 - a)
        dst[:, :, 3:4] = a * 255 + dst[:, :, 3:4] * (1 - a)
        canvas[py:py + h, px:px + w] = dst

    for n in ORDER:
        if n not in off:
            continue
        if n == "Face":
            ys, xs = np.nonzero(face_arr[:, :, 3] > 0)
            ox = max(0, int(xs.min()) - 2); oy = max(0, int(ys.min()) - 2)
            blit(face_arr[oy:min(H, int(ys.max()) + 3), ox:min(W, int(xs.max()) + 3)].astype(np.float32), ox, oy, 1.0)
        elif n == "Mouth_Closed":
            # the segmentation's neck blob stays static, at its own z
            neck = np.asarray(Image.open(f"{RIG}/Mouth_Closed.png").convert("RGBA")).astype(np.float32)
            blit(neck, off[n]["x"], off[n]["y"], 1.0)
            blit(mouth_closed[by0:by1, bx0:bx1].astype(np.float32), bx0, by0, 1 - mouth_alpha)
        elif n == "Mouth_Open":
            continue  # tested separately
        else:
            a = 0.0 if n in ("Eye_Closed_L", "Eye_Closed_R") else 1.0
            im = np.asarray(Image.open(f"{RIG}/{n}.png").convert("RGBA")).astype(np.float32)
            blit(im, off[n]["x"], off[n]["y"], a)
    return canvas


def to_rgb(a):
    al = a[:, :, 3:4] / 255.0
    return (a[:, :, :3] * al + 255 * (1 - al)).astype(np.uint8)


face = build_face()
mc = patch_closed()
for ma in (0.0,):
    comp = to_rgb(composite(face, mc, ma))
    o = to_rgb(orig)
    d = np.abs(comp.astype(np.int16) - o.astype(np.int16)).max(axis=2)
    box = d[205:245, 160:235]
    print(f"mouth_alpha={ma}  global mean={d.mean():.3f} max={d.max()}  mouthbox mean={box.mean():.3f} max={box.max()}")
    Image.fromarray(comp[205:245, 160:235]).resize((600, 320), Image.NEAREST).save("/tmp/exp3_idle.png")

# save the face hole for inspection
ys, xs = np.nonzero(face[:, :, 3] > 0)
face_c = face[max(0, ys.min() - 2):ys.max() + 3, max(0, xs.min() - 2):xs.max() + 3]
Image.fromarray(face_c).save("/tmp/exp3_face.png")