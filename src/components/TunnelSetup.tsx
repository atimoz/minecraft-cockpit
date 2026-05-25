import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  X,
} from "lucide-react";
import { useState } from "react";
import { useNetworkInfo } from "../hooks/useNetworkInfo";
import { api, type AppConfig } from "../lib/tauri";

type Props = {
  config: AppConfig;
  onConfigChange: (next: AppConfig) => void;
};

export function TunnelSetup({ config, onConfigChange }: Props) {
  const network = useNetworkInfo();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const address = config.tunnel_address;
  // Show the section if the user is behind CGNAT (cellular) or has a tunnel already
  const visible = (network?.behind_cgnat ?? false) || !!address;
  if (!visible) return null;

  const save = async () => {
    const v = draft.trim();
    if (!v) return;
    setSaving(true);
    try {
      const next = await api.setTunnelAddress(v);
      onConfigChange(next);
      setDraft("");
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    const next = await api.setTunnelAddress(null);
    onConfigChange(next);
  };

  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="card mb-3.5 px-5 py-4"
    >
      <AnimatePresence mode="wait" initial={false}>
        {address ? (
          <motion.div
            key="active"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-[8px] bg-[var(--color-green-soft-bg)]"
          >
            <div className="h-8 w-8 rounded-[8px] bg-[var(--color-green)] text-[var(--color-bg-app)] flex items-center justify-center shrink-0">
              <Check size={16} strokeWidth={2.6} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--color-green)]">
                Tunnel actif · Adresse publique
              </div>
              <div className="font-mono text-[14px] font-medium text-[var(--color-text)] truncate mt-0.5 allow-select">
                {address}
              </div>
            </div>
            <button
              onClick={copy}
              className={
                "inline-flex items-center gap-1.5 px-2.5 h-[30px] rounded-[8px] text-[12px] font-medium border transition " +
                (copied
                  ? "bg-[var(--color-green-soft-bg)] border-transparent text-[var(--color-green)]"
                  : "bg-[var(--color-bg-surface)] border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg-surface-2)]")
              }
            >
              {copied ? <Check size={12} strokeWidth={2.6} /> : <Copy size={12} />}
              {copied ? "Copié" : "Copier"}
            </button>
            <button
              onClick={clear}
              className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] rounded transition"
              title="Retirer le tunnel"
            >
              <X size={14} />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="setup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="h-[30px] w-[30px] rounded-[8px] bg-[var(--color-green-soft-bg)] text-[var(--color-green)] flex items-center justify-center shrink-0">
                <ArrowRight size={15} strokeWidth={2} />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-[var(--color-text)]">
                  Active un tunnel pour permettre aux joueurs externes de te rejoindre
                </div>
                <div className="text-[11.5px] text-[var(--color-text-muted)] mt-0.5">
                  Tu es derrière CGNAT — les connexions entrantes sont impossibles sans tunnel.
                </div>
              </div>
            </div>
            <div className="text-[12px] text-[var(--color-text-muted)] leading-[1.55] mb-2.5">
              Le plus simple :{" "}
              <a
                href="https://playit.gg/download"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-green)] font-medium hover:underline inline-flex items-center gap-0.5"
              >
                installe playit.gg
                <ExternalLink size={11} />
              </a>{" "}
              (gratuit, agent léger conçu pour Minecraft), suis l'assistant pour récupérer ton adresse, puis colle-la ici :
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
                placeholder="ex: peaceful-sparkling-fox.gl.joinmc.link"
                className="flex-1 h-8 px-3 bg-[var(--color-bg-surface-3)] border border-transparent
                  rounded-[8px] font-mono text-[12.5px] text-[var(--color-text)]
                  outline-none focus:border-[var(--color-green)] focus:bg-[var(--color-bg-app)]
                  transition allow-select placeholder:text-[var(--color-text-faint)]"
              />
              <button
                onClick={save}
                disabled={!draft.trim() || saving}
                className="h-8 px-4 rounded-[8px] bg-[var(--color-green)] text-[var(--color-bg-app)]
                  text-[12px] font-semibold hover:bg-[var(--color-green-strong)] transition
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Activer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
