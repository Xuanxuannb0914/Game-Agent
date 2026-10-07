"""Build rig-ready layers for the Paimon parametric rig.

The raw `layers/` set cannot be animated: occluded regions were never painted,
so moving a part exposes holes. This script completes them programmatically
(flat anime shading inpaints cleanly), then adds the states the rig needs for
blink / mouth:

  · completion : fill each part's occluded area, clipped to its own silhouette
                 so nothing spills outside the character.
  · new states : Eye_Closed_L/R (drawn procedurally), Mouth_Closed / Mouth_Open
  · output     : each layer cropped to its bbox + a rig.json offset map, which
                 cuts the served payload roughly 5x versus full-canvas PNGs.

The mouth is the subtle part. `segment.py` seeds a layer called "Neck" from the
under-chin / collar box -- it is *not* the mouth. The real mouth (a small smile)
sits about 20px higher, at y≈212..234, and is baked into the Face layer. So here
the mouth is carved out of Face and rebuilt as two **fully opaque patches** over
that box:

  · Mouth_Closed : the original box, pixel for pixel  (idle state)
  · Mouth_Open   : the same skin with an open mouth drawn on it

The rig cross-fades them with alpha `mouth` / `1 - mouth`, which always sums to
1. Because both patches are opaque, the inpainted skin underneath Face is never
exposed and the idle composite stays identical to the original artwork -- while
the mouth can still open.

Output: public/live2d/paimon/rig/<Layer>.png + rig.json

Idempotent. `assets/` holds the full-canvas work files; this is the served set.
"""

from __future__ import annotations

import json
import math
import os

import cv2
import numpy as np
from PIL import Image, ImageDraw

LAY = "assets/live2d/paimon/layers"
OUT = "public/live2d/paimon/rig"
# review sheets live outside public/ so they are never served
REVIEW = "assets/live2d/paimon/rig-review"
SRC = "public/paimon-pet.png"

W, H = 407, 820

# back -> front, incl. the generated states
ORDER = [
    "Hair_Back", "Cape_Back", "Body", "Cape_Front",
    "Arm_L", "Arm_R", "Leg_L", "Leg_R", "Boot_L", "Boot_R",
    "Hand_L", "Hand_R", "Face", "Hair_Tip", "Hair_Front",
    "Eye_L", "Eye_Closed_L", "Eye_R", "Eye_Closed_R",
    "Neck", "Mouth_Closed", "Mouth_Open", "Star_Ornament",
]

GENERATED = ["Eye_Closed_L", "Eye_Closed_R", "Mouth_Closed", "Mouth_Open"]

EYE_L = (138, 166, 182, 212)
EYE_R = (214, 164, 256, 210)
# the real mouth: a small smile at x184..211 y220..227, with skin margin all
# round. Measured in scripts/live2d/_diag_smile.py; must stay above the chin
# outline (y>=239) so the patch never swallows the jaw line.
MOUTH = (175, 212, 219, 234)

# how to fill each part's occluded area
#   hull_of : silhouette sources (convex hull)
#   ellipse : (cx, cy, rx, ry) -- for the forehead, a hull would swallow the hair
#   clip    : bounding box the fill may not leave
#   extra   : additional rectangles (eye sockets, so the iris can slide)
# Only the Face needs completion, and only where the fill stays hidden: the eye
# sockets (so the iris can slide). Everything the head owns moves together, so
# nothing else can separate and expose a hole -- filling more would only drift
# away from the original artwork. In particular the forehead is left alone: it
# would show skin through the hair-strand gaps. The mouth box is not filled by
# `complete` either -- it is replaced wholesale by mouth_skin() below.
RULES: dict[str, dict] = {
    "Face": {"extra": [EYE_L, EYE_R]},
}

SKIN = (250, 211, 212)
LASH = (72, 52, 88)
LIP = (129, 58, 91)
CAVITY = (110, 43, 68)
TONGUE = (214, 120, 140)


def rect_mask(box) -> np.ndarray:
    x0, y0, x1, y1 = box
    m = np.zeros((H, W), bool)
    m[max(0, y0):min(H, y1), max(0, x0):min(W, x1)] = True
    return m


def ellipse_mask(cx, cy, rx, ry) -> np.ndarray:
    m = np.zeros((H, W), np.uint8)
    cv2.ellipse(m, (cx, cy), (rx, ry), 0, 0, 360, 1, -1)
    return m.astype(bool)


def hull_mask(mask: np.ndarray) -> np.ndarray:
    ys, xs = np.nonzero(mask)
    if len(ys) < 3:
        return mask.copy()
    hull = cv2.convexHull(np.column_stack([xs, ys]).astype(np.int32))
    m = np.zeros((H, W), np.uint8)
    cv2.fillConvexPoly(m, hull, 1)
    return m.astype(bool)


