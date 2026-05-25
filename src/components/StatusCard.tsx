import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Play, Square } from "lucide-react";
import { useState } from "react";
import { api, type ServerStatus } from "../lib/tauri";
import { formatUptime } from "../lib/utils";

type Props = {
  status: ServerStatus;
};

export function StatusCard({ status }: Props) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (status.running) await api.stopServer();
      else await api.startServer();
    } finally {
      setTimeout(() => setBusy(false), 600);
    }
  };

  return (
    <div className="card p-6 flex flex-col items-center text-center relative overflow-hidden shrink-0">
      <div
        className={`text-[11px] font-semibold tracking-[0.14em] transition-colors ${
          status.running ? "text-[var(--color-green)]" : "text-[var(--color-text-faint)]"
        }`}
      >
        {status.running ? "EN LIGNE" : "HORS LIGNE"}
      </div>

      <motion.button
        onClick={toggle}
        disabled={busy}
        whileTap={{ scale: 0.94 }}
        whileHover={{ scale: 1.03 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
        className={`relative mt-3.5 h-[110px] w-[110px] rounded-full flex items-center justify-center
          disabled:cursor-wait transition-colors ${
            status.running
              ? "bg-[var(--color-danger)] text-white shadow-[0_12px_32px_-10px_rgba(240,82,74,0.5)]"
              : "bg-[var(--color-green)] text-[var(--color-bg-app)] shadow-[0_12px_32px_-10px_rgba(27,217,106,0.5)]"
          }`}
      >
        {status.running && !busy && (
          <span
            className="absolute inset-0 rounded-full border-2 pulse-ring pointer-events-none"
            style={{ borderColor: "var(--color-danger)" }}
          />
        )}

        <AnimatePresence mode="wait">
          {busy ? (
            <motion.div
              key="busy"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
            >
              <Loader2 size={38} strokeWidth={2} className="animate-spin" />
            </motion.div>
          ) : status.running ? (
            <motion.div
              key="stop"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
            >
              <Square size={32} fill="currentColor" stroke="currentColor" />
            </motion.div>
          ) : (
            <motion.div
              key="play"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              className="pl-1"
            >
              <Play size={40} fill="currentColor" stroke="currentColor" strokeWidth={0} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      <div className="mt-4 flex items-center gap-5">
        <Stat label="Uptime" value={formatUptime(status.uptime_secs)} />
        <div className="h-[26px] w-px bg-[var(--color-border)]" />
        <Stat label="PID" value={status.pid ? `#${status.pid}` : "—"} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center min-w-[60px]">
      <div className="text-[10px] tracking-[0.12em] font-semibold text-[var(--color-text-faint)]">
        {label.toUpperCase()}
      </div>
      <div className="mt-0.5 text-[14px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}
