import { Box, Check, Copy, FolderOpen } from "lucide-react";
import { useState } from "react";
import { api, type ServerStatus } from "../lib/tauri";
import { cn, formatUptime } from "../lib/utils";

type Props = {
  folderPath: string | null;
  status: ServerStatus;
  tunnelAddress: string | null;
};

function basename(path: string | null): string {
  if (!path) return "Serveur Minecraft";
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || path;
}

export function ProjectHeader({ folderPath, status, tunnelAddress }: Props) {
  const name = basename(folderPath);

  return (
    <div className="px-6 py-4 flex items-center gap-4 border-b border-[var(--color-border)] shrink-0">
      <div
        className="h-[52px] w-[52px] rounded-[10px] shrink-0
          bg-gradient-to-br from-[var(--color-green)] to-[var(--color-green-strong)]
          text-[var(--color-bg-app)]
          flex items-center justify-center
          shadow-[0_4px_16px_-6px_rgba(27,217,106,0.4)]"
      >
        <Box size={26} strokeWidth={2} />
      </div>

      <div className="flex-1 min-w-0">
        <h1 className="text-[22px] font-extrabold tracking-[-0.022em] text-[var(--color-text)] truncate m-0">
          {name}
        </h1>
        <div className="mt-1 flex items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
          <span>Fabric</span>
          <span className="text-[var(--color-text-faint)]">·</span>
          <span>
            {status.running
              ? `En ligne · ${formatUptime(status.uptime_secs)}`
              : "Hors ligne"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {tunnelAddress && <PublicAddressChip address={tunnelAddress} />}
        <StatusBadge running={status.running} />
        <button
          onClick={() => api.openModsFolder()}
          className="inline-flex items-center gap-1.5 px-3 h-8
            bg-[var(--color-bg-surface)] border border-[var(--color-border)]
            rounded-[var(--radius-sm)]
            text-[12px] font-medium text-[var(--color-text)]
            hover:bg-[var(--color-bg-surface-2)] transition"
        >
          <FolderOpen size={13} />
          Dossier
        </button>
      </div>
    </div>
  );
}

function PublicAddressChip({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      onClick={copy}
      title="Copier l'adresse publique"
      className="inline-flex items-center gap-1.5 px-3 h-8 max-w-[280px]
        bg-[var(--color-green-soft-bg)] text-[var(--color-green)]
        rounded-full font-mono text-[11.5px] font-medium
        hover:bg-[rgba(27,217,106,0.22)] transition"
    >
      {copied ? <Check size={11} strokeWidth={2.6} /> : <Copy size={11} />}
      <span className="truncate">{address}</span>
    </button>
  );
}

function StatusBadge({ running }: { running: boolean }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 h-8 rounded-full",
        "text-[12px] font-medium tracking-wide",
        running
          ? "bg-[var(--color-green-soft-bg)] text-[var(--color-green)] border-0"
          : "bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]",
      )}
    >
      <span
        className={cn(
          "h-[7px] w-[7px] rounded-full",
          running
            ? "bg-[var(--color-green)] shadow-[0_0_8px_rgba(27,217,106,0.6)]"
            : "bg-[var(--color-text-faint)]",
        )}
      />
      {running ? "EN LIGNE" : "HORS LIGNE"}
    </div>
  );
}