def load_masks() -> dict[str, np.ndarray]:
    out = {}
    for n in ORDER:
        if n in GENERATED:
            continue
        p = os.path.join(LAY, n + ".png")
        out[n] = np.asarray(Image.open(p).convert("RGBA"))[:, :, 3] > 16
    return out


def region_for(rule: dict, masks: dict) -> np.ndarray:
    region = np.zeros((H, W), bool)
    if "hull_of" in rule:
        acc = np.zeros((H, W), bool)
        for n in rule["hull_of"]:
            acc |= masks[n]
        region |= hull_mask(acc)
    if "ellipse" in rule:
        region |= ellipse_mask(*rule["ellipse"])
    if "clip" in rule:
        region &= rect_mask(rule["clip"])
    for b in rule.get("extra", []):
        region |= rect_mask(b)
    return region


def complete(arr: np.ndarray, region: np.ndarray) -> np.ndarray:
    # alpha > 0 (not > 16) so the layer's feathered edges are never overwritten
    solid = arr[:, :, 3] > 0
    fill = region & ~solid
    if not fill.any():
        return arr

    dom = np.median(arr[:, :, :3][solid], axis=0) if solid.any() else np.array([255, 255, 255])
    rgb = arr[:, :, :3].astype(np.float32)
    rgb[~solid] = dom                      # sensible colors for the inpaint source
    m8 = (cv2.dilate(fill.astype(np.uint8), np.ones((3, 3), np.uint8))) * 255
    out = cv2.inpaint(rgb.astype(np.uint8), m8, 3, cv2.INPAINT_TELEA)

    res = arr.copy()
    res[:, :, :3] = out
    res[:, :, 3] = np.where(fill, 255, arr[:, :, 3])
    return res


def bezier(p0, p1, p2, n=48):
    pts = []
    for i in range(n + 1):
        t = i / n
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
        pts.append((x, y))
    return pts


def source() -> np.ndarray:
    return np.asarray(Image.open(SRC).convert("RGBA")).copy()


def mouth_skin() -> np.ndarray:
    """The mouth box as bare skin: the original with the smile inpainted away.

    Keeps the chin's blush gradient (unlike a flat fill), so the mouth patches
    blend seamlessly whatever their alpha.
    """
    src = source()
    x0, y0, x1, y1 = MOUTH
    sub = src[y0:y1, x0:x1]
    lum = sub[:, :, :3].astype(np.float32).mean(axis=2)
    m = (lum < 236).astype(np.uint8)
    if m.any():
        m8 = cv2.dilate(m, np.ones((3, 3), np.uint8))
        rgb = cv2.inpaint(sub[:, :, :3], m8, 4, cv2.INPAINT_TELEA)
        sub = sub.copy()
        sub[:, :, :3] = rgb
    sub[:, :, 3] = 255
    out = np.zeros((H, W, 4), np.uint8)
    out[y0:y1, x0:x1] = sub
    return out


def mouth_closed() -> np.ndarray:
    """The idle mouth: the original artwork inside the mouth box, untouched."""
    src = source()
    x0, y0, x1, y1 = MOUTH
    out = np.zeros((H, W, 4), np.uint8)
    out[y0:y1, x0:x1] = src[y0:y1, x0:x1]
    return out


def open_mouth() -> np.ndarray:
    """The talking mouth: mouth_skin() with an open mouth drawn on it.

    Drawn 4x and downsampled so the ~44x22 patch does not come out stair-stepped
    at the pixel level. The scratch layer starts as skin at alpha 0, so the
    downsample blends toward skin instead of leaving a dark fringe.
    """
    x0, y0, x1, y1 = MOUTH
    bg = mouth_skin()
    skin = tuple(int(v) for v in bg[y0:y1, x0:x1][:, :, :3].reshape(-1, 3).mean(axis=0))

    S = 4
    w, h = (x1 - x0) * S, (y1 - y0) * S
    layer = Image.new("RGBA", (w, h), skin + (0,))
    d = ImageDraw.Draw(layer)
    cx, cy = w / 2, h * 0.54
    rx, ry = w * 0.27, h * 0.30
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=CAVITY + (255,))
    trx, try_ = w * 0.18, h * 0.15
    d.ellipse([cx - trx, cy + ry * 0.10 - try_, cx + trx, cy + ry * 0.10 + try_],
              fill=TONGUE + (255,))
    # upper lip: trace the cavity's own top arc so it never overhangs
    pts = [(cx + rx * math.cos(t), cy + ry * math.sin(t))
           for t in np.linspace(math.pi * 1.12, math.pi * 1.88, 24)]
    d.line(pts, fill=LIP + (255,), width=int(2 * S), joint="curve")

    small = np.asarray(layer.resize((x1 - x0, y1 - y0), Image.LANCZOS)).astype(np.float32)
    a = small[:, :, 3:4] / 255.0
    reg = bg[y0:y1, x0:x1].astype(np.float32)
    reg[:, :, :3] = small[:, :, :3] * a + reg[:, :, :3] * (1 - a)
    reg[:, :, 3] = 255
    out = bg
    out[y0:y1, x0:x1] = reg.astype(np.uint8)
    return out


