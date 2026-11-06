import { useAppStore } from "../lib/store";
import { playSound } from "../lib/sound";
import { MousePointerClick } from "lucide-react";

export default function KenoBoard({
  winningNumbers,
  revealedCount,
}: {
  winningNumbers?: number[];
  revealedCount?: number;
}) {
  const { selectedNumbers, toggleNumber, language } = useAppStore();
  const revealed = winningNumbers?.slice(0, revealedCount ?? 0) ?? [];
  const count = selectedNumbers.length;

  return (
    <div className="glass-card rounded-2xl p-3 shadow-2xl border border-white/10 space-y-3">
      {/* Instruction header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
          <MousePointerClick size={13} className="text-[#C084FC]" />
          {language === "am"
            ? "ከ1 እስከ 10 ቁጥሮች ይምረጡ"
            : "Pick 1-10 numbers to play"}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[11px] font-black px-2 py-0.5 rounded-full transition-colors ${
            count === 0
              ? "bg-white/5 text-slate-400"
              : count === 10
                ? "bg-[#22D3EE]/20 text-[#22D3EE]"
                : "bg-[#C084FC]/20 text-[#C084FC]"
          }`}>
            {count}/10
          </span>
        </div>
      </div>

      <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
        {Array.from({ length: 80 }, (_, i) => i + 1).map((num) => {
          const isSelected = selectedNumbers.includes(num);
          const isRevealed = revealed.includes(num);
          const isMatch = isSelected && isRevealed;

          let bgStyle = "bg-[#09090b] text-slate-300 hover:bg-[#12121c] border border-white/5";
          let glowClass = "";

          if (isMatch) {
            bgStyle = "bg-gradient-to-tr from-emerald-500 to-teal-400 text-black font-extrabold shadow-lg shadow-emerald-500/50 scale-105 animate-ball-pop border-emerald-300";
          } else if (isRevealed) {
            bgStyle = "bg-[#22D3EE] text-black font-bold shadow-md shadow-[#22D3EE]/40 border-[#22D3EE]";
            glowClass = "glow-cyan";
          } else if (isSelected) {
            bgStyle = "bg-[#C084FC] text-black font-bold shadow-md shadow-[#C084FC]/40 border-[#C084FC]";
            glowClass = "glow-purple";
          }

          return (
            <button
              key={num}
              onClick={() => { playSound('select'); toggleNumber(num); }}
              disabled={isRevealed}
              className={`aspect-square rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center justify-center ${bgStyle} ${glowClass} disabled:cursor-not-allowed`}
            >
              {num}
            </button>
          );
        })}
      </div>
    </div>
  );
}
