import { useState, useMemo } from "react";
import { useSettledGames, useProvablyFair } from "../lib/hooks";
import { gameApi } from "../lib/api";
import { playSound } from "../lib/sound";
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Hash,
  RotateCcw,
  Copy,
} from "lucide-react";
import { useAppStore } from "../lib/store";
import { sha256, generateDrawNumbers } from "../lib/crypto";

interface FairnessRecord {
  gameId: string;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

interface SettledGame {
  id: string;
  roundNumber: number;
  mode?: string;
  status: string;
  drawNumbers?: number[];
  fairness?: FairnessRecord;
}

interface VerifyResult {
  computedHash: string;
  expectedHash?: string;
  hashMatch?: boolean;
  drawNumbers: number[];
  actualDraw?: number[];
  drawMatch?: boolean;
}

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function truncate(value: string, len = 16): string {
  if (!value) return "—";
  return value.length <= len ? value : `${value.slice(0, len)}…`;
}

export default function ProvablyFair() {
  const { language, clientSeed: myClientSeed } = useAppStore();
  const { data: settledGames } = useSettledGames();
  const [selectedGameId, setSelectedGameId] = useState("");
  const [clientSeedInput, setClientSeedInput] = useState(myClientSeed);
  const [serverSeedInput, setServerSeedInput] = useState("");
  const [nonceInput, setNonceInput] = useState(0);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: record } = useProvablyFair(selectedGameId, {
    enabled: mode === "auto" && !!selectedGameId,
  });

  const games = useMemo(
    () =>
      Array.isArray(settledGames)
        ? settledGames.filter((g: any) => g.status === "COMPLETED")
        : [],
    [settledGames],
  );
  const selectedGame = useMemo(
    () => games.find((g: any) => g.id === selectedGameId),
    [games, selectedGameId],
  );
  const actualDraw = useMemo(() => {
    const d = (selectedGame as any)?.drawNumbers;
    return Array.isArray(d) ? d.map(Number).sort((a, b) => a - b) : [];
  }, [selectedGame]);

  const isAm = language === "am";

  const str = {
    title: isAm ? "ፍትሃዊነት" : "Provably Fair",
    subtitle: isAm
      ? "እያንዳንዱ ዙር በክሪፕቶግራፊ የተመሰጠረ እና በእርስዎ የሚረጋገጥ ነው።"
      : "Every round is cryptographically verifiable by you.",
    autoTab: isAm ? "በራስ-ሰር ማረጋገጥ" : "Auto Verify",
    manualTab: isAm ? "በእጅ ማረጋገጥ" : "Manual",
    selectRound: isAm ? "የተጠናቀቀ ዙር ይምረጡ" : "Select a Completed Round",
    noRounds: isAm ? "እስካሁን የተጠናቀቀ ዙር የለም።" : "No completed rounds yet.",
    selectPlaceholder: isAm ? "-- ዙር ይምረጡ --" : "-- Select Round --",
    recordTitle: isAm ? "የፍትሃዊነት መዝገብ" : "Fairness Record",
    copySeeds: isAm ? "ሴዶችን ቅዳ" : "Copy Seeds",
    committedHash: isAm ? "የታተመ ሃሽ" : "Committed Hash",
    serverSeed: isAm ? "የተገለጠ ሰርቨር ሴድ" : "Revealed Server Seed",
    clientSeed: isAm ? "የደንበኛ ሴድ" : "Client Seed",
    verify: isAm ? "ዙሩን አረጋግጥ" : "Verify Round",
    verifying: isAm ? "በማረጋገጥ ላይ..." : "Verifying...",
    manualTitle: isAm ? "በእጅ ማረጋገጥ" : "Manual Verification",
    manualServerPh: isAm
      ? "የሰርቨር ሴድ (ከጨዋታ በኋላ የተገለጠ)"
      : "Server seed (revealed after the draw)",
    manualClientPh: isAm ? "የደንበኛ ሴድ" : "Client seed",
    noncePh: "Nonce",
    compute: isAm ? "አስላ እና አረጋግጥ" : "Compute & Verify",
    computing: isAm ? "በማስላት ላይ..." : "Computing...",
    compareOptional: isAm
      ? "ለማነጻጸር ዙር ይምረጡ (አማራጭ)"
      : "Round to compare against (optional)",
    verified: isAm ? "ተረጋግጧል" : "VERIFIED",
    failed: isAm ? "አልተረጋገጠም" : "FAILED",
    checkSeed: isAm ? "የሰርቨር ሴድ ሃሽ" : "Server Seed Hash",
    checkDraw: isAm ? "የጨዋታው ውጤት ቁጥሮች" : "Draw Numbers",
    match: isAm ? "ይዛመዳል" : "MATCH",
    mismatch: isAm ? "አይዛመድም" : "MISMATCH",
    nA: isAm ? "የለም" : "N/A",
    actual: isAm ? "ትክክለኛው ውጤት" : "Actual Draw",
    computed: isAm ? "የተሰላው ውጤት" : "Computed Draw",
    computedHash: isAm ? "የተሰላ ሃሽ" : "Computed Hash",
    another: isAm ? "ሌላ ዙር አረጋግጥ" : "Verify Another Round",
    seedIntegrity: isAm ? "የሴድ ትክክለኛነት" : "Seed integrity",
    drawIntegrity: isAm ? "የውጤት ትክክለኛነት" : "Draw integrity",
  };

