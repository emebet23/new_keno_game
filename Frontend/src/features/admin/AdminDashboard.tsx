import { useState } from "react";
import {
  useAdminAnalytics,
  useAdminSettings,
  useAdminReports,
  useAdminUsers,
  useUpdateAdminSettings,
  useUpdateUserStatus,
  useUpdateUserRole,
} from "./hooks";
import { useAppStore } from "../../lib/store";
import { playSound } from "../../lib/sound";
import {
  Settings,
  TrendingUp,
  Users,
  DollarSign,
  RefreshCw,
  BarChart2,
  Shield,
  UserCheck,
  UserX,
  Search,
  CheckCircle2,
  Award,
  UserCog,
  Gamepad2,
  Hash,
  Dices,
  Target,
  Ticket,
  Table2,
  Wallet,
  Activity,
  AlertTriangle,
  Percent,
  ArrowUpDown,
  TrendingDown,
  UserMinus,
  Eye,
} from "lucide-react";

type SettingsForm = {
  numberPoolSize?: number;
  drawCount?: number;
  minPick?: number;
  maxPick?: number;
  minBet?: number;
  maxBet?: number;
  rtpPercentage?: number;
  houseEdge?: number;
  drawIntervalSec?: number;
};

const DEFAULT_PAYOUT_TABLE: Record<string, Record<string, number>> = {
  "1": { "1": 3.8 },
  "2": { "2": 6 },
  "3": { "2": 1, "3": 12 },
  "4": { "2": 1, "3": 5, "4": 50 },
  "5": { "3": 2, "4": 15, "5": 300 },
  "6": { "3": 1, "4": 5, "5": 50, "6": 1000 },
  "7": { "4": 3, "5": 20, "6": 150, "7": 5000 },
  "8": { "4": 2, "5": 10, "6": 75, "7": 1000, "8": 20000 },
  "9": { "4": 1, "5": 5, "6": 25, "7": 250, "8": 5000, "9": 100000 },
  "10": { "0": 2, "5": 2, "6": 15, "7": 100, "8": 500, "9": 3000, "10": 100000 },
};

