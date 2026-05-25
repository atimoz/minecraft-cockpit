import { useEffect, useState } from "react";
import { api, type NetworkInfo } from "../lib/tauri";

export function useNetworkInfo(): NetworkInfo | null {
  const [info, setInfo] = useState<NetworkInfo | null>(null);

  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | null = null;

    api.getNetworkInfo().then((n) => mounted && setInfo(n));

    api.onNetwork((n) => mounted && setInfo(n)).then((u) => {
      unlisten = u;
    });

    return () => {
      mounted = false;
      unlisten?.();
    };
  }, []);

  return info;
}