  const handleAutoVerify = async () => {
    if (!record) return;
    setVerifying(true);
    setError(null);
    try {
      const [computedHash, computedDraw] = await Promise.all([
        sha256(record.serverSeed),
        generateDrawNumbers(record.serverSeed, record.clientSeed, record.nonce),
      ]);
      const hashMatch = computedHash === record.serverSeedHash;
      const drawMatch =
        actualDraw.length > 0 && arraysEqual(computedDraw, actualDraw);
      setResult({
        computedHash,
        expectedHash: record.serverSeedHash,
        hashMatch,
        drawNumbers: computedDraw,
        actualDraw: actualDraw.length > 0 ? actualDraw : undefined,
        drawMatch: actualDraw.length > 0 ? drawMatch : undefined,
      });
    } catch {
      setError(isAm ? "ማረጋገጥ አልተሳካም" : "Verification computation failed");
    } finally {
      setVerifying(false);
    }
  };

  const handleManualVerify = async () => {
    if (!serverSeedInput || !clientSeedInput) return;
    setVerifying(true);
    setError(null);
    try {
      const [computedHash, computedDraw] = await Promise.all([
        sha256(serverSeedInput),
        generateDrawNumbers(serverSeedInput, clientSeedInput, nonceInput),
      ]);

      let serverActual: number[] = [];
      if (selectedGameId) {
        const game = await gameApi.result(selectedGameId);
        serverActual = Array.isArray(game?.drawNumbers)
          ? game.drawNumbers.map(Number).sort((a, b) => a - b)
          : [];
      }

      const hasActual = serverActual.length > 0;
      setResult({
        computedHash,
        drawNumbers: computedDraw,
        actualDraw: hasActual ? serverActual : undefined,
        drawMatch: hasActual
          ? arraysEqual(computedDraw, serverActual)
          : undefined,
      });
    } catch {
      setError(isAm ? "ማስላት አልተሳካም" : "Computation failed");
    } finally {
      setVerifying(false);
    }
  };

  const reset = () => {
    setSelectedGameId("");
    setServerSeedInput("");
    setClientSeedInput(myClientSeed);
    setNonceInput(0);
    setResult(null);
    setError(null);
    setCopied(false);
  };

  const handleCopySeeds = async () => {
    if (!record) return;
    const text = `Server Seed: ${record.serverSeed}\nServer Seed Hash: ${record.serverSeedHash}\nClient Seed: ${record.clientSeed}\nNonce: ${record.nonce}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      playSound("success");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(isAm ? "ቅዳ አልተሳካም" : "Copy failed");
    }
  };

  const overallPassed =
    result &&
    (result.hashMatch ?? true) !== false &&
    (result.drawMatch ?? true) !== false;
  const hasChecks =
    result &&
    (result.hashMatch !== undefined || result.drawMatch !== undefined);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass-card rounded-2xl p-4 border border-white/10 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-emerald-500/20 to-[#22D3EE]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-3 relative">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-[#22D3EE] flex items-center justify-center text-black shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="font-extrabold text-white text-base">{str.title}</h2>
            <p className="text-[11px] text-slate-400">{str.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 bg-black rounded-xl p-1 border border-white/10">
        <button
          onClick={() => {
            playSound("click");
            setMode("auto");
            reset();
          }}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${mode === "auto" ? "bg-gradient-to-r from-emerald-500 to-[#22D3EE] text-black" : "text-slate-400 hover:text-white"}`}
        >
          {str.autoTab}
        </button>
        <button
          onClick={() => {
            playSound("click");
            setMode("manual");
            reset();
          }}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${mode === "manual" ? "bg-gradient-to-r from-emerald-500 to-[#22D3EE] text-black" : "text-slate-400 hover:text-white"}`}
        >
          {str.manualTab}
        </button>
      </div>

      {/* AUTO MODE */}
      {mode === "auto" && (
        <div className="glass-card rounded-2xl p-4 space-y-3 border border-white/10">
          <div className="flex items-center gap-2">
            <Hash size={16} className="text-emerald-400" />
            <h3 className="font-bold text-sm text-white">{str.selectRound}</h3>
          </div>

          {games.length === 0 ? (
            <p className="text-xs text-slate-400">{str.noRounds}</p>
          ) : (
            <select
              value={selectedGameId}
              onChange={(e) => {
                setSelectedGameId(e.target.value);
                setResult(null);
                setError(null);
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-black border border-white/10 text-white text-xs appearance-none cursor-pointer focus:outline-none focus:border-emerald-500"
            >
              <option value="">{str.selectPlaceholder}</option>
              {games.map((g: any) => (
                <option key={g.id} value={g.id}>
                  {isAm ? `ዙር #${g.roundNumber}` : `Round #${g.roundNumber}`} —{" "}
                  {g.mode === "INSTANT"
                    ? isAm
                      ? "ፈጣን"
                      : "Instant"
                    : isAm
                      ? "ክላሲክ"
                      : "Classic"}{" "}
                  — {new Date(g.startedAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          )}

