import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAppStore, Tab } from "./lib/store";
import { usePlayKeno, useCurrentRound } from "./lib/hooks";
import { ensureAuth } from "./lib/api";
import { playSound } from "./lib/sound";
import SplashScreen from "./components/SplashScreen";
import Home from "./components/Home";
import KenoBoard from "./components/KenoBoard";
import BetControls from "./components/BetControls";
import GameResult from "./components/GameResult";
import LiveReveal from "./components/LiveReveal";
import LiveSocket from "./components/LiveSocket";
import ClassicCountdown from "./components/ClassicCountdown";
import Wallet from "./components/Wallet";
import History from "./components/History";
import ProvablyFair from "./components/ProvablyFair";
import Profile from "./components/Profile";
import Settings from "./components/Settings";
import AdminDashboard from "./features/admin/AdminDashboard";
import { Home as HomeIcon, Clock, WalletIcon, ShieldCheck, User as UserIcon, ArrowLeft } from "lucide-react";

const qc = new QueryClient();

// Client Navigation Tabs
const TABS_EN: { id: Tab; label: string; icon: any }[] = [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "history", label: "History", icon: Clock },
  { id: "wallet", label: "Wallet", icon: WalletIcon },
  { id: "fair", label: "Fairness", icon: ShieldCheck },
  { id: "profile", label: "Profile", icon: UserIcon },
];
const TABS_AM: { id: Tab; label: string; icon: any }[] = [
  { id: "home", label: "መነሻ", icon: HomeIcon },
  { id: "history", label: "ታሪክ", icon: Clock },
  { id: "wallet", label: "ኪስ ቦርሳ", icon: WalletIcon },
  { id: "fair", label: "ፍትሃዊነት", icon: ShieldCheck },
  { id: "profile", label: "መገለጫ", icon: UserIcon },
];

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);

  const {
    activeTab,
    setActiveTab,
    selectedNumbers,
    betAmount,
    gameMode,
    clearSelection,
    currentUser,
    setCurrentUser,
    language,
    setPendingClassic,
    toast,
    setToast,
    liveSettled,
  } = useAppStore();

  const TABS = language === "am" ? TABS_AM : TABS_EN;

  const playMutation = usePlayKeno();
  const { data: roundData } = useCurrentRound();

  const [gameResultData, setGameResultData] = useState<any>(null);
  const [drawWinning, setDrawWinning] = useState<number[]>([]);
  const [drawRevealed, setDrawRevealed] = useState(0);

  // Clear the board once a game finishes so it is ready for the next round.
  const resetBoard = () => {
    setDrawWinning([]);
    setDrawRevealed(0);
  };

  // Classic round settled → wipe any leftover draw highlight from the board.
  useEffect(() => {
    if (liveSettled) resetBoard();
  }, [liveSettled]);

  // Auto-dismiss toast notifications
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  // Auto initialize auth on boot
  useEffect(() => {
    const cachedUser = localStorage.getItem("keno_user");
    if (cachedUser) {
      try {
        const parsed = JSON.parse(cachedUser);
        setCurrentUser(parsed);
        setActiveTab(parsed.role === "ADMIN" || parsed.role === "SUPERADMIN" ? "admin" : "home");
      } catch {}
    }
    // Reconcile with the real Telegram user (replaces stale default/dev sessions)
    ensureAuth().then(() => {
      const stored = localStorage.getItem("keno_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        setCurrentUser(parsed);
        setActiveTab(parsed.role === "ADMIN" || parsed.role === "SUPERADMIN" ? "admin" : "home");
      }
    });
  }, []);

  const handlePlay = () => {
    resetBoard();
    playMutation.mutate(
      { selectedNumbers, betAmount, mode: gameMode },
      {
        onSuccess: (data) => {
          if (data.mode === "INSTANT" && data.drawNumbers) {
            setDrawWinning(data.drawNumbers);
            setDrawRevealed(0);
            clearSelection();

            let idx = 0;
            const interval = setInterval(() => {
              idx++;
              setDrawRevealed(idx);
              if (idx >= data.drawNumbers.length) {
                clearInterval(interval);
                setTimeout(() => setGameResultData(data), 300);
              }
            }, 70);
          } else {
            setPendingClassic({ gameId: data.gameId, roundNumber: data.roundNumber, ticketCount: 1 });
            clearSelection();
            setToast(language === "am"
              ? `ትኬት ለክላሲክ ኬኖ #${data.roundNumber} ተመዝግቧል! ውጤቱ በቀጥታ ይታያል`
              : `Ticket accepted for Classic Round #${data.roundNumber}! Live result will appear shortly`);
          }
        },
        onError: (err: any) => {
          alert(err?.response?.data?.message || err?.message || (language === "am" ? "ውርርድ ማድረግ አልተሳካም" : "Failed to place bet"));
        },
      }
    );
  };

  // Render Splash Screen on initial application launch
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // Role-based guard: admin dashboard only for ADMIN role
  if (activeTab === "admin" && (currentUser?.role === "ADMIN" || currentUser?.role === "SUPERADMIN")) {
    return (
      <>
        <AdminDashboard onSwitchToPlayer={() => setActiveTab("home")} />
      </>
    );
  }

  // Non-admin trying to access admin tab → force to home
  if (activeTab === "admin") {
    setActiveTab("home");
  }

  return (
    <div className="min-h-dvh flex flex-col max-w-lg mx-auto bg-[#000000] text-slate-100 selection:bg-[#C084FC] selection:text-black">
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {activeTab === "home" && <Home />}
        {activeTab === "game" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => { playSound(); setActiveTab("home"); }}
                className="flex items-center gap-1 text-xs font-bold text-[#C084FC] hover:text-white transition-all bg-[#12121c] px-3 py-1.5 rounded-xl border border-white/10"
              >
                <ArrowLeft size={14} /> {language === "am" ? "ወደ መነሻ ተመለስ" : "Back to Home"}
              </button>
              <span className="text-xs text-slate-400 font-mono">
                {gameMode === "INSTANT" ? (language === "am" ? "ፈጣን ሁነታ" : "INSTANT MODE") : (language === "am" ? "ክላሲክ ሁነታ" : "CLASSIC MODE")}
              </span>
            </div>
            {gameMode === "CLASSIC" && <ClassicCountdown compact />}
            {gameMode === "CLASSIC" && <LiveReveal />}
            <KenoBoard winningNumbers={drawWinning} revealedCount={drawRevealed} />
            <BetControls onPlay={handlePlay} isPlaying={playMutation.isPending} />
          </div>
        )}
        {activeTab === "history" && <History />}
        {activeTab === "wallet" && <Wallet />}
        {activeTab === "fair" && <ProvablyFair />}
        {activeTab === "profile" && <Profile />}
        {activeTab === "settings" && <Settings />}
      </main>

      {/* Client Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#09090b]/90 backdrop-blur-xl border-t border-white/10 z-40">
        <div className="max-w-lg mx-auto flex">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { playSound(); setActiveTab(t.id); }}
                className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-bold transition-all relative ${
                  isActive
                    ? "text-[#C084FC]"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon size={18} className={isActive ? "stroke-[#C084FC] filter drop-shadow-md" : ""} />
                {t.label}
                {isActive && (
                  <span className="absolute bottom-0 w-8 h-1 bg-gradient-to-r from-[#C084FC] to-[#22D3EE] rounded-t-full shadow-sm shadow-[#C084FC]" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[92%] max-w-md">
          <div className="glass-card rounded-xl px-4 py-3 text-xs font-bold text-center text-white border border-[#22D3EE]/30 shadow-lg shadow-[#22D3EE]/10 animate-fade-in">
            {toast}
          </div>
        </div>
      )}

      {/* Global socket layer (keeps wallet/history in sync across tabs) */}
      <LiveSocket />

      {/* Modals */}
      {gameResultData && <GameResult result={gameResultData} onClose={() => { resetBoard(); setGameResultData(null); }} />}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AppContent />
    </QueryClientProvider>
  );
}
