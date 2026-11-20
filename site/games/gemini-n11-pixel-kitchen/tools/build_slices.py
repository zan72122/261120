#!/usr/bin/env python3
"""
Sprite-Stacking Horizontal Slice Generator for Little Pixel Kitchen.
Builds 3D horizontal pixel-art slice strips (dozens of layers per object)
faithfully modeled after the multi-angle reference turnaround sheets in refs/.
Exports:
  - assets/slices/<name>.png  (horizontal slice strips, W*H x D)
  - src/slices-data.js        (embedded base64 data URIs for zero-CORS file:// play)
  - refs/slice_preview.png    (4-angle visual turnaround check of generated slices)
"""

import os
import math
import zlib
import struct
import base64
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SLICES_DIR = os.path.join(ROOT, "assets", "slices")
REFS_DIR = os.path.join(ROOT, "refs")
OUT_JS = os.path.join(ROOT, "src", "slices-data.js")

os.makedirs(SLICES_DIR, exist_ok=True)
os.makedirs(REFS_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Pure-Python RGBA PNG encoder
# ---------------------------------------------------------------------------
def write_png(path, width, height, rgba_bytes):
    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)  # filter type None
        start = y * stride
        raw.extend(rgba_bytes[start:start + stride])

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as f:
        f.write(png)
    return png