          {record && (
            <div className="bg-black/60 rounded-xl p-3 space-y-2 border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                  <KeyRound size={11} className="text-emerald-400" />
                  {str.recordTitle}
                </span>
              </div>
              <div className="text-[11px] space-y-1.5 font-mono text-slate-300">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-500 shrink-0">
                    {str.committedHash}:
                  </span>
                  <span className="text-emerald-400 break-all text-right">
                    {truncate(record.serverSeedHash, 24)}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-500 shrink-0">
                    {str.serverSeed}:
                  </span>
                  <span className="text-white break-all text-right">
                    {truncate(record.serverSeed, 24)}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-500 shrink-0">
                    {str.clientSeed}:
                  </span>
                  <span className="text-[#22D3EE] break-all text-right">
                    {truncate(record.clientSeed, 24)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Nonce:</span>
                  <span className="text-white">{record.nonce}</span>
                </div>
              </div>
              <button
                onClick={handleCopySeeds}
                className="w-full mt-1 py-2 rounded-xl bg-white/5 text-slate-300 text-[11px] font-bold hover:bg-white/10 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
              >
                {copied ? (
                  <>
                    <CheckCircle2 size={13} className="text-emerald-400" />
                    {isAm ? "ተቀድቷል!" : "Copied to clipboard!"}
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    {str.copySeeds}
                  </>
                )}
              </button>
            </div>
          )}

          <button
            onClick={() => {
              playSound("select");
              handleAutoVerify();
            }}
            disabled={verifying || !record}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-[#22D3EE] text-black font-extrabold text-sm hover:opacity-90 active:scale-[0.99] disabled:opacity-40 transition-all"
          >
            {verifying ? str.verifying : str.verify}
          </button>
        </div>
      )}

