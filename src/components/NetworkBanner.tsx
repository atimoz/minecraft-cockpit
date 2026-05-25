import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Cable,
  Check,
  RotateCw,
  Signal,
  Wifi,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api, type NetworkInfo, type NetworkProfile } from "../lib/tauri";
import { cn } from "../lib/utils";

const TYPE_LABELS: Record<NetworkInfo["type"], string> = {
  wifi: "Wi-Fi",
  cellular: "Mobile",
  ethernet: "Ethernet",
  unknown: "Inconnu",
};

function NetIcon({ type, size = 18 }: { type: NetworkInfo["type"]; size?: number }) {
  if (type === "cellular") return <Signal size={size} strokeWidth={2} />;
  if (type === "ethernet") return <Cable size={size} strokeWidth={2} />;
  return <Wifi size={size} strokeWidth={2} />;
}

export function NetworkBanner() {
  const [info, setInfo] = useState<NetworkInfo | null>(null);
  const [profile, setProfile] = useState<NetworkProfile>("home");
  const [autoDetect, setAutoDetect] = useState(true);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | null = null;

    api.getNetworkInfo().then((n) => mounted && setInfo(n));
    api.getActiveProfile().then((p) => mounted && setProfile(p));

    api.onNetwork((n) => mounted && setInfo(n)).then((u) => {
      unlisten = u;
    });

    return () => {
      mounted = false;
      unlisten?.();
    };
  }, []);

  if (!info) return null;

  const apply = async (p: NetworkProfile) => {
    setProfile(p);
    await api.applyNetworkProfile(p);
  };
  const onSimulate = async () => {
    const next = await api.cycleMockNetwork();
    if (next) setInfo(next);
  };

  const netKey = `${info.name}|${info.type}`;
  const needSuggest =
    autoDetect && info.suggested_profile !== profile && dismissedKey !== netKey;
  const suggestedLabel = info.suggested_profile === "mobile" ? "Mobile" : "Maison";

  return (
    <div
      className={cn(
        "card px-4 py-2.5 mb-3.5 flex items-center gap-3.5 flex-wrap",
        info.type === "cellular" && "border-[rgba(245,197,66,0.25)]",
      )}
    >
      <div
        className={cn(
          "h-[34px] w-[34px] rounded-[8px] flex items-center justify-center shrink-0",
          info.type === "cellular"
            ? "bg-[rgba(245,197,66,0.16)] text-[var(--color-warn)]"
            : "bg-[var(--color-green-soft-bg)] text-[var(--color-green)]",
        )}
      >
        <NetIcon type={info.type} />
      </div>

      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[var(--color-text)]">
            {info.name}
          </span>
          <span className="text-[10px] font-semibold tracking-[0.08em] uppercase text-[var(--color-text-faint)]">
            {TYPE_LABELS[info.type]}
          </span>
        </div>
        <div className="font-mono text-[11px] text-[var(--color-text-faint)] mt-0.5 flex items-center gap-2">
          <span>{info.local_ip} : 25565</span>
          {info.behind_cgnat && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-px rounded-full
                bg-[rgba(245,197,66,0.16)] text-[var(--color-warn)]
                text-[10px] font-semibold tracking-wide font-sans"
            >
              <AlertCircle size={9} strokeWidth={2.6} />
              CGNAT — tunnel requis
            </span>
          )}
        </div>
      </div>

      <div className="h-[26px] w-px bg-[var(--color-border)] mx-1" />

      <ProfilePicker value={profile} onChange={apply} />

      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={() => setAutoDetect((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]"
        >
          <span
            className={cn(
              "relative w-7 h-4 rounded-full transition-colors",
              autoDetect ? "bg-[var(--color-green)]" : "bg-[var(--color-bg-surface-3)]",
            )}
          >
            <motion.span
              layout
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="absolute top-0.5 h-3 w-3 rounded-full bg-white"
              style={{ left: autoDetect ? "14px" : "2px" }}
            />
          </span>
          Détection auto
        </button>
        <button
          onClick={onSimulate}
          className="text-[11px] text-[var(--color-text-faint)] hover:text-[var(--color-text)]
            inline-flex items-center gap-1 transition"
          title="Simuler un changement de réseau"
        >
          <RotateCw size={11} />
          Simuler
        </button>
      </div>

      {/* Suggestion banner */}
      <AnimatePresence>
        {needSuggest && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="basis-full overflow-hidden"
          >
            <div
              className="mt-2 px-3 py-2 flex items-center gap-2.5
                bg-[var(--color-green-soft-bg)] rounded-[8px] text-[12px]"
            >
              <Check size={13} className="text-[var(--color-green)] shrink-0" />
              <div className="flex-1">
                Connexion {TYPE_LABELS[info.type].toLowerCase()} détectée — appliquer le profil{" "}
                <b className="font-semibold">{suggestedLabel}</b> ?
              </div>
              <button
                onClick={() => apply(info.suggested_profile)}
                className="px-2.5 h-[26px] rounded-md bg-[var(--color-green)]
                  text-[var(--color-bg-app)] text-[11px] font-semibold
                  hover:bg-[var(--color-green-strong)] transition"
              >
                Appliquer
              </button>
              <button
                onClick={() => setDismissedKey(netKey)}
                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                title="Masquer"
              >
                <X size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProfilePicker({
  value,
  onChange,
}: {
  value: NetworkProfile;
  onChange: (p: NetworkProfile) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold tracking-[0.12em] text-[var(--color-text-faint)]">
        PROFIL
      </span>
      <div className="inline-flex gap-1 p-[3px] rounded-[8px] bg-[var(--color-bg-surface-3)]">
        {(["home", "mobile"] as NetworkProfile[]).map((p) => {
          const isOn = value === p;
          return (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={cn(
                "px-3 py-[5px] text-[12px] font-medium rounded-[5px] transition-colors",
                isOn
                  ? "bg-[var(--color-green-soft-bg)] text-[var(--color-green)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
              )}
            >
              {p === "home" ? "Maison" : "Mobile"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