def hex_rgba(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def shade(col, factor):
    r, g, b, a = col
    return (
        max(0, min(255, int(r * factor))),
        max(0, min(255, int(g * factor))),
        max(0, min(255, int(b * factor))),
        a,
    )


def mix(c1, c2, t):
    return (
        int(c1[0] * (1 - t) + c2[0] * t),
        int(c1[1] * (1 - t) + c2[1] * t),
        int(c1[2] * (1 - t) + c2[2] * t),
        int(c1[3] * (1 - t) + c2[3] * t),
    )


# ---------------------------------------------------------------------------
# Curated palette matched directly to our 3 reference turnaround sheets
# ---------------------------------------------------------------------------
PAL = {
    "outline": hex_rgba("#2b1912"),
    "wood_lt": hex_rgba("#e59d52"),
    "wood_md": hex_rgba("#c87b33"),
    "wood_dk": hex_rgba("#9c581f"),
    "wood_vd": hex_rgba("#6b3913"),
    "wood_pl": hex_rgba("#f0be7a"),

    "tile_lt": hex_rgba("#fbf4e4"),
    "tile_md": hex_rgba("#efe2c6"),
    "tile_dk": hex_rgba("#d9c5a0"),
    "grout":   hex_rgba("#bda580"),

    "terra_lt": hex_rgba("#d46d46"),
    "terra_md": hex_rgba("#b5502e"),
    "terra_dk": hex_rgba("#87361c"),

    "iron_lt": hex_rgba("#5b5e6e"),
    "iron_md": hex_rgba("#3d404d"),
    "iron_dk": hex_rgba("#262832"),

    "oven_gl": hex_rgba("#ffba47"),
    "oven_in": hex_rgba("#d96b1f"),
    "oven_dk": hex_rgba("#522613"),
    "rack":    hex_rgba("#e0d6c8"),
    "steel":   hex_rgba("#dce3eb"),
    "steel_d": hex_rgba("#9aa6b5"),

    "pot_lt":  hex_rgba("#ff8270"),
    "pot_md":  hex_rgba("#e85947"),
    "pot_dk":  hex_rgba("#b83a2c"),
    "pot_in":  hex_rgba("#f0eee9"),

    "cer_wh":  hex_rgba("#fcfbf7"),
    "cer_sh":  hex_rgba("#dbe2ed"),
    "navy":    hex_rgba("#2f4a80"),

    "brass_l": hex_rgba("#ffe473"),
    "brass_m": hex_rgba("#ebb02d"),
    "brass_d": hex_rgba("#a87014"),

    "glass_l": hex_rgba("#e3f5ff"),
    "glass_m": hex_rgba("#b5def5"),
    "glass_d": hex_rgba("#7eb6d9"),

    "ket_lt":  hex_rgba("#f53d33"),
    "ket_md":  hex_rgba("#d1241d"),
    "ket_dk":  hex_rgba("#961410"),

    "red_btn": hex_rgba("#e63e35"),
    "yel_btn": hex_rgba("#f5c636"),

    "towel_r": hex_rgba("#d94a43"),
    "towel_w": hex_rgba("#faf4e8"),

    # Foods
    "tom_lt":  hex_rgba("#ff5747"),
    "tom_md":  hex_rgba("#e02b22"),
    "tom_dk":  hex_rgba("#9e1612"),
    "tom_in":  hex_rgba("#ff968a"),
    "tom_sd":  hex_rgba("#ffe099"),
    "leaf_l":  hex_rgba("#59b842"),
    "leaf_m":  hex_rgba("#378c28"),
    "leaf_d":  hex_rgba("#215e18"),

    "car_lt":  hex_rgba("#ff9b36"),
    "car_md":  hex_rgba("#eb721a"),
    "car_dk":  hex_rgba("#b84b0d"),
    "car_in":  hex_rgba("#ffc278"),

    "egg_sh":  hex_rgba("#f5d7b5"),
    "egg_sd":  hex_rgba("#d9b189"),
    "egg_wh":  hex_rgba("#fffef7"),
    "egg_ws":  hex_rgba("#e3ded3"),
    "yolk_l":  hex_rgba("#ffe047"),
    "yolk_m":  hex_rgba("#ffa914"),
    "yolk_d":  hex_rgba("#d97800"),

    "wien_l":  hex_rgba("#e85643"),
    "wien_m":  hex_rgba("#c9372a"),
    "wien_d":  hex_rgba("#8f2018"),
    "wien_in": hex_rgba("#f7b8a8"),

    "mush_l":  hex_rgba("#9c6343"),
    "mush_m":  hex_rgba("#78472c"),
    "mush_d":  hex_rgba("#4f2b18"),
    "mush_st": hex_rgba("#f2e3cc"),
    "mush_ss": hex_rgba("#ccb597"),

    "broc_l":  hex_rgba("#62c445"),
    "broc_m":  hex_rgba("#3a9929"),
    "broc_d":  hex_rgba("#226619"),
    "broc_st": hex_rgba("#91d968"),

    "sear":    hex_rgba("#7a3a18"),

    # Mama
    "hair_l":  hex_rgba("#8c4e2b"),
    "hair_m":  hex_rgba("#6b371b"),
    "hair_d":  hex_rgba("#47210e"),
    "band":    hex_rgba("#f7cf54"),
    "skin_l":  hex_rgba("#ffdec2"),
    "skin_m":  hex_rgba("#f7c49e"),
    "skin_d":  hex_rgba("#dea178"),
    "cheek":   hex_rgba("#f58782"),
    "eye":     hex_rgba("#291711"),
    "star_y":  hex_rgba("#ffe44d"),
    "mouth":   hex_rgba("#b84a42"),
    "knit_l":  hex_rgba("#faf2dc"),
    "knit_d":  hex_rgba("#dfd0b2"),
    "apron_l": hex_rgba("#9ab895"),
    "apron_m": hex_rgba("#7b9976"),
    "apron_d": hex_rgba("#597555"),
    "pants":   hex_rgba("#634436"),
    "shoe":    hex_rgba("#472d22"),
}


# ---------------------------------------------------------------------------
# Voxel / Slice Volume Helper
# ---------------------------------------------------------------------------
class Volume:
    def __init__(self, w, d, h):
        self.w = w
        self.d = d
        self.h = h
        self.v = [[[None for _ in range(w)] for _ in range(d)] for _ in range(h)]

    def set(self, x, y, z, col):
        if 0 <= x < self.w and 0 <= y < self.d and 0 <= z < self.h:
            self.v[z][y][x] = col

    def get(self, x, y, z):
        if 0 <= x < self.w and 0 <= y < self.d and 0 <= z < self.h:
            return self.v[z][y][x]
        return None

    def clear(self, x, y, z):
        self.set(x, y, z, None)

    def box(self, x0, y0, z0, x1, y1, z1, col):
        for z in range(max(0, z0), min(self.h, z1)):
            for y in range(max(0, y0), min(self.d, y1)):
                for x in range(max(0, x0), min(self.w, x1)):
                    self.v[z][y][x] = col

    def cyl(self, cx, cy, r, z0, z1, col, hollow_r=0):
        r2 = r * r
        hr2 = hollow_r * hollow_r
        for z in range(max(0, z0), min(self.h, z1)):
            for y in range(self.d):
                dy = y + 0.5 - cy
                for x in range(self.w):
                    dx = x + 0.5 - cx
                    dist2 = dx * dx + dy * dy
                    if dist2 <= r2 and (hollow_r <= 0 or dist2 >= hr2):
                        self.v[z][y][x] = col

    def ellipsoid(self, cx, cy, cz, rx, ry, rz, col_fn):
        for z in range(self.h):
            dz = (z + 0.5 - cz) / rz
            if abs(dz) > 1.05:
                continue
            for y in range(self.d):
                dy = (y + 0.5 - cy) / ry
                if dy * dy + dz * dz > 1.05:
                    continue
                for x in range(self.w):
                    dx = (x + 0.5 - cx) / rx
                    d2 = dx * dx + dy * dy + dz * dz
                    if d2 <= 1.0:
                        c = col_fn(x, y, z, dx, dy, dz, d2) if callable(col_fn) else col_fn
                        if c is not None:
                            self.v[z][y][x] = c

    def add_slice_outlines(self, outline_col=None, strength=0.45):
        """Darken outer rim pixels subtly for crisp 16-bit pixel readability at any rotation."""
        if outline_col is None:
            outline_col = PAL["outline"]
        new_v = [[[self.v[z][y][x] for x in range(self.w)] for y in range(self.d)] for z in range(self.h)]
        for z in range(self.h):
            # Subtle vertical ambient lighting (bottom slightly deeper, top brighter)
            z_t = z / max(1, self.h - 1)
            z_mul = 0.88 + 0.16 * z_t
            for y in range(self.d):
                for x in range(self.w):
                    c = self.v[z][y][x]
                    if c is None:
                        continue
                    # Check if on horizontal silhouette edge
                    edge = False
                    for ox, oy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                        nx, ny = x + ox, y + oy
                        if nx < 0 or nx >= self.w or ny < 0 or ny >= self.d or self.v[z][ny][nx] is None:
                            edge = True
                            break
                    # Check if top surface exposed
                    top_exposed = (z == self.h - 1) or (self.v[z + 1][y][x] is None)
                    c2 = shade(c, z_mul * (1.04 if top_exposed else 0.97))
                    if edge and strength > 0:
                        # Only darken slightly on top edges so top faces stay bright & vibrant
                        s = strength * (0.45 if top_exposed else 0.85)
                        c2 = mix(c2, outline_col, s)
                    new_v[z][y][x] = c2
        self.v = new_v

    def export_strip(self, name):
        """Export horizontal slice strip PNG (width = W * H, height = D) and return metadata + base64."""
        strip_w = self.w * self.h
        strip_h = self.d
        buf = bytearray(strip_w * strip_h * 4)
        for z in range(self.h):
            x_off = z * self.w
            for y in range(self.d):
                row_base = y * strip_w
                for x in range(self.w):
                    c = self.v[z][y][x]
                    if c is not None:
                        idx = (row_base + x_off + x) * 4
                        buf[idx] = c[0]
                        buf[idx + 1] = c[1]
                        buf[idx + 2] = c[2]
                        buf[idx + 3] = c[3]
        png_path = os.path.join(SLICES_DIR, f"{name}.png")
        png_bytes = write_png(png_path, strip_w, strip_h, buf)
        b64 = base64.b64encode(png_bytes).decode("ascii")
        return {
            "w": self.w,
            "d": self.d,
            "h": self.h,
            "data": f"data:image/png;base64,{b64}",
        }


# ---------------------------------------------------------------------------
# MODEL 1: KITCHEN ISLAND (116 x 64 x 42 slices)
# Faithful to kitchen_island_turnaround.jpg:
#   - Terracotta & cream checkerboard floor plinth (z=0..4)
#   - Honey-oak cabinet with front mini oven + glowing window + 2 drawers (z=5..33)
#   - Back slatted wood paneling + recessed dish cubby with stacked plates/bowls!
#   - Cream ceramic tiled countertop with grout lines (z=34..38)
#   - Low tiled back lip along left/center back (z=39..41)
#   - 2-burner cast-iron stove grates on right-center (z=39..41)
# ---------------------------------------------------------------------------
def build_island():
    W, D, H = 116, 64, 42
    vol = Volume(W, D, H)

    # 1. Checkerboard terracotta & cream floor plinth (z=0..4)
    for z in range(0, 5):
        for y in range(0, D):
            for x in range(0, W):
                # Border trim
                if x == 0 or x == W - 1 or y == 0 or y == D - 1:
                    col = PAL["outline"] if z == 0 else PAL["terra_dk"]
                else:
                    tx = (x - 1) // 8
                    ty = (y - 1) // 8
                    is_terra = (tx + ty) % 2 == 0
                    if z == 4:
                        # Subtle grout line on top of plinth
                        if (x - 1) % 8 == 0 or (y - 1) % 8 == 0:
                            col = PAL["grout"]
                        else:
                            col = PAL["terra_lt"] if is_terra else PAL["tile_lt"]
                    else:
                        col = PAL["terra_md"] if is_terra else PAL["tile_dk"]
                vol.set(x, y, z, col)

    # 2. Honey-oak cabinet body (x=6..110, y=6..58, z=5..33)
    cx0, cx1 = 6, 110
    cy0, cy1 = 6, 58
    for z in range(5, 34):
        for y in range(cy0, cy1):
            for x in range(cx0, cx1):
                col = PAL["wood_md"]
                # Corner posts slightly darker
                if (x in (cx0, cx1 - 1) and y in (cy0, cy1 - 1)) or z == 5:
                    col = PAL["wood_vd"]
                elif x == cx0 or x == cx1 - 1 or y == cy0 or y == cy1 - 1:
                    col = PAL["wood_md"]
                    # Vertical wood planks on back face (y == cy0)
                    if y == cy0:
                        if x % 5 == 0:
                            col = PAL["wood_dk"]
                        elif x % 5 == 2:
                            col = PAL["wood_lt"]
                    # Side panels framed
                    if x in (cx0, cx1 - 1):
                        if y in (cy0 + 4, cy1 - 5) or z in (9, 29):
                            col = PAL["wood_dk"]
                        elif cy0 + 4 < y < cy1 - 5 and 9 < z < 29:
                            col = PAL["wood_lt"]
                vol.set(x, y, z, col)

    # 3. FRONT FACE DETAILS (y = cy1 - 2..cy1 - 1 — 2px thick for zero diagonal Moiré when rotated!)
    # 3a. Built-in Mini Oven (x = 16..50, z = 8..29)
    for z in range(8, 30):
        for x in range(16, 50):
            c = PAL["wood_vd"] if (x in (16, 49) or z in (8, 29)) else PAL["wood_lt"]
            vol.set(x, cy1 - 1, z, c)
            vol.set(x, cy1 - 2, z, c)
    # Silver oven handle sticking out at y=cy1, z=27..28
    for x in range(21, 45):
        vol.set(x, cy1, 27, PAL["steel_d"])
        vol.set(x, cy1, 28, PAL["steel"])
        if x in (21, 22, 43, 44):
            vol.set(x, cy1 - 1, 27, PAL["iron_dk"])
            vol.set(x, cy1 - 1, 28, PAL["iron_dk"])
    # Oven glass window (x=21..45, z=11..24) recessed with warm glowing interior + wire rack!
    for z in range(11, 25):
        for x in range(21, 45):
            if x in (21, 44) or z in (11, 24):
                vol.set(x, cy1 - 1, z, PAL["iron_dk"])
                vol.set(x, cy1 - 2, z, PAL["iron_dk"])
            else:
                vol.clear(x, cy1 - 1, z)
                glow_t = (z - 11) / 13.0
                glow = mix(PAL["oven_in"], PAL["oven_gl"], 0.45 + 0.50 * (1.0 - abs(glow_t - 0.55) * 1.3))
                vol.set(x, cy1 - 3, z, glow)
                vol.set(x, cy1 - 2, z, mix(glow, PAL["oven_in"], 0.25))
                if z == 16:
                    vol.set(x, cy1 - 2, z, PAL["rack"])
                    vol.set(x, cy1 - 1, z, PAL["rack"])
                if (x - 21) + (24 - z) in (5, 6):
                    vol.set(x, cy1 - 1, z, hex_rgba("#fff2cc"))

    # 3b. Two Drawers with Brass Knobs (x = 54..84, z = 8..25) — 2px solid depth
    for (dz0, dz1) in ((8, 16), (17, 25)):
        for z in range(dz0, dz1):
            for x in range(54, 85):
                if x in (54, 84) or z in (dz0, dz1 - 1):
                    c = PAL["wood_vd"]
                elif x in (55, 83) or z in (dz0 + 1, dz1 - 2):
                    c = PAL["wood_pl"]
                else:
                    c = PAL["wood_lt"]
                vol.set(x, cy1 - 1, z, c)
                vol.set(x, cy1 - 2, z, c)
        # Brass knob
        mz = (dz0 + dz1) // 2
        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1):
                if abs(dx) + abs(dz) <= 1:
                    vol.set(69 + dx, cy1, mz + dz, PAL["brass_m"])
        vol.set(69, cy1 + 1, mz, PAL["brass_l"])

    # 3c. Right Serving-Side Cabinet Front Panel (x = 88..106, z = 8..29) — 2px solid depth
    for z in range(8, 30):
        for x in range(88, 106):
            if x in (88, 105) or z in (8, 29):
                c = PAL["wood_vd"]
            elif x in (90, 103) or z in (10, 27):
                c = PAL["wood_dk"]
            else:
                c = PAL["wood_lt"]
            vol.set(x, cy1 - 1, z, c)
            vol.set(x, cy1 - 2, z, c)

    # 4. BACK FACE DETAILS (y = cy0): Open Dish Cubby with stacked pixel plates & bowls!
    # Cubby x = 14..52, z = 8..24, recessed y = cy0..cy0 + 10
    for z in range(8, 25):
        for x in range(14, 52):
            if x in (14, 51) or z in (8, 24):
                vol.set(x, cy0, z, PAL["wood_vd"])
            else:
                for ry in range(cy0, cy0 + 10):
                    vol.clear(x, ry, z)
                vol.set(x, cy0 + 10, z, PAL["wood_vd"])
                if z == 9:
                    for ry in range(cy0 + 1, cy0 + 10):
                        vol.set(x, ry, z, PAL["wood_dk"])
    # Stack of 4 ceramic plates inside cubby (cx=26, cy=cy0+5, z=10..17)
    for p_i in range(4):
        pz = 10 + p_i * 2
        vol.cyl(26, cy0 + 5, 7, pz, pz + 1, PAL["cer_sh"])
        vol.cyl(26, cy0 + 5, 7, pz + 1, pz + 2, PAL["navy"], hollow_r=5.5)
        vol.cyl(26, cy0 + 5, 5.5, pz + 1, pz + 2, PAL["cer_wh"])
    # Stack of 2 bowls next to plates (cx=42, cy=cy0+5, z=10..19)
    for b_i in range(2):
        bz = 10 + b_i * 4
        vol.cyl(42, cy0 + 5, 4.2, bz, bz + 2, PAL["cer_sh"])
        vol.cyl(42, cy0 + 5, 5.2, bz + 2, bz + 4, PAL["cer_wh"], hollow_r=3.5)
        vol.cyl(42, cy0 + 5, 5.2, bz + 3, bz + 4, PAL["navy"], hollow_r=4.1)

    # 5. LEFT SIDE TOWEL BAR (wooden bar mounted at x = cx0 - 3..cx0 - 1)
    for y in range(18, 46):
        vol.set(cx0 - 3, y, 25, PAL["wood_lt"])
        vol.set(cx0 - 3, y, 24, PAL["wood_dk"])
        vol.set(cx0 - 2, y, 25, PAL["wood_md"])
    for by in (19, 44):
        for bx in (cx0 - 3, cx0 - 2, cx0 - 1):
            for bz in (23, 24, 25, 26):
                vol.set(bx, by, bz, PAL["wood_dk"])

    # 6. CREAM CERAMIC TILED COUNTERTOP (x=4..112, y=4..60, z=34..38)
    for z in range(34, 39):
        for y in range(4, 60):
            for x in range(4, 112):
                if x in (4, 111) or y in (4, 59):
                    col = PAL["tile_dk"] if z < 38 else PAL["grout"]
                elif z == 38:
                    # Clean 8x8 cream ceramic tile grid!
                    gx = (x - 4) % 8 == 0
                    gy = (y - 4) % 8 == 0
                    if gx or gy:
                        col = PAL["grout"]
                    else:
                        # Subtle warm tile variation
                        tx = (x - 4) // 8
                        ty = (y - 4) // 8
                        # Right serving placemat zone (x=84..108, y=10..54): cozy woven sage-linen placemat!
                        if 84 <= x <= 108 and 10 <= y <= 54:
                            if x in (84, 108) or y in (10, 54):
                                col = PAL["apron_d"]
                            elif x in (86, 106) or y in (12, 52):
                                col = PAL["tile_lt"]
                            else:
                                col = PAL["apron_l"] if (x + y) % 2 == 0 else mix(PAL["apron_l"], PAL["tile_lt"], 0.45)
                        else:
                            col = PAL["tile_lt"] if (tx + ty) % 2 == 0 else mix(PAL["tile_lt"], PAL["tile_md"], 0.55)
                else:
                    col = PAL["tile_md"] if z >= 36 else PAL["tile_dk"]
                vol.set(x, y, z, col)

    # 7. LOW TILED BACK LIP (x=4..84, y=4..9, z=39..41) - low so back views see right over it!
    for z in range(39, 42):
        for y in range(4, 10):
            for x in range(4, 84):
                if (x - 4) % 8 == 0 and y == 9:
                    col = PAL["grout"]
                elif z == 41:
                    col = PAL["tile_lt"]
                else:
                    col = PAL["tile_md"]
                vol.set(x, y, z, col)

    # 8. TWO-BURNER CAST-IRON GAS STOVE GRATES
    # Back burner centered at (69, 20), Front burner centered at (69, 44)
    for (bx, by) in ((69, 20), (69, 44)):
        # Dark recessed burner well on top of countertop (z=38)
        vol.cyl(bx, by, 10.5, 38, 39, PAL["iron_dk"])
        # Outer square cast-iron grate frame (z=39..41)
        for z in range(39, 42):
            for y in range(by - 10, by + 11):
                for x in range(bx - 10, bx + 11):
                    on_border = (abs(x - bx) >= 9 or abs(y - by) >= 9)
                    on_cross = (abs(x - bx) <= 1 or abs(y - by) <= 1) and (abs(x - bx) + abs(y - by) >= 5)
                    if on_border or on_cross:
                        c = PAL["iron_lt"] if z == 41 else PAL["iron_md"]
                        vol.set(x, y, z, c)
        # Inner brass/iron burner cap ring (z=39..40)
        vol.cyl(bx, by, 4.2, 39, 41, PAL["iron_lt"], hollow_r=2.0)
        vol.cyl(bx, by, 2.2, 39, 40, PAL["iron_dk"])

    vol.add_slice_outlines(strength=0.40)
    return vol


