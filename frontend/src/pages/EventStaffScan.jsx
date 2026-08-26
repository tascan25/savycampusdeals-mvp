import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { CheckCircle2, Gift, Keyboard, Loader2, LogOut, QrCode, ScanLine, ShieldAlert, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function EventStaffScan() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initial = new URLSearchParams(location.search).get("g") || "";
  const [manual, setManual] = useState(initial);
  const [mode, setMode] = useState(initial ? "manual" : "camera");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scannerRef = useRef(null);
  const scannedRef = useRef(false);

  const lookup = async (payload) => {
    if (!payload || busy) return;
    setBusy(true); setError("");
    try { const { data } = await api.post("/freshers/staff/lookup", { payload }); setResult(data); }
    catch (e) { const message = formatApiError(e.response?.data?.detail); setError(message); toast.error(message); }
    finally { setBusy(false); }
  };

  useEffect(() => { if (initial) lookup(initial); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (mode !== "camera" || result) return undefined;
    scannedRef.current = false;
    const scanner = new Html5Qrcode("freshers-qr-reader");
    scannerRef.current = scanner;
    scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, async (decoded) => {
      if (scannedRef.current) return;
      scannedRef.current = true;
      await scanner.stop().catch(() => {});
      lookup(decoded);
    }, () => {}).catch(() => setError("Camera could not start. Use manual entry instead."));
    return () => { scanner.stop().catch(() => {}); scanner.clear().catch(() => {}); };
  }, [mode, result]); // eslint-disable-line react-hooks/exhaustive-deps

  const collect = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/freshers/staff/collect", { payload: result.code });
      toast.success(`Goodies handed to ${data.student_name}`);
      setResult({ ...result, status: "collected", collected_at: data.collected_at, collected_by: data.approved_by });
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  const reset = () => { setResult(null); setManual(""); setError(""); scannedRef.current = false; };

  return <div className="min-h-screen bg-[#050505] px-5 py-8 text-white">
    <header className="mx-auto flex max-w-lg items-center justify-between"><div><p className="text-xs uppercase tracking-[0.22em] text-indigo-300">KIET Freshers 2026</p><h1 className="mt-1 font-display text-2xl font-black">Goodies scanner</h1></div><button onClick={async () => { await logout(); navigate("/login"); }} className="rounded-xl border border-white/10 p-2 text-zinc-400"><LogOut size={18} /></button></header>
    <main className="mx-auto mt-7 max-w-lg">
      {!result && <><div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1"><button onClick={() => setMode("camera")} className={`flex-1 rounded-lg py-2 text-sm ${mode === "camera" ? "bg-white text-black" : "text-zinc-400"}`}><ScanLine className="mr-2 inline" size={15}/>Camera</button><button onClick={() => setMode("manual")} className={`flex-1 rounded-lg py-2 text-sm ${mode === "manual" ? "bg-white text-black" : "text-zinc-400"}`}><Keyboard className="mr-2 inline" size={15}/>Code</button></div>
        {mode === "camera" ? <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-black p-3"><div id="freshers-qr-reader" /></div> : <form className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5" onSubmit={(e) => { e.preventDefault(); lookup(manual); }}><label className="text-xs uppercase tracking-wider text-zinc-500">Goodies pass code</label><input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="KFG-..." className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-indigo-400"/><button disabled={busy || !manual} className="mt-3 w-full rounded-xl bg-white py-3 font-bold text-black disabled:opacity-50">{busy ? <Loader2 className="mx-auto animate-spin" size={17}/> : "Find pass"}</button></form>}
        {error && <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>}</>}
      {result && <section className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-6"><button onClick={reset} className="absolute right-4 top-4 text-zinc-500"><X size={18}/></button><div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${result.status === "active" ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300" : "border-amber-400/20 bg-amber-500/10 text-amber-200"}`}>{result.status === "active" ? <CheckCircle2 size={14}/> : <ShieldAlert size={14}/>} {result.status === "active" ? "Eligible — not collected" : result.status}</div><Gift className="mt-6 text-indigo-300"/><h2 className="mt-2 font-display text-3xl font-black">{result.student_name}</h2><p className="mt-1 text-zinc-400">Registration position #{result.position}</p><div className="mt-5 grid gap-3 rounded-2xl bg-black/25 p-4 text-sm"><p><span className="text-zinc-500">Student number:</span> {result.student_number || "—"}</p><p><span className="text-zinc-500">Email:</span> {result.student_email}</p><p><span className="text-zinc-500">Includes:</span> {result.goodies}</p></div>{result.status === "active" && result.student_verified ? <button disabled={busy} onClick={collect} className="mt-6 w-full rounded-full bg-emerald-300 py-3 font-black text-emerald-950 disabled:opacity-50">{busy ? <Loader2 className="mx-auto animate-spin"/> : "Mark goodies as collected"}</button> : <div className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] p-4 text-sm text-amber-100">{result.status === "collected" ? `Already collected ${result.collected_at ? new Date(result.collected_at).toLocaleString("en-IN") : ""} by ${result.collected_by || "event staff"}.` : "Do not distribute this reward."}</div>}<button onClick={reset} className="mt-3 w-full rounded-full border border-white/10 py-3 text-sm font-bold">Scan another</button></section>}
    </main>
  </div>;
}
