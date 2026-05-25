# Icônes

Icônes commitées (cube iso vert Modrinth) générées depuis `logo.png` (racine du projet) via les scripts dans `icon-gen/`.

## Régénérer après changement du logo

### Depuis macOS (le plus simple)

```bash
# 1. Refaire logo.png (Python stdlib only, aucune dépendance)
python3 icon-gen/make_logo.py

# 2. Fan-out vers toutes les variantes (sips + iconutil + Python pour .ico)
bash icon-gen/make_variants.sh
```

### Depuis Windows

```powershell
npx @tauri-apps/cli icon ..\..\logo.png
```

Cela écrit : `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`.