# ---------------------------------------------------------------------------
# MODEL 2: HANGING CHECKERED DISH TOWEL (8 x 22 x 16)
# ---------------------------------------------------------------------------
def build_towel():
    W, D, H = 8, 22, 16
    vol = Volume(W, D, H)
    for z in range(0, H):
        for y in range(2, D - 2):
            # Folded drape hanging over rail at z=14..15
            if z >= 13:
                xs = [2, 3, 4, 5]
            else:
                # Slight natural cloth wave
                wave = int(round(math.sin((y - 2) * 0.55) * 0.6))
                xs = [2 + wave, 3 + wave]
            for x in xs:
                cx = (y // 3 + z // 3) % 2 == 0
                col = PAL["towel_r"] if cx else PAL["towel_w"]
                if z == 0:
                    col = mix(col, PAL["wood_dk"], 0.2)
                vol.set(x, y, z, col)
    vol.add_slice_outlines(strength=0.45)
    return vol


# ---------------------------------------------------------------------------
# MODEL 3: STOVE KNOB (Red & Yellow) (10 x 10 x 8)
# ---------------------------------------------------------------------------
def build_knob(main_col, hi_col):
    W, D, H = 10, 10, 8
    vol = Volume(W, D, H)
    vol.cyl(5, 5, 4.3, 0, 2, PAL["iron_dk"])
    vol.cyl(5, 5, 3.8, 2, 6, main_col)
    vol.cyl(5, 5, 3.4, 6, 7, hi_col)
    # Raised pointer bar across the top so rotation is super obvious!
    for z in range(5, 8):
        for y in range(2, 6):
            vol.set(4, y, z, PAL["cer_wh"] if z == 7 else hi_col)
            vol.set(5, y, z, PAL["cer_wh"] if z == 7 else hi_col)
    vol.add_slice_outlines(strength=0.5)
    return vol


# ---------------------------------------------------------------------------
# MODEL 4: LOW WOODEN INGREDIENT TRAY (28 x 44 x 6) — low rim so all 6 veggies pop!
# ---------------------------------------------------------------------------
def build_basket():
    W, D, H = 28, 44, 6
    vol = Volume(W, D, H)
    for z in range(0, H):
        for y in range(1, D - 1):
            for x in range(1, W - 1):
                is_wall = (x <= 2 or x >= W - 3 or y <= 2 or y >= D - 3)
                is_floor = (z <= 1)
                if is_wall or is_floor:
                    if is_floor and not is_wall:
                        col = PAL["wood_dk"] if (y % 4 == 0) else PAL["wood_md"]
                    else:
                        weave = ((x + y) // 3 + z // 2) % 2 == 0
                        col = PAL["wood_lt"] if weave else PAL["wood_md"]
                        if z == H - 1:
                            col = PAL["wood_pl"]
                    vol.set(x, y, z, col)
    vol.add_slice_outlines(strength=0.45)
    return vol


# ---------------------------------------------------------------------------
# MODEL 5: WOODEN CHOPPING BOARD (26 x 22 x 7)
# ---------------------------------------------------------------------------
def build_board():
    W, D, H = 26, 22, 7
    vol = Volume(W, D, H)
    for z in range(0, H):
        for y in range(1, D - 1):
            for x in range(1, W - 1):
                # Rounded corners
                if (x in (1, W - 2)) and (y in (1, D - 2)):
                    continue
                # Cutout handle slot on left side (x=3..4, y=8..13)
                if 3 <= x <= 4 and 8 <= y <= 13:
                    continue
                # Warm striped wood grain
                grain = (y // 3) % 2 == 0
                if z == H - 1:
                    col = PAL["wood_pl"] if grain else PAL["wood_lt"]
                elif z >= H - 3:
                    col = PAL["wood_lt"] if grain else PAL["wood_md"]
                else:
                    col = PAL["wood_dk"]
                vol.set(x, y, z, col)
    vol.add_slice_outlines(strength=0.45)
    return vol


# ---------------------------------------------------------------------------
# MODEL 6: KITCHEN KNIFE (24 x 10 x 10)
# ---------------------------------------------------------------------------
def build_knife():
    W, D, H = 24, 10, 10
    vol = Volume(W, D, H)
    # Wooden handle on right (x=15..22, y=4..6, z=3..6)
    for z in range(3, 7):
        for y in range(4, 7):
            for x in range(15, 23):
                col = PAL["wood_dk"] if z == 3 else PAL["wood_md"]
                if x in (17, 20) and z == 5:
                    col = PAL["steel"]  # metal rivets
                vol.set(x, y, z, col)
    # Steel blade on left (x=2..15, y=5, z=1..7, tapering to tip at x=2)
    for x in range(2, 15):
        t = (x - 2) / 12.0
        z_bot = int(round(1 + (1.0 - t) * 2.5))
        z_top = 7
        for z in range(z_bot, z_top):
            col = PAL["steel"] if z <= z_bot + 1 else PAL["steel_d"]
            if z == z_top - 1:
                col = PAL["cer_wh"]
            vol.set(x, 5, z, col)
            if z >= z_bot + 1:
                vol.set(x, 4, z, PAL["steel_d"])
    vol.add_slice_outlines(strength=0.45)
    return vol


# ---------------------------------------------------------------------------
# MODEL 7: CAST-IRON FRYING PAN (46 x 26 x 14)
# Pan bowl DEAD-CENTERED at (23, 13) so it sits perfectly over the stove burner!
# Wooden handle extends from x=33..45.
# ---------------------------------------------------------------------------
def build_pan():
    W, D, H = 46, 26, 14
    vol = Volume(W, D, H)
    cx, cy = 23, 13
    # Bottom flat iron base (z=0..2)
    vol.cyl(cx, cy, 9.5, 0, 2, PAL["iron_dk"])
    vol.cyl(cx, cy, 10.5, 2, 3, PAL["iron_md"])
    # Sloped hollow cast-iron wall (z=3..9)
    for z in range(3, 10):
        r_out = 10.5 + (z - 3) * 0.25
        r_in = r_out - 1.8
        vol.cyl(cx, cy, r_out, z, z + 1, PAL["iron_lt"] if z == 9 else PAL["iron_md"], hollow_r=r_in)
    # Inner dark seasoned cooking floor (z=2)
    vol.cyl(cx, cy, 8.8, 2, 3, PAL["iron_dk"])
    # Metal handle collar + angled rising wooden handle (x=33..45, y=11..15)
    for x in range(33, 45):
        t = (x - 33) / 11.0
        hz = int(round(7 + t * 4.0))
        is_metal = x < 35
        for dy in (-1, 0, 1):
            for dz in (0, 1, 2):
                if x == 43 and dy == 0:
                    continue
                if is_metal:
                    col = PAL["iron_lt"] if dz == 2 else PAL["iron_md"]
                else:
                    col = PAL["wood_pl"] if dz == 2 else (PAL["wood_lt"] if dz == 1 else PAL["wood_dk"])
                vol.set(x, cy + dy, hz + dz, col)
    vol.add_slice_outlines(strength=0.45)
    return vol


# ---------------------------------------------------------------------------
# MODEL 8: CORAL-RED ENAMEL SOUP POT (32 x 26 x 20)
# Centered at (16, 13), hollow inside so dynamic colored soup renders inside!
# ---------------------------------------------------------------------------
def build_pot():
    W, D, H = 32, 26, 20
    vol = Volume(W, D, H)
    cx, cy = 16, 13
    # Bottom
    vol.cyl(cx, cy, 9.2, 0, 2, PAL["pot_dk"])
    vol.cyl(cx, cy, 10.2, 2, 4, PAL["pot_md"])
    # Tall hollow cylindrical enamel walls (z=4..17)
    for z in range(4, 18):
        col = PAL["pot_md"]
        if z in (14, 15):
            col = PAL["pot_lt"]
        vol.cyl(cx, cy, 10.4, z, z + 1, col, hollow_r=8.2)
        # Inner cream enamel coating
        vol.cyl(cx, cy, 8.4, z, z + 1, PAL["pot_in"], hollow_r=7.2)
    # Crisp white enamel top lip (z=18..19)
    vol.cyl(cx, cy, 11.2, 18, 20, PAL["cer_wh"], hollow_r=7.4)
    # Two looped side handles at x=2..6 and x=26..30, y=10..16, z=12..16
    for side in (-1, 1):
        hx_base = cx + side * 10
        for z in range(12, 16):
            for dy in (-3, -2, -1, 0, 1, 2, 3):
                for dist in (1, 2, 3):
                    hx = hx_base + side * dist
                    if dist == 3 or abs(dy) == 3:
                        if not (dist == 3 and abs(dy) == 3):
                            col = PAL["pot_lt"] if z == 15 else PAL["pot_dk"]
                            vol.set(hx, cy + dy, z, col)
    vol.add_slice_outlines(strength=0.42)
    return vol


# ---------------------------------------------------------------------------
# MODEL 9: WOODEN LADLE (10 x 18 x 22)
# ---------------------------------------------------------------------------
def build_ladle():
    W, D, H = 10, 18, 22
    vol = Volume(W, D, H)
    # Scooping bowl at bottom (cx=5, cy=5, z=0..5)
    vol.cyl(5, 5, 3.6, 0, 2, PAL["wood_dk"])
    vol.cyl(5, 5, 4.0, 2, 5, PAL["wood_md"], hollow_r=2.2)
    # Rising angled handle (z=4..21, moving along +y from 7 to 14)
    for z in range(4, 22):
        t = (z - 4) / 17.0
        hy = int(round(7 + t * 6.5))
        for dx in (0, 1):
            vol.set(4 + dx, hy, z, PAL["wood_pl"] if z > 17 else PAL["wood_lt"])
            vol.set(4 + dx, hy - 1, z, PAL["wood_md"])
    vol.add_slice_outlines(strength=0.45)
    return vol


# ---------------------------------------------------------------------------
# MODEL 10: GLASS SALT SHAKER (12 x 12 x 18)
# ---------------------------------------------------------------------------
def build_salt():
    W, D, H = 12, 12, 18
    vol = Volume(W, D, H)
    cx, cy = 6, 6
    # Glass base & tapered faceted body (z=0..12)
    for z in range(0, 13):
        r = 4.2 - (z / 12.0) * 0.7
        vol.cyl(cx, cy, r, z, z + 1, PAL["glass_m"])
        # White salt inside lower half!
        if z >= 1 and z <= 8:
            vol.cyl(cx, cy, r - 1.1, z, z + 1, PAL["cer_wh"])
        # Bright glass highlight edge
        vol.set(int(cx - r + 1), int(cy - 1), z, PAL["glass_l"])
    # Silver screw cap & perforated dome (z=13..17)
    vol.cyl(cx, cy, 3.6, 13, 16, PAL["steel_d"])
    vol.cyl(cx, cy, 3.2, 16, 17, PAL["steel"])
    vol.cyl(cx, cy, 2.4, 17, 18, PAL["steel"])
    # Tiny dark shaker holes on top slice
    for (hx, hy) in ((5, 5), (7, 5), (6, 7), (5, 7)):
        vol.set(hx, hy, 17, PAL["iron_dk"])
    vol.add_slice_outlines(strength=0.45)
    return vol


# ---------------------------------------------------------------------------
# MODEL 11: RED KETCHUP SQUEEZE BOTTLE (12 x 12 x 22)
# ---------------------------------------------------------------------------
def build_ketchup():
    W, D, H = 12, 12, 22
    vol = Volume(W, D, H)
    cx, cy = 6, 6
    vol.cyl(cx, cy, 4.0, 0, 14, PAL["ket_md"])
    # Specular highlight strip on bottle side
    for z in range(2, 13):
        vol.set(3, 5, z, PAL["ket_lt"])
        vol.set(3, 6, z, PAL["ket_lt"])
    # Shoulder & screw ring (z=14..17)
    vol.cyl(cx, cy, 3.4, 14, 16, PAL["ket_lt"])
    vol.cyl(cx, cy, 3.7, 16, 18, PAL["ket_dk"])
    # Pointed squeeze nozzle (z=18..21)
    vol.cyl(cx, cy, 2.3, 18, 20, PAL["ket_md"])
    vol.cyl(cx, cy, 1.4, 20, 22, PAL["ket_lt"])
    vol.add_slice_outlines(strength=0.45)
    return vol


# ---------------------------------------------------------------------------
# MODEL 12: WHITE CERAMIC PLATE WITH NAVY RIM (28 x 28 x 7)
# ---------------------------------------------------------------------------
def build_plate():
    W, D, H = 28, 28, 7
    vol = Volume(W, D, H)
    cx, cy = 14, 14
    vol.cyl(cx, cy, 9.5, 0, 2, PAL["cer_sh"])
    vol.cyl(cx, cy, 11.5, 2, 4, PAL["cer_wh"])
    vol.cyl(cx, cy, 12.8, 4, 6, PAL["cer_wh"], hollow_r=9.2)
    vol.cyl(cx, cy, 13.0, 6, 7, PAL["navy"], hollow_r=11.0)
    vol.cyl(cx, cy, 11.0, 5, 6, PAL["cer_wh"], hollow_r=9.2)
    vol.cyl(cx, cy, 9.5, 3, 4, PAL["cer_wh"])
    vol.add_slice_outlines(strength=0.38)
    return vol


# ---------------------------------------------------------------------------
# MODEL 13: MATCHING SOUP BOWL (20 x 20 x 12)
# ---------------------------------------------------------------------------
def build_bowl():
    W, D, H = 20, 20, 12
    vol = Volume(W, D, H)
    cx, cy = 10, 10
    vol.cyl(cx, cy, 5.2, 0, 2, PAL["cer_sh"])
    for z in range(2, 11):
        r = 6.0 + (z - 2) * 0.36
        vol.cyl(cx, cy, r, z, z + 1, PAL["cer_wh"], hollow_r=r - 1.8 if z >= 4 else 0)
    vol.cyl(cx, cy, 9.2, 11, 12, PAL["navy"], hollow_r=7.2)
    vol.add_slice_outlines(strength=0.40)
    return vol


# ---------------------------------------------------------------------------
# MODEL 14: BRASS SERVICE BELL (14 x 14 x 13)
# ---------------------------------------------------------------------------
def build_bell():
    W, D, H = 14, 14, 13
    vol = Volume(W, D, H)
    cx, cy = 7, 7
    vol.cyl(cx, cy, 6.2, 0, 3, PAL["iron_dk"])
    for z in range(3, 11):
        t = (z - 3) / 7.5
        r = 5.4 * math.sqrt(max(0.05, 1.0 - t * t * 0.85))
        col = PAL["brass_l"] if z >= 8 else PAL["brass_m"]
        vol.cyl(cx, cy, r, z, z + 1, col)
    # Top push plunger
    vol.cyl(cx, cy, 1.8, 11, 13, PAL["brass_l"])
    vol.add_slice_outlines(strength=0.45)
    return vol


# ---------------------------------------------------------------------------
# FOODS (Whole, Chopped, Cooked — matching cookware_ingredients_turnaround.jpg!)
# ---------------------------------------------------------------------------
def build_tomato_whole():
    W, D, H = 16, 16, 15
    vol = Volume(W, D, H)
    def col(x, y, z, dx, dy, dz, d2):
        if dx < -0.2 and dy < -0.2 and dz > 0.25:
            return PAL["tom_lt"]
        return PAL["tom_md"] if dz > -0.3 else PAL["tom_dk"]
    vol.ellipsoid(8, 8, 6.2, 6.2, 6.2, 5.4, col)
    # Green 5-pointed star calyx + tiny stem on top (z=11..14)
    for ang_deg in range(0, 360, 72):
        rad = math.radians(ang_deg)
        for step in (1, 2, 3):
            sx = int(round(8 + math.cos(rad) * step))
            sy = int(round(8 + math.sin(rad) * step))
            vol.set(sx, sy, 11 if step >= 3 else 12, PAL["leaf_m"] if step == 3 else PAL["leaf_l"])
    vol.cyl(8, 8, 1.2, 12, 15, PAL["leaf_d"])
    vol.add_slice_outlines(strength=0.45)
    return vol


def build_tomato_sliced(cooked=False):
    W, D, H = 16, 16, 9
    vol = Volume(W, D, H)
    rim = PAL["sear"] if cooked else PAL["tom_md"]
    in_c = PAL["tom_md"] if cooked else PAL["tom_in"]
    seed_c = PAL["yolk_m"] if cooked else PAL["tom_sd"]
    # Two slightly offset juicy slices stacked
    for (cx, cy, z0) in ((7, 8, 0), (9, 8, 4)):
        vol.cyl(cx, cy, 5.2, z0, z0 + 4, rim)
        vol.cyl(cx, cy, 4.1, z0 + 1, z0 + 4, in_c)
        for (ox, oy) in ((-2, -1), (2, -1), (-1, 2), (2, 1)):
            vol.set(cx + ox, cy + oy, z0 + 3, seed_c)
    vol.add_slice_outlines(strength=0.42)
    return vol


def build_carrot_whole():
    W, D, H = 18, 12, 12
    vol = Volume(W, D, H)
    # Lying horizontally along X (tip at x=2, thick shoulder at x=12, leafy top at x=13..17)
    for x in range(2, 13):
        t = (x - 2) / 10.0
        r = 1.4 + t * 2.6
        for z in range(1, 10):
            for y in range(1, 11):
                dy = y + 0.5 - 6.0
                dz = z + 0.5 - 5.2
                if dy * dy + dz * dz <= r * r:
                    c = PAL["car_lt"] if dz > 0.6 else (PAL["car_md"] if dz > -1.0 else PAL["car_dk"])
                    if x % 3 == 0 and dz > 0:
                        c = PAL["car_dk"]
                    vol.set(x, y, z, c)
    # Lush green leaves at x=13..17
    for x in range(13, 17):
        for dy in (-2, -1, 0, 1, 2):
            for dz in (-2, -1, 0, 1, 2):
                if abs(dy) + abs(dz) <= (3 if x < 16 else 2):
                    if (x + dy + dz) % 2 == 0 or x == 13:
                        vol.set(x, 6 + dy, 5 + dz, PAL["leaf_l"] if dz > 0 else PAL["leaf_m"])
    vol.add_slice_outlines(strength=0.45)
    return vol


def build_carrot_sliced(flower=False, cooked=False):
    W, D, H = 16, 16, 9
    vol = Volume(W, D, H)
    out_c = PAL["car_dk"] if cooked else PAL["car_md"]
    hi_c = PAL["car_md"] if cooked else PAL["car_lt"]
    core_c = PAL["car_lt"] if cooked else PAL["car_in"]
    centers = [(6, 7, 0), (10, 9, 4)] if not flower else [(8, 8, 0), (8, 8, 4)]
    for (cx, cy, z0) in centers:
        if not flower:
            vol.cyl(cx, cy, 4.3, z0, z0 + 4, out_c)
            vol.cyl(cx, cy, 3.5, z0 + 3, z0 + 4, hi_c)
            vol.cyl(cx, cy, 1.8, z0 + 3, z0 + 4, core_c)
        else:
            # Cute 5-petal Japanese hanagata flower carrot!
            for z in range(z0, z0 + 4):
                for y in range(D):
                    for x in range(W):
                        dx, dy = x + 0.5 - cx, y + 0.5 - cy
                        r = math.hypot(dx, dy)
                        ang = math.atan2(dy, dx)
                        petal_r = 4.5 + 1.15 * math.cos(5 * ang)
                        if r <= petal_r:
                            c = out_c if z < z0 + 3 else (core_c if r < 1.9 else hi_c)
                            vol.set(x, y, z, c)
    vol.add_slice_outlines(strength=0.42)
    return vol


def build_egg_whole():
    W, D, H = 14, 14, 15
    vol = Volume(W, D, H)
    def col(x, y, z, dx, dy, dz, d2):
        if dx < -0.15 and dy < -0.15 and dz > 0.25:
            return PAL["egg_wh"]
        return PAL["egg_sh"] if dz > -0.2 else PAL["egg_sd"]
    for z in range(1, 14):
        t = (z - 1) / 12.0
        # Egg profile: wider near bottom, softly pointed near top
        r = 4.6 * math.sin(math.pi * (t ** 0.85))
        for y in range(D):
            for x in range(W):
                dx, dy = x + 0.5 - 7, y + 0.5 - 7
                if dx * dx + dy * dy <= r * r:
                    c = PAL["egg_wh"] if (dx < -0.5 and dy < -0.5 and t > 0.5) else (PAL["egg_sh"] if t > 0.3 else PAL["egg_sd"])
                    vol.set(x, y, z, c)
    vol.add_slice_outlines(strength=0.40)
    return vol


def build_egg_cracked(fried=False):
    W, D, H = 18, 18, 8
    vol = Volume(W, D, H)
    cx, cy = 9, 9
    wh_base = PAL["egg_wh"] if fried else hex_rgba("#f0ece0")
    wh_edge = PAL["wood_pl"] if fried else hex_rgba("#ded9cb")
    # Organic scalloped egg white puddle (z=0..3)
    for z in range(0, 3):
        for y in range(D):
            for x in range(W):
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                ang = math.atan2(dy, dx)
                rad = 6.6 + 1.1 * math.sin(3 * ang + 0.4) + 0.7 * math.cos(5 * ang)
                dist = math.hypot(dx, dy)
                if dist <= rad - (0.6 if z == 2 else 0):
                    c = wh_edge if (fried and dist > rad - 1.3 and z <= 1) else wh_base
                    vol.set(x, y, z, c)
    # Glossy golden dome yolk on top (z=2..7)
    def yolk_col(x, y, z, dx, dy, dz, d2):
        if dx < -0.15 and dy < -0.15 and dz > 0.35:
            return PAL["cer_wh"]
        return PAL["yolk_l"] if dz > 0.1 else PAL["yolk_m"]
    vol.ellipsoid(cx + 0.5, cy - 0.3, 3.2, 3.5, 3.5, 3.4, yolk_col)
    vol.add_slice_outlines(strength=0.36)
    return vol


def build_wiener_whole(slit=False):
    W, D, H = 18, 12, 10
    vol = Volume(W, D, H)
    # Plump horizontal red bento wiener sausage
    for x in range(2, 16):
        end_dist = min(x - 2, 15 - x)
        r = 3.0 if end_dist >= 2 else (2.4 if end_dist == 1 else 1.5)
        for z in range(1, 9):
            for y in range(2, 10):
                dy = y + 0.5 - 6.0
                dz = z + 0.5 - 4.5
                if dy * dy + dz * dz <= r * r:
                    c = PAL["wien_l"] if dz > 0.8 else (PAL["wien_m"] if dz > -0.8 else PAL["wien_d"])
                    if slit and x in (6, 9, 12) and dz > 0.6:
                        c = PAL["wien_in"]
                    vol.set(x, y, z, c)
    vol.add_slice_outlines(strength=0.45)
    return vol


def build_wiener_tako():
    """Adorable Japanese octopus wiener (tako-san wiener) with 6 curled legs & cute eyes!"""
    W, D, H = 16, 16, 17
    vol = Volume(W, D, H)
    cx, cy = 8, 8
    # 6 curled outward octopus legs at bottom (z=0..6)
    for k in range(6):
        ang = math.radians(k * 60 + 15)
        for step in range(1, 6):
            lx = cx + math.cos(ang) * (1.8 + step * 0.95)
            ly = cy + math.sin(ang) * (1.8 + step * 0.95)
            lz = int(round(5 - step * 0.85 + (0.9 if step == 5 else 0)))
            for dz in (0, 1, 2):
                c = PAL["wien_in"] if dz == 0 else PAL["wien_m"]
                vol.set(int(round(lx)), int(round(ly)), max(0, lz + dz), c)
                vol.set(int(round(lx)) + 1, int(round(ly)), max(0, lz + dz), c)
    # Plump domed octopus head/body (z=5..16)
    def head_col(x, y, z, dx, dy, dz, d2):
        return PAL["wien_l"] if (dx < 0 and dz > 0.2) else PAL["wien_m"]
    vol.ellipsoid(cx, cy, 10.5, 4.2, 4.2, 5.8, head_col)
    # Two cute tiny pixel eyes on the front (+Y) of the head!
    vol.set(6, 11, 12, PAL["eye"])
    vol.set(10, 11, 12, PAL["eye"])
    vol.set(6, 12, 12, PAL["eye"])
    vol.set(10, 12, 12, PAL["eye"])
    vol.set(8, 12, 10, PAL["wien_in"])  # tiny cute o-mouth
    vol.add_slice_outlines(strength=0.42)
    return vol


def build_mushroom_whole():
    W, D, H = 16, 16, 15
    vol = Volume(W, D, H)
    cx, cy = 8, 8
    # Sturdy cream stem (z=0..7)
    vol.cyl(cx, cy, 2.6, 0, 8, PAL["mush_st"])
    vol.cyl(cx, cy, 2.2, 0, 2, PAL["mush_ss"])
    # Cream gills underside (z=6..7)
    vol.cyl(cx, cy, 5.6, 6, 8, PAL["mush_ss"])
    # Domed rich-brown shiitake cap (z=7..14)
    def cap_col(x, y, z, dx, dy, dz, d2):
        if dz < 0:
            return None
        if abs(dx) < 0.2 and abs(dy) < 0.2 and dz > 0.65:
            return PAL["mush_st"]  # cute shiitake cross-notch hint!
        return PAL["mush_l"] if dz > 0.35 else PAL["mush_m"]
    vol.ellipsoid(cx, cy, 7.5, 6.4, 6.4, 6.8, cap_col)
    vol.add_slice_outlines(strength=0.45)
    return vol


def build_mushroom_sliced(cooked=False):
    W, D, H = 16, 16, 8
    vol = Volume(W, D, H)
    cap_c = PAL["mush_d"] if cooked else PAL["mush_m"]
    st_c = PAL["wood_pl"] if cooked else PAL["mush_st"]
    # Two neat T-shaped mushroom slices lying flat
    for (ox, oy, z0) in ((3, 4, 0), (5, 6, 3)):
        for z in range(z0, z0 + 3):
            # Cap arc
            for x in range(ox, ox + 9):
                vol.set(x, oy, z, cap_c)
                vol.set(x, oy + 1, z, cap_c)
                if ox + 1 <= x <= ox + 7:
                    vol.set(x, oy + 2, z, st_c)
            # Stem
            for y in range(oy + 3, oy + 7):
                for x in range(ox + 3, ox + 6):
                    vol.set(x, y, z, st_c)
    vol.add_slice_outlines(strength=0.42)
    return vol


def build_broccoli_whole(chopped=False, cooked=False):
    W, D, H = 16, 16, 16 if not chopped else 11
    vol = Volume(W, D, H)
    cx, cy = 8, 8
    c_l = PAL["broc_l"] if not cooked else hex_rgba("#4cd93b")
    c_m = PAL["broc_m"]
    c_d = PAL["broc_d"]
    st = PAL["broc_st"]
    if not chopped:
        vol.cyl(cx, cy, 2.3, 0, 8, st)
        # Cluster of lush bumpy florets
        puffs = [
            (8, 8, 11.5, 4.2), (5, 7, 9.5, 3.4), (11, 7, 9.5, 3.4),
            (7, 11, 9.5, 3.3), (10, 10, 10.0, 3.2), (7, 5, 9.5, 3.3),
        ]
    else:
        # Two bite-sized mini broccoli florets
        vol.cyl(6, 7, 1.5, 0, 5, st)
        vol.cyl(11, 10, 1.5, 0, 5, st)
        puffs = [
            (6, 7, 6.5, 3.2), (4, 6, 5.5, 2.3),
            (11, 10, 6.5, 3.2), (12, 9, 5.5, 2.3),
        ]
    for (px, py, pz, pr) in puffs:
        def fcol(x, y, z, dx, dy, dz, d2):
            if dz > 0.35 and (x + y) % 2 == 0:
                return c_l
            return c_m if dz > -0.2 else c_d
        vol.ellipsoid(px, py, pz, pr, pr, pr * 0.9, fcol)
    vol.add_slice_outlines(strength=0.44)
    return vol


# ---------------------------------------------------------------------------
# MAMA CHARACTER (Split into Stool+Body AND Expressive Head!)
# Faithful to mama_turnaround.jpg:
#   - Seated on 4-legged round wooden stool
#   - Cream knit sweater, sage-green apron with pocket (front) & tied bow (back!)
#   - Chestnut brown hair with top bun + golden yellow hairband
#   - Front faces +Y in local space (we rotate her to face -X toward the plate!)
# ---------------------------------------------------------------------------
def build_mama_body():
    W, D, H = 26, 26, 26
    vol = Volume(W, D, H)
    cx, cy = 13, 13

    # 1. Wooden 4-legged kitchen stool (z=0..10)
    for (lx, ly) in ((8, 8), (18, 8), (8, 18), (18, 18)):
        vol.cyl(lx, ly, 1.4, 0, 9, PAL["wood_dk"])
    # Cross stretchers
    for x in range(8, 19):
        vol.set(x, 13, 4, PAL["wood_md"])
    for y in range(8, 19):
        vol.set(13, y, 4, PAL["wood_md"])
    # Round wooden stool seat (z=8..10)
    vol.cyl(cx, cy, 7.6, 8, 10, PAL["wood_md"])
    vol.cyl(cx, cy, 7.2, 10, 11, PAL["wood_lt"])

    # 2. Seated legs & brown shoes tucked in front (+Y side, z=1..12)
    for sx in (10, 16):
        vol.box(sx - 2, 17, 1, sx + 2, 21, 4, PAL["shoe"])
        vol.box(sx - 2, 16, 4, sx + 2, 19, 10, PAL["pants"])
    # Lap / seated hips (z=10..14)
    vol.box(8, 11, 10, 18, 19, 14, PAL["pants"])

    # 3. Torso: cream knit sweater + sage-green apron (z=13..25)
    for z in range(13, 26):
        for y in range(8, 18):
            for x in range(7, 19):
                dx = (x + 0.5 - cx) / 5.8
                dy = (y + 0.5 - cy) / 4.4
                if dx * dx + dy * dy <= 1.0:
                    # Sweater stripe pattern
                    col = PAL["knit_l"] if (x % 2 == 0) else PAL["knit_d"]
                    # Sage-green apron covering front (+Y) & lower skirt over lap
                    if y >= 14 and 9 <= x <= 16:
                        col = PAL["apron_m"]
                        if z in (16, 17, 18, 19) and 10 <= x <= 15:
                            col = PAL["apron_l"]  # front pocket!
                        if z == 20 and 10 <= x <= 15:
                            col = PAL["apron_d"]  # pocket top seam
                    # Apron shoulder straps up to z=25
                    if z >= 21 and x in (9, 10, 15, 16) and y >= 11:
                        col = PAL["apron_m"]
                    # Apron waistband wrapping around back!
                    if z in (15, 16) and y <= 14:
                        col = PAL["apron_d"]
                    vol.set(x, y, z, col)

    # Apron skirt draping over lap (+Y, z=11..15)
    for z in range(11, 15):
        for x in range(9, 17):
            for y in range(15, 20):
                vol.set(x, y, z, PAL["apron_m"] if z >= 12 else PAL["apron_d"])

    # Cute tied sage-green apron bow on the BACK (y = 6..8, z = 13..17)!
    for dx in (-3, -2, -1, 0, 1, 2, 3):
        for dz in (-1, 0, 1):
            if abs(dx) >= 1 or dz == 0:
                c = PAL["apron_l"] if dz == 1 else PAL["apron_m"]
                vol.set(cx + dx, 7, 15 + dz, c)
    # Hanging bow ribbons
    vol.box(cx - 2, 7, 12, cx - 1, 8, 15, PAL["apron_d"])
    vol.box(cx + 1, 7, 12, cx + 2, 8, 15, PAL["apron_d"])

    # Arms resting warmly forward (cream knit sleeves + cute skin hands!)
    for side in (-1, 1):
        ax = cx + side * 6
        vol.box(ax - 1, 11, 16, ax + 2, 16, 22, PAL["knit_l"])
        vol.box(ax - 1, 15, 14, ax + 2, 19, 18, PAL["knit_d"])
        # Hands resting gently in front
        hx = cx + side * 4
        vol.box(hx - 1, 17, 14, hx + 2, 20, 17, PAL["skin_l"])

    # Neck
    vol.cyl(cx, cy, 2.3, 24, 26, PAL["skin_m"])

    vol.add_slice_outlines(strength=0.40)
    return vol


def build_mama_head(expr="idle"):
    """
    Expressive 3D stacked head (26 x 26 x 24 slices):
      expr in ('idle', 'star', 'happy', 'surprised', 'giggle', 'munch')
    Front face is at +Y so all facial pixels are cleanly visible from front & 3/4 angles!
    """
    W, D, H = 26, 26, 24
    vol = Volume(W, D, H)
    cx, cy = 13, 13

    # 1. Head sphere (z=0..15) — tuned so face & eyes stay 100% clear from elevated 3/4 view!
    def head_col(x, y, z, dx, dy, dz, d2):
        # Hair covers top, back (dy < 0.18), sides, and clean high bangs well above eyes (dz > 0.36)
        is_hair = False
        if dz > 0.42:
            is_hair = True
        elif dy < 0.18:
            is_hair = True
        elif abs(dx) > 0.78 and dz > -0.40:
            is_hair = True
        elif dy >= 0.18 and dz > 0.30:
            # Gentle high side-swept bangs
            bang_h = 0.32 + 0.14 * abs(dx - 0.12)
            if dz > bang_h:
                is_hair = True
        if is_hair:
            if dz > 0.58 and (x + y) % 3 == 0:
                return PAL["hair_l"]
            return PAL["hair_m"] if dz > -0.25 else PAL["hair_d"]
        # Warm skin face
        return PAL["skin_l"] if dz > -0.15 else PAL["skin_m"]

    vol.ellipsoid(cx, cy, 7.8, 8.0, 7.4, 7.6, head_col)

    # Cute little ears on sides (x=4..5 and x=20..21, y=12..14, z=5..8)
    for ex in (4, 20):
        vol.box(ex, 12, 5, ex + 2, 14, 9, PAL["skin_m"])

    # 2. Top chestnut hair bun + golden-yellow hairband (z=14..23)!
    vol.cyl(cx, cy - 1, 4.6, 14, 16, PAL["band"])
    def bun_col(x, y, z, dx, dy, dz, d2):
        return PAL["hair_l"] if dz > 0.25 else PAL["hair_m"]
    vol.ellipsoid(cx, cy - 1, 18.8, 4.6, 4.6, 4.0, bun_col)

    # 3. Facial features painted boldly onto the front-most skin pixels (+Y surface)!
    def paint_front(fx, fz, col):
        for y in range(D - 1, cy, -1):
            if vol.get(fx, y, fz) is not None:
                vol.set(fx, y, fz, col)
                vol.set(fx, y - 1, fz, col)
                return

    # Rosy cheeks (always warm & super readable!)
    for (rx, rz) in ((8, 4), (9, 4), (8, 5), (9, 5), (17, 4), (18, 4), (17, 5), (18, 5)):
        paint_front(rx, rz, PAL["cheek"])

    if expr == "idle":
        # Bright expressive pixel eyes (2x3 with white sparkle!)
        for ex in (10, 16):
            for ez in (6, 7, 8):
                paint_front(ex, ez, PAL["eye"])
                paint_front(ex + (1 if ex == 10 else -1), ez, PAL["eye"])
            paint_front(ex, 8, PAL["cer_wh"])
        # Warm smile
        for mx in (12, 13, 14):
            paint_front(mx, 3, PAL["mouth"])
        paint_front(11, 4, PAL["mouth"])
        paint_front(15, 4, PAL["mouth"])

    elif expr == "star":
        # Sparkling golden star-eyes!
        for ex in (10, 16):
            for (ox, oz) in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
                paint_front(ex + ox, 7 + oz, PAL["star_y"] if ox == 0 else PAL["brass_m"])
        # Big excited open smile
        for mx in (12, 13, 14):
            paint_front(mx, 4, PAL["mouth"])
            paint_front(mx, 3, PAL["cheek"])
            paint_front(mx, 2, PAL["mouth"])

    elif expr in ("happy", "giggle"):
        # Joyful curved closed eyes (^ ^)
        for ex in (10, 16):
            paint_front(ex - 1, 6, PAL["eye"])
            paint_front(ex, 7, PAL["eye"])
            paint_front(ex, 8, PAL["eye"])
            paint_front(ex + 1, 6, PAL["eye"])
        # Big beaming smile
        for mx in (12, 13, 14):
            paint_front(mx, 3, PAL["mouth"])
            paint_front(mx, 2, PAL["cheek"])
        paint_front(11, 4, PAL["mouth"])
        paint_front(15, 4, PAL["mouth"])

    elif expr == "munch":
        # Happy munching eyes & cute round chomping mouth!
        for ex in (10, 16):
            paint_front(ex - 1, 6, PAL["eye"])
            paint_front(ex, 7, PAL["eye"])
            paint_front(ex + 1, 6, PAL["eye"])
        for mx in (12, 13, 14):
            paint_front(mx, 3, PAL["mouth"])
            paint_front(mx, 4, PAL["mouth"])
        paint_front(13, 2, PAL["mouth"])

    elif expr == "surprised":
        # Funny wide-eyed "WHOA!" face
        for ex in (10, 16):
            for ox in (-1, 0, 1):
                for oz in (6, 7, 8):
                    paint_front(ex + ox, oz, PAL["cer_wh"])
            paint_front(ex, 7, PAL["eye"])
        # Little 'O' mouth
        for (mx, mz) in ((12, 3), (13, 3), (14, 3), (12, 2), (13, 2), (14, 2)):
            paint_front(mx, mz, PAL["mouth"])

    vol.add_slice_outlines(strength=0.35)
    return vol


# ---------------------------------------------------------------------------
# Render a quick 4-angle sprite-stacked preview contact sheet for visual QA!
# ---------------------------------------------------------------------------
def render_preview(models_dict):
    """Draw key models from 4 angles (front-3/4, right, back-3/4, left) onto refs/slice_preview.png."""
    PW, PH = 720, 480
    img = bytearray(PW * PH * 4)
    # Warm cream backdrop
    bg = hex_rgba("#f5ebd6")
    for i in range(0, PW * PH * 4, 4):
        img[i:i + 4] = bytes(bg)

    def draw_vol(vol, cx, cy, angle_rad, tilt=0.58, scale=1.0):
        cos_a = math.cos(angle_rad)
        sin_a = math.sin(angle_rad)
        hw = vol.w / 2.0
        hd = vol.d / 2.0
        for z in range(vol.h):
            sy_off = -z * 0.9 * scale
            for y in range(vol.d):
                dy = y - hd
                for x in range(vol.w):
                    c = vol.v[z][y][x]
                    if c is None:
                        continue
                    dx = x - hw
                    rx = (dx * cos_a - dy * sin_a) * scale
                    ry = (dx * sin_a + dy * cos_a) * tilt * scale + sy_off
                    px = int(round(cx + rx))
                    py = int(round(cy + ry))
                    # Splat 2x2 if scale >= 1.5 else 1x1
                    rad = 1 if scale >= 1.4 else 0
                    for oy in range(0, rad + 1):
                        for ox in range(0, rad + 1):
                            qx, qy = px + ox, py + oy
                            if 0 <= qx < PW and 0 <= qy < PH:
                                idx = (qy * PW + qx) * 4
                                img[idx] = c[0]
                                img[idx + 1] = c[1]
                                img[idx + 2] = c[2]
                                img[idx + 3] = 255

    # Row 1: Kitchen Island at 4 angles (Front-3/4, Side, Back-3/4, Other Side)
    island = models_dict["island"]
    angles = [0.42, 1.57, 3.55, -1.57]
    for i, ang in enumerate(angles):
        draw_vol(island, 100 + i * 175, 118, ang, scale=1.15)

    # Row 2: Mama (body + head) at 4 angles!
    m_body = models_dict["mama_body"]
    m_heads = [
        models_dict["mama_head_idle"],
        models_dict["mama_head_star"],
        models_dict["mama_head_happy"],
        models_dict["mama_head_surprised"],
    ]
    for i, ang in enumerate([0.35, 1.35, 3.14, -0.35]):
        bx = 95 + i * 165
        by = 265
        draw_vol(m_body, bx, by, ang, scale=1.8)
        draw_vol(m_heads[i], bx, by - 25 * 0.9 * 1.8, ang, scale=1.8)

    # Row 3: Cookware & Foods lineup!
    lineup = [
        "pan", "pot", "board", "knife", "salt", "ketchup", "plate", "bell",
        "tomato_whole", "carrot_flower", "egg_fried", "wiener_tako", "mushroom_whole", "broccoli_whole",
    ]
    for i, key in enumerate(lineup):
        lx = 46 + (i % 7) * 100
        ly = 365 + (i // 7) * 78
        draw_vol(models_dict[key], lx, ly, 0.45, scale=1.75)

    write_png(os.path.join(REFS_DIR, "slice_preview.png"), PW, PH, img)


def main():
    builders = {
        "island": build_island,
        "towel": build_towel,
        "knob_red": lambda: build_knob(PAL["red_btn"], PAL["pot_lt"]),
        "knob_yellow": lambda: build_knob(PAL["yel_btn"], PAL["brass_l"]),
        "basket": build_basket,
        "board": build_board,
        "knife": build_knife,
        "pan": build_pan,
        "pot": build_pot,
        "ladle": build_ladle,
        "salt": build_salt,
        "ketchup": build_ketchup,
        "plate": build_plate,
        "bowl": build_bowl,
        "bell": build_bell,
        "tomato_whole": build_tomato_whole,
        "tomato_sliced": lambda: build_tomato_sliced(False),
        "tomato_cooked": lambda: build_tomato_sliced(True),
        "carrot_whole": build_carrot_whole,
        "carrot_sliced": lambda: build_carrot_sliced(False, False),
        "carrot_flower": lambda: build_carrot_sliced(True, False),
        "carrot_cooked": lambda: build_carrot_sliced(True, True),
        "egg_whole": build_egg_whole,
        "egg_raw": lambda: build_egg_cracked(False),
        "egg_fried": lambda: build_egg_cracked(True),
        "wiener_whole": lambda: build_wiener_whole(False),
        "wiener_cut": lambda: build_wiener_whole(True),
        "wiener_tako": build_wiener_tako,
        "mushroom_whole": build_mushroom_whole,
        "mushroom_sliced": lambda: build_mushroom_sliced(False),
        "mushroom_cooked": lambda: build_mushroom_sliced(True),
        "broccoli_whole": lambda: build_broccoli_whole(False, False),
        "broccoli_sliced": lambda: build_broccoli_whole(True, False),
        "broccoli_cooked": lambda: build_broccoli_whole(True, True),
        "mama_body": build_mama_body,
        "mama_head_idle": lambda: build_mama_head("idle"),
        "mama_head_star": lambda: build_mama_head("star"),
        "mama_head_happy": lambda: build_mama_head("happy"),
        "mama_head_surprised": lambda: build_mama_head("surprised"),
        "mama_head_giggle": lambda: build_mama_head("giggle"),
        "mama_head_munch": lambda: build_mama_head("munch"),
    }

    models = {}
    manifest = {}
    total_slices = 0
    for name, fn in builders.items():
        vol = fn()
        models[name] = vol
        meta = vol.export_strip(name)
        manifest[name] = meta
        total_slices += vol.h
        print(f"  built {name:18s}: {vol.w:3d}x{vol.d:2d} x {vol.h:2d} slices")

    # Write embedded JS bundle for zero-CORS file:// execution
    js = "// Auto-generated by tools/build_slices.py — horizontal pixel-art sprite-stack strips\n"
    js += "window.SLICE_DATA = " + json.dumps(manifest, separators=(",", ":")) + ";\n"
    with open(OUT_JS, "w", encoding="utf-8") as f:
        f.write(js)

    print(f"\nExported {len(manifest)} models ({total_slices} total slices) -> {OUT_JS} ({len(js)//1024} KB)")
    render_preview(models)
    print(f"Rendered turnaround check -> {os.path.join(REFS_DIR, 'slice_preview.png')}")


if __name__ == "__main__":
    main()
