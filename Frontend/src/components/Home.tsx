import { useEffect } from "react";
import { useAppStore } from "../lib/store";
import { playSound } from "../lib/sound";
import { useWallet, useCurrentRound } from "../lib/hooks";
import ClassicCountdown from "./ClassicCountdown";
import {
  Zap,
  Clock,
  Flame,
  ArrowRight,
  Settings,
  ChevronRight,
  Plus,
  Minus,
  Sparkles,
  BadgeCheck,
} from "lucide-react";

const PRESETS = [10, 25, 50, 100, 250];
const STEP = 5;
const MIN_BET = 10;

export default function Home() {
  const {
    setActiveTab,
    gameMode,
    setGameMode,
    selectedNumbers,
    betAmount,
    setBetAmount,
    currentUser,
    language,
    setToast,
  } = useAppStore();

  const { data: wallet } = useWallet();
  const { data: roundData } = useCurrentRound();

  const isAm = language === "am";

  // Dynamic minimum bet set by the admin (falls back to MIN_BET).
  const minBet = Number(roundData?.minBet) || MIN_BET;

  // If the current wager falls below the admin-set minimum, clamp it and warn.
  useEffect(() => {
    if (!roundData?.minBet) return;
    const min = Number(roundData.minBet);
    if (betAmount < min) {
      setBetAmount(min);
      setToast(
        isAm
          ? `ዝቅተኛው የውርርድ መጠን ${min} ETB ነው`
          : `Minimum bet amount is ${min} ETB`
      );
    }
  }, [roundData?.minBet, betAmount, isAm]);

  const str = {
    greeting: isAm ? "እንኳን ደህና መጡ" : "Welcome Back",
    player: isAm ? "የኬኖ ተጫዋች" : "Keno Player",
    settings: isAm ? "ማስተካከያዎች" : "Settings",
    activeRound: isAm ? "ንቁ የክላሲክ ኬኖ" : "Active Classic Round",
    round: (n: number) => (isAm ? `ዙር #${n}` : `Round #${n}`),
    selectMode: isAm ? "የጨዋታ ዓይነት ይምረጡ" : "Select Game Mode",
    instantTitle: isAm ? "ፈጣን ኬኖ" : "Instant Keno",
    instantDesc: isAm
      ? "ቁጥሮች ወዲያውኑ ይወጣሉ፣ ወዲያውኑ ይከፈላል።"
      : "Draws numbers immediately with instant payouts.",
    fastBadge: isAm ? "ፈጣን" : "FAST",
    classicTitle: isAm ? "ክላሲክ ኬኖ" : "Classic Round",
    classicDesc: isAm
      ? "በየ30 ሰከንድ የሚወጡ የቡድን ዙሮች።"
      : "Scheduled multiplayer rounds drawn every 30s.",
    liveBadge: isAm ? "በቀጥታ" : "LIVE",
    selected: isAm ? "ተመርጧል" : "Selected",
    setWager: isAm ? "የውርርድ መጠን ያዘጋጁ" : "Set Wager per Bet",
    custom: isAm ? "ወይም የራስዎን መጠን ያስገቡ" : "Or Enter Custom Amount",
    customPh: isAm ? "የውርርድ መጠን ያስገቡ..." : "Enter custom wager amount...",
    max: isAm ? "ከፍተኛ" : "Max",
    enterWith: isAm
      ? `ወደ ጨዋታ ግቡ (${selectedNumbers.length} ተመርጧል)`
      : `Enter Game (${selectedNumbers.length} Selected)`,
    goBoard: isAm ? "ወደ ጨዋታ ሰሌዳ ይሂዱ" : "Go to Game Board",
  };

  const handleEnterGame = () => {
    setActiveTab("game");
  };

  const adjustBet = (delta: number) => {
    const max = Math.max(minBet, Number(wallet?.totalBalance) || 0);
    const next = Math.min(max, Math.max(minBet, betAmount + delta));
    if (next !== betAmount) {
      playSound("click");
      setBetAmount(next);
    }
  };

  const maxBet = Math.max(minBet, Number(wallet?.totalBalance) || 0);
  const initial = (currentUser?.firstName?.[0] || currentUser?.username?.[0] || "K").toUpperCase();

  return (
    <div className="space-y-5">
      {/* 1. Header: identity + quick actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#C084FC] via-[#22D3EE] to-white flex items-center justify-center text-black font-black text-xl shadow-lg shadow-[#C084FC]/25">
              {initial}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-black" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-slate-400 font-medium leading-tight">{str.greeting}</div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-extrabold text-white truncate max-w-[190px]">
                {currentUser?.firstName || currentUser?.username || str.player}
              </h2>
              <BadgeCheck size={16} className="text-[#22D3EE] shrink-0" />
            </div>
            {(currentUser?.role === "ADMIN" || currentUser?.role === "SUPERADMIN") && (
              <button
                onClick={(e) => { playSound('select'); e.stopPropagation(); setActiveTab("admin"); }}
                className="text-[10px] font-bold text-[#22D3EE] underline cursor-pointer hover:text-white transition-colors"
              >
                [ADMIN]
              </button>
            )}
          </div>
        </div>

        <button
          onClick={() => { playSound("select"); setActiveTab("settings"); }}
          className="p-2.5 rounded-xl bg-[#12121c] border border-white/10 text-slate-300 hover:text-white hover:border-white/25 active:scale-95 transition-all cursor-pointer"
          aria-label={str.settings}
        >
          <Settings size={18} />
        </button>
      </div>

      {/* 2. Active classic round banner */}
      {roundData && (
        <div className="glass-card rounded-2xl p-4 border border-white/10 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22D3EE] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22D3EE]" />
              </span>
              {str.activeRound}
              <span className="font-bold text-[#22D3EE]">{str.round(roundData.roundNumber)}</span>
            </div>
            <ClassicCountdown compact />
          </div>
          <button
            onClick={() => { playSound("select"); setGameMode("CLASSIC"); handleEnterGame(); }}
            className="flex items-center gap-1 shrink-0 text-[11px] font-bold text-black bg-gradient-to-r from-[#C084FC] to-[#22D3EE] px-3.5 py-2 rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            {isAm ? "ይጫወቱ" : "Play"} <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* 4. Game mode selection */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={13} className="text-[#C084FC]" />
            {str.selectMode}
          </div>
          <button
            onClick={() => { playSound("click"); setActiveTab("history"); }}
            className="text-[11px] font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-0.5 cursor-pointer"
          >
            {isAm ? "ታሪክ" : "History"} <ChevronRight size={13} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div
            onClick={() => { playSound('select'); setGameMode("INSTANT"); }}
            className={`relative cursor-pointer rounded-2xl p-4 border transition-all duration-200 group ${
              gameMode === "INSTANT"
                ? "border-[#C084FC] bg-gradient-to-b from-[#C084FC]/15 to-transparent shadow-lg shadow-[#C084FC]/20"
                : "glass-card border-white/5 hover:border-white/20 hover:-translate-y-0.5"
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#C084FC]/30 to-[#C084FC]/5 text-[#C084FC] shadow-inner">
                <Zap size={20} />
              </div>
              <span
                className={`text-[9px] font-black tracking-wider px-2 py-0.5 rounded-full ${
                  gameMode === "INSTANT"
                    ? "bg-[#C084FC] text-black"
                    : "bg-[#C084FC]/10 text-[#C084FC]"
                }`}
              >
                {str.fastBadge}
              </span>
            </div>
            <h3 className="font-extrabold text-sm text-white">{str.instantTitle}</h3>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">{str.instantDesc}</p>

            {gameMode === "INSTANT" && (
              <div className="absolute top-2 right-2">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#C084FC] to-[#22D3EE] flex items-center justify-center text-black">
                  <span className="text-[10px] font-black">✓</span>
                </div>
              </div>
            )}
          </div>

          <div
            onClick={() => { playSound('select'); setGameMode("CLASSIC"); }}
            className={`relative cursor-pointer rounded-2xl p-4 border transition-all duration-200 group ${
              gameMode === "CLASSIC"
                ? "border-[#22D3EE] bg-gradient-to-b from-[#22D3EE]/15 to-transparent shadow-lg shadow-[#22D3EE]/20"
                : "glass-card border-white/5 hover:border-white/20 hover:-translate-y-0.5"
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#22D3EE]/30 to-[#22D3EE]/5 text-[#22D3EE] shadow-inner">
                <Clock size={20} />
              </div>
              <span
                className={`flex items-center gap-1 text-[9px] font-black tracking-wider px-2 py-0.5 rounded-full ${
                  gameMode === "CLASSIC"
                    ? "bg-[#22D3EE] text-black"
                    : "bg-[#22D3EE]/10 text-[#22D3EE]"
                }`}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
                </span>
                {str.liveBadge}
              </span>
            </div>
            <h3 className="font-extrabold text-sm text-white">{str.classicTitle}</h3>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">{str.classicDesc}</p>

            {gameMode === "CLASSIC" && (
              <div className="absolute top-2 right-2">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#C084FC] to-[#22D3EE] flex items-center justify-center text-black">
                  <span className="text-[10px] font-black">✓</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Bet wager selector */}
      <div className="glass-card rounded-2xl p-4 space-y-3 border border-white/10">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">{str.setWager} (ETB)</span>
          <span className="font-bold text-[#22D3EE] font-mono text-sm">{betAmount} ETB</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => adjustBet(-STEP)}
            className="w-10 h-10 rounded-xl bg-[#12121c] border border-white/10 text-slate-300 hover:text-white hover:border-white/25 active:scale-90 transition-all flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="-"
          >
            <Minus size={16} />
          </button>
          <input
            type="number"
            min={minBet}
            max={maxBet}
            value={betAmount}
            onChange={(e) => setBetAmount(Math.max(minBet, Math.min(maxBet, Number(e.target.value) || minBet)))}
            placeholder={str.customPh}
            className="w-full h-10 px-3 rounded-xl bg-[#000000] border border-white/10 text-white font-mono text-sm text-center focus:outline-none focus:border-[#C084FC] transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={() => adjustBet(STEP)}
            className="w-10 h-10 rounded-xl bg-[#12121c] border border-white/10 text-slate-300 hover:text-white hover:border-white/25 active:scale-90 transition-all flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="+"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => { playSound("click"); setBetAmount(maxBet); }}
            className="h-10 px-3.5 rounded-xl bg-gradient-to-r from-[#C084FC]/20 to-[#22D3EE]/20 border border-[#C084FC]/30 text-[#C084FC] text-xs font-black hover:opacity-90 active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            {str.max}
          </button>
        </div>

        <div className="flex gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => { playSound(); setBetAmount(p); }}
              disabled={p < minBet}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                betAmount === p
                  ? "bg-gradient-to-r from-[#C084FC] to-[#22D3EE] text-black shadow-lg shadow-[#C084FC]/25 scale-[1.03]"
                  : "bg-[#12121c] text-slate-300 hover:bg-[#1a1a2e]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* 6. CTA */}
      <button
        onClick={() => { playSound('success'); handleEnterGame(); }}
        className="relative w-full mt-2 py-3 rounded-2xl bg-gradient-to-r from-[#C084FC] via-[#22D3EE] to-[#C084FC] text-black font-black text-base shadow-2xl shadow-[#C084FC]/30 transition-all hover:scale-[1.01] hover:shadow-[#22D3EE]/30 active:scale-[0.99] flex items-center justify-center gap-2 overflow-hidden cursor-pointer"
      >
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
        <Flame size={18} className="fill-black" />
        {selectedNumbers.length > 0 ? str.enterWith : str.goBoard}
        <ArrowRight size={18} />
      </button>
    </div>
  );
}
