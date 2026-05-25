#!/usr/bin/env python3
"""Génère icon.ico Windows multi-résolution depuis les PNG déjà produits par sips.

Le format ICO accepte les données PNG directement depuis Windows Vista.
On embarque 16, 32, 48, 64, 128, 256.
"""
import struct
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "logo.png"
OUT = ROOT / "src-tauri" / "icons" / "icon.ico"

SIZES = [16, 32, 48, 64, 128, 256]

# Génère un PNG temporaire pour chaque taille avec sips
images = []
with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    for s in SIZES:
        p = tmp / f"{s}.png"
        subprocess.run(
            ["sips", "-z", str(s), str(s), str(SRC), "--out", str(p)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        images.append((s, p.read_bytes()))

    # ICO header
    # ICONDIR : reserved(2) + type(2)=1 + count(2)
    header = struct.pack("<HHH", 0, 1, len(images))

    # Calcule l'offset de chaque image
    entries = bytearray()
    data_blob = bytearray()
    offset = 6 + 16 * len(images)  # début après header + toutes les entries
    for size, png_bytes in images:
        w = 0 if size == 256 else size
        h = 0 if size == 256 else size
        entry = struct.pack(
            "<BBBBHHII",
            w,                 # width (0=256)
            h,                 # height (0=256)
            0,                 # color palette count (0)
            0,                 # reserved
            1,                 # color planes
            32,                # bits per pixel
            len(png_bytes),    # size of image data
            offset,            # offset
        )
        entries.extend(entry)
        data_blob.extend(png_bytes)
        offset += len(png_bytes)

    OUT.write_bytes(header + bytes(entries) + bytes(data_blob))
    print(f"Wrote {OUT} ({OUT.stat().st_size / 1024:.1f} KB)")
