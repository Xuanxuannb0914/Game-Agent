"""Segment public/paimon-pet.png into Live2D-modeling layers.

Strategy
--------
1. Color-separable parts are carved by HSV masks (gold star, blue irises, skin,
   navy cape lining). These are pixel-accurate.
2. The large white mass (hair / cape / dress / boots) shares one color, so it is
   partitioned geometrically. These cuts are *approximate* and only meant as a
   starting point for hand cleanup in Cubism Editor.
3. Every layer keeps the original pixels; nothing is repainted here.

Output: assets/live2d/paimon/layers/<Name>.png  (+ _contact_sheet.png, _report.txt)

The script is idempotent and does not touch the app bundle (assets/ is not served).
"""

from __future__ import annotations

import os

import cv2
import numpy as np
from PIL import Image

SRC = "public/paimon-pet.png"
OUT = "assets/live2d/paimon/layers"

W, H = 407, 820

# ---- geometry, measured from regions.py -------------------------------------
AHOGE_Y = 52                 # above this: the single hair strand (ahoge)
AHOGE_X0, AHOGE_X1 = 132, 282
HEAD_BOTTOM = 280            # below this: neck / body
FRINGE_Y0, FRINGE_Y1 = 74, 208
FRINGE_X0, FRINGE_X1 = 112, 288

BOX = {
    "Star_Ornament": (222, 82, 296, 162),   # gold star in hair
    "Eye_L": (138, 166, 182, 212),
    "Eye_R": (214, 164, 256, 210),
    "Face": (120, 156, 276, 272),
    # chin/neck skin + the collar pixels the residual pass grows into it. Named
    # "Neck" because that is what it actually is: the mouth sits ~20px higher, at
    # y≈213..233, and is cut out of Face later by complete_layers.py.
    "Neck": (168, 232, 226, 268),
    "Hand_L": (16, 222, 100, 368),          # raised waving hand
    "Hand_R": (358, 466, 402, 514),
    "Leg_L": (104, 566, 182, 716),
    "Leg_R": (208, 566, 292, 716),
    "Arm_L": (8, 220, 194, 412),
    "Arm_R": (282, 446, 407, 584),
    "Boot_L": (96, 694, 184, 820),
    "Boot_R": (222, 598, 300, 820),
    "Cape_Front": (30, 276, 380, 420),      # shoulder / chest cape + clasp star
    "Chest_Star": (170, 280, 220, 354),     # gold clasp star -> belongs to Cape_Front
}

# ---------------------------------------------------------------------------


def load() -> tuple[np.ndarray, dict[str, np.ndarray]]:
    im = Image.open(SRC).convert("RGBA")
    arr = np.asarray(im).astype(np.float32)
    assert (arr.shape[1], arr.shape[0]) == (W, H), f"unexpected size {arr.shape}"

    rgb = arr[:, :, :3] / 255.0
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    v = mx
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0.0)
    d = np.maximum(mx - mn, 1e-6)
    hue = np.zeros_like(mx)
    m1 = mx == r
    m2 = (mx == g) & ~m1
    m3 = (mx == b) & ~m1 & ~m2
    hue[m1] = ((g - b)[m1] / d[m1] * 60) % 360
    hue[m2] = ((b - r)[m2] / d[m2] * 60) + 120
    hue[m3] = ((r - g)[m3] / d[m3] * 60) + 240

    solid = arr[:, :, 3] > 16
    masks = {
        "solid": solid,
        "gold": solid & (hue >= 25) & (hue < 70) & (s > 0.30) & (v > 0.35),
        "iris": solid & (hue >= 175) & (hue < 265) & (s > 0.35) & (v > 0.30),
        "navy": solid & (hue >= 175) & (hue < 265) & (s > 0.25) & (v < 0.62),
        "skin": solid & ((hue >= 335) | (hue < 26)) & (s > 0.09) & (v > 0.62),
        "white": solid & (s < 0.16) & (v > 0.78),
    }
    # darker warm pixels: the under-chin / collar shadow line. Seeds the "Neck"
    # layer, whose real content is filled in by the residual pass below.
    masks["mouth"] = solid & (v < 0.86) & (hue > 330) & (s > 0.12)
    return arr, masks


def box_mask(shape, b) -> np.ndarray:
    x0, y0, x1, y1 = b
    m = np.zeros(shape, bool)
    m[y0:y1, x0:x1] = True
    return m


