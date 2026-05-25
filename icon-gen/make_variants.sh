#!/bin/bash
# Génère toutes les variantes d'icônes depuis logo.png
# Utilise sips (macOS) + iconutil (macOS) + Python (pour .ico)
set -euo pipefail

cd "$(dirname "$0")/.."
ICONS=src-tauri/icons
SRC=logo.png

if [ ! -f "$SRC" ]; then
  echo "logo.png manquant"
  exit 1
fi

mkdir -p "$ICONS"

# PNGs principaux Tauri
sips -z 32 32     "$SRC" --out "$ICONS/32x32.png" >/dev/null
sips -z 128 128   "$SRC" --out "$ICONS/128x128.png" >/dev/null
sips -z 256 256   "$SRC" --out "$ICONS/128x128@2x.png" >/dev/null
sips -z 512 512   "$SRC" --out "$ICONS/icon.png" >/dev/null

# .icns macOS via iconutil
ICONSET="$ICONS/icon.iconset"
rm -rf "$ICONSET"
mkdir "$ICONSET"
sips -z 16 16     "$SRC" --out "$ICONSET/icon_16x16.png" >/dev/null
sips -z 32 32     "$SRC" --out "$ICONSET/icon_16x16@2x.png" >/dev/null
sips -z 32 32     "$SRC" --out "$ICONSET/icon_32x32.png" >/dev/null
sips -z 64 64     "$SRC" --out "$ICONSET/icon_32x32@2x.png" >/dev/null
sips -z 128 128   "$SRC" --out "$ICONSET/icon_128x128.png" >/dev/null
sips -z 256 256   "$SRC" --out "$ICONSET/icon_128x128@2x.png" >/dev/null
sips -z 256 256   "$SRC" --out "$ICONSET/icon_256x256.png" >/dev/null
sips -z 512 512   "$SRC" --out "$ICONSET/icon_256x256@2x.png" >/dev/null
sips -z 512 512   "$SRC" --out "$ICONSET/icon_512x512.png" >/dev/null
sips -z 1024 1024 "$SRC" --out "$ICONSET/icon_512x512@2x.png" >/dev/null
iconutil -c icns -o "$ICONS/icon.icns" "$ICONSET"
rm -rf "$ICONSET"

# .ico Windows multi-résolution
python3 icon-gen/make_ico.py

echo
echo "OK — variantes générées :"
ls -lh "$ICONS"
