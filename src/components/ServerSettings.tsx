import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useServerStatus } from "../hooks/useServerStatus";
import { api } from "../lib/tauri";
import { cn } from "../lib/utils";

// ─── Field schema ────────────────────────────────────────────────────────────

type SegOption = { label: string; value: string };
type FieldDef = {
  key: string;
  label: string;
  type: "bool" | "segmented" | "number" | "port" | "text" | "password";
  options?: (string | SegOption)[];
  min?: number;
  max?: number;
  placeholder?: string;
  wide?: boolean;
  mono?: boolean;
  hint?: string;
};

const SECTIONS: { title: string; fields: FieldDef[] }[] = [
  { title: "IDENTITÉ", fields: [
    { key: "motd", label: "Message du jour", type: "text", wide: true },
    { key: "server-port", label: "Port serveur", type: "port" },
    { key: "server-ip", label: "Adresse d'écoute", type: "text", placeholder: "Vide = toutes les interfaces", mono: true },
  ]},
  { title: "JOUEURS", fields: [
    { key: "max-players", label: "Joueurs max", type: "number", min: 1, max: 500 },
    { key: "online-mode", label: "Online mode", type: "bool", hint: "Auth Mojang" },
    { key: "white-list", label: "Liste blanche", type: "bool" },
    { key: "enforce-whitelist", label: "Forcer la whitelist", type: "bool" },
    { key: "op-permission-level", label: "Niveau OP", type: "segmented", options: ["1", "2", "3", "4"] },
  ]},
  { title: "MONDE", fields: [
    { key: "level-name", label: "Nom du monde", type: "text", mono: true },
    { key: "level-seed", label: "Seed", type: "text", placeholder: "Aléatoire", mono: true },
    { key: "level-type", label: "Type de monde", type: "segmented", options: [
      { label: "Normal", value: "minecraft:normal" },
      { label: "Flat", value: "minecraft:flat" },
      { label: "Large", value: "minecraft:large_biomes" },
      { label: "Amplifié", value: "minecraft:amplified" },
    ]},
    { key: "generate-structures", label: "Structures", type: "bool" },
    { key: "spawn-protection", label: "Protection du spawn", type: "number", min: 0, max: 64 },
    { key: "view-distance", label: "Distance d'affichage", type: "number", min: 3, max: 32 },
    { key: "simulation-distance", label: "Distance de simulation", type: "number", min: 3, max: 32 },
    { key: "allow-nether", label: "Autoriser le Nether", type: "bool" },
  ]},
  { title: "GAMEPLAY", fields: [
    { key: "gamemode", label: "Mode de jeu", type: "segmented", options: [
      { label: "Survie", value: "survival" },
      { label: "Créatif", value: "creative" },
      { label: "Aventure", value: "adventure" },
      { label: "Spectateur", value: "spectator" },
    ]},
    { key: "difficulty", label: "Difficulté", type: "segmented", options: [
      { label: "Paisible", value: "peaceful" },
      { label: "Facile", value: "easy" },
      { label: "Normal", value: "normal" },
      { label: "Difficile", value: "hard" },
    ]},
    { key: "hardcore", label: "Hardcore", type: "bool" },
    { key: "pvp", label: "PvP", type: "bool" },
    { key: "allow-flight", label: "Autoriser le vol", type: "bool" },
    { key: "force-gamemode", label: "Forcer le gamemode", type: "bool" },
    { key: "enable-command-block", label: "Command blocks", type: "bool" },
  ]},
  { title: "PERFORMANCE", fields: [
    { key: "max-tick-time", label: "Tick max (ms)", type: "number", min: -1, max: 600000 },
    { key: "network-compression-threshold", label: "Seuil compression réseau", type: "number", min: -1, max: 16384 },
    { key: "sync-chunk-writes", label: "Écritures chunks synchrones", type: "bool" },
  ]},
  { title: "RCON & QUERY", fields: [
    { key: "enable-rcon", label: "RCON activé", type: "bool" },
    { key: "rcon.port", label: "Port RCON", type: "port" },
    { key: "rcon.password", label: "Mot de passe RCON", type: "password" },
    { key: "enable-query", label: "Query activé", type: "bool" },
    { key: "query.port", label: "Port Query", type: "port" },
  ]},
  { title: "RESOURCE PACK", fields: [
    { key: "resource-pack", label: "URL", type: "text", wide: true, placeholder: "https://…" },
    { key: "resource-pack-prompt", label: "Message d'invite", type: "text", wide: true },
    { key: "resource-pack-sha1", label: "SHA-1", type: "text", wide: true, mono: true },
    { key: "require-resource-pack", label: "Obligatoire", type: "bool" },
  ]},
];

