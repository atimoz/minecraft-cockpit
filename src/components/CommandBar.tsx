import { ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../lib/tauri";

type Props = {
  enabled: boolean;
};

export function CommandBar({ enabled }: Props) {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const ref = useRef<HTMLInputElement>(null);

  const send = async () => {
    const cmd = value.trim();
    if (!cmd || !enabled) return;
    await api.sendCommand(cmd);
    setHistory((h) => [cmd, ...h].slice(0, 50));
    setHistIdx(-1);
    setValue("");
  };

  return (
    <div
      className={`card h-11 px-3.5 flex items-center gap-3 transition-opacity ${
        enabled ? "opacity-100" : "opacity-45 pointer-events-none"
      }`}
    >
      <ChevronRight size={14} strokeWidth={2.4} className="text-[var(--color-green)] shrink-0" />
      <input
        ref={ref}
        value={value}
        disabled={!enabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") send();
          if (e.key === "ArrowUp" && history.length) {
            e.preventDefault();
            const next = Math.min(histIdx + 1, history.length - 1);
            setHistIdx(next);
            setValue(history[next]);
          }
          if (e.key === "ArrowDown" && histIdx >= 0) {
            e.preventDefault();
            const next = histIdx - 1;
            setHistIdx(next);
            setValue(next < 0 ? "" : history[next]);
          }
        }}
        placeholder={
          enabled
            ? "say bonjour    ·    op username    ·    /help"
            : "Démarre le serveur pour envoyer des commandes"
        }
        className="flex-1 bg-transparent outline-none font-mono text-[12.5px]
          text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] allow-select"
      />
      {value && enabled && (
        <button
          onClick={send}
          className="text-[11px] font-semibold tracking-wide
            text-[var(--color-bg-app)] bg-[var(--color-green)]
            hover:bg-[var(--color-green-strong)]
            px-3 h-[26px] rounded-md transition"
        >
          ENVOYER ⏎
        </button>
      )}
    </div>
  );
}