export default function AdminDashboard({ onSwitchToPlayer }: { onSwitchToPlayer?: () => void }) {
  const [adminTab, setAdminTab] = useState<"analytics" | "settings" | "users" | "reports">("analytics");
  const { currentUser } = useAppStore();

  const { data: analytics, refetch: refetchAnalytics } = useAdminAnalytics();
  const { data: settings, refetch: refetchSettings } = useAdminSettings();
  const { data: reports, refetch: refetchReports } = useAdminReports();

  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const { data: usersData, refetch: refetchUsers } = useAdminUsers(userPage, 12, userSearch);

  const updateSettings = useUpdateAdminSettings();
  const updateUserStatus = useUpdateUserStatus();
  const updateUserRole = useUpdateUserRole();

  // Settings form state
  const [form, setForm] = useState<SettingsForm>({});
  const [editingPayouts, setEditingPayouts] = useState(false);
  const [payoutDraft, setPayoutDraft] = useState<string>("");
  const [statusMsg, setStatusMsg] = useState("");

  const set = <K extends keyof SettingsForm>(key: K, val: SettingsForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleUpdateSettings = () => {
    const payload: any = {};
    if (form.numberPoolSize !== undefined) payload.numberPoolSize = form.numberPoolSize;
    if (form.drawCount !== undefined) payload.drawCount = form.drawCount;
    if (form.minPick !== undefined) payload.minPick = form.minPick;
    if (form.maxPick !== undefined) payload.maxPick = form.maxPick;
    if (form.minBet !== undefined) payload.minBet = form.minBet;
    if (form.maxBet !== undefined) payload.maxBet = form.maxBet;
    if (form.rtpPercentage !== undefined) payload.rtpPercentage = form.rtpPercentage;
    if (form.houseEdge !== undefined) payload.houseEdge = form.houseEdge;
    if (form.drawIntervalSec !== undefined) payload.drawIntervalSec = form.drawIntervalSec;

    if (editingPayouts) {
      try {
        payload.payoutTable = JSON.parse(payoutDraft);
        setEditingPayouts(false);
      } catch {
        setStatusMsg("Invalid JSON in payout table");
        setTimeout(() => setStatusMsg(""), 3000);
        return;
      }
    }

    updateSettings.mutate(payload, {
      onSuccess: () => {
        setStatusMsg("Settings saved successfully!");
        setTimeout(() => setStatusMsg(""), 3000);
        refetchSettings();
      },
    });
  };

  const handleToggleStatus = (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    updateUserStatus.mutate({ userId, status: newStatus });
  };

  const handleToggleRole = (userId: string, currentRole: string) => {
    const newRole = currentRole === "SUPERADMIN" ? "ADMIN" : currentRole === "ADMIN" ? "USER" : "ADMIN";
    updateUserRole.mutate({ userId, role: newRole });
  };

  const refreshAll = () => {
    refetchAnalytics();
    refetchSettings();
    refetchReports();
    refetchUsers();
  };

  const currentPayoutTable = settings?.payoutTable || DEFAULT_PAYOUT_TABLE;
  const totalRegistered = reports?.totalRegisteredUsers ?? 0;
  const activeToday = reports?.activeUsersToday ?? 0;
  const retentionPct = totalRegistered > 0 ? ((activeToday / totalRegistered) * 100).toFixed(1) : "0.0";

  return (
    <div className="min-h-screen w-full bg-[#000000] text-slate-100 flex flex-col font-sans selection:bg-[#C084FC] selection:text-black">
      {/* Header */}
      <header className="w-full bg-[#09090b]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#C084FC] to-[#22D3EE] flex items-center justify-center font-black text-black text-lg shadow-lg shadow-[#C084FC]/30">
            K
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wide bg-gradient-to-r from-[#C084FC] via-[#22D3EE] to-white bg-clip-text text-transparent">
              ኬኖ ADMIN PORTAL
            </h1>
            <p className="text-xs text-slate-400 font-medium">Production Management & Analytics Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-[#12121c] px-3 py-1.5 rounded-full border border-white/10 text-xs">
            <span className="text-slate-300 font-semibold">@{currentUser?.username || "Admin"}</span>
            <span className="text-[#22D3EE] font-bold">{currentUser?.role === "SUPERADMIN" ? "[SUPERADMIN]" : "[ADMIN]"}</span>
          </div>

          {onSwitchToPlayer && (
            <button
              onClick={() => { playSound(); onSwitchToPlayer?.(); }}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-300 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-white/10 transition-all"
            >
              <Gamepad2 size={14} className="text-[#22D3EE]" />
              Player View
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex bg-[#09090b] p-1.5 rounded-2xl border border-white/10 overflow-x-auto scrollbar-none">
          {[
            { id: "analytics", label: "Financial Analytics", icon: TrendingUp },
            { id: "settings", label: "Game Settings & Limits", icon: Settings },
            { id: "users", label: "User Management", icon: Users },
            { id: "reports", label: "Reports & Statistics", icon: BarChart2 },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = adminTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { playSound(); setAdminTab(t.id as any); }}
                className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-gradient-to-r from-[#C084FC] to-[#22D3EE] text-black shadow-lg shadow-[#C084FC]/25"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ===================== 1. FINANCIAL ANALYTICS ===================== */}
        {adminTab === "analytics" && (
          <div className="space-y-6">
            {/* Primary Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-card rounded-2xl p-5 border border-white/10 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold">Total Bets</span>
                  <DollarSign size={18} className="text-[#C084FC]" />
                </div>
                <div className="text-2xl font-black text-white">
                  {Number(analytics?.totalBets || 0).toFixed(2)} <span className="text-xs text-slate-400 font-normal">ETB</span>
                </div>
                <div className="text-xs text-slate-500 mt-2">Gross wager volume</div>
              </div>

              <div className="glass-card rounded-2xl p-5 border border-white/10 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold">Total Payouts</span>
                  <TrendingDown size={18} className="text-rose-400" />
                </div>
                <div className="text-2xl font-black text-rose-400">
                  {Number(analytics?.totalPayouts || 0).toFixed(2)} <span className="text-xs text-slate-400 font-normal">ETB</span>
                </div>
                <div className="text-xs text-slate-500 mt-2">Returned to players</div>
              </div>

              <div className="glass-card rounded-2xl p-5 border border-emerald-500/20 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold">Revenue (House)</span>
                  <DollarSign size={18} className="text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-400">
                  {Number(analytics?.revenue || 0).toFixed(2)} <span className="text-xs text-slate-400 font-normal">ETB</span>
                </div>
                <div className="text-xs text-emerald-400/80 mt-2 font-bold">
                  Profit: +{Number(analytics?.profit || 0).toFixed(2)} ETB
                </div>
              </div>

              <div className="glass-card rounded-2xl p-5 border border-white/10">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold">Total Tickets</span>
                  <Ticket size={18} className="text-[#C084FC]" />
                </div>
                <div className="text-2xl font-black text-[#C084FC]">
                  {analytics?.totalTicketsCount ?? 0}
                </div>
                <div className="text-xs text-slate-500 mt-2">All time issued</div>
              </div>
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-card rounded-2xl p-5 border border-[#22D3EE]/20 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold">Actual RTP</span>
                  <Percent size={18} className="text-[#22D3EE]" />
                </div>
                <div className="text-3xl font-black text-[#22D3EE]">
                  {Number(analytics?.actualRtpPercentage || 95).toFixed(2)}%
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-400">
                    House Margin: <strong className="text-[#C084FC]">{(100 - Number(analytics?.actualRtpPercentage || 95)).toFixed(2)}%</strong>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Target: {Number(settings?.rtpPercentage || 95)}%
                  </span>
                </div>
              </div>

              <div className="glass-card rounded-2xl p-5 border border-white/10">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold">Profit Margin</span>
                  <TrendingUp size={18} className="text-emerald-400" />
                </div>
                <div className="text-3xl font-black text-emerald-400">
                  {Number(analytics?.totalBets || 0) > 0
                    ? (((Number(analytics?.profit || 0)) / Number(analytics?.totalBets || 1)) * 100).toFixed(2)
                    : "0.00"}%
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-400">
                    Target Edge: <strong className="text-[#22D3EE]">{Number(settings?.houseEdge || 5)}%</strong>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {Number(analytics?.totalBets || 0) > 0 ? `${Number(analytics?.totalTicketsCount ?? 0)} tickets` : "No data"}
                  </span>
                </div>
              </div>
            </div>

            {/* Largest Win Record */}
            {analytics?.largestWin && (
              <div className="glass-card rounded-3xl p-6 border border-emerald-500/30">
                <div className="flex items-center justify-between text-sm text-slate-400 mb-3">
                  <span className="text-emerald-400 font-extrabold flex items-center gap-2 text-base">
                    <Award size={20} /> All-Time Largest Jackpot Record
                  </span>
                  <span>{new Date(analytics.largestWin.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold">
                  <span className="text-slate-100">User @{analytics.largestWin.username}</span>
                  <span className="text-emerald-400 font-mono text-2xl font-black">+{Number(analytics.largestWin.payout || 0).toFixed(2)} ETB</span>
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  Wagered {analytics.largestWin.betAmount} ETB @ {analytics.largestWin.multiplier}x Multiplier ({analytics.largestWin.matches} matches hit)
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== 2. GAME SETTINGS & LIMITS ===================== */}
        {adminTab === "settings" && (
          <div className="space-y-6">
            {/* Number & Draw Configuration */}
            <div className="glass-card rounded-3xl p-6 space-y-5 border border-white/10">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <Hash className="text-[#C084FC]" size={24} />
                  <div>
                    <h3 className="text-base font-extrabold text-white">Number Pool & Draw Configuration</h3>
                    <p className="text-xs text-slate-400">Configure keno number range and draw mechanics</p>
                  </div>
                </div>
                <button onClick={() => { playSound(); refreshAll(); }} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400">
                  <RefreshCw size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1.5 font-bold">Number Pool Size</label>
                  <input
                    type="number"
                    placeholder={String(settings?.numberPoolSize || 80)}
                    value={form.numberPoolSize ?? ""}
                    onChange={(e) => set("numberPoolSize", Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-[#000000] border border-white/10 text-white font-mono text-sm focus:border-[#C084FC]"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Range: 20 - 100</span>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1.5 font-bold">Draw Count</label>
                  <input
                    type="number"
                    placeholder={String(settings?.drawCount || 20)}
                    value={form.drawCount ?? ""}
                    onChange={(e) => set("drawCount", Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-[#000000] border border-white/10 text-white font-mono text-sm focus:border-[#22D3EE]"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Numbers drawn per round (1-50)</span>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1.5 font-bold">Min Pick</label>
                  <input
                    type="number"
                    placeholder={String(settings?.minPick || 1)}
                    value={form.minPick ?? ""}
                    onChange={(e) => set("minPick", Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-[#000000] border border-white/10 text-white font-mono text-sm focus:border-[#C084FC]"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Min numbers player picks</span>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1.5 font-bold">Max Pick</label>
                  <input
                    type="number"
                    placeholder={String(settings?.maxPick || 10)}
                    value={form.maxPick ?? ""}
                    onChange={(e) => set("maxPick", Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-[#000000] border border-white/10 text-white font-mono text-sm focus:border-[#22D3EE]"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Max numbers player picks</span>
                </div>
              </div>
            </div>

            {/* Bet Limits & Financial Config */}
            <div className="glass-card rounded-3xl p-6 space-y-5 border border-white/10">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <DollarSign className="text-emerald-400" size={24} />
                <div>
                  <h3 className="text-base font-extrabold text-white">Bet Limits & Financial Configuration</h3>
                  <p className="text-xs text-slate-400">RTP, house edge, and bet range settings</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1.5 font-bold">Min Bet (ETB)</label>
                  <input
                    type="number"
                    placeholder={String(settings?.minBet || 1)}
                    value={form.minBet ?? ""}
                    onChange={(e) => set("minBet", Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-[#000000] border border-white/10 text-white font-mono text-sm focus:border-[#C084FC]"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1.5 font-bold">Max Bet (ETB)</label>
                  <input
                    type="number"
                    placeholder={String(settings?.maxBet || 10000)}
                    value={form.maxBet ?? ""}
                    onChange={(e) => set("maxBet", Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-[#000000] border border-white/10 text-white font-mono text-sm focus:border-[#C084FC]"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1.5 font-bold">Target RTP (%)</label>
                  <input
                    type="number"
                    placeholder={String(settings?.rtpPercentage || 95)}
                    value={form.rtpPercentage ?? ""}
                    onChange={(e) => set("rtpPercentage", Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-[#000000] border border-white/10 text-white font-mono text-sm focus:border-[#22D3EE]"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1.5 font-bold">House Edge (%)</label>
                  <input
                    type="number"
                    placeholder={String(settings?.houseEdge || 5)}
                    value={form.houseEdge ?? ""}
                    onChange={(e) => set("houseEdge", Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-[#000000] border border-white/10 text-white font-mono text-sm focus:border-[#22D3EE]"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1.5 font-bold">Draw Interval (Seconds)</label>
                  <input
                    type="number"
                    placeholder={String(settings?.drawIntervalSec || 30)}
                    value={form.drawIntervalSec ?? ""}
                    onChange={(e) => set("drawIntervalSec", Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-[#000000] border border-white/10 text-white font-mono text-sm focus:border-[#C084FC]"
                  />
                </div>
              </div>
            </div>

            {/* Payout Table */}
            <div className="glass-card rounded-3xl p-6 space-y-5 border border-[#22D3EE]/20">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <Table2 className="text-[#22D3EE]" size={24} />
                  <div>
                    <h3 className="text-base font-extrabold text-white">Payout Table</h3>
                    <p className="text-xs text-slate-400">Multipliers for each pick/match combination</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    playSound();
                    if (!editingPayouts) {
                      setPayoutDraft(JSON.stringify(currentPayoutTable, null, 2));
                    }
                    setEditingPayouts(!editingPayouts);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    editingPayouts
                      ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
                      : "bg-[#22D3EE]/20 text-[#22D3EE] hover:bg-[#22D3EE]/30"
                  }`}
                >
                  {editingPayouts ? "Cancel Edit" : "Edit JSON"}
                </button>
              </div>

              {!editingPayouts ? (
                <div className="space-y-4">
                  {Object.entries(currentPayoutTable).map(([pick, matches]) => (
                    <div key={pick}>
                      <h4 className="text-xs font-bold text-[#C084FC] mb-2">
                        Pick {pick} {Number(pick) === 1 ? "number" : "numbers"}
                      </h4>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {Object.entries(matches).map(([match, mult]) => (
                          <div
                            key={`${pick}-${match}`}
                            className="bg-[#000000] rounded-xl px-3 py-2 border border-white/5 text-center"
                          >
                            <div className="text-[10px] text-slate-500">
                              Match {match}
                            </div>
                            <div className="text-sm font-black text-[#22D3EE]">
                              {mult}x
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[10px] text-slate-500">
                    Edit the JSON below. Format: &#123; "pickCount": &#123; "matchCount": multiplier &#125; &#125;
                  </p>
                  <textarea
                    value={payoutDraft}
                    onChange={(e) => setPayoutDraft(e.target.value)}
                    className="w-full h-80 px-4 py-3 rounded-xl bg-[#000000] border border-white/10 text-white font-mono text-xs focus:border-[#22D3EE] resize-y"
                    spellCheck={false}
                  />
                </div>
              )}
            </div>

            {statusMsg && (
              <div className={`text-sm p-3 rounded-xl text-center flex items-center justify-center gap-2 font-bold ${
                statusMsg.includes("Invalid") ? "text-rose-400 bg-rose-500/10" : "text-emerald-400 bg-emerald-500/10"
              }`}>
                {statusMsg.includes("Invalid") ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                {statusMsg}
              </div>
            )}

            <button
              onClick={() => { playSound('success'); handleUpdateSettings(); }}
              disabled={updateSettings.isPending}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#C084FC] via-[#22D3EE] to-[#C084FC] text-black font-black text-sm shadow-xl shadow-[#C084FC]/25 transition-all hover:scale-[1.005] active:scale-[0.995] disabled:opacity-50"
            >
              {updateSettings.isPending ? "Saving to Database & Redis..." : "Save All Settings"}
            </button>
          </div>
        )}

        {/* ===================== 3. USER MANAGEMENT ===================== */}
        {adminTab === "users" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
                <input
                  type="text"
                  placeholder="Search user by username..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#09090b] border border-white/10 text-white text-xs focus:border-[#C084FC]"
                />
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
                <span>Total Users: <strong className="text-white">{usersData?.total ?? 0}</strong></span>
                <span>Page <strong className="text-[#22D3EE]">{usersData?.page ?? 1}</strong>/{usersData?.totalPages ?? 1}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {usersData?.items?.map((u: any) => {
                const isSuspended = u.status === "SUSPENDED";
                const isAdmin = u.role === "ADMIN" || u.role === "SUPERADMIN";
                const isSuper = u.role === "SUPERADMIN";
                const totalBal = Number(u.wallet?.playBalance || 0) + Number(u.wallet?.mainBalance || 0);
                const ticketCount = u._count?.tickets ?? 0;
                const txCount = u._count?.transactions ?? 0;
                const isHighValue = totalBal > 10000;
                const isHighVolume = ticketCount > 50;
                const isSuspicious = isHighValue || isHighVolume;

                return (
                  <div
                    key={u.id}
                    className={`glass-card rounded-2xl p-4 space-y-3 border flex flex-col justify-between ${
                      isSuspicious ? "border-amber-500/40" : "border-white/10"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-extrabold text-sm text-white">@{u.username || "Anonymous"}</span>
                        <div className="flex gap-1">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                              isSuper ? "bg-amber-500/20 text-amber-400" : isAdmin ? "bg-[#22D3EE]/20 text-[#22D3EE]" : "bg-white/10 text-slate-400"
                            }`}
                          >
                            {u.role}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                              isSuspended ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"
                            }`}
                          >
                            {u.status}
                          </span>
                        </div>
                      </div>

                      {isSuspicious && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-400 mb-1.5">
                          <AlertTriangle size={10} />
                          {isHighValue && "High Balance"}
                          {isHighValue && isHighVolume && " · "}
                          {isHighVolume && "High Volume"}
                        </div>
                      )}

                      <div className="text-xs text-slate-400 font-mono space-y-0.5">
                        <div>Telegram ID: {u.telegramId?.toString()}</div>
                        <div className="flex items-center gap-1">
                          <Wallet size={10} />
                          Balance: <strong className="text-emerald-400">{totalBal.toFixed(2)} ETB</strong>
                          <span className="text-[9px] text-slate-600">(play: {Number(u.wallet?.playBalance || 0).toFixed(0)})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-0.5">
                            <Ticket size={10} /> {ticketCount} tickets
                          </span>
                          <span className="flex items-center gap-0.5">
                            <ArrowUpDown size={10} /> {txCount} txns
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/10 flex items-center justify-end gap-2">
                      {currentUser?.role === "SUPERADMIN" && (
                        <button
                          onClick={() => { playSound(); handleToggleRole(u.id, u.role); }}
                          disabled={updateUserRole.isPending}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                            isAdmin
                              ? "bg-[#22D3EE]/20 text-[#22D3EE] hover:bg-[#22D3EE]/30"
                              : "bg-[#C084FC]/20 text-[#C084FC] hover:bg-[#C084FC]/30"
                          }`}
                        >
                          <UserCog size={14} />
                          {isAdmin ? "Demote" : "Promote"}
                        </button>
                      )}

                      <button
                        onClick={() => { playSound(); handleToggleStatus(u.id, u.status); }}
                        disabled={updateUserStatus.isPending}
                        className={`p-2 rounded-xl text-xs font-bold transition-all ${
                          isSuspended
                            ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                            : "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
                        }`}
                        title={isSuspended ? "Activate Account" : "Suspend Account"}
                      >
                        {isSuspended ? <UserCheck size={16} /> : <UserX size={16} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {usersData?.items?.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-xs">No registered users found matching search.</div>
            )}

            {/* Pagination */}
            {usersData && usersData.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button
                  onClick={() => { playSound(); setUserPage((p) => Math.max(1, p - 1)); }}
                  disabled={userPage <= 1}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-slate-400 hover:text-white disabled:opacity-30"
                >
                  Prev
                </button>
                <span className="text-xs text-slate-500 font-mono">{userPage} / {usersData.totalPages}</span>
                <button
                  onClick={() => { playSound(); setUserPage((p) => Math.min(usersData.totalPages, p + 1)); }}
                  disabled={userPage >= usersData.totalPages}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-slate-400 hover:text-white disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===================== 4. REPORTS & STATISTICS ===================== */}
        {adminTab === "reports" && (
          <div className="space-y-6">
            {/* Key Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="glass-card rounded-2xl p-5 border border-white/10 text-center">
                <div className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">Daily Games</div>
                <div className="font-black text-white text-2xl mt-1">{reports?.dailyGames ?? 0}</div>
              </div>
              <div className="glass-card rounded-2xl p-5 border border-white/10 text-center">
                <div className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">Active Today</div>
                <div className="font-black text-[#22D3EE] text-2xl mt-1">{activeToday}</div>
              </div>
              <div className="glass-card rounded-2xl p-5 border border-white/10 text-center">
                <div className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">Avg Bet Size</div>
                <div className="font-black text-[#C084FC] text-2xl mt-1">
                  {Number(reports?.averageBetAmount || 0).toFixed(2)} <span className="text-xs font-normal text-slate-500">ETB</span>
                </div>
              </div>
              <div className="glass-card rounded-2xl p-5 border border-white/10 text-center">
                <div className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">Registered</div>
                <div className="font-black text-white text-2xl mt-1">{totalRegistered}</div>
              </div>
              <div className="glass-card rounded-2xl p-5 border border-emerald-500/20 text-center">
                <div className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">Retention</div>
                <div className="font-black text-emerald-400 text-2xl mt-1">{retentionPct}%</div>
                <div className="text-[10px] text-slate-500 mt-1">active / registered</div>
              </div>
            </div>

            {/* Popular Numbers */}
            <div className="glass-card rounded-3xl p-6 space-y-4 border border-white/10">
              <h4 className="text-sm font-extrabold text-slate-200">Most Popular Picked Numbers (Frequency Analysis 1-80)</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-xs">
                {reports?.popularNumbers?.map((p: any) => (
                  <div key={p.number} className="flex justify-between items-center bg-[#000000] p-3 rounded-xl border border-white/10">
                    <span className="font-extrabold text-[#22D3EE] text-sm">#{p.number}</span>
                    <span className="text-slate-400 font-mono">{p.count} picks</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
