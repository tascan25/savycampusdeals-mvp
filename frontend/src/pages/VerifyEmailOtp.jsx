import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, MailCheck, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function VerifyEmailOtp() {
  const { user, refreshUser, setUser } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const email = user?.email || loc.state?.email || "";
  const initialOtp = loc.state?.dev_otp || "";
  const emailSent = loc.state?.email_sent;
  const [digits, setDigits] = useState(
    initialOtp && /^\d{6}$/.test(initialOtp) ? initialOtp.split("") : ["", "", "", "", "", ""]
  );
  const [devOtp, setDevOtp] = useState(initialOtp || "");
  const [devDelivery, setDevDelivery] = useState(emailSent === false);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [err, setErr] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (!email) nav("/login");
  }, [email, nav]);

  useEffect(() => {
    if (user?.email_verified) nav("/verify", { replace: true });
  }, [user, nav]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const onChange = (i, val) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = digit;
    setDigits(next);
    if (digit && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const onKeyDown = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
    if (e.key === "Enter") submit();
  };

  const onPaste = (e) => {
    const paste = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    if (paste.length >= 4) {
      e.preventDefault();
      const arr = paste.split("");
      const next = ["", "", "", "", "", ""];
      arr.forEach((d, idx) => { next[idx] = d; });
      setDigits(next);
      inputRefs.current[Math.min(paste.length, 5)]?.focus();
    }
  };

  const submit = async () => {
    const code = digits.join("");
    if (code.length !== 6) { setErr("Enter all 6 digits."); return; }
    setLoading(true); setErr("");
    try {
      await api.post("/auth/verify-otp", { email, otp: code });
      await refreshUser();
      toast.success("Email verified! Welcome in.");
      nav("/verify", { replace: true });
    } catch (e) {
      setErr(formatApiError(e.response?.data?.detail));
      toast.error("Wrong code. Try again.");
    } finally { setLoading(false); }
  };

  const resend = async () => {
    setErr("");
    try {
      const { data } = await api.post("/auth/send-otp", { email });
      if (data.dev_otp) {
        setDevOtp(data.dev_otp);
        setDevDelivery(true);
        setDigits(data.dev_otp.split(""));
        toast.warning("Email delivery unavailable — using dev code");
      } else {
        setDevDelivery(false);
        setDevOtp("");
        toast.success("New code sent to your inbox");
        setDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
      setResendIn(60);
    } catch (e) {
      const msg = formatApiError(e.response?.data?.detail);
      setErr(msg);
      toast.error(msg);
    }
  };

  const changeEmail = async (e) => {
    e.preventDefault();
    setErr("");
    setEmailLoading(true);
    try {
      const { data } = await api.post("/auth/change-email", { email: newEmail });
      if (data.token) localStorage.setItem("scd_token", data.token);
      setUser(data.user);
      setDigits(
        data.dev_otp
          ? data.dev_otp.split("")
          : ["", "", "", "", "", ""]
      );
      setDevOtp(data.dev_otp || "");
      setDevDelivery(data.email_sent === false);
      setNewEmail("");
      setChangingEmail(false);
      setResendIn(60);
      toast.success(`Verification code sent to ${data.user.email}`);
    } catch (e) {
      const message = formatApiError(e.response?.data?.detail);
      setErr(message);
      toast.error(message);
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] grain flex items-center justify-center px-4 sm:px-6 relative overflow-hidden">
      <div className="aurora bg-indigo-600/40" style={{ width: 500, height: 500, top: -100, left: -100 }} />
      <div className="aurora bg-purple-600/30" style={{ width: 400, height: 400, bottom: -100, right: -100 }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="glass-heavy rounded-3xl p-5 sm:p-8 md:p-10 w-full max-w-md relative z-10"
        data-testid="otp-page"
      >
        <div className="inline-flex items-center gap-2 mb-6">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 grid place-items-center">
            <MailCheck size={18} className="text-white" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-indigo-300">Step 2 of 3</div>
            <div className="font-display font-bold text-lg">Verify your email</div>
          </div>
        </div>

        <h1 className="font-display text-3xl font-extrabold tracking-tight">Enter the 6-digit code</h1>
        <p className="text-zinc-400 text-sm mt-2">
          We sent a code to <span className="text-white font-semibold [overflow-wrap:anywhere]">{email}</span>. It expires in 10 minutes.
        </p>

        {devDelivery && devOtp && (
          <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4" data-testid="otp-dev-banner">
            <div className="text-[10px] uppercase tracking-widest text-amber-300 font-semibold">Email delivery unavailable — dev mode</div>
            <p className="text-xs text-amber-100/80 mt-1">
              Your Resend account can only email its verified address. We've pre-filled your code below so you can continue.
              To enable real inbox delivery, verify a domain at <a className="underline" href="https://resend.com/domains" target="_blank" rel="noreferrer">resend.com/domains</a>.
            </p>
            <div className="mt-3 rounded-lg bg-black/40 border border-amber-400/30 p-3 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-amber-300">Your code</span>
              <span className="font-mono font-bold text-xl sm:text-2xl text-amber-100 tracking-[0.2em] sm:tracking-[0.35em]" data-testid="otp-dev-code">{devOtp}</span>
            </div>
          </div>
        )}

        <div className="mt-8 grid grid-cols-6 gap-1.5 sm:gap-2" onPaste={onPaste} data-testid="otp-inputs">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputRefs.current[i] = el)}
              data-testid={`otp-digit-${i}`}
              inputMode="numeric"
              autoFocus={i === 0}
              maxLength={1}
              value={d}
              onChange={(e) => onChange(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              className="h-12 w-full min-w-0 rounded-lg sm:h-14 sm:rounded-xl bg-white/5 border border-white/10 text-center text-white font-mono text-xl sm:text-2xl font-bold focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40 focus:outline-none"
            />
          ))}
        </div>

        {err && <div data-testid="otp-error" className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>}

        {changingEmail && (
          <form onSubmit={changeEmail} className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <label className="text-xs uppercase tracking-widest text-zinc-500">Different email address</label>
            <input
              data-testid="otp-change-email-input"
              type="email"
              required
              autoFocus
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="you@college.edu"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-indigo-400"
            />
            <div className="mt-3 flex gap-2">
              <button
                data-testid="otp-change-email-submit"
                disabled={emailLoading}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
              >
                {emailLoading ? <Loader2 size={14} className="animate-spin" /> : "Send new code"}
              </button>
              <button
                type="button"
                onClick={() => { setChangingEmail(false); setNewEmail(""); }}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <button
          data-testid="otp-submit"
          onClick={submit}
          disabled={loading}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full bg-white text-black font-semibold py-3 hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <>Verify <Sparkles size={14} /></>}
        </button>

        <div className="mt-6 flex flex-col items-start justify-between gap-3 text-sm sm:flex-row sm:items-center">
          <button
            data-testid="otp-resend"
            onClick={resend}
            disabled={resendIn > 0}
            className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={14} /> {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
          </button>
          <button
            data-testid="otp-logout"
            onClick={() => setChangingEmail((value) => !value)}
            className="text-zinc-500 hover:text-white"
          >
            Use different email
          </button>
        </div>
      </motion.div>
    </div>
  );
}
