import { useAppStore } from "../lib/store";
import { playSound } from "../lib/sound";
import { useWallet, useQuickPick, useCurrentRound } from "../lib/hooks";
import { Zap, Trash2, Clock, Flame, Minus, Plus } from "lucide-react";

// Default multiplier table preview mapping
const MULTIPLIERS_PREVIEW: Record<number, Record<number, number>> = {
  1: { 1: 3.8 },
  2: { 2: 15 },
  3: { 2: 2, 3: 42 },
  4: { 2: 1, 3: 10, 4: 100 },
  5: { 3: 2, 4: 15, 5: 300 },
  6: { 3: 1, 4: 7, 5: 70, 6: 1000 },
  7: { 4: 3, 5: 20, 6: 200, 7: 4000 },
  8: { 4: 2, 5: 10, 6: 90, 7: 750, 8: 10000 },
  9: { 5: 5, 6: 40, 7: 300, 8: 2500, 9: 25000 },
  10: { 0: 2, 5: 2, 6: 15, 7: 100, 8: 500, 9: 3000, 10: 100000 },
};

const STEP = 5;

export default function BetControls({
  onPlay,
  isPlaying,
}: {
  onPlay: () => void;
  isPlaying: boolean;
}) {
  const {
    selectedNumbers,
    setSelection,
    clearSelection,
    betAmount,
    setBetAmount,
    gameMode,
    setGameMode,
    language,
  } = useAppStore();
  const { data: wallet } = useWallet();
  const { data: roundData } = useCurrentRound();
  const quickPickMutation = useQuickPick();

  const minBet = Number(roundData?.minBet) || 10;
  const maxBet = Math.max(minBet, Number(wallet?.totalBalance) || 0);

  const count = selectedNumbers.length;
  const canPlay = count >= 1 && count <= 10 && betAmount >= minBet && (wallet?.totalBalance ?? 1000) >= betAmount;
  const multiplierTable = MULTIPLIERS_PREVIEW[count] || {};

  const adjustBet = (delta: number) => {
    const next = Math.min(maxBet, Math.max(minBet, betAmount + delta));
    if (next !== betAmount) {
      playSound("click");
      setBetAmount(next);
    }
  };

  const handleQuickPick = (numCount: number) => {
    quickPickMutation.mutate(numCount, {
      onSuccess: (numbers) => setSelection(numbers),
      onError: () => {
        // Fallback local quick pick
        const picked = new Set<number>();
        while (picked.size < numCount) {
          picked.add(Math.floor(Math.random() * 80) + 1);
        }
        setSelection(Array.from(picked));
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Game Mode Selector */}
      <div className="flex bg-[#09090b] p-1 rounded-xl border border-white/10">
        <button
          onClick={() => { playSound('select'); setGameMode("INSTANT"); }}
          className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            gameMode === "INSTANT"
              ? "bg-[#C084FC] text-black shadow-md shadow-[#C084FC]/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Zap size={14} />
          {language === "am" ? "ፈጣን ኬኖ" : "Instant Keno"}
        </button>
        <button
          onClick={() => { playSound('select'); setGameMode("CLASSIC"); }}
          className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            gameMode === "CLASSIC"
              ? "bg-[#22D3EE] text-black shadow-md shadow-[#22D3EE]/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Clock size={14} />
          {language === "am" ? "ክላሲክ ኬኖ" : "Classic Round"}
        </button>
      </div>

      {/* Multipliers Preview Bar */}
      {count > 0 && (
        <div className="glass-card rounded-xl p-2.5 border border-white/10">
          <div className="text-[11px] text-slate-400 mb-1.5 flex justify-between items-center">
            <span>{language === "am" ? `የክፍያ ማባዣ (${count} ተመርጧል)` : `Payout Multipliers (${count} selected)`}</span>
            <span className="text-[#C084FC] font-semibold">{language === "am" ? "ከፍተኛ" : "Max"} {(Math.max(...Object.values(multiplierTable), 0))}x</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {Object.entries(multiplierTable).map(([hit, mult]) => (
              <div
                key={hit}
                className="flex-1 min-w-[50px] bg-[#12121c] rounded-lg p-1.5 text-center border border-white/5"
              >
                <div className="text-[10px] text-slate-400">{hit} {language === "am" ? "ግጥሚያ" : "Hits"}</div>
                <div className="text-xs font-bold text-[#22D3EE]">{mult}x</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Pick & Selection Helpers */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400">{language === "am" ? "ፈጣን ምርጫ:" : "Quick Pick:"}</span>
          {[3, 5, 7, 10].map((n) => (
            <button
              key={n}
              onClick={() => { playSound(); handleQuickPick(n); }}
              className="px-2 py-1 rounded-md bg-[#12121c] border border-white/10 text-xs font-bold text-[#C084FC] hover:bg-[#C084FC] hover:text-black transition-all"
            >
              {language === "am" ? `${n} ምረጥ` : `Pick ${n}`}
            </button>
          ))}
        </div>
        <button
          onClick={() => { playSound(); clearSelection(); }}
          disabled={selectedNumbers.length === 0}
          className="p-1.5 rounded-md bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 disabled:opacity-30 text-xs font-bold flex items-center gap-1"
          title={language === "am" ? "ምርጫ አጽዳ" : "Clear Selection"}
        >
          <Trash2 size={14} /> {language === "am" ? "አጽዳ" : "Clear"}
        </button>
      </div>

      {/* Wager Selector */}
      <div className="glass-card rounded-xl p-3 border border-white/10 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-400">{language === "am" ? "የውርርድ መጠን (ETB)" : "Wager Amount (ETB)"}</span>
          <span className="font-bold text-[#22D3EE] font-mono text-sm">{betAmount} ETB</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => adjustBet(-STEP)}
            disabled={betAmount <= minBet}
            className="w-9 h-9 rounded-xl bg-[#12121c] border border-white/10 text-slate-300 hover:text-white hover:border-white/25 active:scale-90 transition-all flex items-center justify-center shrink-0 disabled:opacity-30 cursor-pointer"
            aria-label="-"
          >
            <Minus size={14} />
          </button>
          <input
            type="number"
            min={minBet}
            max={maxBet}
            value={betAmount}
            onChange={(e) => setBetAmount(Math.max(minBet, Math.min(maxBet, Number(e.target.value) || minBet)))}
            className="w-full h-9 px-2 rounded-xl bg-[#000000] border border-white/10 text-white font-mono text-sm text-center focus:outline-none focus:border-[#C084FC] transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={() => adjustBet(STEP)}
            className="w-9 h-9 rounded-xl bg-[#12121c] border border-white/10 text-slate-300 hover:text-white hover:border-white/25 active:scale-90 transition-all flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="+"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => { playSound("click"); setBetAmount(maxBet); }}
            className="h-9 px-3 rounded-xl bg-gradient-to-r from-[#C084FC]/20 to-[#22D3EE]/20 border border-[#C084FC]/30 text-[#C084FC] text-[11px] font-black hover:opacity-90 active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            {language === "am" ? "ከፍተኛ" : "Max"}
          </button>
        </div>
      </div>

      {/* Play Action Button */}
      <button
        onClick={() => { playSound('success'); onPlay(); }}
        disabled={!canPlay || isPlaying}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#C084FC] via-[#22D3EE] to-[#C084FC] text-black font-extrabold text-base shadow-xl shadow-[#C084FC]/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Flame size={20} className="fill-black" />
        {isPlaying
          ? (language === "am" ? "ቁጥሮች እየወጡ ነው..." : "Drawing Numbers...")
          : gameMode === "INSTANT"
          ? (language === "am" ? `ፈጣን ተጫወት (${count} ቁጥሮች @ ${betAmount} ETB)` : `Play Instant (${count} numbers @ ${betAmount} ETB)`)
          : (language === "am" ? `የክላሲክ ትኬት አስገባ (${count} ቁጥሮች @ ${betAmount} ETB)` : `Queue Classic Ticket (${count} numbers @ ${betAmount} ETB)`)}
      </button>
    </div>
  );
}
