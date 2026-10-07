"""Generate per-layer redraw templates for the Paimon Live2D model.

For every layer that needs hand work (see docs/live2d/01-layering-report.md §4),
this writes a 407x820 RGBA template the artist can draw straight onto:

  · target layer      -> full opacity
  · other layers      -> 18% opacity (context, so the part is drawn in place)
  · region to add     -> magenta tint + dashed cyan outline
  · label             -> ASCII layer name + instruction, top-left

Two kinds of guide region:
  · "holes"  -> transparent areas fully enclosed by the layer (e.g. the face
                hole inside Hair_Back). Detected automatically, so the guide is
                pixel-accurate.
  · "rect"   -> a suggested box for parts that are occluded from the outside
                (arm roots, chest under the cape). Approximate on purpose --
                the exact silhouette is the artist's call.

Output: assets/live2d/paimon/redraw/<Layer>_base.png
        assets/live2d/paimon/redraw/_overview.png
        assets/live2d/paimon/redraw/_colors.json

Idempotent; assets/ is not served by Next.js.
"""

from __future__ import annotations

import json
import os

import cv2
import numpy as np
from PIL import Image

SRC = "public/paimon-pet.png"
LAYERS = "assets/live2d/paimon/layers"
OUT = "assets/live2d/paimon/redraw"

W, H = 407, 820

# back -> front, same as segment.py ORDER
ORDER = [
    "Hair_Back", "Cape_Back", "Body", "Cape_Front",
    "Arm_L", "Arm_R", "Leg_L", "Leg_R", "Boot_L", "Boot_R",
    "Hand_L", "Hand_R", "Face", "Hair_Tip", "Hair_Front",
    "Eye_L", "Eye_R", "Neck", "Star_Ornament",
]

# eye / mouth boxes reused from segment.py so guides land exactly on the art
BOX = {
    "Eye_L": (138, 166, 182, 212),
    "Eye_R": (214, 164, 256, 210),
    "Mouth": (175, 212, 219, 234),
}

TASKS: dict[str, dict] = {
    # --- A. occluded areas: make each part a complete shape -----------------
    "Hair_Back":  {"kind": "hull", "ymax": 286,
                   "note": "fill head shape"},
    "Face":       {"kind": "rect", "box": (112, 74, 276, 160),
                   "note": "fill forehead"},
    "Body":       {"kind": "rect", "box": (60, 300, 340, 418),
                   "note": "fill chest+shoulder"},
    "Arm_L":      {"kind": "rect", "box": (8, 220, 194, 412),
                   "note": "fill inner arm"},
    "Arm_R":      {"kind": "rect", "box": (282, 446, 407, 584),
                   "note": "fill upper arm"},
    "Cape_Front": {"kind": "rect", "box": (124, 275, 355, 426),
                   "note": "fill under arms"},
    "Hand_L":     {"kind": "rect", "box": (16, 300, 106, 372),
                   "note": "fill wrist"},
    "Hand_R":     {"kind": "rect", "box": (352, 462, 404, 516),
                   "note": "fill wrist"},
    # --- B. new drawings: states that do not exist in the source ------------
    "Eye_Closed_L": {"kind": "rect", "box": BOX["Eye_L"],
                     "note": "draw closed eye"},
    "Eye_Closed_R": {"kind": "rect", "box": BOX["Eye_R"],
                     "note": "draw closed eye"},
    "Mouth_Open":   {"kind": "rect", "box": BOX["Mouth"],
                     "note": "draw open mouth"},
    "Brow_L":       {"kind": "rect", "box": (136, 144, 188, 170),
                     "note": "draw brow"},
    "Brow_R":       {"kind": "rect", "box": (210, 142, 258, 168),
                     "note": "draw brow"},
}

TINT = np.array([255, 45, 149], np.uint8)     # magenta = draw here
EDGE = np.array([0, 229, 255], np.uint8)      # cyan = suggested box
CTX_ALPHA = 46                                # 18% context
TINT_ALPHA = 120


def load_layers() -> tuple[np.ndarray, dict[str, np.ndarray]]:
    arr = np.asarray(Image.open(SRC).convert("RGBA")).astype(np.uint8)
    masks: dict[str, np.ndarray] = {}
    for n in ORDER:
        p = os.path.join(LAYERS, n + ".png")
        masks[n] = np.asarray(Image.open(p).convert("RGBA"))[:, :, 3] > 128
    return arr, masks


def hull_mask(mask: np.ndarray, ymax: int) -> np.ndarray:
    """Convex hull of the layer, clipped to ymax.

    Hair_Back is a ring whose opening reaches the neck, so it has no *enclosed*
    hole to flood-fill. The hull of the outer boundary is the head silhouette;
    subtracting the layer itself leaves exactly the interior to repaint.
    """
    ys, xs = np.nonzero(mask)
    hull = cv2.convexHull(np.column_stack([xs, ys]).astype(np.int32))
    m = np.zeros((H, W), np.uint8)
    cv2.fillConvexPoly(m, hull, 1)
    yy = np.arange(H)[:, None] * np.ones((1, W), int)
    return (m.astype(bool)) & (yy <= ymax)


def rect_mask(box: tuple[int, int, int, int]) -> np.ndarray:
    x0, y0, x1, y1 = box
    m = np.zeros((H, W), bool)
    m[max(0, y0):min(H, y1), max(0, x0):min(W, x1)] = True
    return m


