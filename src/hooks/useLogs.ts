import { useEffect, useState } from "react";
import { api, type LogLine } from "../lib/tauri";

const MAX_LINES = 500;

export function useLogs(): LogLine[] {
  const [logs, setLogs] = useState<LogLine[]>([]);

  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | null = null;

    api.onLog((line) => {
      if (!mounted) return;
      setLogs((prev) => {
        const next = prev.length >= MAX_LINES ? prev.slice(-MAX_LINES + 1) : prev;
        return [...next, line];
      });
    }).then((u) => {
      unlisten = u;
    });

    return () => {
      mounted = false;
      unlisten?.();
    };
  }, []);

  return logs;
}
