# Handoff Codex — Minecraft Cockpit

Salut Codex. Tu reprends ce projet **sur le PC Windows d'Alexandre** pour le finaliser, le builder, et le lancer en conditions réelles avec un serveur Minecraft Fabric.

Tout le code a été écrit côté macOS via mock JS. Personne ne l'a encore compilé ni lancé contre un vrai serveur. Ton job principal : **prouver que ça marche bout-en-bout sur Windows**, fixer les inévitables petits couacs, builder l'installeur final.

---

## TL;DR — Ce que tu dois faire

### Option A — Tester l'installeur builé par GitHub (chemin court)

Aucun toolchain à installer côté Windows.

1. Va sur **[Releases](https://github.com/atimoz/minecraft-cockpit/releases)** → télécharge le dernier `.exe`.
2. Installe-le → double-clic le raccourci bureau qui se pose.
3. Sélectionne le dossier du serveur Minecraft d'Alex (celui avec `run.bat`).
4. **Test bout-en-bout** — clique Start, vérifie :
   - Le `.bat` se lance (cmd.exe en arrière-plan, pas de fenêtre console qui pop)
   - Console défile avec logs INFO/WARN/ERROR colorés
   - Stats CPU/RAM du `java.exe` apparaissent et bougent
   - Un joueur qui se connecte apparaît avec son IP
   - `/say hello` envoyé depuis CommandBar apparaît dans le chat in-game
5. Clique Stop → vérifie arrêt propre (pas de monde corrompu, timeout 30s avant kill forcé).
6. Teste onglets Paramètres + Mods sur les vrais fichiers (`server.properties`, dossier `mods/`).
7. **Documente les bugs** dans ce fichier (section « Bugs rencontrés »).

### Option B — Setup dev pour fix les bugs (si tu dois patcher le code)

Si Option A révèle des bugs et que tu dois modifier le code, alors installer le toolchain :

```powershell
winget install Rustlang.Rustup OpenJS.NodeJS.LTS
winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.Windows11SDK.22621"
# Redémarre PowerShell après l'install de Rust
git clone https://github.com/atimoz/minecraft-cockpit && cd minecraft-cockpit
npm install
npm run tauri:dev   # mode dev avec hot-reload
```

Quand tu push tes fixes sur `main`, GitHub Actions rebuild un nouveau `.exe` automatiquement, dispo dans Releases sous le tag `latest` dans ~5 min.

---

## Contexte du projet

Alex tourne un serveur Minecraft Fabric 1.21.1 sur son PC Windows pour ~10 potes, view-distance 12, simulation 8. Il en a marre de jongler avec une fenêtre `cmd.exe` pour démarrer/arrêter, de pas voir qui est connecté, de devoir éditer `server.properties` à la main.

L'app **Minecraft Cockpit** est une fenêtre Tauri (Rust + WebView) qui sert de tableau de bord :
- Bouton Start/Stop animé
- Liste joueurs temps-réel avec IP
- Console live + envoi de commandes
- Stats CPU/RAM du process Java
- Éditeur de `server.properties` avec contrôles intelligents (switches, segmented, steppers)
- Gestion des mods Fabric/Forge (toggle `.jar` ↔ `.jar.disabled`)
- Adaptation réseau (profil Maison/Mobile) + intégration playit.gg pour tunnel CGNAT

**Design** : palette Modrinth (vert `#1bd96a` sur fond `#131518`), flat, sidebar gauche, accents qui passent **en rouge quand le serveur est éteint** (signal visuel fort), classe `.server-running` sur le main pour swap les CSS vars.

**Stack** :
- **Frontend** : React 18 + TypeScript + Vite + Tailwind v4 + Framer Motion + Lucide
- **Backend** : Rust + Tauri 2.1, plugins `dialog`/`store`/`fs`
- **Crates clés** : `notify` (file watching), `sysinfo` (CPU/RAM), `regex` (parsing logs), `zip`+`toml` (métadonnées mods), `if-addrs` (détection réseau), `encoding_rs` (fallback CP1252)

---

## Architecture

```
minecraft-cockpit/
├── src/                        # Frontend React
│   ├── App.tsx                 # Switch Setup ↔ Dashboard
│   ├── components/
│   │   ├── Sidebar.tsx         # Nav verticale 64px (Cockpit/Settings/Mods)
│   │   ├── ProjectHeader.tsx   # Header avec titre + statut + chip tunnel
│   │   ├── Dashboard.tsx       # Layout sidebar + main + applique .server-running
│   │   ├── CockpitView.tsx     # Onglet principal : StatusCard + StatsCard + PlayersList + Console + CommandBar + NetworkBanner + TunnelSetup
│   │   ├── StatusCard.tsx      # Gros bouton circulaire Start/Stop avec pulse-ring
│   │   ├── StatsCard.tsx       # Barres CPU/RAM animées (spring transition)
│   │   ├── PlayersList.tsx     # Liste joueurs (memo + ConnectedSince isolé pour pas re-render)
│   │   ├── Console.tsx         # Logs défilants avec coloration niveau
│   │   ├── CommandBar.tsx      # Input + historique ↑↓ + bouton ENVOYER
│   │   ├── ServerSettings.tsx  # Vue Paramètres : sections groupées + save bar dirty-tracking
│   │   ├── ModsView.tsx        # Liste mods avec filter/search/toggle
│   │   ├── NetworkBanner.tsx   # Profil Maison/Mobile + détection CGNAT
│   │   ├── TunnelSetup.tsx     # Setup playit.gg + persistance adresse publique
│   │   ├── SetupScreen.tsx     # Premier lancement : pick folder
│   │   └── TitleBar.tsx        # Barre custom (drag region + min/max/close)
│   ├── hooks/                  # useServerStatus, usePlayers, useLogs, useSystemStats, useNetworkInfo
│   ├── lib/
│   │   ├── tauri.ts            # Bridge IPC typé + MockBridge complet (pour dev navigateur)
│   │   └── utils.ts            # cn(), formatUptime, formatDuration
│   └── index.css               # Design tokens (palette + theme dynamique vert↔rouge)
│
└── src-tauri/                  # Backend Rust
    ├── Cargo.toml
    ├── tauri.conf.json         # Window 1180×760, decorations:false transparent:true, bundle NSIS+app+dmg
    ├── installer-hooks.nsh     # Hook NSIS : pose raccourci bureau Windows
    ├── icons/                  # Cube iso vert Modrinth (32/128/256/icns/ico)
    ├── capabilities/default.json
    └── src/
        ├── main.rs             # Entrypoint
        ├── lib.rs              # Bootstrap Tauri + invoke_handler! avec toutes les commandes
        ├── state.rs            # AppConfig, AppState, Player, ServerStatus, SystemStats, LogLine, ServerProcess
        ├── log_watcher.rs      # spawn_stdio_readers + spawn_file_watcher + parsing regex
        └── commands/
            ├── mod.rs
            ├── config.rs       # pick_server_folder (cherche .bat/.sh selon OS), get_config, set_max_ram, set_tunnel_address
            ├── server.rs       # start_server (build_command cfg-gated Windows/Unix), stop_server, send_command, get_server_status, get_players
            ├── stats.rs        # spawn_stats_loop (sysinfo, find_java_descendant BFS)
            ├── properties.rs   # read_server_properties (préserve commentaires), write_server_properties (atomic .tmp+rename), restart_server
            ├── mods.rs         # list_mods (parse fabric.mod.json/META-INF/mods.toml/mcmod.info), toggle_mod (rename .jar↔.jar.disabled), open_mods_folder (explorer.exe)
            └── network.rs      # get_network_info (if-addrs), apply_network_profile (presets home/mobile)
```

---

## Setup Windows complet

### 1. Prérequis

```powershell
# Rust
winget install Rustlang.Rustup
rustup default stable

# Node.js LTS (≥ 20)
winget install OpenJS.NodeJS.LTS

# VS Build Tools (Tauri en a besoin pour linker)
winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.Windows11SDK.22621"

# WebView2 (déjà installé sur Win10+/11 en général, vérifier)
# https://developer.microsoft.com/microsoft-edge/webview2/
```

Redémarre PowerShell après l'install de Rust.

### 2. Cloner

```powershell
cd C:\Users\<user>\
git clone https://github.com/atimoz/minecraft-cockpit
cd minecraft-cockpit
npm install
```

### 3. Mode dev

```powershell
npm run tauri:dev
```

L'app s'ouvre en quelques secondes. Si elle plante au lancement → check la console Vite et le terminal Rust (les erreurs Tauri viennent généralement de `tauri.conf.json` mal formé ou d'un plugin manquant).

### 4. Build production

```powershell
npm run tauri:build
```

Sortie : `src-tauri\target\release\bundle\nsis\Minecraft Cockpit_0.1.0_x64-setup.exe`

Double-clique pour installer → l'app se pose dans `%LOCALAPPDATA%\Programs\Minecraft Cockpit\` et un **raccourci s'ajoute automatiquement sur le bureau** + menu Démarrer (géré par `installer-hooks.nsh`).

### 5. SmartScreen / Defender

L'`.exe` n'est pas signé. Au premier lancement après install :

> Windows a protégé votre PC

Clic **Informations complémentaires → Exécuter quand même**. Une fois fait, Windows mémorise.

---

## Ce qui marche déjà (testé sur mock)

✅ Le **MockBridge** dans `src/lib/tauri.ts` simule un serveur complet en JS (joueurs qui se connectent, logs qui défilent, stats CPU/RAM aléatoires, properties + mods éditables). Donc tu peux lancer `npm run dev` (sans `tauri:`) dans un navigateur pour itérer le design sans Tauri.

✅ Le **design Modrinth** : palette, sidebar, header, cartes flat, animations Framer Motion sont validés visuellement via le preview HTML.

✅ Le **theme switching vert↔rouge** : classe `.server-running` sur le main qui swap les CSS vars `--color-green*`. Quand le serveur dort, tous les accents passent en rouge.

✅ Le **fix flicker joueurs** : `PlayerRow` est wrappé dans `memo`, et `ConnectedSince` est un sous-composant autonome avec son propre `setInterval` — donc le tick d'horloge ne re-render PAS toute la liste.

---

## Ce qui n'a JAMAIS été testé en réel (à toi de jouer)

### 🚨 Priorité 1 — Spawn du `.bat` Windows

`src-tauri/src/commands/server.rs::build_command` lance `cmd /C run.bat` avec `CREATE_NO_WINDOW` pour éviter la fenêtre console. **À valider** :
- La fenêtre cmd.exe ne pop pas
- stdin/stdout/stderr sont bien pipés
- L'envoi de `stop\n` via stdin déclenche bien un arrêt propre côté Minecraft (pas de monde corrompu)
- Timeout 30s avant kill forcé fonctionne

Si bug : check le path du `.bat` (Windows aime `\`, Rust aime les deux mais teste). Check les permissions.

### 🚨 Priorité 2 — Détection du process Java enfant

`commands/stats.rs::find_java_descendant` fait un BFS sur la process tree depuis le PID de cmd.exe pour trouver `java.exe`. À valider :
- Le BFS trouve bien `java.exe` (pas `javaw.exe`)
- Les valeurs CPU/RAM remontent et correspondent à ce que Task Manager affiche
- Si le `.bat` lance via `javaw.exe` : ajuste le filtre `name.starts_with("java")` (devrait déjà matcher les deux)

### 🚨 Priorité 3 — Encodage console Windows

Les logs Minecraft sortent généralement en UTF-8 mais certaines combinaisons Java/Windows peuvent cracher du CP1252. `log_watcher.rs` doit tenter UTF-8 d'abord et fallback CP1252 via `encoding_rs`. **À valider** sur des messages avec accents (joueurs nommés `Élise`, MOTDs accentués, etc.).

### 🚨 Priorité 4 — Parsing des joueurs

Les regex dans `log_watcher.rs` matchent :
- `(\w+)\[/(\d+\.\d+\.\d+\.\d+):(\d+)\] logged in` → connection
- `(\w+) joined the game` → online
- `(\w+) (left the game|lost connection)` → déconnexion

**À valider** que le format de log de Fabric 1.21.1 est bien celui-ci. Si pas, ajuste les regex (l'API `regex::Regex::new` est compilée au lancement, l'erreur sera claire).

### 🚨 Priorité 5 — Path traversal sécurité

`commands/mods.rs::toggle_mod` reçoit un `file_name` depuis le front. Vérifier que la validation existante refuse `..`, `/`, `\` avant de `join` au chemin. **Test** : essayer de toggler un mod fictif `../../../etc/passwd` doit retourner une erreur, pas exécuter.

### 🚨 Priorité 6 — Build NSIS

`npm run tauri:build` doit produire un `.exe` qui :
- S'installe sans demander admin (config `installMode: currentUser`)
- Pose un raccourci sur le bureau (via `installer-hooks.nsh`)
- Désinstalle proprement (raccourci nettoyé)

Si le hook NSIS plante : check la syntaxe `${PRODUCTNAME}` et `${MAINBINARYNAME}`. Tauri 2 documente ces variables dans son template par défaut.

---

## Préparer le serveur Minecraft d'Alex

L'app cherche un `.bat` à la racine du dossier. Noms reconnus (par priorité) :

1. `run.bat`
2. `start.bat`
3. `launch.bat`
4. `server.bat`
5. `start-server.bat`

Sinon le premier `.bat` alphabétique.

**Exemple `run.bat` recommandé** (à mettre dans le dossier serveur d'Alex) :

```bat
@echo off
java -Xmx6G -Xms4G -jar fabric-server-launch.jar nogui
```

⚠ **PAS de `pause` à la fin** — Cockpit gère le lifecycle, un `pause` ferait freezer le serveur dans l'attente d'une touche fantôme.

**Settings recommandés** dans `server.properties` (pour son setup 10 joueurs / VD 12 sur Intel MBP — euh non, sur son PC Windows finalement) :

```properties
view-distance=12
simulation-distance=8
max-players=10
entity-broadcast-range-percentage=80
spawn-protection=0
max-tick-time=60000
```

**Mods Fabric côté serveur fortement recommandés** (séparés des mods client comme Sodium/Iris qui n'ont aucun effet serveur) :
- Lithium (optims AI/redstone/hopper)
- FerriteCore (divise la RAM par 2-3)
- Krypton (optims réseau)
- ServerCore (désactive entités lointaines)
- Memory Leak Fix

---

## Adaptation réseau & Tunnel CGNAT

Alex peut héberger sur sa connexion fixe (port-forward du 25565 sur sa box). Si jamais il bascule sur partage de connexion (4G/5G), **les opérateurs mobiles utilisent du CGNAT** (range `100.64.0.0/10`) → aucun port-forward possible.

L'app détecte ça automatiquement via `commands/network.rs::is_cgnat` et propose la section **Tunnel** dans le Cockpit. Solution recommandée : **playit.gg** (gratuit, optimisé Minecraft).

Workflow pour Alex :
1. Télécharger l'agent playit.gg depuis https://playit.gg
2. Le lancer, créer un tunnel TCP sur 25565
3. Copier l'adresse `play.your-name.gl.joinmc.link:XXXXX` qu'il fournit
4. La coller dans la section Tunnel de Cockpit → l'adresse devient visible/copiable dans le header pour partager à ses potes

Le profil **Mobile** dans `commands/network.rs::profile_preset` baisse automatiquement view-distance à 8 et simulation à 5 pour ne pas saturer la 4G.

---

## Commandes Tauri exposées (référence rapide)

Toutes dans `src-tauri/src/lib.rs::invoke_handler!`. Côté front, wrappers typés dans `src/lib/tauri.ts::api.*`.

| Commande | Description |
|---|---|
| `get_config` | Retourne `AppConfig` persisté |
| `pick_server_folder` | Ouvre dialog natif + détecte script de lancement |
| `set_max_ram(gb)` | Persiste la RAM max alouée à Java |
| `set_tunnel_address(addr)` | Persiste l'adresse publique playit.gg |
| `start_server` | Spawn cmd.exe `/C run.bat`, attache log readers |
| `stop_server` | Envoie `stop\n` sur stdin, timeout 30s, kill si besoin |
| `send_command(cmd)` | Écrit `cmd\n` sur stdin du process |
| `get_server_status` | `{running, pid, uptime_secs}` |
| `get_players` | `Vec<Player>` connectés |
| `read_server_properties` | Parse `server.properties` en `Vec<PropertyEntry>` (conserve l'ordre + commentaires) |
| `write_server_properties(updates)` | Patch in-place, atomic write |
| `restart_server` | stop_server + start_server enchaînés |
| `list_mods` | Scanne `mods/`, parse les `.jar` (fabric.mod.json → META-INF/mods.toml → mcmod.info → fallback) |
| `toggle_mod(file_name, enable)` | Rename `.jar` ↔ `.jar.disabled` |
| `open_mods_folder` | `explorer.exe <path>` |
| `get_network_info` | `if-addrs` + classification + détection CGNAT |
| `apply_network_profile(profile)` | Applique le preset (Maison/Mobile) à `server.properties` |
| `get_system_stats` | (non utilisé directement — émis via `stats:update` event) |

Events émis côté Rust (écouter via `listen` côté front) :
- `server:status` — chaque changement de running
- `players:update` — chaque changement de la liste joueurs
- `log:line` — chaque nouvelle ligne de log
- `stats:update` — toutes les 1.5s

---

## Bugs rencontrés (à remplir au fil de tes tests)

> Remplis cette section à chaque truc qui foire, même mineur. Format : `**Bug** — Description • Fix : ...`

- (vide pour l'instant — premier run sur Windows en cours)

---

## Si tu galères

- **L'app dit "Aucun script de lancement trouvé"** : vérifie que `run.bat` est BIEN à la racine du dossier choisi (pas dans un sous-dossier).
- **CPU/RAM restent à 0** : le BFS dans `stats.rs` ne trouve pas le process Java. Check Task Manager : est-ce que `java.exe` apparaît bien comme enfant de `cmd.exe` ? Si c'est `javaw.exe`, le filtre `starts_with("java")` devrait quand même matcher.
- **Joueurs n'apparaissent pas** : le format de log n'est probablement pas celui qu'on parse. Ouvre `logs/latest.log` en direct, copie une ligne `logged in`, ajuste la regex dans `log_watcher.rs`.
- **Stop ne marche pas / monde corrompu** : timeout 30s peut être trop court sur un gros monde. Bump la boucle `for _ in 0..60` dans `server.rs::stop_server` à `0..120` (60s).
- **Build Tauri échoue avec erreur de linker** : VS Build Tools mal installé ou C++ workload pas activé. Réinstalle avec le `--add Microsoft.VisualStudio.Workload.VCTools` (cf. README).
- **NSIS installer pose pas le raccourci** : vérifier `installer-hooks.nsh` est bien chargé. Logs NSIS dans `src-tauri\target\release\bundle\nsis\`.

---

## Tu peux contacter Alex via

Discord / Telegram (il te dira). Les changements de design / nouvelles features → check avec lui avant. Les fixes techniques bloquants → fais et documente dans la section Bugs.

Bonne chance, le code est propre et structuré, tu devrais pas trop souffrir. Le mock JS te permet aussi de tester le UI sans rien builder côté Rust.

— Claude (l'IA qui a pondu tout ça sur Mac sans pouvoir le compiler une seule fois 🙃)
