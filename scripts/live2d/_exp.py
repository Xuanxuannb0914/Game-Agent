"""Experiment: which Face completion reproduces the original best?"""
from __future__ import annotations

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

# real mouth box (measured from the smile curve)
REAL_MOUTH = (176, 214, 218, 232)


def build_face(extra):
    rule = {"extra": extra}
    masks = {n: np.asarray(Image.open(f"{LAY}/{n}.png").convert("RGBA"))[:, :, 3] > 16
             for n in ORDER if n not in cl.GENERATED}
    region = cl.region_for(rule, masks)
    return cl.complete(raw_face.copy(), region)


def composite(face_arr):
    """Composite all rig layers, using face_arr for Face."""
    import json
    off = json.load(open(f"{RIG}/rig.json"))
    canvas = np.zeros((H, W, 4), np.float32)
    for n in ORDER:
        if n not in off:
            continue
        if n == "Face":
            x0, y0 = 125, 157
            im = face_arr[y0:y0 + (265 - 157 + 3), x0:x0 + (261 - 125 + 3)].astype(np.float32)
            # face_arr is full canvas; crop to the same bbox the script uses
            ys, xs = np.nonzero(face_arr[:, :, 3] > 0)
            x0 = max(0, int(xs.min()) - 2); y0 = max(0, int(ys.min()) - 2)
            x1 = min(W, int(xs.max()) + 3); y1 = min(H, int(ys.max()) + 3)
            im = face_arr[y0:y1, x0:x1].astype(np.float32)
        else:
            x0, y0 = off[n]["x"], off[n]["y"]
            im = np.asarray(Image.open(f"{RIG}/{n}.png").convert("RGBA")).astype(np.float32)
        a = im[:, :, 3:4] / 255.0
        if n in ("Eye_Closed_L", "Eye_Closed_R", "Mouth_Open"):
            a = a * 0.0
        h, w = im.shape[:2]
        dst = canvas[y0:y0 + h, x0:x0 + w]
        dst[:, :, :3] = im[:, :, :3] * a + dst[:, :, :3] * (1 - a)
        dst[:, :, 3:4] = a * 255 + dst[:, :, 3:4] * (1 - a)
        canvas[y0:y0 + h, x0:x0 + w] = dst
    return canvas


def to_rgb(a):
    al = a[:, :, 3:4] / 255.0
    return (a[:, :, :3] * al + 255 * (1 - al)).astype(np.uint8)


variants = {
    "A_current(eye+oldmouth)": [cl.EYE_L, cl.EYE_R, cl.MOUTH],
    "B_eye_only": [cl.EYE_L, cl.EYE_R],
    "C_eye+realmouth": [cl.EYE_L, cl.EYE_R, REAL_MOUTH],
}
for name, extra in variants.items():
    face = build_face(extra)
    comp = to_rgb(composite(face))
    o = to_rgb(orig)
    d = np.abs(comp.astype(np.int16) - o.astype(np.int16)).max(axis=2)
    box = d[225:275, 150:245]
    print(f"{name:26s} global mean={d.mean():.2f}  mouthbox mean={box.mean():.2f} max={box.max()}")
    Image.fromarray(comp[205:280, 150:250]).resize((500, 375), Image.NEAREST).save(f"/tmp/exp_{name.split('_')[0]}.png")