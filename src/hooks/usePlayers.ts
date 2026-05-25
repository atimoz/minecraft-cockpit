import { useEffect, useState } from "react";
import { api, type Player } from "../lib/tauri";

export function usePlayers(): Player[] {
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | null = null;

    api.getPlayers().then((p) => {
      if (mounted) setPlayers(p);
    });

    api.onPlayers((p) => {
      if (mounted) setPlayers(p);
    }).then((u) => {
      unlisten = u;
    });

    return () => {
      mounted = false;
      unlisten?.();
    };
  }, []);

  return players;
}