def closed_eye(box) -> np.ndarray:
    x0, y0, x1, y1 = box
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = (x0 + x1) / 2
    # eyelid: opaque skin so the socket is covered when the iris fades out
    d.ellipse([x0 + 1, y0 + 4, x1 - 1, y1 + 6], fill=SKIN + (255,))
    d.ellipse([x0 + 6, y0 + 2, x1 - 6, y1 - 6], fill=(246, 200, 202, 255))
    # lash: gentle downward arc
    mid = y0 + (y1 - y0) * 0.52
    pts = bezier((x0 + 2, mid - 6), (cx, mid + 16), (x1 - 2, mid - 6))
    d.line(pts, fill=LASH + (255,), width=3, joint="curve")
    return np.asarray(im).copy()


def paste(dst: np.ndarray, patch: np.ndarray, box) -> np.ndarray:
    x0, y0, x1, y1 = box
    out = dst.copy()
    sub = patch[y0:y1, x0:x1]
    out[y0:y1, x0:x1] = np.where(sub[:, :, 3:4] > 0, sub, out[y0:y1, x0:x1])
    return out


def crop_save(arr: np.ndarray, name: str, offsets: dict) -> None:
    ys, xs = np.nonzero(arr[:, :, 3] > 0)
    if len(ys) == 0:
        return
    x0, y0 = max(0, int(xs.min()) - 2), max(0, int(ys.min()) - 2)
    x1, y1 = min(W, int(xs.max()) + 3), min(H, int(ys.max()) + 3)
    Image.fromarray(arr[y0:y1, x0:x1], "RGBA").save(f"{OUT}/{name}.png", optimize=True)
    offsets[name] = {"x": x0, "y": y0}


def checker(w, h, size=12):
    y = (np.arange(h)[:, None] // size) % 2
    x = (np.arange(w)[None, :] // size) % 2
    c = (y ^ x).astype(np.uint8)
    return np.where(c[:, :, None] == 1, 235, 205).astype(np.uint8)


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(REVIEW, exist_ok=True)
    masks = load_masks()
    offsets: dict[str, dict] = {}
    preview = []

    for n in ORDER:
        if n == "Eye_Closed_L":
            arr = closed_eye(EYE_L)
        elif n == "Eye_Closed_R":
            arr = closed_eye(EYE_R)
        elif n == "Mouth_Closed":
            arr = mouth_closed()
        elif n == "Mouth_Open":
            arr = open_mouth()
        else:
            arr = np.asarray(Image.open(f"{LAY}/{n}.png").convert("RGBA")).copy()
            if n in RULES:
                arr = complete(arr, region_for(RULES[n], masks))
            if n == "Face":
                # swap the baked-in smile for bare skin: the mouth is now a layer
                arr = paste(arr, mouth_skin(), MOUTH)
        crop_save(arr, n, offsets)
        preview.append((n, arr))

    with open(f"{OUT}/rig.json", "w") as f:
        json.dump(offsets, f, indent=2, ensure_ascii=False, sort_keys=True)

    # preview sheet so the completion can be eyeballed
    cols, cw, ch = 6, W // 3, H // 3
    rows = (len(preview) + cols - 1) // cols
    sheet = np.zeros((rows * (ch + 20), cols * cw, 3), np.uint8)
    bg = checker(W, H)
    for i, (n, arr) in enumerate(preview):
        a = arr[:, :, 3:4] / 255.0
        comp = (arr[:, :, :3] * a + bg * (1 - a)).astype(np.uint8)
        comp = cv2.resize(comp, (cw, ch), interpolation=cv2.INTER_AREA)
        cy, cx = divmod(i, cols)
        y0 = cy * (ch + 20) + 20
        sheet[y0:y0 + ch, cx * cw:(cx + 1) * cw] = comp
        cv2.putText(sheet, n, (cx * cw + 5, cy * (ch + 20) + 14),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.38, (20, 20, 20), 1, cv2.LINE_AA)
    Image.fromarray(sheet).save(f"{REVIEW}/_preview.png")

    total = sum(os.path.getsize(f"{OUT}/{n}.png") for n in offsets)
    print(f"rig layers: {len(offsets)}  total {total / 1024:.0f} KB")
    for n in ORDER:
        o = offsets.get(n)
        if o:
            print(f"  {n:15s} offset({o['x']:>3},{o['y']:>3})")


if __name__ == "__main__":
    main()