import { useEffect, useState } from "react";
import { api, type ServerStatus } from "../lib/tauri";

export function useServerStatus(): ServerStatus {
  const [status, setStatus] = useState<ServerStatus>({
    running: false,
    pid: null,
    uptime_secs: 0,
  });

  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | null = null;

    api.getServerStatus().then((s) => {
      if (mounted) setStatus(s);
    });

    api.onStatus((s) => {
      if (mounted) setStatus(s);
    }).then((u) => {
      unlisten = u;
    });

    // Tick uptime locally every second while running
    const tick = setInterval(() => {
      setStatus((s) =>
        s.running ? { ...s, uptime_secs: s.uptime_secs + 1 } : s,
      );
    }, 1000);

    // Re-sync with backend every 10s to correct drift
    const resync = setInterval(() => {
      api.getServerStatus().then((s) => {
        if (mounted) setStatus(s);
      });
    }, 10000);

    return () => {
      mounted = false;
      clearInterval(tick);
      clearInterval(resync);
      unlisten?.();
    };
  }, []);

  return status;
}
