import { motion } from "framer-motion";
import { Cpu, MemoryStick } from "lucide-react";
import { useEffect, useRef } from "react";
import type { SystemStats } from "../lib/tauri";

type Props = {
  stats: SystemStats;
  running: boolean;
};

export function StatsCard({ stats, running }: Props) {
  const ramPct = stats.ram_max_mb
    ? Math.min(100, (stats.ram_mb / stats.ram_max_mb) * 100)
    : 0;
  const cpuPct = Math.min(100, stats.cpu_percent);

  return (
    <div className="card px-5 py-4.5 shrink-0">
      <div className="text-[10px] font-semibold tracking-[0.14em] text-[var(--color-text-faint)] mb-3.5">
        SYSTÈME
      </div>

      <div className="space-y-3.5">
        <Bar
          icon={<Cpu size={13} strokeWidth={2} />}
          label="CPU"
          value={cpuPct}
          display={`${cpuPct.toFixed(1)}%`}
          active={running}
        />
        <Bar
          icon={<MemoryStick size={13} strokeWidth={2} />}
          label="RAM"
          value={ramPct}
          display={
            stats.ram_max_mb
              ? `${(stats.ram_mb / 1024).toFixed(2)} / ${(stats.ram_max_mb / 1024).toFixed(0)} GB`
              : `${(stats.ram_mb / 1024).toFixed(2)} GB`
          }
          active={running}
        />
      </div>
    </div>
  );
}

function Bar({
  icon,
  label,
  value,
  display,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  display: string;
  active: boolean;
}) {
  const prev = useAnimatedNumber(value);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
          <span className="text-[var(--color-text-faint)]">{icon}</span>
          <span className="text-[12px] font-medium">{label}</span>
        </div>
        <span className="text-[12px] font-semibold tabular-nums">
          {active ? display : "—"}
        </span>
      </div>
      <div className="h-[5px] rounded-full bg-[var(--color-bg-surface-3)] overflow-hidden">
        <motion.div
          className="h-full bg-[var(--color-green)] rounded-full"
          style={{ width: `${active ? prev : 0}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
        />
      </div>
    </div>
  );
}

function useAnimatedNumber(target: number): number {
  const ref = useRef(target);
  ref.current = ref.current + (target - ref.current) * 0.35;
  useEffect(() => {
    ref.current = target;
  }, [target]);
  return ref.current;
}
