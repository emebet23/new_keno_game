import { useWallet, useTransactions } from "../lib/hooks";
import { Wallet as WalletIcon, History } from "lucide-react";
import { useAppStore } from "../lib/store";

export default function Wallet() {
  const { language } = useAppStore();
  const { data: wallet, isLoading } = useWallet();
  const { data: txData } = useTransactions(1, 10);

  if (isLoading) {
    return <div className="text-center py-12 text-slate-400">{language === "am" ? "የኪስ ቦርሳ መረጃ በመጫን ላይ..." : "Loading wallet info..."}</div>;
  }

  const totalBal = Number(wallet?.totalBalance || 0);
  const playBal = Number(wallet?.playBalance || 0);
  const mainBal = Number(wallet?.mainBalance || 0);

  const transactions = Array.isArray(txData) ? txData : (txData as any)?.items ?? [];

  return (
    <div className="space-y-4">
      {/* Wallet Balance Cards */}
      <div className="glass-card rounded-2xl p-5 border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#C084FC]/20 to-[#22D3EE]/20 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center gap-2 mb-3">
          <WalletIcon className="text-[#C084FC]" size={24} />
          <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase">{language === "am" ? "የተጠቃሚ ኪስ ቦርሳ" : "User Wallet"}</span>
        </div>

        <div className="text-3xl font-extrabold text-white">
          {totalBal.toFixed(2)}{" "}
          <span className="text-sm font-normal text-[#22D3EE]">{wallet?.currency ?? "ETB"}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/10 text-xs">
          <div>
            <span className="text-slate-400">{language === "am" ? "የጨዋታ ሂሳብ:" : "Play Balance:"}</span>
            <div className="font-bold text-[#C084FC] text-sm">{playBal.toFixed(2)} ETB</div>
          </div>
          <div>
            <span className="text-slate-400">{language === "am" ? "ዋና ሂሳብ:" : "Main Balance:"}</span>
            <div className="font-bold text-[#22D3EE] text-sm">{mainBal.toFixed(2)} ETB</div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="glass-card rounded-2xl p-4 border border-white/10">
        <div className="flex items-center gap-2 mb-3 font-bold text-sm text-slate-200">
          <History size={18} className="text-[#C084FC]" />
          <span>{language === "am" ? "የቅርብ ጊዜ ግብይቶች" : "Recent Transactions"}</span>
        </div>
        {transactions.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">{language === "am" ? "እስካሁን ግብይት የለም" : "No transactions yet"}</p>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 10).map((tx: any, i: number) => {
              const isCredit = ["DEPOSIT", "WIN", "REFUND", "TRANSFER", "REFERRAL"].includes(tx.type);
              const label = tx.type === "DEPOSIT" ? (language === "am" ? "ገቢ" : "Deposit")
                : tx.type === "WITHDRAW" ? (language === "am" ? "ወጪ" : "Withdraw")
                : tx.type === "BET" ? (language === "am" ? "ውርርድ" : "Bet")
                : tx.type === "WIN" ? (language === "am" ? "ድል" : "Win")
                : tx.type === "REFUND" ? (language === "am" ? "ተመላሽ" : "Refund")
                : tx.type ?? tx.description ?? (language === "am" ? "ግብይት" : "Transaction");
              return (
                <div
                  key={tx.id ?? i}
                  className="flex items-center justify-between py-2 px-3 rounded-xl bg-[#12121c] border border-white/5"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-200">{label}</div>
                    <div className="text-[10px] text-slate-500">
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : ""}
                    </div>
                  </div>
                  <div
                    className={`text-xs font-bold ${isCredit ? "text-emerald-400" : "text-rose-400"}`}
                  >
                    {isCredit ? "+" : "-"}{Number(tx.amount).toFixed(2)} ETB
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
