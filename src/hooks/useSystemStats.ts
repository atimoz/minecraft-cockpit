import { useEffect, useState } from "react";
import { api, type SystemStats } from "../lib/tauri";

export function useSystemStats(): SystemStats {
  const [stats, setStats] = useState<SystemStats>({
    cpu_percent: 0,
    ram_mb: 0,
    ram_max_mb: null,
  });

  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | null = null;

    api.onStats((s) => {
      if (mounted) setStats(s);
    }).then((u) => {
      unlisten = u;
    });

    return () => {
      mounted = false;
      unlisten?.();
    };
  }, []);

  return stats;
}
