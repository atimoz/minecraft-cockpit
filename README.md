# Minecraft Cockpit

App de bureau minimaliste pour gérer un serveur Minecraft local sur Windows.
Dark mode flat, accent vert Modrinth — devient rouge quand le serveur dort.

## 🎯 Installer (utilisateur final)

**Tu n'as RIEN à installer comme outils de dev**. GitHub builde le `.exe` automatiquement à chaque push.

1. Va sur **[Releases](https://github.com/atimoz/minecraft-cockpit/releases)**
2. Télécharge le dernier `Minecraft Cockpit_X.Y.Z_x64-setup.exe`
3. Double-clique → l'installeur pose l'app dans `%LOCALAPPDATA%\Programs\Minecraft Cockpit\` **et un raccourci sur le bureau**
4. Premier lancement : si Windows SmartScreen râle → *Informations complémentaires → Exécuter quand même* (app non signée, normal)
5. Choisis ton dossier serveur (celui qui contient `run.bat`)

Voilà. Pas de Rust, pas de Node, pas de VS Build Tools.

- ▶ **Start / Stop** du serveur en un clic
- 👥 **Liste des joueurs** connectés en temps réel avec leurs IP
- 💻 **Console live** avec coloration des niveaux de log
- ⌨️ **Envoi de commandes** au serveur (op, say, tp, …) avec historique
- 📊 **Stats RAM/CPU** du process Java
- ⏱️ **Uptime** et statut serveur

---

## Setup sur Windows (à faire une fois)

### 1. Installer les prérequis

```powershell
# Rust (https://rustup.rs)
winget install Rustlang.Rustup
rustup default stable

# Node.js LTS
winget install OpenJS.NodeJS.LTS

# Outils de build Visual Studio (nécessaires pour Tauri)
winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.Windows11SDK.22621"

# WebView2 (souvent déjà installé sur Windows 10+/11)
# https://developer.microsoft.com/microsoft-edge/webview2/
```

Redémarre PowerShell après l'installation de Rust.

### 2. Cloner et installer les dépendances

```powershell
cd C:\
git clone <ton-repo> minecraft-cockpit
cd minecraft-cockpit
npm install
```

### 3. Icônes

Les icônes sont déjà commitées dans `src-tauri/icons/` (cube vert iso sur fond sombre, généré depuis `logo.png` à la racine).

Pour les régénérer depuis un nouveau `logo.png` :

```powershell
# Option facile (Tauri CLI fait tout d'un coup) :
npx @tauri-apps/cli icon logo.png
```

### 4. Lancer en mode dev

```powershell
npm run tauri:dev
```

L'app s'ouvre, écran de bienvenue, tu sélectionnes le dossier de ton serveur (celui qui contient `run.bat`).

### 5. Builder l'installeur (avec raccourci bureau)

```powershell
npm run tauri:build
```

L'installeur NSIS sort dans `src-tauri\target\release\bundle\nsis\` (un `Minecraft Cockpit_<version>_x64-setup.exe`).

Double-clique l'installeur → l'app se pose dans `%LOCALAPPDATA%\Programs\Minecraft Cockpit\` **et un raccourci s'ajoute automatiquement sur le bureau** ainsi que dans le menu Démarrer. Désinstaller efface les deux.

Le hook qui pose le raccourci est dans `src-tauri/installer-hooks.nsh` :

```nsh
!macro NSIS_HOOK_POSTINSTALL
  CreateShortCut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
!macroend
```

---

## Setup sur macOS (Intel ou Apple Silicon)

### 1. Prérequis

```bash
# Xcode Command Line Tools (compilateur C/C++/Swift requis par Rust)
xcode-select --install

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Node.js (via Homebrew, ou nodejs.org)
brew install node
```

### 2. Cloner et installer

```bash
git clone <ton-repo> minecraft-cockpit
cd minecraft-cockpit
npm install
```

### 3. Mode dev

```bash
npm run tauri:dev
```

### 4. Build

```bash
# Architecture native (celle du Mac qui build)
npm run tauri:build

# Build universal (Intel + Apple Silicon dans le même .app)
npx @tauri-apps/cli build --target universal-apple-darwin
```

L'output sort dans `src-tauri/target/release/bundle/` :
- `macos/Minecraft Cockpit.app` — l'application elle-même, glissable dans `/Applications`
- `dmg/Minecraft Cockpit_<version>_x64.dmg` — installeur drag-to-Applications

Double-clic le `.dmg`, glisse l'icône dans `Applications`, lance depuis Launchpad ou Spotlight. **Premier lancement** : Gatekeeper va râler parce que l'app n'est pas signée — clic droit sur l'app → **Ouvrir** → confirmer. Une fois fait, plus jamais de blocage.

### 5. Préparer ton serveur sur Mac

L'app cherche les scripts dans cet ordre :

1. `run.sh`
2. `start.sh`
3. `launch.sh`
4. `server.sh`
5. `start.command` / `run.command` / `launch.command`
6. Fallback : tout `.sh` ou `.bat` à la racine

**Exemple `run.sh` :**

```bash
#!/usr/bin/env bash
cd "$(dirname "$0")"
exec java -Xmx6G -Xms4G -jar server.jar nogui
```

Et rends-le exécutable :

```bash
chmod +x run.sh
```

> L'app pose automatiquement le bit `+x` au premier lancement si tu l'as oublié.

---

## Préparer ton dossier serveur (Windows)

L'app détecte automatiquement le `.bat` à la racine du dossier choisi. Noms reconnus en priorité :

1. `run.bat`
2. `start.bat`
3. `launch.bat`
4. `server.bat`
5. `start-server.bat`

Sinon le premier `.bat` alphabétique est utilisé.

**Exemple `run.bat` :**

```bat
@echo off
java -Xmx4G -Xms2G -jar server.jar nogui
pause
```

Astuce : retire `pause` à la fin — Cockpit gère déjà le cycle de vie.

---

## Itérer le design depuis macOS

Sans Rust/Tauri sur Mac, on peut quand même prévisualiser l'UI dans le navigateur grâce au **mode mock** intégré : un faux serveur émet de faux logs, joueurs, et stats.

```bash
npm install
npm run dev
```

Ouvre http://localhost:1420 — tu peux cliquer Start, voir des joueurs apparaître, des logs défiler, tester les commandes (elles s'affichent en console mais ne font rien d'autre).

Quand l'UI te convient, on rebuild sur Windows pour brancher le vrai backend.

---

## Architecture

```
minecraft-cockpit/
├── src/                          # Frontend React + TS + Tailwind v4
│   ├── App.tsx                   # routeur Setup/Dashboard
│   ├── components/
│   │   ├── TitleBar.tsx          # barre titre custom (drag + boutons fenêtre)
│   │   ├── SetupScreen.tsx       # écran premier lancement
│   │   ├── Dashboard.tsx         # layout principal
│   │   ├── StatusCard.tsx        # gros bouton Start/Stop animé
│   │   ├── StatsCard.tsx         # barres CPU/RAM animées
│   │   ├── PlayersList.tsx       # liste joueurs avec IP
│   │   ├── Console.tsx           # logs défilants
│   │   └── CommandBar.tsx        # input commande + historique
│   ├── hooks/                    # useServerStatus, usePlayers, useLogs, useSystemStats
│   ├── lib/
│   │   ├── tauri.ts              # bridge IPC + mock pour navigation
│   │   └── utils.ts
│   └── index.css                 # design tokens (palette Apple)
│
└── src-tauri/                    # Backend Rust
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/default.json # permissions IPC
    └── src/
        ├── main.rs               # entrypoint Windows
        ├── lib.rs                # bootstrap Tauri
        ├── state.rs              # AppState partagé
        ├── log_watcher.rs        # tail stdout + logs/latest.log + parse joueurs
        └── commands/
            ├── config.rs         # pick_server_folder, persistance
            ├── server.rs         # start_server, stop_server, send_command
            └── stats.rs          # boucle stats CPU/RAM via sysinfo
```

---

## Sécurité Windows

L'`.exe` n'est pas signé. Au premier lancement Defender peut afficher SmartScreen :

> Windows a protégé votre PC

Clique **Informations complémentaires → Exécuter quand même**.

Pour éviter ça à long terme, signe le binaire avec un certificat de code (Azure Trusted Signing ou un cert auto-signé installé en `Trusted Root`).

---

## Dépannage

- **L'app dit "Aucun .bat trouvé"** → Vérifie qu'un fichier `.bat` est bien à la **racine** du dossier choisi (pas dans un sous-dossier).
- **Le serveur démarre mais aucune RAM/CPU n'apparaît** → Le watcher cherche `java.exe` parmi les descendants du `cmd.exe`. Si ton `.bat` lance via `javaw.exe`, modifie `find_java_descendant` dans `commands/stats.rs` (le filtre est `name.starts_with("java")`, ça matche déjà les deux).
- **Les joueurs n'apparaissent pas** → Vérifie le format de `logs/latest.log`. Le parseur attend la ligne `<name>[/<ip>:<port>] logged in` (format vanilla 1.16+).
- **Stop ne marche pas / corruption du monde** → L'app envoie `stop` proprement via stdin avec un timeout 30s avant kill. Si ton serveur prend plus de 30s à sauvegarder, augmente le timeout dans `commands/server.rs` (boucle `for _ in 0..60`).
