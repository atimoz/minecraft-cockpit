import { AnimatePresence, motion } from "framer-motion";
import { Users } from "lucide-react";
import { memo, useEffect, useState } from "react";
import type { Player } from "../lib/tauri";
import { formatDuration } from "../lib/utils";

type Props = {
  players: Player[];
};

export function PlayersList({ players }: Props) {
  return (
    <div className="card flex flex-col h-full min-h-0">
      <div className="px-5 pt-3.5 pb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[var(--color-text)]">
          <Users size={14} strokeWidth={2} className="text-[var(--color-text-faint)]" />
          <span className="text-[13px] font-semibold">Joueurs connectés</span>
        </div>
        <div
          className="inline-flex items-center h-5 px-2 rounded-full
            bg-[var(--color-bg-surface-3)] text-[var(--color-text-muted)]
            text-[11px] font-medium tabular-nums"
        >
          {players.length}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
        {players.length === 0 ? (
          <EmptyState />
        ) : (
          <motion.ul className="space-y-0.5" layout>
            <AnimatePresence initial={false}>
              {players.map((p) => (
                <PlayerRow key={p.name} player={p} />
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>
    </div>
  );
}

const PlayerRow = memo(function PlayerRow({ player }: { player: Player }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="px-3 py-2 rounded-[var(--radius-sm)] flex items-center gap-3
        hover:bg-[var(--color-bg-surface-2)] transition"
    >
      <div className="relative">
        <div
          className="h-8 w-8 rounded-[8px] flex items-center justify-center
            bg-[var(--color-green-soft-bg)] text-[var(--color-green)]
            font-bold text-[13px]"
        >
          {player.name[0]?.toUpperCase()}
        </div>
        <div
          className="absolute -bottom-px -right-px h-2 w-2 rounded-full
            bg-[var(--color-green)] ring-2 ring-[var(--color-bg-surface)]"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold truncate">{player.name}</div>
        <div className="text-[11px] font-mono text-[var(--color-text-faint)] truncate allow-select">
          {player.ip}:{player.port}
        </div>
      </div>

      <ConnectedSince since={player.connected_at} />
    </motion.li>
  );
});

function ConnectedSince({ since }: { since: number }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="text-[11px] text-[var(--color-text-muted)] tabular-nums shrink-0">
      {formatDuration(now - since)}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full min-h-[120px] flex flex-col items-center justify-center text-center px-6 py-6">
      <div
        className="h-10 w-10 rounded-[10px] flex items-center justify-center
          bg-[var(--color-bg-surface-3)] mb-2.5"
      >
        <Users size={16} className="text-[var(--color-text-faint)]" />
      </div>
      <p className="text-[12px] text-[var(--color-text-muted)]">Personne pour l'instant</p>
      <p className="mt-1 text-[11px] text-[var(--color-text-faint)]">
        Les joueurs apparaîtront dès qu'ils se connecteront.
      </p>
    </div>
  );
}
