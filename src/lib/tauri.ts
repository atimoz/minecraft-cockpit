// Thin typed wrapper around the Tauri bridge. Works in two modes:
//  1. Inside a Tauri window → real `invoke` + `listen`.
//  2. In a plain browser (Vite dev for design iteration) → a JS-side mock
//     that emits fake players, logs, stats, server.properties, mods.

import type { UnlistenFn } from "@tauri-apps/api/event";

export type Player = {
  name: string;
  ip: string;
  port: number;
  connected_at: number; // unix seconds
};

export type ServerStatus = {
  running: boolean;
  pid: number | null;
  uptime_secs: number;
};

export type SystemStats = {
  cpu_percent: number;
  ram_mb: number;
  ram_max_mb: number | null;
};

export type LogLine = {
  ts: number;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG" | "RAW";
  text: string;
};

export type AppConfig = {
  server_folder: string | null;
  bat_file: string | null;
  max_ram_gb: number;
  tunnel_address: string | null;
};

export type PropertyEntry = {
  key: string;
  value: string;
};

export type ModInfo = {
  file_name: string;
  display_name: string;
  version: string | null;
  description: string | null;
  authors: string[];
  loader: "fabric" | "forge" | "unknown";
  size_kb: number;
  enabled: boolean;
};

export type NetworkInfo = {
  type: "wifi" | "cellular" | "ethernet" | "unknown";
  name: string;       // e.g. "Freebox-A1B2", "iPhone Hotspot", "Ethernet 2.5 Gb"
  local_ip: string;
  public_ip: string | null;
  behind_cgnat: boolean;
  suggested_profile: NetworkProfile;
};

export type NetworkProfile = "home" | "mobile";

export const NETWORK_PROFILE_PRESETS: Record<NetworkProfile, Record<string, string>> = {
  home: {
    "view-distance": "10",
    "simulation-distance": "10",
    "network-compression-threshold": "256",
    "max-players": "20",
  },
  mobile: {
    "view-distance": "5",
    "simulation-distance": "5",
    "network-compression-threshold": "64",
    "max-players": "6",
  },
};

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// Détection OS pour adapter l'UI (barre de titre, wording du Setup).
// Lecture purement côté JS via userAgentData/navigator — pas besoin de plugin Tauri OS.
export type OsKind = "macos" | "windows" | "linux" | "unknown";

function detectOs(): OsKind {
  if (typeof navigator === "undefined") return "unknown";
  const ua = (
    (navigator as any).userAgentData?.platform ||
    navigator.platform ||
    navigator.userAgent ||
    ""
  ).toLowerCase();
  if (ua.includes("mac")) return "macos";
  if (ua.includes("win")) return "windows";
  if (ua.includes("linux")) return "linux";
  return "unknown";
}

export const currentOs: OsKind = detectOs();
export const isMac = currentOs === "macos";
export const isWindows = currentOs === "windows";

// ── Real Tauri bridge ────────────────────────────────────────────────────────

async function tauriInvoke<T>(cmd: string, args?: object): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

async function tauriListen<T>(
  event: string,
  cb: (payload: T) => void,
): Promise<UnlistenFn> {
  const { listen } = await import("@tauri-apps/api/event");
  return listen<T>(event, (e) => cb(e.payload));
}

// ── Browser mock bridge ──────────────────────────────────────────────────────

type Listener<T> = (payload: T) => void;

const DEFAULT_PROPS: Record<string, string> = {
  "motd": "A Minecraft Server",
  "server-port": "25565",
  "server-ip": "",
  "max-players": "20",
  "online-mode": "true",
  "white-list": "false",
  "enforce-whitelist": "false",
  "op-permission-level": "4",
  "level-name": "world",
  "level-seed": "",
  "level-type": "minecraft:normal",
  "generate-structures": "true",
  "max-world-size": "29999984",
  "spawn-protection": "16",
  "view-distance": "10",
  "simulation-distance": "10",
  "allow-nether": "true",
  "gamemode": "survival",
  "difficulty": "easy",
  "hardcore": "false",
  "pvp": "true",
  "allow-flight": "false",
  "force-gamemode": "false",
  "enable-command-block": "false",
  "max-tick-time": "60000",
  "network-compression-threshold": "256",
  "sync-chunk-writes": "true",
  "enable-rcon": "false",
  "rcon.port": "25575",
  "rcon.password": "",
  "enable-query": "false",
  "query.port": "25565",
  "resource-pack": "",
  "resource-pack-prompt": "",
  "resource-pack-sha1": "",
  "require-resource-pack": "false",
};

