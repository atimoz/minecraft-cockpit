import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useServerStatus } from "../hooks/useServerStatus";
import type { AppConfig } from "../lib/tauri";
import { CockpitView } from "./CockpitView";
import { ModsView } from "./ModsView";
import { ProjectHeader } from "./ProjectHeader";
import { ServerSettings } from "./ServerSettings";
import { Sidebar, type TabId } from "./Sidebar";

type Props = {
  config: AppConfig;
};

export function Dashboard({ config: initialConfig }: Props) {
  const [tab, setTab] = useState<TabId>("cockpit");
  const [config, setConfig] = useState<AppConfig>(initialConfig);
  const status = useServerStatus();

  return (
    <div className={`flex-1 flex min-h-0 ${status.running ? "server-running" : ""}`}>
      <Sidebar active={tab} onChange={setTab} />

      <main className="flex-1 flex flex-col min-w-0 bg-[var(--color-bg-app-2)]">
        <ProjectHeader folderPath={config.server_folder} status={status} tunnelAddress={config.tunnel_address} />

        <div className="flex-1 flex min-h-0">
          <AnimatePresence mode="wait" initial={false}>
            {tab === "cockpit" && (
              <CockpitView key="cockpit" config={config} onConfigChange={setConfig} />
            )}
            {tab === "settings" && <ServerSettings key="settings" />}
            {tab === "mods" && <ModsView key="mods" />}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
