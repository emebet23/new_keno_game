import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { useCurrentRound } from "../lib/hooks";
import { useAppStore } from "../lib/store";

export default function ClassicCountdown({ compact }: { compact?: boolean }) {
  const { language, classicDrawing, liveSettled } = useAppStore();
  const { data: roundData } = useCurrentRound();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!roundData) return null;

  const intervalSec = roundData.drawIntervalSec ?? 30;
  const startedAt = new Date(roundData.startedAt).getTime();
  const elapsedSec = Math.max(0, (now - startedAt) / 1000);
  const remainingSec = Math.max(0, Math.ceil(intervalSec - (elapsedSec % intervalSec)));
  const progress = Math.min(1, (elapsedSec % intervalSec) / intervalSec);

  // The counter is paused while a draw is running or the result is on screen.
  // It resumes counting down to the next round once the user returns to the game.
  const paused = classicDrawing || !!liveSettled;

  const mm = Math.floor(remainingSec / 60);
  const ss = remainingSec % 60;
  const label = language === "am" ? "ቀጣይ ድልድል" : "Next Draw";

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {paused ? (
          <span className="flex items-center gap-1.5 text-[#22D3EE] font-bold animate-pulse">
            <Timer size={13} />
            {language === "am" ? "ውርርድ እየተካሄደ ነው..." : "Drawing..."}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-slate-300 font-mono text-xs">
            <Timer size={13} className="text-[#22D3EE]" />
            <span className="text-slate-400">{label}</span>
            <span className="font-bold text-[#22D3EE]">
              {mm}:{ss.toString().padStart(2, "0")}
            </span>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-4 border border-white/10">
      <div className="flex items-center justify-between text-xs mb-2">
        {paused ? (
          <span className="font-bold text-[#22D3EE] animate-pulse">
            {language === "am" ? "ውርርድ እየተካሄደ ነው..." : "Drawing in progress..."}
          </span>
        ) : (
          <span className="text-slate-400">{label}</span>
        )}
        {!paused && (
          <span className="font-mono font-extrabold text-[#22D3EE]">
            {mm}:{ss.toString().padStart(2, "0")}
          </span>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            paused
              ? "bg-gradient-to-r from-[#C084FC] to-[#22D3EE] animate-pulse"
              : "bg-gradient-to-r from-[#C084FC] to-[#22D3EE]"
          }`}
          style={{ width: paused ? "100%" : `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