const MOCK_MODS: ModInfo[] = [
  { file_name: "fabric-api-0.115.0+1.21.1.jar", display_name: "Fabric API",
    version: "0.115.0+1.21.1", loader: "fabric", size_kb: 2156, enabled: true,
    description: "Module API de base fournissant les hooks essentiels et les mesures d'intercompatibilité pour les mods Fabric.",
    authors: ["modmuss50", "asie", "sfPlayer1"] },
  { file_name: "sodium-fabric-0.6.0+mc1.21.1.jar", display_name: "Sodium",
    version: "0.6.0", loader: "fabric", size_kb: 1247, enabled: true,
    description: "Un moteur de rendu libre et open-source qui remplace celui de Minecraft pour des performances et une qualité visuelle bien supérieures.",
    authors: ["JellySquid", "IMS"] },
  { file_name: "lithium-fabric-mc1.21.1-0.13.0.jar", display_name: "Lithium",
    version: "0.13.0", loader: "fabric", size_kb: 384, enabled: true,
    description: "Mod d'optimisation général sans changement de comportement vanilla.",
    authors: ["JellySquid"] },
  { file_name: "iris-mc1.21.1-1.7.5-fabric.jar", display_name: "Iris Shaders",
    version: "1.7.5", loader: "fabric", size_kb: 1834, enabled: true,
    description: "Mod de shaders open-source compatible avec les packs OptiFine.",
    authors: ["coderbot", "IMS", "FoundationGames"] },
  { file_name: "modmenu-11.0.3.jar", display_name: "Mod Menu",
    version: "11.0.3", loader: "fabric", size_kb: 712, enabled: true,
    description: "Ajoute un menu des mods accessible depuis l'écran titre.",
    authors: ["Prospector"] },
  { file_name: "krypton-0.2.8.jar", display_name: "Krypton",
    version: "0.2.8", loader: "fabric", size_kb: 145, enabled: true,
    description: "Optimise la stack réseau de Minecraft pour des connexions plus rapides.",
    authors: ["tuxed"] },
  { file_name: "lazydfu-0.1.3.jar", display_name: "Lazy DataFixerUpper",
    version: "0.1.3", loader: "fabric", size_kb: 24, enabled: true,
    description: "Rend le DataFixerUpper paresseux, réduisant drastiquement le temps de démarrage.",
    authors: ["Thalassophobian"] },
  { file_name: "fabric-carpet-1.21.1-1.4.147+v240809.jar", display_name: "Carpet",
    version: "1.4.147", loader: "fabric", size_kb: 1456, enabled: true,
    description: "Modded vanilla — ajoute des outils techniques et optimisations sans modifier le gameplay.",
    authors: ["gnembon"] },
  { file_name: "memoryleakfix-1.21-1.1.5.jar", display_name: "Memory Leak Fix",
    version: "1.1.5", loader: "fabric", size_kb: 88, enabled: true,
    description: "Corrige plusieurs fuites mémoire connues du jeu vanilla.",
    authors: ["FxMorin"] },
  { file_name: "ferritecore-7.0.0-fabric.jar", display_name: "Ferrite Core",
    version: "7.0.0", loader: "fabric", size_kb: 76, enabled: true,
    description: "Réduit considérablement l'utilisation mémoire de Minecraft.",
    authors: ["malte0811"] },
  { file_name: "connectivity-1.21-5.4.jar", display_name: "Connectivity",
    version: "5.4", loader: "fabric", size_kb: 32, enabled: true,
    description: "Résout les problèmes de connectivité courants entre client et serveur.",
    authors: ["someaddon"] },
  { file_name: "spark-1.10.74-fabric.jar", display_name: "Spark",
    version: "1.10.74", loader: "fabric", size_kb: 5421, enabled: true,
    description: "Profiler de performances pour Minecraft — CPU sampling, allocations mémoire, lag spikes.",
    authors: ["lucko"] },
  { file_name: "serverperformance-1.21-1.0.0.jar", display_name: "Server Performance",
    version: "1.0.0", loader: "fabric", size_kb: 198, enabled: false,
    description: "Améliorations de performance côté serveur (chargement de chunks, IA mobs).",
    authors: ["xpple"] },
  { file_name: "chunky-fabric-1.4.16.jar", display_name: "Chunky",
    version: "1.4.16", loader: "fabric", size_kb: 654, enabled: false,
    description: "Pré-génère les chunks pour éviter les ralentissements en exploration.",
    authors: ["pop4959"] },
  { file_name: "dcintegration-3.1.4-mc1.21.1.jar", display_name: "Discord Integration",
    version: "3.1.4", loader: "fabric", size_kb: 1024, enabled: false,
    description: "Bridge entre le chat serveur et un canal Discord via un bot.",
    authors: ["Erdragh"] },
];

