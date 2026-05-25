#!/usr/bin/env python3
"""Génère logo.png 1024x1024 — fond sombre + cube isométrique vert Modrinth-style.

Utilise uniquement la stdlib (struct + zlib) — pas de PIL nécessaire.
"""
import struct
import zlib
import math
from pathlib import Path

W = H = 1024
# Palette
BG = (19, 21, 24)          # #131518 — bg-app de l'app
TILE = (27, 217, 106)      # #1bd96a — accent vert Modrinth
TILE_DARK = (20, 184, 92)  # #14b85c — vert plus profond pour ombrage
WHITE = (245, 246, 247)
FAINT_WHITE = (220, 224, 228)

# Crée un buffer de pixels RGB
pixels = bytearray(W * H * 3)
for y in range(H):
    for x in range(W):
        i = (y * W + x) * 3
        pixels[i:i+3] = bytes(BG)


def set_pixel(x, y, color, alpha=1.0):
    if 0 <= x < W and 0 <= y < H:
        i = (y * W + x) * 3
        if alpha >= 1.0:
            pixels[i:i+3] = bytes(color)
        else:
            r, g, b = pixels[i], pixels[i+1], pixels[i+2]
            nr = int(r * (1 - alpha) + color[0] * alpha)
            ng = int(g * (1 - alpha) + color[1] * alpha)
            nb = int(b * (1 - alpha) + color[2] * alpha)
            pixels[i:i+3] = bytes((nr, ng, nb))


def fill_rounded_rect(x0, y0, x1, y1, radius, color):
    """Rectangle plein avec coins arrondis et anti-aliasing simple."""
    for y in range(max(0, y0), min(H, y1)):
        for x in range(max(0, x0), min(W, x1)):
            # Distance au coin le plus proche
            cx = x
            cy = y
            in_corner = False
            corner_dist = 0
            if cx < x0 + radius and cy < y0 + radius:
                in_corner = True
                corner_dist = math.hypot(cx - (x0 + radius), cy - (y0 + radius))
            elif cx >= x1 - radius and cy < y0 + radius:
                in_corner = True
                corner_dist = math.hypot(cx - (x1 - radius - 1), cy - (y0 + radius))
            elif cx < x0 + radius and cy >= y1 - radius:
                in_corner = True
                corner_dist = math.hypot(cx - (x0 + radius), cy - (y1 - radius - 1))
            elif cx >= x1 - radius and cy >= y1 - radius:
                in_corner = True
                corner_dist = math.hypot(cx - (x1 - radius - 1), cy - (y1 - radius - 1))

            if in_corner:
                if corner_dist <= radius - 1:
                    set_pixel(x, y, color)
                elif corner_dist <= radius:
                    set_pixel(x, y, color, 1.0 - (corner_dist - (radius - 1)))
            else:
                set_pixel(x, y, color)


def fill_polygon(points, color):
    """Remplit un polygone convexe (liste de (x, y)) via scanline simple."""
    ys = [int(p[1]) for p in points]
    y_min = max(0, min(ys))
    y_max = min(H - 1, max(ys))
    for y in range(y_min, y_max + 1):
        intersections = []
        n = len(points)
        for i in range(n):
            x1, y1 = points[i]
            x2, y2 = points[(i + 1) % n]
            if y1 == y2:
                continue
            if (y1 <= y < y2) or (y2 <= y < y1):
                t = (y - y1) / (y2 - y1)
                xi = x1 + t * (x2 - x1)
                intersections.append(xi)
        intersections.sort()
        for k in range(0, len(intersections), 2):
            if k + 1 >= len(intersections):
                break
            x_start = int(math.ceil(intersections[k]))
            x_end = int(math.floor(intersections[k + 1]))
            for x in range(max(0, x_start), min(W, x_end + 1)):
                set_pixel(x, y, color)


# Tile arrondi vert en fond (squircle-like)
PADDING = 110
RADIUS = 180
fill_rounded_rect(PADDING, PADDING, W - PADDING, H - PADDING, RADIUS, TILE)

# Cube isométrique blanc au centre
# Géométrie d'un cube iso : on définit 8 sommets puis 3 faces visibles
cx, cy = W // 2, H // 2
size = 220  # demi-taille du cube
# Coordonnées 2D d'un cube isométrique (projection classique 30°)
# Sommet supérieur / inférieur, et les 4 coins latéraux
# Le cube vu en iso a un point haut (centre top), un point bas (centre bot),
# et 4 points sur les côtés (gauche, droite, et les 2 du milieu)
top    = (cx, cy - size)
bottom = (cx, cy + size)
left   = (cx - int(size * math.cos(math.radians(30))), cy - int(size * math.sin(math.radians(30))))
right  = (cx + int(size * math.cos(math.radians(30))), cy - int(size * math.sin(math.radians(30))))
bleft  = (cx - int(size * math.cos(math.radians(30))), cy + int(size * math.sin(math.radians(30))))
bright = (cx + int(size * math.cos(math.radians(30))), cy + int(size * math.sin(math.radians(30))))

# Face du haut (losange) - blanc le plus clair
fill_polygon([top, right, (cx, cy), left], WHITE)
# Face gauche - blanc légèrement plus sombre
fill_polygon([left, (cx, cy), bottom, bleft], FAINT_WHITE)
# Face droite - blanc encore plus sombre via mélange
DARKER = (200, 206, 212)
fill_polygon([right, bright, bottom, (cx, cy)], DARKER)

# Encode en PNG
def write_png(path, w, h, pix):
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
    ihdr = struct.pack('>I', 13) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)

    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw.extend(pix[y*w*3:(y+1)*w*3])
    compressed = zlib.compress(bytes(raw), 9)
    idat_crc = zlib.crc32(b'IDAT' + compressed)
    idat = struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', idat_crc)

    iend_crc = zlib.crc32(b'IEND')
    iend = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)

    Path(path).write_bytes(sig + ihdr + idat + iend)


out = Path(__file__).resolve().parent.parent / "logo.png"
write_png(out, W, H, pixels)
print(f"Wrote {out} ({out.stat().st_size / 1024:.1f} KB)")
