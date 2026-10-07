"""Experiment 2: proper mouth — hole in Face, smile as Mouth_Closed."""
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
x0, y0, x1, y1 = BOX


def extract_mouth(thr=232):
    sub = orig[y0:y1, x0:x1].copy()
    lum = sub[:, :, :3].mean(axis=2)
    m = lum < thr
    out = np.zeros((H, W, 4), np.uint8)
    out[y0:y1, x0:x1][m] = sub[m].astype(np.uint8)
    return out


def build_face():
    masks = {n: np.asarray(Image.open(f"{LAY}/{n}.png").convert("RGBA"))[:, :, 3] > 16
             for n in ORDER if n not in cl.GENERATED}
    region = cl.region_for({"extra": [cl.EYE_L, cl.EYE_R, BOX]}, masks)
    return cl.complete(raw_face.copy(), region)


def composite(face_arr, mouth_closed, mouth_alpha=0.0):
    off = json.load(open(f"{RIG}/rig.json"))
    canvas = np.zeros((H, W, 4), np.float32)
    for n in ORDER:
        if n not in off:
            continue
        if n == "Face":
            im = face_arr.astype(np.float32)
            ys, xs = np.nonzero(face_arr[:, :, 3] > 0)
            ox = max(0, int(xs.min()) - 2); oy = max(0, int(ys.min()) - 2)
            im = face_arr[oy:min(H, int(ys.max()) + 3), ox:min(W, int(xs.max()) + 3)].astype(np.float32)
            px, py = ox, oy
        elif n == "Mouth_Closed":
            im = mouth_closed.astype(np.float32)
            ys, xs = np.nonzero(mouth_closed[:, :, 3] > 0)
            if len(ys) == 0:
                continue
            px = max(0, int(xs.min()) - 2); py = max(0, int(ys.min()) - 2)
            im = mouth_closed[py:min(H, int(ys.max()) + 3), px:min(W, int(xs.max()) + 3)].astype(np.float32)
        else:
            px, py = off[n]["x"], off[n]["y"]
            im = np.asarray(Image.open(f"{RIG}/{n}.png").convert("RGBA")).astype(np.float32)
        a = im[:, :, 3:4] / 255.0
        if n in ("Eye_Closed_L", "Eye_Closed_R", "Mouth_Open"):
            a = a * 0.0
        h, w = im.shape[:2]
        dst = canvas[py:py + h, px:px + w]
        dst[:, :, :3] = im[:, :, :3] * a + dst[:, :, :3] * (1 - a)
        dst[:, :, 3:4] = a * 255 + dst[:, :, 3:4] * (1 - a)
        canvas[py:py + h, px:px + w] = dst
    return canvas


def to_rgb(a):
    al = a[:, :, 3:4] / 255.0
    return (a[:, :, :3] * al + 255 * (1 - al)).astype(np.uint8)


face = build_face()
for thr in (228, 232, 236, 240):
    mc = extract_mouth(thr)
    comp = to_rgb(composite(face, mc))
    o = to_rgb(orig)
    d = np.abs(comp.astype(np.int16) - o.astype(np.int16)).max(axis=2)
    box = d[210:240, 170:225]
    print(f"thr={thr}  global mean={d.mean():.2f}  mouthbox mean={box.mean():.2f} max={box.max()}")
    Image.fromarray(comp[205:245, 160:235]).resize((600, 320), Image.NEAREST).save(f"/tmp/exp2_{thr}.png")

# also show the extracted mouth at thr=236
mc = extract_mouth(236)
bg = np.zeros((H, W, 3), np.uint8); bg[:] = (235, 205, 220)
al = mc[:, :, 3:4].astype(np.float32) / 255.0
vis = (mc[:, :, :3].astype(np.float32) * al + bg * (1 - al)).astype(np.uint8)
Image.fromarray(vis[205:245, 160:235]).resize((600, 320), Image.NEAREST).save("/tmp/exp2_mouth_layer.png")
print("saved")