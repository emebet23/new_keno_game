import { Trophy, X } from "lucide-react";
import { useHistory } from "../lib/hooks";
import { useAppStore } from "../lib/store";

export default function History() {
  const { language } = useAppStore();
  const { data, isLoading } = useHistory(1, 10);

  if (isLoading) {
    return <div className="text-center py-12 text-slate-400">{language === "am" ? "ታሪክ በመጫን ላይ..." : "Loading history..."}</div>;
  }

  const tickets = data?.items || data?.history || [];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {tickets.slice(0, 10).map((t: any) => {
          const isWin = t.status === "WON" || t.status === "won" || Number(t.payout) > 0;
          const selected = t.selectedNumbers as number[];
          const betAmount = Number(t.betAmount);
          const payout = Number(t.payout || t.prizeAmount || 0);

          return (
            <div
              key={t.id}
              className="glass-card rounded-xl p-3 flex items-center gap-3 border border-white/10"
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                  isWin ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                }`}
              >
                {isWin ? <Trophy size={16} /> : <X size={16} />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">
                    {language === "am" ? "ዙር" : "Round"} #{t.game?.roundNumber || t.roundNumber || "N/A"}
                  </span>
                  <span className={`font-mono font-extrabold ${isWin ? "text-emerald-400" : "text-rose-400"}`}>
                    {isWin ? `+${payout.toFixed(2)} ETB` : `-${betAmount.toFixed(2)} ETB`}
                  </span>
                </div>

                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>{language === "am" ? "ግጥሚያ:" : "Matches:"} {t.matches ?? 0}/{selected?.length ?? 0}</span>
                  <span className="text-[#22D3EE] font-bold">{t.multiplier ?? 0}x</span>
                </div>

                <div className="text-[10px] font-mono text-[#C084FC] mt-1 truncate">
                  {language === "am" ? "ምርጫዎች:" : "Picks:"} {selected?.join(", ")}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {tickets.length === 0 && (
        <div className="text-center py-12 text-slate-400">{language === "am" ? "እስካሁን ትኬት አልተጫወቱም። ይጀምሩ!" : "No tickets played yet. Start playing!"}</div>
      )}
    </div>
  );
}