class MockBridge {
  private listeners = new Map<string, Set<Listener<unknown>>>();
  private running = false;
  private startedAt = 0;
  private players: Player[] = [];
  private playerTimer: number | null = null;
  private logTimer: number | null = null;
  private statsTimer: number | null = null;
  private config: AppConfig = {
    server_folder: "/Users/demo/minecraft-server",
    bat_file: "/Users/demo/minecraft-server/run.bat",
    max_ram_gb: 8,
    tunnel_address: null,
  };
  private properties: Record<string, string> = { ...DEFAULT_PROPS };
  private mods: ModInfo[] = MOCK_MODS.map((m) => ({ ...m }));
  private networkIndex = 0;
  private networkPresets: NetworkInfo[] = [
    { type: "wifi",     name: "Freebox-A1B2",    local_ip: "192.168.1.42",  public_ip: "82.66.x.x", behind_cgnat: false, suggested_profile: "home"   },
    { type: "cellular", name: "iPhone Hotspot",  local_ip: "172.20.10.2",   public_ip: null,         behind_cgnat: true,  suggested_profile: "mobile" },
    { type: "ethernet", name: "Ethernet 2,5 Gb", local_ip: "192.168.1.105", public_ip: "82.66.x.x", behind_cgnat: false, suggested_profile: "home"   },
  ];
  private activeProfile: NetworkProfile = "home";

  emit<T>(event: string, payload: T) {
    const set = this.listeners.get(event);
    if (set) set.forEach((cb) => cb(payload as unknown));
  }

  on<T>(event: string, cb: Listener<T>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(cb as Listener<unknown>);
    return () => set!.delete(cb as Listener<unknown>);
  }

  status(): ServerStatus {
    return {
      running: this.running,
      pid: this.running ? 31415 : null,
      uptime_secs: this.running
        ? Math.floor((Date.now() - this.startedAt) / 1000)
        : 0,
    };
  }

  getPlayers(): Player[] {
    return this.players;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.startedAt = Date.now();
    this.emit("server:status", this.status());
    this.pushLog("INFO", "Starting minecraft server version 1.21.1");
    this.pushLog("INFO", "Loading properties");
    setTimeout(() => this.pushLog("INFO", "Preparing spawn area: 0%"), 600);
    setTimeout(() => this.pushLog("INFO", 'Done (3.42s)! For help, type "help"'), 1400);
    setTimeout(() => this.simulateJoin("Alex"), 2800);
    setTimeout(() => this.simulateJoin("Notch"), 5200);

    this.logTimer = window.setInterval(() => {
      const samples = [
        ["INFO", "Saving chunks for level 'overworld'"],
        ["INFO", "Auto-saved chunks (took 0.12s)"],
        ["WARN", "Can't keep up! Did the system time change?"],
      ] as const;
      const [level, text] = samples[Math.floor(Math.random() * samples.length)];
      this.pushLog(level, text);
    }, 6000);

    this.statsTimer = window.setInterval(() => {
      this.emit<SystemStats>("stats:update", {
        cpu_percent: 8 + Math.random() * 20,
        ram_mb: 2200 + Math.random() * 800,
        ram_max_mb: this.config.max_ram_gb * 1024,
      });
    }, 1500);

    this.playerTimer = window.setInterval(() => {
      if (Math.random() < 0.15) {
        const names = ["Steve", "Herobrine", "Dream", "Technoblade", "Tommy"];
        const free = names.filter((n) => !this.players.find((p) => p.name === n));
        if (free.length) this.simulateJoin(free[Math.floor(Math.random() * free.length)]);
      } else if (this.players.length > 1 && Math.random() < 0.08) {
        const p = this.players[Math.floor(Math.random() * this.players.length)];
        this.simulateLeave(p.name);
      }
    }, 4000);
  }