      {/* MANUAL MODE */}
      {mode === "manual" && (
        <div className="glass-card rounded-2xl p-4 space-y-3 border border-white/10">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-[#C084FC]" />
            <h3 className="font-bold text-sm text-white">{str.manualTitle}</h3>
          </div>

          <input
            type="text"
            placeholder={str.manualServerPh}
            value={serverSeedInput}
            onChange={(e) => setServerSeedInput(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-black border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-[#C084FC]"
          />
          <input
            type="text"
            placeholder={str.manualClientPh}
            value={clientSeedInput}
            onChange={(e) => setClientSeedInput(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-black border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-[#22D3EE]"
          />
          <input
            type="number"
            placeholder={str.noncePh}
            value={nonceInput}
            onChange={(e) => setNonceInput(Number(e.target.value))}
            className="w-full px-3 py-2.5 rounded-xl bg-black border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-[#C084FC]"
          />

          {games.length > 0 && (
            <select
              value={selectedGameId}
              onChange={(e) => {
                setSelectedGameId(e.target.value);
                setResult(null);
                setError(null);
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-black border border-white/10 text-white text-xs appearance-none cursor-pointer focus:outline-none focus:border-emerald-500"
            >
              <option value="">{str.compareOptional}</option>
              {games.map((g: any) => (
                <option key={g.id} value={g.id}>
                  {isAm ? `ዙር #${g.roundNumber}` : `Round #${g.roundNumber}`}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => {
              playSound("select");
              handleManualVerify();
            }}
            disabled={verifying || !serverSeedInput || !clientSeedInput}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#C084FC] to-[#22D3EE] text-black font-extrabold text-sm hover:opacity-90 active:scale-[0.99] disabled:opacity-40 transition-all"
          >
            {verifying ? str.computing : str.compute}
          </button>
        </div>
      )}

      {/* VERIFICATION RESULT */}
      {result && !verifying && (
        <div
          className={`glass-card rounded-2xl p-4 space-y-3 border ${hasChecks && !overallPassed ? "border-rose-500/40" : "border-emerald-500/40"}`}
        >
          {/* Badge */}
          <div
            className={`flex items-center gap-2 ${hasChecks ? (overallPassed ? "text-emerald-400" : "text-rose-400") : "text-slate-300"}`}
          >
            {hasChecks && overallPassed ? (
              <CheckCircle2 size={26} />
            ) : hasChecks ? (
              <XCircle size={26} />
            ) : (
              <ShieldCheck size={26} className="text-[#C084FC]" />
            )}
            <span className="font-extrabold text-base">
              {hasChecks && overallPassed
                ? str.verified
                : hasChecks
                  ? str.failed
                  : str.computedHash}
            </span>
          </div>

          {/* Seed hash check */}
          {result.hashMatch !== undefined && (
            <div className="bg-black/60 rounded-xl p-3 text-xs space-y-1.5 border border-white/5">
              <div className="flex items-center gap-1.5">
                {result.hashMatch ? (
                  <CheckCircle2 size={14} className="text-emerald-400" />
                ) : (
                  <XCircle size={14} className="text-rose-400" />
                )}
                <span className="font-bold text-white">
                  {str.checkSeed} · SHA256
                </span>
                <span
                  className={`ml-auto font-black ${result.hashMatch ? "text-emerald-400" : "text-rose-400"}`}
                >
                  {result.hashMatch ? str.match : str.mismatch}
                </span>
              </div>
              <div className="space-y-0.5 font-mono text-[10px]">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-500 shrink-0">
                    {str.computedHash}:
                  </span>
                  <span className="text-slate-300 break-all text-right">
                    {result.computedHash}
                  </span>
                </div>
                {result.expectedHash && (
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-slate-500 shrink-0">
                      {str.committedHash}:
                    </span>
                    <span className="text-emerald-400 break-all text-right">
                      {result.expectedHash}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Draw check */}
          {result.actualDraw && result.drawMatch !== undefined && (
            <div className="bg-black/60 rounded-xl p-3 text-xs space-y-1.5 border border-white/5">
              <div className="flex items-center gap-1.5">
                {result.drawMatch ? (
                  <CheckCircle2 size={14} className="text-emerald-400" />
                ) : (
                  <XCircle size={14} className="text-rose-400" />
                )}
                <span className="font-bold text-white">
                  {str.checkDraw} · HMAC-SHA256
                </span>
                <span
                  className={`ml-auto font-black ${result.drawMatch ? "text-emerald-400" : "text-rose-400"}`}
                >
                  {result.drawMatch ? str.match : str.mismatch}
                </span>
              </div>

              <div>
                <div className="text-[10px] text-slate-500 mb-1">
                  {str.actual} ({result.actualDraw.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {result.actualDraw.map((n) => (
                    <span
                      key={`a${n}`}
                      className="inline-flex items-center justify-center min-w-7 h-7 px-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-[10px] font-bold"
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Computed draw */}
          <div className="bg-black/60 rounded-xl p-3 text-xs space-y-1.5 border border-white/5">
            <div className="flex items-center gap-1.5">
              <Hash size={13} className="text-[#C084FC]" />
              <span className="font-bold text-white">
                {str.computed} ({result.drawNumbers.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {result.drawNumbers.map((n) => (
                <span
                  key={`c${n}`}
                  className="inline-flex items-center justify-center min-w-7 h-7 px-1 rounded-lg bg-[#C084FC]/15 text-[#C084FC] text-[10px] font-bold"
                >
                  {n}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              playSound("click");
              reset();
            }}
            className="w-full py-2.5 rounded-xl bg-white/5 text-slate-400 text-xs font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-1.5"
          >
            <RotateCcw size={13} />
            {str.another}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass-card rounded-2xl p-4 border border-rose-500/30 flex items-center gap-2">
          <ShieldAlert size={16} className="text-rose-400 shrink-0" />
          <p className="text-xs text-rose-400">{error}</p>
        </div>
      )}
    </div>
  );
}
