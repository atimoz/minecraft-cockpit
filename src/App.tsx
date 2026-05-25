import { useEffect, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { SetupScreen } from "./components/SetupScreen";
import { TitleBar } from "./components/TitleBar";
import { api, type AppConfig } from "./lib/tauri";

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.getConfig().then((c) => {
      setConfig(c);
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[var(--color-bg-app)]">
        <div className="text-[12px] text-[var(--color-text-faint)]">Chargement…</div>
      </div>
    );
  }

  const hasFolder = !!config?.server_folder;

  return (
    <div className="h-full w-full flex flex-col bg-[var(--color-bg-app)] border border-[var(--color-border)] rounded-[14px] overflow-hidden">
      <TitleBar />
      {hasFolder && config ? (
        <Dashboard config={config} />
      ) : (
        <SetupScreen onDone={setConfig} />
      )}
    </div>
  );
}