def clean(m: np.ndarray, k: int = 3) -> np.ndarray:
    """Drop specks and close pinholes so layers are not peppered with gaps."""
    m8 = m.astype(np.uint8)
    m8 = cv2.morphologyEx(m8, cv2.MORPH_OPEN, np.ones((k, k), np.uint8))
    m8 = cv2.morphologyEx(m8, cv2.MORPH_CLOSE, np.ones((k, k), np.uint8))
    return m8.astype(bool)


def build_layers(arr, m) -> dict[str, np.ndarray]:
    solid = m["solid"]
    white = m["white"] & solid
    layers: dict[str, np.ndarray] = {}

    def take(name, mask):
        layers[name] = mask

    # --- priority pass: small, color-specific parts first -------------------
    take("Star_Ornament", m["gold"] & box_mask(solid.shape, BOX["Star_Ornament"]))
    take("Eye_L", m["iris"] & box_mask(solid.shape, BOX["Eye_L"]))
    take("Eye_R", m["iris"] & box_mask(solid.shape, BOX["Eye_R"]))
    take("Neck", m["mouth"] & box_mask(solid.shape, BOX["Neck"]))
    take("Hand_L", m["skin"] & box_mask(solid.shape, BOX["Hand_L"]))
    take("Hand_R", m["skin"] & box_mask(solid.shape, BOX["Hand_R"]))
    take("Leg_L", m["skin"] & box_mask(solid.shape, BOX["Leg_L"]))
    take("Leg_R", m["skin"] & box_mask(solid.shape, BOX["Leg_R"]))
    take("Face", m["skin"] & box_mask(solid.shape, BOX["Face"]))

    # navy lining = cape back surface
    take("Cape_Back", clean(m["navy"]))

    # --- white mass: carve by geometry -------------------------------------
    claimed = np.zeros(solid.shape, bool)
    for k in layers:
        claimed |= layers[k]

    rest = white & ~claimed
    yy = np.arange(H)[:, None] * np.ones((1, W), int)
    xx = np.ones((H, 1), int) * np.arange(W)[None, :]

    tip = rest & (yy < AHOGE_Y) & (xx >= AHOGE_X0) & (xx < AHOGE_X1)
    fringe = rest & (yy >= FRINGE_Y0) & (yy < FRINGE_Y1) & (xx >= FRINGE_X0) & (xx < FRINGE_X1)
    head_rest = rest & (yy < HEAD_BOTTOM) & ~tip & ~fringe

    arm_l = rest & box_mask(solid.shape, BOX["Arm_L"])
    arm_r = rest & box_mask(solid.shape, BOX["Arm_R"])
    boot_l = rest & box_mask(solid.shape, BOX["Boot_L"]) & (yy > 690)
    boot_r = rest & box_mask(solid.shape, BOX["Boot_R"]) & (yy > 690)

    cape_front = (
        rest
        & box_mask(solid.shape, BOX["Cape_Front"])
        & ~arm_l
        & ~arm_r
        & ~boot_l
        & ~boot_r
    ) | (m["gold"] & box_mask(solid.shape, BOX["Chest_Star"]))
    body = (
        rest
        & ~tip
        & ~fringe
        & ~head_rest
        & ~arm_l
        & ~arm_r
        & ~boot_l
        & ~boot_r
        & ~cape_front
    )

    take("Hair_Tip", clean(tip, 1))
    take("Hair_Front", clean(fringe, 3))
    take("Hair_Back", clean(head_rest, 3))
    take("Arm_L", clean(arm_l, 3))
    take("Arm_R", clean(arm_r, 3))
    take("Boot_L", clean(boot_l, 3))
    take("Boot_R", clean(boot_r, 3))
    take("Cape_Front", clean(cape_front, 3))
    take("Body", clean(body, 3))

    assign_residual(layers, order_of(layers), solid)
    return layers


# stacking order (back -> front); also the growth priority for residual pixels
ORDER = [
    "Hair_Back", "Cape_Back", "Body", "Cape_Front",
    "Arm_L", "Arm_R", "Leg_L", "Leg_R", "Boot_L", "Boot_R",
    "Hand_L", "Hand_R", "Face", "Hair_Tip", "Hair_Front",
    "Eye_L", "Eye_R", "Neck", "Star_Ornament",
]


def order_of(layers) -> list[str]:
    return [n for n in ORDER if n in layers]


