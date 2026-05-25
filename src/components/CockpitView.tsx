import { motion } from "framer-motion";
import { useLogs } from "../hooks/useLogs";
import { usePlayers } from "../hooks/usePlayers";
import { useServerStatus } from "../hooks/useServerStatus";
import { useSystemStats } from "../hooks/useSystemStats";
import type { AppConfig } from "../lib/tauri";
import { CommandBar } from "./CommandBar";
import { Console } from "./Console";
import { NetworkBanner } from "./NetworkBanner";
import { PlayersList } from "./PlayersList";
import { StatsCard } from "./StatsCard";
import { StatusCard } from "./StatusCard";
import { TunnelSetup } from "./TunnelSetup";

type Props = {
  config: AppConfig;
  onConfigChange: (next: AppConfig) => void;
};

export function CockpitView({ config, onConfigChange }: Props) {
  const status = useServerStatus();
  const players = usePlayers();
  const logs = useLogs();
  const stats = useSystemStats();

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="flex-1 flex flex-col min-h-0 px-6 py-5"
    >
      <NetworkBanner />
      <TunnelSetup config={config} onConfigChange={onConfigChange} />

      <div className="grid grid-cols-12 gap-3.5 flex-1 min-h-0">
        {/* Left column */}
        <div className="col-span-5 flex flex-col gap-3.5 min-h-0">
          <StatusCard status={status} />
          <StatsCard stats={stats} running={status.running} />
          <div className="flex-1 min-h-0">
            <PlayersList players={players} />
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-7 flex flex-col gap-3.5 min-h-0">
          <div className="flex-1 min-h-0">
            <Console logs={logs} />
          </div>
          <CommandBar enabled={status.running} />
        </div>
      </div>
    </motion.div>
  );
}
