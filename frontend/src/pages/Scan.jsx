import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Html5Qrcode } from "html5-qrcode";
import { useQuery } from "@tanstack/react-query";
import { QrCode, ScanLine, BadgeCheck, ShieldAlert, Ticket, CheckCircle2, X, Camera, Keyboard, Loader2, Gift } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

function ResultCard({ result, onRedeem, onClose, redeeming }) {
  if (!result) return null;

  if (result.kind === "student") {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-heavy rounded-3xl p-6 max-w-md w-full relative" data-testid="scan-student-result">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white"><X size={18}/></button>
        <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
          result.verified && !result.expired
            ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
            : "bg-red-500/15 text-red-300 border-red-400/30"
        }`}>
          {result.verified && !result.expired ? <BadgeCheck size={14}/> : <ShieldAlert size={14}/>}
          {result.verified && !result.expired ? "Verified student" : result.expired ? "Pass expired" : "Not verified"}
        </div>
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">Name</div>
          <div className="font-display text-2xl font-extrabold" data-testid="scan-student-name">{result.name || "—"}</div>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">College</div>
              <div className="text-sm text-white">{result.college || "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">Course · Year</div>
              <div className="text-sm text-white">{[result.course, result.year].filter(Boolean).join(" · ") || "—"}</div>
            </div>
            <div className="col-span-2">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">Student number</div>
              <div className="font-mono text-white">{result.student_number || "—"}</div>
            </div>
            <div className="col-span-2">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">Valid till</div>
              <div className="text-sm text-white">{result.expiry ? new Date(result.expiry).toLocaleDateString("en-IN", { month:"short", year:"numeric"}) : "—"}</div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (result.kind === "level_reward") {
    const active = result.status === "active" && !result.expired;
    const studentOk = result.student_verified;
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-heavy relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-300/20 p-6" data-testid="scan-level-reward-result">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-400 to-amber-300" />
        <button onClick={onClose} className="absolute right-4 top-4 text-zinc-400 hover:text-white"><X size={18}/></button>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-200"><Gift size={14}/> Savvy level reward</div>
        <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-violet-300">{result.tier_name}</p>
        <h2 className="mt-2 font-display text-2xl font-extrabold leading-tight">{result.reward_title}</h2>
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">Reward belongs to</p>
          <p className="mt-1 font-display text-xl font-bold">{result.student_name || "—"}</p>
          <p className="mt-1 text-sm text-zinc-400">{result.student_college || result.student_number || "—"}</p>
          <div className={`mt-3 inline-flex items-center gap-1.5 text-xs font-semibold ${studentOk ? "text-emerald-300" : "text-rose-300"}`}>
            {studentOk ? <BadgeCheck size={14}/> : <ShieldAlert size={14}/>} {studentOk ? "Verified student" : "Student verification inactive"}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] p-3">
          <div><p className="text-[10px] uppercase tracking-widest text-zinc-500">Reward code</p><p className="mt-1 font-mono text-sm font-bold">{result.code}</p></div>
          <div className="text-right"><p className="text-[10px] uppercase tracking-widest text-zinc-500">Valid until</p><p className="mt-1 text-sm">{result.expires_at ? new Date(result.expires_at).toLocaleDateString("en-IN") : "—"}</p></div>
        </div>
        {active && studentOk ? (
          <button data-testid="scan-redeem-level-reward-btn" disabled={redeeming} onClick={onRedeem} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 font-semibold text-black transition-transform hover:scale-[1.02] disabled:opacity-60">
            {redeeming ? <Loader2 size={16} className="animate-spin"/> : <><CheckCircle2 size={16}/> Approve reward redemption</>}
          </button>
        ) : (
          <div className={`mt-6 rounded-xl border p-3 text-center text-sm ${result.status === "redeemed" ? "border-violet-400/20 bg-violet-500/10 text-violet-200" : "border-rose-400/20 bg-rose-500/10 text-rose-200"}`}>
            {result.status === "redeemed" ? `Already redeemed on ${new Date(result.redeemed_at).toLocaleString("en-IN")}` : result.expired ? "This reward has expired." : "Do not approve — student verification is inactive."}
          </div>
        )}
      </motion.div>
    );
  }

  if (result.kind === "coupon") {
    const active = result.status === "active" && !result.expired;
    const studentOk = result.student_verified && !result.student_expiry_expired;
    const initial = (result.student_name || "?")[0].toUpperCase();
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-heavy rounded-3xl p-6 max-w-md w-full relative" data-testid="scan-coupon-result">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white"><X size={18}/></button>

        {/* Student verification is now the hero of the coupon result */}
        <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
          studentOk ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
          : "bg-red-500/15 text-red-300 border-red-400/30"
        }`}>
          {studentOk ? <BadgeCheck size={14}/> : <ShieldAlert size={14}/>}
          {studentOk ? "Verified SavyCampusDeals member" : result.student_expiry_expired ? "Pass expired" : "Not verified"}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center font-display font-extrabold text-2xl text-white">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="font-display text-xl font-extrabold truncate" data-testid="scan-coupon-student-name">{result.student_name || "—"}</div>
            <div className="text-sm text-zinc-400 truncate">{result.student_college || result.student_email || "—"}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Course · Year</div>
            <div className="text-sm text-white mt-1">{[result.student_course, result.student_year].filter(Boolean).join(" · ") || "—"}</div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Student ID</div>
            <div className="font-mono text-sm text-white mt-1" data-testid="scan-coupon-student-number">{result.student_number || "—"}</div>
          </div>
          <div className="col-span-2 rounded-xl bg-white/5 border border-white/10 p-3">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Pass valid till</div>
            <div className="text-sm text-white mt-1">
              {result.student_expiry ? new Date(result.student_expiry).toLocaleDateString("en-IN", { month: "short", year: "numeric", day: "numeric" }) : "—"}
            </div>
          </div>
        </div>

        {/* Coupon summary (secondary) */}
        <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-indigo-300 flex items-center gap-1">
              {active ? <Ticket size={11}/> : result.status === "redeemed" ? <CheckCircle2 size={11}/> : <ShieldAlert size={11}/>}
              {active ? "Active coupon" : result.status === "redeemed" ? "Already redeemed" : "Expired coupon"}
            </div>
            <div className="text-sm font-semibold truncate" data-testid="scan-coupon-brand">{result.brand}</div>
            <div className="text-xs text-zinc-400 truncate">{result.offer_title}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-display text-xl font-extrabold">{result.discount}</div>
            <div className="font-mono text-[10px] text-zinc-500 mt-0.5" data-testid="scan-coupon-code">{result.code}</div>
          </div>
        </div>

        {active && studentOk && (
          <button
            data-testid="scan-redeem-btn"
            disabled={redeeming}
            onClick={onRedeem}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full bg-white text-black font-semibold py-3 hover:scale-[1.02] transition-transform disabled:opacity-60"
          >
            {redeeming ? <Loader2 size={16} className="animate-spin"/> : <><CheckCircle2 size={16}/> Approve & mark as redeemed</>}
          </button>
        )}
        {active && !studentOk && (
          <div className="mt-6 rounded-xl bg-red-500/10 border border-red-400/30 text-red-200 text-sm text-center p-3">
            Do not approve — the student is not verified.
          </div>
        )}
        {!active && (
          <div className="mt-6 text-center text-sm text-zinc-500">
            {result.status === "redeemed" ? `Redeemed on ${new Date(result.redeemed_at).toLocaleString()}` : "This coupon cannot be redeemed."}
          </div>
        )}
      </motion.div>
    );
  }
  return null;
}