// ─── Main view ───────────────────────────────────────────────────────────────

export function ServerSettings() {
  const status = useServerStatus();
  const [initial, setInitial] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.readServerProperties().then((entries) => {
      if (!mounted) return;
      const map: Record<string, string> = {};
      for (const e of entries) map[e.key] = e.value;
      setInitial(map);
      setApplied(map);
      setCurrent(map);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const dirtyCount = useMemo(() => {
    let n = 0;
    for (const k of Object.keys(current)) {
      if ((current[k] ?? "") !== (initial[k] ?? "")) n++;
    }
    return n;
  }, [current, initial]);

  const needsRestart = useMemo(() => {
    if (!status.running) return false;
    for (const k of Object.keys(initial)) {
      if ((initial[k] ?? "") !== (applied[k] ?? "")) return true;
    }
    return false;
  }, [initial, applied, status.running]);

  const onChange = (key: string, value: string) =>
    setCurrent((c) => ({ ...c, [key]: value }));
  const onCancel = () => setCurrent(initial);
  const onSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, string> = {};
      for (const k of Object.keys(current)) {
        if ((current[k] ?? "") !== (initial[k] ?? "")) updates[k] = current[k];
      }
      await api.writeServerProperties(updates);
      setInitial({ ...current });
    } finally {
      setSaving(false);
    }
  };
  const onRestart = async () => {
    await api.restartServer();
    setApplied({ ...initial });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-[var(--color-text-faint)]" size={20} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="flex-1 flex flex-col min-h-0 px-6 py-5 relative"
    >
      <div className="flex-1 overflow-y-auto pb-24 pr-1">
        {needsRestart && <RestartBanner onRestart={onRestart} />}

        {SECTIONS.map((section) => (
          <div key={section.title} className="card px-5 py-4 mb-3.5">
            <div className="text-[10px] font-semibold tracking-[0.14em] text-[var(--color-text-faint)] mb-3">
              {section.title}
            </div>
            <div>
              {section.fields.map((field, i) => (
                <FieldRow
                  key={field.key}
                  field={field}
                  value={current[field.key] ?? ""}
                  onChange={(v) => onChange(field.key, v)}
                  first={i === 0}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {dirtyCount > 0 && (
          <SaveBar count={dirtyCount} saving={saving} onCancel={onCancel} onSave={onSave} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function RestartBanner({ onRestart }: { onRestart: () => void }) {
  return (
    <div
      className="mb-3.5 px-4 py-3 flex items-center gap-3 rounded-[var(--radius-card)]
        bg-[rgba(245,197,66,0.08)] border border-[rgba(245,197,66,0.25)]"
    >
      <div
        className="h-7 w-7 rounded-[8px] flex items-center justify-center shrink-0
          bg-[rgba(245,197,66,0.16)] text-[var(--color-warn)]"
      >
        <AlertCircle size={14} strokeWidth={2.4} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold">Le serveur tourne avec l'ancienne configuration</div>
        <div className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
          Redémarre-le pour appliquer les paramètres modifiés.
        </div>
      </div>
      <button
        onClick={onRestart}
        className="px-3 h-[30px] rounded-md bg-[var(--color-warn)] text-[var(--color-bg-app)]
          text-[12px] font-semibold transition hover:bg-[#f7d263] shrink-0"
      >
        Redémarrer
      </button>
    </div>
  );
}

function FieldRow({
  field,
  value,
  onChange,
  first,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
  first: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[220px_1fr] items-center gap-4 py-2.5",
        !first && "border-t border-[var(--color-border-soft)]",
      )}
    >
      <div className="flex flex-col">
        <div className="text-[13px] font-medium text-[var(--color-text)]">{field.label}</div>
        <div className="text-[11px] text-[var(--color-text-faint)] font-mono mt-0.5">
          {field.key}{field.hint ? `  ·  ${field.hint}` : ""}
        </div>
      </div>
      <div className="flex justify-end">
        <FieldControl field={field} value={value} onChange={onChange} />
      </div>
    </div>
  );
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.type === "bool") {
    return (
      <Switch
        on={value === "true"}
        onToggle={() => onChange(value === "true" ? "false" : "true")}
      />
    );
  }
  if (field.type === "segmented") {
    const opts = (field.options ?? []).map((o) =>
      typeof o === "string" ? { label: o, value: o } : o,
    );
    return <Segmented value={value} options={opts} onChange={onChange} />;
  }
  if (field.type === "number" || field.type === "port") {
    return (
      <input
        type="number"
        value={value}
        min={field.min}
        max={field.max}
        onChange={(e) => onChange(e.target.value)}
        className="h-[30px] px-3 min-w-[120px] text-right
          bg-[var(--color-bg-surface-3)] border border-transparent
          rounded-md text-[12.5px] tabular-nums text-[var(--color-text)]
          outline-none focus:border-[var(--color-green)]
          focus:bg-[var(--color-bg-app)] transition allow-select"
      />
    );
  }
  if (field.type === "password") {
    return <PasswordInput value={value} onChange={onChange} />;
  }
  return (
    <input
      type="text"
      value={value}
      placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-[30px] px-3 min-w-[160px] bg-[var(--color-bg-surface-3)]",
        "border border-transparent rounded-md text-[12.5px] text-[var(--color-text)]",
        "outline-none focus:border-[var(--color-green)] focus:bg-[var(--color-bg-app)]",
        "transition allow-select",
        field.wide && "min-w-[280px]",
        field.mono && "font-mono",
      )}
    />
  );
}

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "relative w-[38px] h-[22px] rounded-full transition-colors",
        on ? "bg-[var(--color-green)]" : "bg-[var(--color-bg-surface-3)]",
      )}
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white"
        style={{ left: on ? "18px" : "2px" }}
      />
    </button>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: SegOption[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex p-[3px] rounded-[8px] bg-[var(--color-bg-surface-3)]">
      {options.map((opt) => {
        const isOn = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-[11px] py-[5px] text-[12px] font-medium rounded-[5px] transition-colors",
              isOn
                ? "bg-[var(--color-green-soft-bg)] text-[var(--color-green)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function PasswordInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [shown, setShown] = useState(false);
  return (
    <div
      className="flex items-center min-w-[200px] pr-1
        bg-[var(--color-bg-surface-3)] border border-transparent rounded-md
        focus-within:border-[var(--color-green)] focus-within:bg-[var(--color-bg-app)]"
    >
      <input
        type={shown ? "text" : "password"}
        value={value}
        placeholder="Vide"
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 h-[30px] bg-transparent px-3 outline-none
          text-[12.5px] font-mono text-[var(--color-text)] allow-select"
      />
      <button
        onClick={() => setShown((s) => !s)}
        className="p-1 rounded text-[var(--color-text-faint)]
          hover:text-[var(--color-text)] hover:bg-[var(--color-bg-surface-2)] transition"
      >
        {shown ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </div>
  );
}

function SaveBar({
  count,
  saving,
  onCancel,
  onSave,
}: {
  count: number;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10
        flex items-center gap-2.5 px-[10px] py-[8px]
        bg-[var(--color-bg-surface)] border border-[var(--color-border)]
        rounded-full shadow-[0_14px_36px_-10px_rgba(0,0,0,0.6)] whitespace-nowrap"
    >
      <span className="px-2 text-[12.5px] font-medium text-[var(--color-text-muted)]">
        <strong className="text-[var(--color-text)]">{count}</strong>{" "}
        modification{count > 1 ? "s" : ""} non enregistrée{count > 1 ? "s" : ""}
      </span>
      <button
        onClick={onCancel}
        disabled={saving}
        className="px-3 h-[30px] rounded-full bg-[var(--color-bg-surface-3)]
          hover:bg-[var(--color-bg-surface-2)]
          text-[var(--color-text)] text-[12px] font-medium transition
          disabled:opacity-50"
      >
        Annuler
      </button>
      <button
        onClick={onSave}
        disabled={saving}
        className="px-3.5 h-[30px] rounded-full bg-[var(--color-green)]
          hover:bg-[var(--color-green-strong)]
          text-[var(--color-bg-app)] text-[12px] font-semibold transition
          disabled:opacity-60 inline-flex items-center gap-1.5"
      >
        {saving && <Loader2 size={12} className="animate-spin" />}
        Enregistrer
      </button>
    </motion.div>
  );
}
