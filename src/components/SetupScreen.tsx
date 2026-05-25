import { motion } from "framer-motion";
import { ArrowRight, Box, FolderOpen } from "lucide-react";
import { useState } from "react";
import { api, isMac, type AppConfig } from "../lib/tauri";

type Props = {
  onDone: (config: AppConfig) => void;
};

export function SetupScreen({ onDone }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await api.pickServerFolder();
      if (cfg && cfg.server_folder) onDone(cfg);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-10 py-8 bg-[var(--color-bg-app-2)]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-md w-full text-center"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 20 }}
          className="mx-auto h-[72px] w-[72px] rounded-[18px] flex items-center justify-center
            bg-gradient-to-br from-[var(--color-green)] to-[var(--color-green-strong)]
            text-[var(--color-bg-app)]
            shadow-[0_20px_50px_-15px_rgba(27,217,106,0.55)]"
        >
          <Box size={34} strokeWidth={1.8} />
        </motion.div>

        <h1 className="mt-7 text-[26px] font-bold tracking-tight">Bienvenue</h1>
        <p className="mt-2 text-[14px] text-[var(--color-text-muted)] leading-relaxed">
          Pour commencer, sélectionne le dossier de ton serveur Minecraft.
          <br />
          Il doit contenir un script de lancement{" "}
          {isMac ? (
            <>
              (<code className="font-mono text-[13px] text-[var(--color-text)]">run.sh</code>
              {" "}ou{" "}
              <code className="font-mono text-[13px] text-[var(--color-text)]">start.command</code>).
            </>
          ) : (
            <>
              (<code className="font-mono text-[13px] text-[var(--color-text)]">run.bat</code>
              {" "}ou{" "}
              <code className="font-mono text-[13px] text-[var(--color-text)]">start.bat</code>).
            </>
          )}
        </p>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={pick}
          disabled={loading}
          className="mt-8 inline-flex items-center gap-2.5 px-5 h-10 rounded-full
            bg-[var(--color-green)] hover:bg-[var(--color-green-strong)]
            text-[var(--color-bg-app)] font-semibold text-[14px] transition
            shadow-[0_8px_24px_-8px_rgba(27,217,106,0.55)]
            disabled:opacity-50"
        >
          <FolderOpen size={16} strokeWidth={2.2} />
          {loading ? "Sélection…" : "Choisir le dossier"}
          <ArrowRight size={15} strokeWidth={2.4} />
        </motion.button>

        {error && (
          <p className="mt-4 text-[12px] text-[var(--color-danger)]">{error}</p>
        )}

        <p className="mt-8 text-[11px] text-[var(--color-text-faint)]">
          Tu pourras changer cela à tout moment dans les réglages.
        </p>
      </motion.div>
    </div>
  );
}