def dashed_rect(img: np.ndarray, box: tuple[int, int, int, int], dash: int = 7) -> None:
    x0, y0, x1, y1 = box
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(W - 1, x1), min(H - 1, y1)
    for x in range(x0, x1):
        if (x // dash) % 2 == 0:
            img[y0, x] = EDGE
            img[y1, x] = EDGE
    for y in range(y0, y1):
        if (y // dash) % 2 == 0:
            img[y, x0] = EDGE
            img[y, x1] = EDGE


def build_template(name: str, spec: dict, arr, masks) -> np.ndarray:
    # new-state layers (Eye_Closed_*, Mouth_Open, Brow_*) have no source art yet
    target = masks.get(name, np.zeros((H, W), bool))
    other = np.zeros((H, W), bool)
    for n in ORDER:
        if n != name:
            other |= masks[n]

    if spec["kind"] == "hull":
        guide = hull_mask(target, spec["ymax"]) & ~target
    else:
        guide = rect_mask(spec["box"]) & ~target

    rgb = np.zeros((H, W, 3), np.uint8)
    a = np.zeros((H, W), np.uint8)

    ctx = other & ~target
    rgb[ctx] = arr[:, :, :3][ctx]
    a[ctx] = CTX_ALPHA

    rgb[target] = arr[:, :, :3][target]
    a[target] = 255

    g = guide & ~target
    rgb[g] = TINT
    a[g] = np.maximum(a[g], TINT_ALPHA)

    # guides drawn at full alpha so they stay visible in any viewer
    if spec["kind"] == "hull" and guide.any():
        ys, xs = np.nonzero(guide)
        box = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
    elif spec["kind"] == "rect":
        box = spec["box"]
    else:
        box = None
    if box:
        dashed_rect(rgb, box)
        a[(rgb == EDGE).all(axis=2)] = 255

    rgba = np.dstack([rgb, a])
    label = f"{name}  [{spec['note']}]"
    if box:
        label += f"  x{box[0]}-{box[2]} y{box[1]}-{box[3]}"
    cv2.putText(rgba, label, (8, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.42,
                (255, 255, 255), 1, cv2.LINE_AA)
    cv2.putText(rgba, label, (8, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.42,
                (20, 20, 30), 1, cv2.LINE_AA)
    return rgba


def checker(w: int, h: int, size: int = 12) -> np.ndarray:
    y = (np.arange(h)[:, None] // size) % 2
    x = (np.arange(w)[None, :] // size) % 2
    c = (y ^ x).astype(np.uint8)
    return np.where(c[:, :, None] == 1, 235, 205).astype(np.uint8)


def sample_colors(arr, masks) -> dict:
    def med(name):
        px = arr[:, :, :3][masks[name]].astype(np.float32)
        return "#%02X%02X%02X" % tuple(int(round(c)) for c in np.median(px, axis=0))

    def darkest(name, pct=10):
        px = arr[:, :, :3][masks[name]].astype(np.float32)
        lum = px @ np.array([0.299, 0.587, 0.114])
        k = max(1, int(len(lum) * pct / 100))
        return "#%02X%02X%02X" % tuple(
            int(round(c)) for c in np.median(px[np.argsort(lum)[:k]], axis=0)
        )

    return {
        "skin": med("Face"),
        "hair_white": med("Hair_Front"),
        "cape_navy": med("Cape_Back"),
        "ornament_gold": med("Star_Ornament"),
        "iris_blue": med("Eye_L"),
        "line_art": darkest("Eye_L"),
        "mouth_line": darkest("Neck", 15),
        "boot_white": med("Boot_L"),
    }


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    arr, masks = load_layers()

    saved = []
    for name, spec in TASKS.items():
        rgba = build_template(name, spec, arr, masks)
        Image.fromarray(rgba, "RGBA").save(f"{OUT}/{name}_base.png")
        saved.append(name)

    # overview: every template over a checkerboard, half scale
    cw, ch = W // 2, H // 2
    cols = 5
    rows = (len(saved) + cols - 1) // cols
    sheet = np.zeros((rows * (ch + 22), cols * cw, 3), np.uint8)
    bg = checker(W, H)
    for i, name in enumerate(saved):
        rgba = build_template(name, TASKS[name], arr, masks)
        alpha = rgba[:, :, 3:4] / 255.0
        comp = (rgba[:, :, :3] * alpha + bg * (1 - alpha)).astype(np.uint8)
        comp = cv2.resize(comp, (cw, ch), interpolation=cv2.INTER_AREA)
        cy, cx = divmod(i, cols)
        y0 = cy * (ch + 22) + 22
        sheet[y0:y0 + ch, cx * cw:(cx + 1) * cw] = comp
        cv2.putText(sheet, name, (cx * cw + 6, cy * (ch + 22) + 15),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, (20, 20, 20), 1, cv2.LINE_AA)
    Image.fromarray(sheet).save(f"{OUT}/_overview.png")

    colors = sample_colors(arr, masks)
    with open(f"{OUT}/_colors.json", "w") as f:
        json.dump(colors, f, indent=2, ensure_ascii=False)

    print(f"templates: {len(saved)} -> {OUT}/")
    for n in saved:
        print("  -", n + "_base.png")
    print("colors:")
    for k, v in colors.items():
        print(f"  {k:15s} {v}")


if __name__ == "__main__":
    main()