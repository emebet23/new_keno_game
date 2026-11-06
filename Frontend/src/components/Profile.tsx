import { useState } from "react";
import { useAppStore } from "../lib/store";
import { playSound } from "../lib/sound";
import { useWallet, useHistory } from "../lib/hooks";
import {
  Settings as SettingsIcon,
  ShieldCheck,
  Wallet as WalletIcon,
  Award,
  ChevronRight,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

export default function Profile() {
  const {
    currentUser,
    language,
    clientSeed,
    setClientSeed,
    setActiveTab,
  } = useAppStore();

  const { data: wallet } = useWallet();
  const { data: historyData } = useHistory(1, 100);

  const [customSeed, setCustomSeed] = useState(clientSeed);
  const [seedSavedMsg, setSeedSavedMsg] = useState("");

  const historyItems: any[] = Array.isArray(historyData?.items)
    ? historyData.items
    : Array.isArray(historyData?.history)
      ? historyData.history
      : [];
  const totalGames = Number(historyData?.total || historyItems.length || 0);
  const winnings = historyData?.totalWinnings != null
    ? Number(historyData.totalWinnings)
    : historyItems.reduce((sum, t) => sum + Number(t.payout || 0), 0);
  const bets = historyData?.totalBets != null
    ? Number(historyData.totalBets)
    : historyItems.reduce((sum, t) => sum + Number(t.betAmount || 0), 0);
  const wonCount = historyItems.filter((t) => t.status === "WON").length;
  const winRate = totalGames > 0 ? Math.round((wonCount / totalGames) * 100) : 0;

  const handleGenerateRandomSeed = () => {
    const randomSeed = "seed_" + Math.random().toString(36).substring(2, 12);
    setCustomSeed(randomSeed);
    setClientSeed(randomSeed);
    setSeedSavedMsg(language === "am" ? "አዲስ ሴድ ተቀይሯል!" : "New Client Seed Saved!");
    setTimeout(() => setSeedSavedMsg(""), 3000);
  };

  const handleSaveSeed = () => {
    if (customSeed.trim()) {
      setClientSeed(customSeed.trim());
      setSeedSavedMsg(language === "am" ? "ሴድ በተሳካ ሁኔታ ተቀምጧል!" : "Client Seed Saved!");
      setTimeout(() => setSeedSavedMsg(""), 3000);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. USER PROFILE CARD */}
      <div className="glass-card rounded-2xl p-5 border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#C084FC]/20 to-[#22D3EE]/20 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#C084FC] via-[#22D3EE] to-white flex items-center justify-center text-black font-black text-2xl shadow-xl shadow-[#C084FC]/30">
            {currentUser?.firstName?.[0] || currentUser?.username?.[0] || "K"}
          </div>

          <div className="flex-1 min-w-0">
            <div>
              <h2 className="text-base font-extrabold text-white truncate">
                {currentUser?.firstName
                  ? `${currentUser.firstName} ${currentUser.lastName || ""}`
                  : `@${currentUser?.username || "keno_player"}`}
              </h2>
            </div>

            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              Telegram ID: {currentUser?.telegramId || "123456789"}
            </div>
          </div>
        </div>
      </div>

      {/* 2. WALLET SUMMARY & QUICK ACTIONS */}
      <div className="glass-card rounded-2xl p-4 border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <WalletIcon className="text-[#C084FC]" size={16} />
            <span>{language === "am" ? "የኪስ ቦርሳ ሁኔታ" : "Wallet Balances"}</span>
          </div>
          <button
            onClick={() => { playSound(); setActiveTab("wallet"); }}
            className="text-xs text-[#22D3EE] font-bold flex items-center gap-1 hover:underline"
          >
            {language === "am" ? "ዝርዝር ይመልከቱ" : "Manage Wallet"} <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-[#000000] p-2.5 rounded-xl border border-white/5">
            <span className="text-slate-400 text-[10px] block">Play Balance</span>
            <span className="font-bold text-[#C084FC] text-sm">
              {Number(wallet?.playBalance || 0).toFixed(2)} ETB
            </span>
          </div>
          <div className="bg-[#000000] p-2.5 rounded-xl border border-white/5">
            <span className="text-slate-400 text-[10px] block">Main Balance</span>
            <span className="font-bold text-[#22D3EE] text-sm">
              {Number(wallet?.mainBalance || 0).toFixed(2)} ETB
            </span>
          </div>
        </div>
      </div>

      {/* 3. CAREER PERFORMANCE STATS */}
      <div className="glass-card rounded-2xl p-4 space-y-3 border border-white/10">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
          <Award className="text-[#C084FC]" size={18} />
          <span>{language === "am" ? "የጨዋታ ታሪክ ስታቲስቲክስ" : "Career Performance Stats"}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-[#000000] p-2.5 rounded-xl border border-white/5">
            <div className="text-slate-400 text-[10px]">Total Played</div>
            <div className="font-extrabold text-white text-sm mt-0.5">{totalGames}</div>
          </div>
          <div className="bg-[#000000] p-2.5 rounded-xl border border-white/5">
            <div className="text-slate-400 text-[10px]">Winnings</div>
            <div className="font-extrabold text-emerald-400 text-sm mt-0.5">{winnings.toFixed(0)} ETB</div>
          </div>
          <div className="bg-[#000000] p-2.5 rounded-xl border border-white/5">
            <div className="text-slate-400 text-[10px]">Win Rate</div>
            <div className="font-extrabold text-[#22D3EE] text-sm mt-0.5">{winRate}%</div>
          </div>
        </div>
      </div>

      {/* 4. SETTINGS LINK */}
      <button
        onClick={() => { playSound(); setActiveTab("settings"); }}
        className="w-full glass-card rounded-2xl p-4 border border-white/10 flex items-center justify-between hover:bg-white/5 transition-all"
      >
        <div className="flex items-center gap-2.5 text-xs text-slate-200 font-semibold">
          <SettingsIcon className="text-[#C084FC]" size={18} />
          <div className="text-left">
            <div>{language === "am" ? "ማስተካከያዎች" : "Settings"}</div>
            <div className="text-[10px] text-slate-400 font-normal">
              {language === "am" ? "ድምፅ፣ ቋንቋ እና ሌሎችም" : "Sound, Language & more"}
            </div>
          </div>
        </div>
        <ChevronRight size={18} className="text-slate-400" />
      </button>

      {/* 4. PROVABLY FAIR SEED SETTINGS */}
      <div className="glass-card rounded-2xl p-4 space-y-3 border border-white/10">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
          <ShieldCheck className="text-emerald-400" size={18} />
          <span>{language === "am" ? "ፍትሃዊነት (Provably Fair Client Seed)" : "Provably Fair Client Seed"}</span>
        </div>
        <p className="text-[11px] text-slate-400">
          {language === "am"
            ? "የእርስዎን የራሶት ሴድ በማስገባት የእጣ ውጤቱን ትክክለኛነት ማረጋገጥ ይችላሉ።"
            : "Customize your client seed to guarantee seed entropy and deterministic fairness."}
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={customSeed}
            onChange={(e) => setCustomSeed(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg bg-[#000000] border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-[#C084FC]"
          />
          <button
            onClick={() => { playSound(); handleGenerateRandomSeed(); }}
            className="p-2 rounded-lg bg-[#12121c] text-[#22D3EE] hover:bg-[#1a1a2e] border border-white/10"
            title="Generate Random Seed"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {seedSavedMsg && (
          <div className="text-emerald-400 text-xs bg-emerald-500/10 p-2 rounded-lg text-center flex items-center justify-center gap-1">
            <CheckCircle2 size={14} /> {seedSavedMsg}
          </div>
        )}

        <button
          onClick={() => { playSound('success'); handleSaveSeed(); }}
          className="w-full py-2 rounded-xl bg-[#22D3EE] text-black font-bold text-xs hover:opacity-90 transition-all"
        >
          {language === "am" ? "ሴድ አስቀምጥ" : "Save Custom Client Seed"}
        </button>
      </div>

    </div>
  );
}
