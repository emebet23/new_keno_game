import { useState } from "react";
import { authApi } from "../lib/api";
import { useAppStore } from "../lib/store";
import { useQueryClient } from "@tanstack/react-query";
import { playSound } from "../lib/sound";
import { KeyRound, X } from "lucide-react";

export default function DevLoginModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { setCurrentUser, setActiveTab } = useAppStore();

  const [telegramId, setTelegramId] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (customId?: string) => {
    setLoading(true);
    setErrorMsg("");

    try {
      const id = customId || telegramId;
      if (!id) {
        setErrorMsg("Telegram ID is required");
        setLoading(false);
        return;
      }

      const res = await authApi.loginTelegram({ telegramId: id });
      setCurrentUser(res.user);

      qc.invalidateQueries();

      setActiveTab(res.user.role === "ADMIN" || res.user.role === "SUPERADMIN" ? "admin" : "home");

      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.response?.data?.message || err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="glass-card border border-[#C084FC]/40 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl shadow-[#C084FC]/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#C084FC]/20 text-[#C084FC]">
              <KeyRound size={22} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Dev Login</h3>
              <p className="text-[11px] text-slate-400">Login with Telegram ID</p>
            </div>
          </div>
          <button
            onClick={() => { playSound(); onClose(); }}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">Telegram ID</label>
            <input
              type="text"
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value)}
              placeholder="Enter Telegram ID"
              className="w-full px-3 py-2 rounded-lg bg-[#000000] border border-white/10 text-white font-mono focus:outline-none focus:border-[#C084FC]"
            />
          </div>
        </div>

        {errorMsg && (
          <div className="text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg text-center">
            {errorMsg}
          </div>
        )}

        <button
          onClick={() => { playSound('success'); handleLogin(); }}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#C084FC] via-[#22D3EE] to-[#C084FC] text-black font-extrabold text-xs shadow-lg shadow-[#C084FC]/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
        >
          {loading ? "Authenticating..." : "Login"}
        </button>
      </div>
    </div>
  );
}
