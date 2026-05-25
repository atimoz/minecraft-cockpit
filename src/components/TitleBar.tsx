import { ChevronRight, Minus, Square, X } from "lucide-react";
import { api } from "../lib/tauri";

async function getWindow() {
  if (!api.isTauri) return null;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

type Props = {
  crumb?: string;
};

export function TitleBar({ crumb }: Props) {
  const onMin = async () => (await getWindow())?.minimize();
  const onMax = async () => (await getWindow())?.toggleMaximize();
  const onClose = async () => (await getWindow())?.close();

  return (
    <header
      className="titlebar-drag h-10 px-3.5 flex items-center justify-between
        bg-[var(--color-bg-app)] border-b border-[var(--color-border)] shrink-0"
    >
      <div className="flex items-center gap-2.5">
        <span className="text-[12px] font-medium text-[var(--color-text-muted)] tracking-tight">
          Minecraft Cockpit
        </span>
        {crumb && (
          <span className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-faint)]">
            <ChevronRight size={11} strokeWidth={2.4} />
            <span className="text-[var(--color-text)] font-medium">{crumb}</span>
          </span>
        )}
      </div>

      {/* Boutons custom min/max/close — identiques sur Windows et macOS.
          Sur macOS, on n'utilise PAS les traffic lights natifs (le design
          Modrinth-uniforme prime sur la convention macOS, et Cmd+Q reste
          dispo pour quitter). */}
      <div className="titlebar-no-drag flex items-center gap-0.5">
        <button
          onClick={onMin}
          className="h-[26px] w-[26px] rounded-md flex items-center justify-center
            text-[var(--color-text-faint)] hover:bg-[var(--color-bg-surface-2)]
            hover:text-[var(--color-text)] transition"
          aria-label="Réduire"
        >
          <Minus size={13} strokeWidth={2.2} />
        </button>
        <button
          onClick={onMax}
          className="h-[26px] w-[26px] rounded-md flex items-center justify-center
            text-[var(--color-text-faint)] hover:bg-[var(--color-bg-surface-2)]
            hover:text-[var(--color-text)] transition"
          aria-label="Agrandir"
        >
          <Square size={11} strokeWidth={2.2} />
        </button>
        <button
          onClick={onClose}
          className="h-[26px] w-[26px] rounded-md flex items-center justify-center
            text-[var(--color-text-faint)] hover:bg-[var(--color-danger)]
            hover:text-white transition"
          aria-label="Fermer"
        >
          <X size={13} strokeWidth={2.2} />
        </button>
      </div>
    </header>
  );
}
