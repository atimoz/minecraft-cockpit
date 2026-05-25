import { Box, FolderOpen, Package, Sliders, Terminal } from "lucide-react";
import { api } from "../lib/tauri";
import { cn } from "../lib/utils";

export type TabId = "cockpit" | "settings" | "mods";

type Props = {
  active: TabId;
  onChange: (id: TabId) => void;
};

const NAV: { id: TabId; label: string; Icon: typeof Terminal }[] = [
  { id: "cockpit", label: "Cockpit", Icon: Terminal },
  { id: "settings", label: "Paramètres", Icon: Sliders },
  { id: "mods", label: "Mods", Icon: Package },
];

export function Sidebar({ active, onChange }: Props) {
  return (
    <aside
      className="w-16 shrink-0 flex flex-col items-center py-3 gap-1
        bg-[var(--color-bg-app)] border-r border-[var(--color-border)]"
    >
      {/* Logo */}
      <div
        className="h-[38px] w-[38px] rounded-[10px] mb-3
          bg-[var(--color-green)] text-[var(--color-bg-app)]
          flex items-center justify-center
          shadow-[0_4px_12px_-4px_rgba(27,217,106,0.4)]"
        title="Minecraft Cockpit"
      >
        <Box size={22} strokeWidth={2} />
      </div>

      {/* Primary nav */}
      {NAV.map(({ id, label, Icon }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            title={label}
            className={cn(
              "relative h-11 w-11 rounded-[var(--radius-sm)]",
              "flex items-center justify-center transition-all",
              isActive
                ? "bg-[var(--color-green-soft-bg)] text-[var(--color-green)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text)]",
            )}
          >
            {isActive && (
              <span
                className="absolute -left-3 top-1/2 -translate-y-1/2
                  w-[3px] h-[22px] rounded-r-[3px] bg-[var(--color-green)]"
              />
            )}
            <Icon size={20} strokeWidth={2} />
          </button>
        );
      })}

      <div className="flex-1" />

      {/* Secondary actions */}
      <button
        onClick={() => api.openModsFolder()}
        title="Ouvrir le dossier serveur"
        className="h-11 w-11 rounded-[var(--radius-sm)]
          flex items-center justify-center
          text-[var(--color-text-muted)]
          hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text)] transition"
      >
        <FolderOpen size={20} strokeWidth={2} />
      </button>
    </aside>
  );
}