def assign_residual(layers, order, solid, max_iter: int = 60) -> None:
    """Give line-art / shading pixels (no color match) to the nearest layer.

    Flat illustrations carry dark outlines and soft shading that match no color
    mask. For Live2D these pixels must ride along with the part they outline, so
    we grow every layer simultaneously into the unclaimed area (Voronoi-style).
    """
    labels = np.zeros(solid.shape, np.int32)
    for i, n in enumerate(order):
        labels[layers[n]] = i + 1

    kernel = np.ones((3, 3), np.uint8)
    unassigned = solid & (labels == 0)
    for _ in range(max_iter):
        if not unassigned.any():
            break
        grown = []
        for i, n in enumerate(order):
            d = cv2.dilate((labels == i + 1).astype(np.uint8), kernel) > 0
            grown.append(d & unassigned)
        # apply simultaneously so no layer gets a head start
        for i, n in enumerate(order):
            labels[grown[i]] = i + 1
        unassigned = solid & (labels == 0)

    for i, n in enumerate(order):
        layers[n] = labels == i + 1


def compose(arr, layers, names) -> Image.Image:
    """Flatten chosen layers back over transparency (sanity check)."""
    out = np.zeros_like(arr)
    for n in names:
        m = layers[n]
        out[m] = arr[m]
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def checker(w, h, size=12) -> np.ndarray:
    y = (np.arange(h)[:, None] // size) % 2
    x = (np.arange(w)[None, :] // size) % 2
    c = (y ^ x).astype(np.uint8)
    img = np.where(c[:, :, None] == 1, 235, 205).astype(np.uint8)
    return np.repeat(img, 3, axis=2)


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    arr, m = load()
    layers = build_layers(arr, m)

    # order for stacking / contact sheet (back to front)
    order = ORDER

    solid = m["solid"]
    total = int(solid.sum())
    covered = np.zeros(solid.shape, bool)
    rows = []
    for n in order:
        mask = layers[n]
        covered |= mask
        ys, xs = np.nonzero(mask)
        if len(ys):
            bb = f"x[{xs.min()}..{xs.max()}] y[{ys.min()}..{ys.max()}]"
        else:
            bb = "-"
        rows.append((n, int(mask.sum()), bb))
        rgba = np.zeros_like(arr)
        rgba[mask] = arr[mask]
        Image.fromarray(rgba.astype(np.uint8), "RGBA").save(f"{OUT}/{n}.png")

    # contact sheet: each layer over a checkerboard, scaled 0.5
    cell_w, cell_h = W // 2, H // 2
    cols = 5
    rows_n = (len(order) + cols - 1) // cols
    sheet = np.zeros((rows_n * (cell_h + 22), cols * cell_w, 3), np.uint8)
    for i, n in enumerate(order):
        cy, cx = divmod(i, cols)
        rgba = np.zeros_like(arr)
        mask = layers[n]
        rgba[mask] = arr[mask]
        rgb = rgba[:, :, :3].astype(np.uint8)
        a = (rgba[:, :, 3:4] / 255.0)
        bg = checker(W, H)
        comp = (rgb * a + bg * (1 - a)).astype(np.uint8)
        comp = cv2.resize(comp, (cell_w, cell_h), interpolation=cv2.INTER_AREA)
        y0 = cy * (cell_h + 22) + 22
        sheet[y0:y0 + cell_h, cx * cell_w:(cx + 1) * cell_w] = comp
        cv2.putText(
            sheet, n, (cx * cell_w + 6, cy * (cell_h + 22) + 15),
            cv2.FONT_HERSHEY_SIMPLEX, 0.42, (20, 20, 20), 1, cv2.LINE_AA,
        )
    Image.fromarray(sheet).save(f"{OUT}/_contact_sheet.png")

    # rebuild check
    rebuild = compose(arr, layers, order)
    rebuild.save(f"{OUT}/_rebuild.png")

    miss = int((solid & ~covered).sum())
    lines = [
        f"source           : {SRC} ({W}x{H})",
        f"opaque pixels    : {total}",
        f"covered by layers: {int(covered.sum())} ({covered.sum() / total * 100:.2f}%)",
        f"uncovered        : {miss} ({miss / total * 100:.2f}%)",
        "",
        f"{'layer':16s} {'px':>7s}  bbox",
        "-" * 60,
    ]
    for n, c, bb in rows:
        lines.append(f"{n:16s} {c:>7d}  {bb}")
    report = "\n".join(lines)
    with open(f"{OUT}/_report.txt", "w") as f:
        f.write(report + "\n")
    print(report)


if __name__ == "__main__":
    main()