  stop() {
    if (!this.running) return;
    this.pushLog("INFO", "Stopping the server");
    this.pushLog("INFO", "Saving players");
    this.pushLog("INFO", "Saving worlds");
    this.players = [];
    this.emit("players:update", this.players);
    this.running = false;
    this.emit("server:status", this.status());
    if (this.logTimer) clearInterval(this.logTimer);
    if (this.statsTimer) clearInterval(this.statsTimer);
    if (this.playerTimer) clearInterval(this.playerTimer);
    this.emit<SystemStats>("stats:update", {
      cpu_percent: 0,
      ram_mb: 0,
      ram_max_mb: this.config.max_ram_gb * 1024,
    });
  }

  command(cmd: string) {
    this.pushLog("INFO", `[Server] Issued command: ${cmd}`);
  }

  private simulateJoin(name: string) {
    if (this.players.find((p) => p.name === name)) return;
    const ip = `192.168.1.${20 + Math.floor(Math.random() * 200)}`;
    const player: Player = {
      name,
      ip,
      port: 50000 + Math.floor(Math.random() * 10000),
      connected_at: Math.floor(Date.now() / 1000),
    };
    this.pushLog(
      "INFO",
      `${name}[/${ip}:${player.port}] logged in with entity id ${Math.floor(Math.random() * 99999)}`,
    );
    this.pushLog("INFO", `${name} joined the game`);
    this.players = [...this.players, player];
    this.emit("players:update", this.players);
  }

  private simulateLeave(name: string) {
    this.pushLog("INFO", `${name} left the game`);
    this.players = this.players.filter((p) => p.name !== name);
    this.emit("players:update", this.players);
  }

  private pushLog(level: LogLine["level"], text: string) {
    this.emit<LogLine>("log:line", {
      ts: Date.now() / 1000,
      level,
      text,
    });
  }

  getConfig() { return this.config; }
  setConfig(c: Partial<AppConfig>) { this.config = { ...this.config, ...c }; }

  getProperties(): PropertyEntry[] {
    return Object.entries(this.properties).map(([key, value]) => ({ key, value }));
  }
  setProperties(updates: Record<string, string>) {
    this.properties = { ...this.properties, ...updates };
    this.pushLog("INFO", `[Cockpit] server.properties saved (${Object.keys(updates).length} entries)`);
  }

  getMods(): ModInfo[] { return this.mods.map((m) => ({ ...m })); }
  toggleMod(fileName: string, enabled: boolean) {
    const m = this.mods.find((x) => x.file_name === fileName);
    if (m) {
      m.enabled = enabled;
      this.pushLog("INFO", `[Cockpit] ${m.display_name} ${enabled ? "activé" : "désactivé"}`);
    }
  }
  openModsFolder() {
    this.pushLog("INFO", "[Cockpit] (mock) Would open mods folder in Explorer");
  }
  getNetworkInfo(): NetworkInfo { return { ...this.networkPresets[this.networkIndex] }; }
  cycleNetwork(): NetworkInfo {
    this.networkIndex = (this.networkIndex + 1) % this.networkPresets.length;
    const next = this.networkPresets[this.networkIndex];
    this.emit("network:update", { ...next });
    this.pushLog("INFO", `[Cockpit] Réseau changé : ${next.type} (${next.name})`);
    return { ...next };
  }
  getActiveProfile(): NetworkProfile { return this.activeProfile; }
  applyNetworkProfile(profile: NetworkProfile) {
    const preset = NETWORK_PROFILE_PRESETS[profile];
    for (const [k, v] of Object.entries(preset)) this.properties[k] = v;
    this.activeProfile = profile;
    this.pushLog("INFO", `[Cockpit] Profil ${profile === "home" ? "Maison" : "Mobile"} appliqué`);
  }
  async restart() {
    if (this.running) {
      this.stop();
      await new Promise((r) => setTimeout(r, 600));
    }
    this.start();
  }
}

const mock = !isTauri ? new MockBridge() : null;

// ── Public API ───────────────────────────────────────────────────────────────

