import { useEffect, useState } from "react";
import { Trophy, X, Radio, Dices, XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { type LiveSettledEvent } from "../lib/socket";
import { useAppStore } from "../lib/store";
import { playSound } from "../lib/sound";

// Inline classic draw reveal rendered directly above the game board. Drawn
// numbers pop in one-by-one in draw order (3, 7, 2, ...) with a gap between
// each chip until all numbers are shown, then the result summary appears.
export default function LiveReveal() {
  const {
    liveSettled,
    setLiveSettled,
    setPendingClassic,
    language,
    vibrationEnabled,
  } = useAppStore();
  const qc = useQueryClient();

  const [revealed, setRevealed] = useState(0);
  const [phase, setPhase] = useState<"drawing" | "result">("drawing");

  const evt: LiveSettledEvent | null = liveSettled;

  // ─── Progressive reveal: numbers appear in draw order, left to right ───
  useEffect(() => {
    if (!evt) return;

    setRevealed(0);
    setPhase("drawing");

    const drawNumbers = evt.drawNumbers;
    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      setRevealed(idx);
      if (idx >= drawNumbers.length) {
        clearInterval(interval);
        setTimeout(() => setPhase("result"), 450);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [evt]);

  // Play sound + haptics when the reveal finishes.
  useEffect(() => {
    if (!evt || phase !== "result") return;

    const won = evt.playerPayout > 0;
    playSound(won ? "success" : "error");
    if (vibrationEnabled && "vibrate" in navigator) {
      navigator.vibrate(won ? [40, 60, 40] : 100);
    }
  }, [phase, evt, vibrationEnabled]);

  const handleClose = () => {
    qc.invalidateQueries({ queryKey: ["wallet"] });
    setLiveSettled(null);
    setPendingClassic(null);
    setRevealed(0);
    setPhase("drawing");
  };

  if (!evt) return null;

  const won = evt.playerPayout > 0;
  const remaining = Math.max(0, evt.drawNumbers.length - revealed);
  const allPicks = new Set<number>();
  evt.tickets.forEach((t) => t.selectedNumbers.forEach((n) => allPicks.add(n)));
  const totalBet = evt.tickets.reduce((sum, t) => sum + t.betAmount, 0);
  const totalMatches = evt.tickets.reduce((sum, t) => sum + t.matches, 0);

  return (
    <div className="glass-card rounded-2xl p-3 border border-[#22D3EE]/25 space-y-2 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-full bg-[#22D3EE]/15 text-[#22D3EE]">
            <Radio size={14} />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-extrabold text-white">
              {language === "am" ? "የክላሲክ ውጤት" : "Classic Draw"}
            </h3>
            {phase === "drawing" && (
              <span className="text-[8px] font-black tracking-widest text-black bg-[#22D3EE] px-1.5 py-0.5 rounded animate-pulse">
                LIVE
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-mono">
            {language === "am" ? `ዙር #${evt.roundNumber}` : `Round #${evt.roundNumber}`}
            {phase === "drawing" && (
              <span className="text-[#22D3EE] font-bold"> · {revealed}/{evt.drawNumbers.length}</span>
            )}
          </span>
          <button
            onClick={() => { playSound(); handleClose(); }}
            className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white"
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Reveal countdown — one number per second until all 20 are shown */}
      {phase === "drawing" && (
        <div className="flex items-center justify-center gap-3 py-1">
          <Dices size={14} className="text-[#22D3EE] animate-spin" style={{ animationDuration: "1.2s" }} />
          <span className="text-[11px] font-bold text-[#22D3EE]">
            {language === "am" ? "ቁጥሮች እየወጡ ነው..." : "Drawing numbers..."}
          </span>
          <span className="flex items-baseline gap-1 font-mono bg-black rounded-lg px-2 py-0.5 border border-[#22D3EE]/20">
            <span className="text-base font-black text-[#22D3EE] tabular-nums">{remaining}</span>
            <span className="text-[9px] text-slate-400">{language === "am" ? "ሰከንድ" : "sec left"}</span>
          </span>
        </div>
      )}

      {/* Drawn numbers — 10 per row, filled left to right in draw order */}
      <div className="grid grid-cols-10 gap-1">
        {evt.drawNumbers.map((num, i) => {
          const isRevealed = i < revealed;
          const matched = isRevealed && allPicks.has(num);
          return (
            <div
              key={num}
              className={`aspect-square w-full rounded-lg flex items-center justify-center text-[10px] sm:text-[11px] font-extrabold transition-all ${
                !isRevealed
                  ? "bg-[#09090b] text-transparent border border-white/5"
                  : matched
                    ? "bg-gradient-to-tr from-emerald-500 to-teal-300 text-black shadow-md shadow-emerald-500/50 scale-105 animate-ball-pop border-emerald-300"
                    : "bg-[#12121c] text-[#22D3EE] border border-white/5 animate-ball-pop"
              }`}
              style={{ animationDelay: `${i * 0.02}s` }}
            >
              {isRevealed ? num : "?"}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#C084FC] to-[#22D3EE] transition-all duration-100"
          style={{ width: `${(revealed / evt.drawNumbers.length) * 100}%` }}
        />
      </div>

      {/* Your picks */}
      <div className="bg-black rounded-lg px-2.5 py-1.5 text-[11px] border border-white/10">
        <span className="text-slate-400">
          {language === "am" ? "የእርስዎ ምርጫ:" : "Your picks:"}
        </span>{" "}
        <span className="font-mono text-[#C084FC] font-bold">{[...allPicks].sort((a, b) => a - b).join(", ")}</span>
      </div>

      {/* Result summary */}
      {phase === "result" && (
        <div className="space-y-1.5 text-[11px] bg-black rounded-lg px-2.5 py-2 border border-white/10 animate-fade-in">
          <div className="flex items-center justify-center gap-2 py-0.5">
            {won ? (
              <>
                <Trophy size={18} className="text-emerald-400" />
                <span className="text-sm font-black text-emerald-400">
                  {language === "am" ? "አሸናፊ!" : "WINNER!"}
                </span>
              </>
            ) : (
              <>
                <XCircle size={18} className="text-rose-400" />
                <span className="text-sm font-black text-rose-400">
                  {language === "am" ? "ግጥሚያ የለም" : "NO MATCH"}
                </span>
              </>
            )}
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">{language === "am" ? "ግጥሚያዎች:" : "Matches:"}</span>
            <span className="font-mono text-emerald-400 font-bold">
              {totalMatches} / {allPicks.size}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">{language === "am" ? "የውርርድ መጠን:" : "Bet Amount:"}</span>
            <span className="font-mono text-slate-200">{totalBet.toFixed(2)} ETB</span>
          </div>

          {evt.tickets.length > 1 && (
            <div className="space-y-1 pt-1 border-t border-white/10">
              {evt.tickets.map((t, idx) => (
                <div key={t.ticketId} className="flex justify-between">
                  <span className="text-slate-500">
                    {language === "am" ? "ትኬት" : "Ticket"} {idx + 1} · {t.matches}{language === "am" ? " ግጥሚያ" : " match"} · {t.multiplier}x
                  </span>
                  <span className={`font-mono font-bold ${t.won ? "text-emerald-400" : "text-rose-400"}`}>
                    {t.won ? `+${t.payout.toFixed(2)}` : `-${t.betAmount.toFixed(2)}`} ETB
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between text-sm font-extrabold border-t border-white/10 pt-1.5">
            <span>{language === "am" ? "ጠቅላላ ሽልማት:" : "Total Prize:"}</span>
            <span className={won ? "text-emerald-400" : "text-rose-400"}>
              {won ? `+${evt.playerPayout.toFixed(2)} ETB` : `-${totalBet.toFixed(2)} ETB`}
            </span>
          </div>

          <button
            onClick={() => { playSound("success"); handleClose(); }}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#C084FC] to-[#22D3EE] text-black font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all hover:opacity-90 active:scale-[0.99]"
          >
            {language === "am" ? "ወደ ጨዋታ ተመለስ" : "Back to Game"} <Dices size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
