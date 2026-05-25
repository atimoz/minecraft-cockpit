import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Filter, FolderOpen, Loader2, Package, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, type ModInfo } from "../lib/tauri";
import { cn } from "../lib/utils";

type FilterId = "all" | "enabled" | "disabled";

export function ModsView() {
  const [mods, setMods] = useState<ModInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    api.listMods().then((m) => {
      if (mounted) {
        setMods(m);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  const enabledCount = useMemo(() => mods.filter((m) => m.enabled).length, [mods]);
  const disabledCount = mods.length - enabledCount;
  const loader = useMemo(() => {
    const counts = { fabric: 0, forge: 0, unknown: 0 };
    for (const m of mods) {
      const k = (counts as any)[m.loader] !== undefined ? m.loader : "unknown";
      (counts as any)[k]++;
    }
    if (counts.fabric > counts.forge) return "fabric";
    if (counts.forge > counts.fabric) return "forge";
    return "unknown";
  }, [mods]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return mods.filter((m) => {
      if (filter === "enabled" && !m.enabled) return false;
      if (filter === "disabled" && m.enabled) return false;
      if (q && !`${m.display_name} ${m.file_name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [mods, query, filter]);

  const onToggle = async (m: ModInfo) => {
    const next = !m.enabled;
    setMods((prev) =>
      prev.map((x) => (x.file_name === m.file_name ? { ...x, enabled: next } : x)),
    );
    try {
      await api.toggleMod(m.file_name, next);
    } catch (e) {
      setMods((prev) =>
        prev.map((x) => (x.file_name === m.file_name ? { ...x, enabled: !next } : x)),
      );
      console.error(e);
    }
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
      className="flex-1 flex flex-col min-h-0 px-6 py-5"
    >
      <Toolbar
        query={query}
        onQuery={setQuery}
        filter={filter}
        onFilter={setFilter}
        total={mods.length}
      />

      <Stats enabled={enabledCount} disabled={disabledCount} loader={loader} />

      <ListHeader />

      <div className="flex-1 overflow-y-auto min-h-0 -mx-2 px-2">
        {filtered.length === 0 ? (
          <EmptyState query={query} hasAny={mods.length > 0} />
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map((m) => (
              <ModRow
                key={m.file_name}
                mod={m}
                expanded={expanded === m.file_name}
                onExpand={() => setExpanded((id) => (id === m.file_name ? null : m.file_name))}
                onToggle={() => onToggle(m)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

function Toolbar({
  query,
  onQuery,
  filter,
  onFilter,
  total,
}: {
  query: string;
  onQuery: (v: string) => void;
  filter: FilterId;
  onFilter: (f: FilterId) => void;
  total: number;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-3 flex-wrap">
      <div
        className="h-[30px] w-[30px] rounded-full
          bg-[var(--color-bg-surface)] border border-[var(--color-border)]
          flex items-center justify-center text-[var(--color-text-faint)]"
      >
        <Filter size={13} />
      </div>

      <FilterPills value={filter} onChange={onFilter} />

      <div
        className="flex-1 min-w-[240px] flex items-center gap-2 px-3 h-[34px]
          bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-full
          focus-within:border-[var(--color-green)]"
      >
        <Search size={13} className="text-[var(--color-text-faint)] shrink-0" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={`Rechercher ${total} mods…`}
          className="flex-1 bg-transparent outline-none text-[13px]
            text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] allow-select"
        />
      </div>

      <button
        onClick={() => api.openModsFolder()}
        className="h-[30px] px-3 inline-flex items-center gap-1.5 rounded-full
          bg-[var(--color-bg-surface)] border border-[var(--color-border)]
          text-[12px] text-[var(--color-text)] font-medium
          hover:bg-[var(--color-bg-surface-2)] transition"
      >
        <FolderOpen size={13} />
        Dossier
      </button>
    </div>
  );
}

function FilterPills({
  value,
  onChange,
}: {
  value: FilterId;
  onChange: (f: FilterId) => void;
}) {
  const opts: { id: FilterId; label: string }[] = [
    { id: "all", label: "Tous" },
    { id: "enabled", label: "Actifs" },
    { id: "disabled", label: "Désactivés" },
  ];
  return (
    <div className="inline-flex items-center gap-1.5">
      {opts.map((o) => {
        const isOn = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              "h-[30px] px-3 rounded-full text-[12px] font-medium transition",
              isOn
                ? "bg-[var(--color-green-soft-bg)] text-[var(--color-green)] border border-transparent"
                : "bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg-surface-2)]",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Stats row ──────────────────────────────────────────────────────────────

function Stats({
  enabled,
  disabled,
  loader,
}: {
  enabled: number;
  disabled: number;
  loader: string;
}) {
  return (
    <div className="flex items-center gap-4 mb-2.5 px-1 text-[11.5px] text-[var(--color-text-faint)]">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-green)] shadow-[0_0_6px_rgba(27,217,106,0.5)]" />
        <strong className="text-[var(--color-text)] font-semibold tabular-nums">{enabled}</strong>{" "}
        mods actifs
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-faint)]" />
        <strong className="text-[var(--color-text)] font-semibold tabular-nums">{disabled}</strong>{" "}
        désactivés
      </span>
      {loader !== "unknown" && (
        <span className="ml-auto inline-flex items-center gap-2">
          Loader détecté
          <LoaderChip loader={loader} />
        </span>
      )}
    </div>
  );
}

function LoaderChip({ loader }: { loader: string }) {
  const isForge = loader === "forge";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium",
        isForge ? "bg-[rgba(255,159,10,0.16)] text-[#ffb340]" : "bg-[rgba(167,139,250,0.16)] text-[#c4b5fd]",
      )}
    >
      {isForge ? "Forge" : "Fabric"}
    </span>
  );
}

// ─── List header ────────────────────────────────────────────────────────────

function ListHeader() {
  return (
    <div
      className="grid grid-cols-[28px_1fr_200px_60px] gap-3 px-[18px] pb-2
        border-b border-[var(--color-border)] mb-1
        text-[10px] font-semibold tracking-[0.12em] uppercase
        text-[var(--color-text-faint)]"
    >
      <div></div>
      <div>Mod</div>
      <div>Version</div>
      <div className="text-right">Actif</div>
    </div>
  );
}

// ─── Mod row ────────────────────────────────────────────────────────────────

function ModRow({
  mod,
  expanded,
  onExpand,
  onToggle,
}: {
  mod: ModInfo;
  expanded: boolean;
  onExpand: () => void;
  onToggle: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      onClick={onExpand}
      className={cn(
        "grid grid-cols-[28px_1fr_200px_60px] gap-3 items-center px-[18px] py-3",
        "border-b border-[var(--color-border-soft)] cursor-pointer transition-colors",
        expanded ? "bg-[var(--color-bg-surface)]" : "hover:bg-[var(--color-bg-surface-2)]",
      )}
    >
      <div className="h-4 w-4 rounded-[4px] border-[1.5px] border-[var(--color-border-soft)] bg-transparent" />

      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            "h-10 w-10 rounded-[8px] flex items-center justify-center shrink-0 transition-opacity",
            mod.enabled
              ? "bg-gradient-to-br from-[var(--color-green)] to-[var(--color-green-strong)] text-[var(--color-bg-app)]"
              : "bg-[var(--color-bg-surface-3)] text-[var(--color-text-faint)]",
          )}
        >
          <Package size={20} strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "text-[14px] font-semibold truncate",
              mod.enabled ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]",
            )}
          >
            {mod.display_name}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">
            <LoaderChip loader={mod.loader} />
            <span className="h-3.5 w-3.5 rounded-full bg-[var(--color-bg-surface-3)] shrink-0" />
            <span className="truncate">{(mod.authors ?? []).slice(0, 2).join(", ")}</span>
          </div>

          <motion.div
            initial={false}
            animate={{ height: expanded ? "auto" : 0, opacity: expanded ? 1 : 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden text-[11.5px] text-[var(--color-text-muted)] leading-[1.55]"
          >
            <div className="pt-3 pb-1">
              {mod.description && <div className="mb-2">{mod.description}</div>}
              <DetailRow label="Auteurs" value={(mod.authors ?? []).join(", ")} />
              <DetailRow
                label="Fichier"
                value={`${mod.file_name}${mod.enabled ? "" : ".disabled"}`}
                mono
              />
              <DetailRow label="Taille" value={formatSize(mod.size_kb)} />
            </div>
          </motion.div>
        </div>
      </div>

      <div>
        <div className="text-[12.5px] font-medium text-[var(--color-text)] tabular-nums truncate">
          {mod.version ? `v${mod.version}` : "—"}
        </div>
        <div className="text-[10.5px] font-mono text-[var(--color-text-faint)] mt-0.5 truncate">
          {mod.file_name}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <ChevronDown
          size={13}
          className={cn(
            "text-[var(--color-text-faint)] transition-transform",
            expanded && "rotate-180",
          )}
        />
        <div onClick={(e) => e.stopPropagation()}>
          <Switch on={mod.enabled} onToggle={onToggle} />
        </div>
      </div>
    </motion.div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2 mt-1">
      <span className="min-w-[80px] text-[var(--color-text-faint)]">{label}</span>
      <span className={cn("text-[var(--color-text-muted)] break-all", mono && "font-mono text-[11px]")}>
        {value}
      </span>
    </div>
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

function EmptyState({ query, hasAny }: { query: string; hasAny: boolean }) {
  if (!hasAny) {
    return (
      <div className="flex-1 min-h-[180px] flex flex-col items-center justify-center text-center px-6">
        <div className="h-10 w-10 rounded-[10px] bg-[var(--color-bg-surface-3)] flex items-center justify-center mb-3">
          <Package size={16} className="text-[var(--color-text-faint)]" />
        </div>
        <p className="text-[13px] text-[var(--color-text-muted)]">
          Pas de dossier <span className="font-mono">mods/</span> détecté
        </p>
        <p className="text-[11px] text-[var(--color-text-faint)] mt-1">
          Ton serveur est-il bien un Fabric ou Forge ? Crée le dossier et redémarre.
        </p>
      </div>
    );
  }
  return (
    <div className="flex-1 min-h-[180px] flex flex-col items-center justify-center text-center px-6">
      <div className="h-10 w-10 rounded-[10px] bg-[var(--color-bg-surface-3)] flex items-center justify-center mb-3">
        <Search size={16} className="text-[var(--color-text-faint)]" />
      </div>
      <p className="text-[13px] text-[var(--color-text-muted)]">
        Aucun mod trouvé{query && ` pour « ${query} »`}
      </p>
      <p className="text-[11px] text-[var(--color-text-faint)] mt-1">
        Essaie un autre terme de recherche ou un autre filtre.
      </p>
    </div>
  );
}

function formatSize(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