export const api = {
  isTauri,

  async getConfig(): Promise<AppConfig> {
    if (mock) return mock.getConfig();
    return tauriInvoke<AppConfig>("get_config");
  },

  async pickServerFolder(): Promise<AppConfig | null> {
    if (mock) {
      mock.setConfig({
        server_folder: "/Users/demo/minecraft-server",
        bat_file: "/Users/demo/minecraft-server/run.bat",
      });
      return mock.getConfig();
    }
    return tauriInvoke<AppConfig | null>("pick_server_folder");
  },

  async setMaxRam(gb: number): Promise<void> {
    if (mock) { mock.setConfig({ max_ram_gb: gb }); return; }
    return tauriInvoke<void>("set_max_ram", { gb });
  },

  async getServerStatus(): Promise<ServerStatus> {
    if (mock) return mock.status();
    return tauriInvoke<ServerStatus>("get_server_status");
  },

  async getPlayers(): Promise<Player[]> {
    if (mock) return mock.getPlayers();
    return tauriInvoke<Player[]>("get_players");
  },

  async startServer(): Promise<void> {
    if (mock) { mock.start(); return; }
    return tauriInvoke<void>("start_server");
  },

  async stopServer(): Promise<void> {
    if (mock) { mock.stop(); return; }
    return tauriInvoke<void>("stop_server");
  },

  async restartServer(): Promise<void> {
    if (mock) { await mock.restart(); return; }
    return tauriInvoke<void>("restart_server");
  },

  async sendCommand(cmd: string): Promise<void> {
    if (mock) { mock.command(cmd); return; }
    return tauriInvoke<void>("send_command", { cmd });
  },

  // ── server.properties ─────────────────────────────────────────────────────
  async readServerProperties(): Promise<PropertyEntry[]> {
    if (mock) return mock.getProperties();
    return tauriInvoke<PropertyEntry[]>("read_server_properties");
  },

  async writeServerProperties(updates: Record<string, string>): Promise<void> {
    if (mock) { mock.setProperties(updates); return; }
    return tauriInvoke<void>("write_server_properties", { updates });
  },

  // ── mods ──────────────────────────────────────────────────────────────────
  async listMods(): Promise<ModInfo[]> {
    if (mock) return mock.getMods();
    return tauriInvoke<ModInfo[]>("list_mods");
  },

  async toggleMod(fileName: string, enabled: boolean): Promise<void> {
    if (mock) { mock.toggleMod(fileName, enabled); return; }
    return tauriInvoke<void>("toggle_mod", { fileName, enabled });
  },

  async openModsFolder(): Promise<void> {
    if (mock) { mock.openModsFolder(); return; }
    return tauriInvoke<void>("open_mods_folder");
  },

  // ── network ───────────────────────────────────────────────────────────────
  async getNetworkInfo(): Promise<NetworkInfo> {
    if (mock) return mock.getNetworkInfo();
    return tauriInvoke<NetworkInfo>("get_network_info");
  },
  async cycleMockNetwork(): Promise<NetworkInfo | null> {
    // Mock-only helper for design iteration
    if (mock) return mock.cycleNetwork();
    return null;
  },
  async getActiveProfile(): Promise<NetworkProfile> {
    if (mock) return mock.getActiveProfile();
    return tauriInvoke<NetworkProfile>("get_active_network_profile");
  },
  async applyNetworkProfile(profile: NetworkProfile): Promise<void> {
    if (mock) { mock.applyNetworkProfile(profile); return; }
    return tauriInvoke<void>("apply_network_profile", { profile });
  },

  // ── tunnel (playit.gg or similar) ─────────────────────────────────────────
  async setTunnelAddress(address: string | null): Promise<AppConfig> {
    if (mock) {
      mock.setConfig({ tunnel_address: address });
      return mock.getConfig();
    }
    return tauriInvoke<AppConfig>("set_tunnel_address", { address });
  },

  // ── Event subscriptions ──────────────────────────────────────────────────
  async onStatus(cb: (s: ServerStatus) => void): Promise<UnlistenFn> {
    if (mock) return mock.on("server:status", cb);
    return tauriListen("server:status", cb);
  },
  async onPlayers(cb: (p: Player[]) => void): Promise<UnlistenFn> {
    if (mock) return mock.on("players:update", cb);
    return tauriListen("players:update", cb);
  },
  async onLog(cb: (l: LogLine) => void): Promise<UnlistenFn> {
    if (mock) return mock.on("log:line", cb);
    return tauriListen("log:line", cb);
  },
  async onStats(cb: (s: SystemStats) => void): Promise<UnlistenFn> {
    if (mock) return mock.on("stats:update", cb);
    return tauriListen("stats:update", cb);
  },
  async onNetwork(cb: (n: NetworkInfo) => void): Promise<UnlistenFn> {
    if (mock) return mock.on("network:update", cb);
    return tauriListen("network:update", cb);
  },
};

// Auto-fire a synthetic status event on load when in mock mode, so React
// hooks that only listen don't sit blank.
if (mock) {
  setTimeout(() => mock.emit("server:status", mock.status()), 50);
}