export default function Scan() {
  const { user } = useAuth();
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const urlCode = urlParams.get("c");         // coupon code
  const urlReward = urlParams.get("r");       // level reward code
  const urlStudent = urlParams.get("s");      // student number
  const urlPayload = urlParams.get("p");      // raw payload (legacy)
  const cameFromQrScan = Boolean(urlCode || urlReward || urlStudent || urlPayload);

  const [mode, setMode] = useState(cameFromQrScan ? "manual" : "camera");
  const [manual, setManual] = useState("");
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [err, setErr] = useState("");
  const scannerRef = useRef(null);
  const readerId = "qr-reader-region";
  const activeRef = useRef(false);
  const autoLookupRef = useRef(false);
  const partner = useQuery({
    queryKey: ["partner-profile"],
    queryFn: async () => (await api.get("/partner/profile")).data,
  });

  const lookup = async (payload) => {
    setErr("");
    try {
      const { data } = await api.post("/scan/lookup", { payload });
      setResult(data);
      if (data.kind === "student") toast.success(data.verified ? "Verified student!" : "Not verified");
      if (data.kind === "coupon") toast.success("Coupon found");
      if (data.kind === "level_reward") toast.success("Level reward found");
    } catch (e) {
      const msg = formatApiError(e.response?.data?.detail);
      setErr(msg);
      toast.error(msg);
    }
  };

  // Auto-lookup when the user lands here from a QR-code URL scanned by their phone camera.
  useEffect(() => {
    if (autoLookupRef.current) return;
    const value = urlCode || urlReward || urlStudent || urlPayload;
    if (value) {
      autoLookupRef.current = true;
      lookup(value);
    }
    // eslint-disable-next-line
  }, []);

  const startScan = async () => {
    if (activeRef.current) return;
    setErr("");
    setResult(null);
    try {
      const scanner = new Html5Qrcode(readerId);
      scannerRef.current = scanner;
      activeRef.current = true;
      setScanning(true);
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decoded) => {
          try { await scanner.stop(); } catch {}
          activeRef.current = false;
          setScanning(false);
          await lookup(decoded);
        },
        () => {}
      );
    } catch (e) {
      setScanning(false);
      activeRef.current = false;
      setErr("Camera unavailable. Try Manual mode.");
    }
  };

  const stopScan = async () => {
    if (scannerRef.current && activeRef.current) {
      try { await scannerRef.current.stop(); } catch {}
    }
    activeRef.current = false;
    setScanning(false);
  };

  useEffect(() => {
    return () => { stopScan(); };
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (mode === "camera" && !result) startScan();
    else stopScan();
    // eslint-disable-next-line
  }, [mode, result]);

  const submitManual = async (e) => {
    e.preventDefault();
    if (!manual.trim()) return;
    await lookup(manual.trim());
  };

  const onRedeem = async () => {
    if (!result || !["coupon", "level_reward"].includes(result.kind)) return;
    setRedeeming(true);
    try {
      const { data } = await api.post("/scan/redeem", { payload: result.code });
      toast.success(data.kind === "level_reward" ? `${data.tier_name} reward redeemed for ${data.student_name}` : `Redeemed ${data.brand} coupon for ${data.student_name}`);
      setResult({ ...result, status: "redeemed", redeemed_at: data.redeemed_at });
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setRedeeming(false);
    }
  };

  const reset = () => { setResult(null); setManual(""); setErr(""); };

  return (
    <div className="min-h-screen bg-[#050505] grain">
      <Navbar />
      <div className="aurora bg-emerald-500/15" style={{ width: 500, height: 500, top: 0, right: -100 }} />
      <div className="max-w-3xl mx-auto px-6 pt-28 pb-16 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-400 flex items-center gap-2"><ScanLine size={12}/> Restaurant scanner</div>
          <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tighter mt-2">Scan a Savy pass or coupon.</h1>
          <p className="text-zinc-400 mt-3">Point your camera at the student's QR to verify them or redeem a coupon.</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200" data-testid="scanner-outlet-badge">
            <BadgeCheck size={13} />
            {user?.role === "admin" ? "Admin scanner access" : partner.isLoading ? "Loading outlet…" : partner.data?.outlet?.name || "Outlet assignment unavailable"}
          </div>
        </motion.div>

        {/* Mode switch */}
        <div className="mt-8 inline-flex glass-heavy rounded-full p-1">
          <button
            data-testid="scan-mode-camera"
            onClick={() => setMode("camera")}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm ${mode === "camera" ? "bg-white text-black" : "text-zinc-300"}`}
          ><Camera size={14}/> Camera</button>
          <button
            data-testid="scan-mode-manual"
            onClick={() => setMode("manual")}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm ${mode === "manual" ? "bg-white text-black" : "text-zinc-300"}`}
          ><Keyboard size={14}/> Enter code</button>
        </div>

        <div className="mt-6 grid md:grid-cols-2 gap-6">
          <div className="glass-heavy rounded-3xl p-4 min-h-[320px]">
            {mode === "camera" ? (
              <>
                <div id={readerId} className="rounded-2xl overflow-hidden aspect-square bg-black/60 border border-white/10" />
                <div className="text-xs text-zinc-500 mt-3 text-center">
                  {scanning ? "Align the QR inside the frame…" : result ? "Scan captured. Try another?" : "Grant camera access to start scanning."}
                </div>
                {result && (
                  <button data-testid="scan-again-btn" onClick={reset} className="mt-3 w-full rounded-full bg-white/10 text-white text-sm py-2 hover:bg-white/20">Scan again</button>
                )}
              </>
            ) : (
              <form onSubmit={submitManual} className="h-full flex flex-col justify-center">
                <label className="text-xs uppercase tracking-widest text-zinc-500">Coupon or student code</label>
                <input
                  data-testid="scan-manual-input"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  placeholder="SCD-XXXXXXXX or SVR-XXXXXXXXXX"
                  className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white font-mono focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none"
                />
                <button data-testid="scan-manual-submit" className="mt-4 rounded-full bg-white text-black font-semibold py-3">Look up</button>
              </form>
            )}
          </div>

          <div className="min-h-[320px]">
            <AnimatePresence mode="wait">
              {result ? (
                <ResultCard key="res" result={result} onRedeem={onRedeem} onClose={reset} redeeming={redeeming} />
              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-3xl p-6 h-full flex items-center justify-center text-center">
                  <div>
                    <div className="h-14 w-14 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-500 grid place-items-center">
                      <QrCode className="text-white" size={22}/>
                    </div>
                    <div className="mt-3 font-display font-semibold text-lg">Waiting for a scan</div>
                    <div className="text-sm text-zinc-400 mt-1">
                      Scan a <span className="text-emerald-300">student pass</span>, <span className="text-indigo-300">coupon</span>, or <span className="text-amber-200">level reward</span>.
                    </div>
                    {err && <div className="mt-4 text-xs text-red-400">{err}</div>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-10 text-xs text-zinc-500 text-center">
          Signed in as {partner.data?.name || user?.name || "partner"}. <Link to="/" className="text-white hover:text-emerald-300 underline">Home →</Link>
        </div>
      </div>
    </div>
  );
}
