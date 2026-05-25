import { Terminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LogLine } from "../lib/tauri";
import { cn } from "../lib/utils";

type Props = {
  logs: LogLine[];
};

export function Console({ logs }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(true);

  useEffect(() => {
    if (!stuck || !ref.current) return;
    ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs, stuck]);

  const onScroll = () => {
    if (!ref.current) return;
    const { scrollTop, scrollHeight, clientHeight } = ref.current;
    setStuck(scrollHeight - scrollTop - clientHeight < 32);
  };

  return (
    <div className="card flex flex-col h-full min-h-0 overflow-hidden">
      <div className="px-5 pt-3.5 pb-2.5 flex items-center justify-between bg-[var(--color-bg-surface)] shrink-0">
        <div className="flex items-center gap-2 text-[var(--color-text)]">
          <Terminal size={14} strokeWidth={2} className="text-[var(--color-text-faint)]" />
          <span className="text-[13px] font-semibold">Console</span>
        </div>
        <div className="flex items-center gap-2">
          {!stuck && (
            <button
              onClick={() => {
                setStuck(true);
                if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
              }}
              className="text-[11px] text-[var(--color-green)] hover:text-[var(--color-green-strong)] font-medium"
            >
              ↓ Suivre
            </button>
          )}
          <div className="text-[11px] text-[var(--color-text-faint)] tabular-nums">
            {logs.length} lignes
          </div>
        </div>
      </div>

      <div
        ref={ref}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-4 pb-3 pt-1 font-mono text-[11.5px]
          leading-[1.65] allow-select min-h-0 bg-[#0d0f12]"
      >
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-[11.5px] text-[var(--color-text-faint)] italic">
              En attente des logs du serveur…
            </p>
          </div>
        ) : (
          logs.map((l, i) => <LogRow key={i} line={l} />)
        )}
      </div>
    </div>
  );
}

const LEVEL_STYLES: Record<LogLine["level"], string> = {
  INFO: "text-[var(--color-text)]",
  WARN: "text-[var(--color-warn)]",
  ERROR: "text-[var(--color-danger)]",
  DEBUG: "text-[var(--color-text-faint)]",
  RAW: "text-[var(--color-text-muted)]",
};

function LogRow({ line }: { line: LogLine }) {
  const time = new Date(line.ts * 1000).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex gap-3 hover:bg-white/[0.03] -mx-2 px-2 rounded">
      <span className="text-[var(--color-text-faint)] tabular-nums shrink-0">{time}</span>
      <span
        className={cn(
          "shrink-0 w-[42px] text-[10px] font-semibold tracking-wider pt-[2px]",
          LEVEL_STYLES[line.level],
        )}
      >
        {line.level !== "RAW" ? line.level : ""}
      </span>
      <span className={cn("break-all", LEVEL_STYLES[line.level])}>{line.text}</span>
    </div>
  );
}
