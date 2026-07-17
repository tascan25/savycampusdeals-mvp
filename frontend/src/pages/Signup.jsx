import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Loader2, Check, X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const passwordChecks = (pw) => ({
  length: pw.length >= 8,
  upper: /[A-Z]/.test(pw),
  digit: /[0-9]/.test(pw),
  special: /[^A-Za-z0-9\s]/.test(pw),
  noSpace: pw.length > 0 && !/\s/.test(pw),
});

// Score: 0..5 based on rule pass count + a small bonus for length ≥ 12
const passwordScore = (pw) => {
  const c = passwordChecks(pw);
  const passed = [c.length, c.upper, c.digit, c.special, c.noSpace].filter(Boolean).length;
  if (passed === 0) return 0;
  const long = pw.length >= 12 ? 0.5 : 0;
  return Math.min(5, passed + long);
};

const strengthMeta = (score) => {
  if (score <= 1) return { label: "Too weak", tint: "bg-red-500", text: "text-red-300", segments: 1 };
  if (score <= 2) return { label: "Weak", tint: "bg-orange-500", text: "text-orange-300", segments: 2 };
  if (score <= 3) return { label: "Fair", tint: "bg-amber-400", text: "text-amber-300", segments: 3 };
  if (score < 5) return { label: "Good", tint: "bg-blue-400", text: "text-blue-300", segments: 4 };
  return { label: "Strong", tint: "bg-emerald-400", text: "text-emerald-300", segments: 5 };
};

const isPasswordValid = (pw) => {
  const c = passwordChecks(pw);
  return c.length && c.upper && c.digit && c.special && c.noSpace;
};

function Rule({ ok, children, testId }) {
  return (
    <li
      data-testid={testId}
      className={`flex items-center gap-2 text-xs transition-colors ${ok ? "text-emerald-300" : "text-zinc-500"}`}
    >
      <span className={`h-4 w-4 rounded-full grid place-items-center border ${ok ? "bg-emerald-500/20 border-emerald-400/40" : "bg-white/5 border-white/10"}`}>
        {ok ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} className="text-zinc-600" />}
      </span>
      {children}
    </li>
  );
}

function StrengthMeter({ score, testId }) {
  const meta = strengthMeta(score);
  return (
    <div className="mt-3" data-testid={testId}>
      <div className="flex gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${i < meta.segments ? meta.tint : "bg-white/10"}`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px]">
        <span className={`font-semibold ${meta.text}`} data-testid={`${testId}-label`}>{score === 0 ? "—" : meta.label}</span>
        <span className="text-zinc-500">Strength</span>
      </div>
    </div>
  );
}

export default function Signup() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", email: "", password: "", confirm_password: "", college: "", course: "", year: "", referral_code: "" });
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [pwFocused, setPwFocused] = useState(false);

  const update = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));
  const pwCheck = passwordChecks(f.password);
  const pwValid = isPasswordValid(f.password);
  const pwScore = passwordScore(f.password);
  const confirmTouched = f.confirm_password.length > 0;
  const confirmMatches = confirmTouched && f.confirm_password === f.password;
  const canSubmit = pwValid && confirmMatches;

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!pwValid) { setErr("Please meet all password requirements."); return; }
    if (!confirmMatches) { setErr("Passwords do not match."); return; }
    setLoading(true);
    // Strip confirm_password before sending
    const { confirm_password, ...payload } = f;
    const r = await register(payload);
    setLoading(false);
    if (r.ok) {
      toast.success("Account created! Check your inbox for a verification code.");
      nav("/verify-email", { state: { email: f.email, dev_otp: r.dev_otp, email_sent: r.email_sent } });
    } else setErr(r.error);
  };

  return (
    <div className="min-h-screen bg-[#050505] grain flex items-center justify-center px-6 py-16 relative overflow-hidden">
      <div className="aurora bg-purple-600/40" style={{ width: 500, height: 500, top: -100, right: -100 }} />
      <div className="aurora bg-indigo-600/30" style={{ width: 400, height: 400, bottom: -100, left: -100 }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="glass-heavy rounded-3xl p-8 md:p-10 w-full max-w-xl relative z-10"
      >
        <Link to="/" className="inline-flex items-center gap-2 mb-6">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-500 grid place-items-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg">Savy<span className="text-indigo-400">.</span></span>
        </Link>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">Get your student pass</h1>
        <p className="text-zinc-400 text-sm mt-2">Free, forever. Just verified students, real perks.</p>

        <form className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={onSubmit}>
          {[
            { k: "name", label: "Full name", type: "text", required: true, span: 2 },
            { k: "email", label: "Email", type: "email", required: true, span: 2 },
          ].map((field) => (
            <div key={field.k} className={field.span === 2 ? "md:col-span-2" : ""}>
              <label className="text-xs uppercase tracking-widest text-zinc-500">{field.label}</label>
              <input
                data-testid={`signup-${field.k}-input`}
                type={field.type}
                required={field.required}
                value={f[field.k]}
                onChange={update(field.k)}
                className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40 focus:outline-none transition-colors"
              />
            </div>
          ))}

          {/* Password */}
          <div className="md:col-span-2">
            <label className="text-xs uppercase tracking-widest text-zinc-500">Password</label>
            <div className="relative mt-2">
              <input
                data-testid="signup-password-input"
                type={showPw ? "text" : "password"}
                required
                value={f.password}
                onChange={update("password")}
                onFocus={() => setPwFocused(true)}
                onBlur={() => setPwFocused(false)}
                className={`w-full rounded-xl bg-white/5 border pl-4 pr-11 py-3 text-white focus:ring-2 focus:outline-none transition-colors ${
                  f.password.length === 0
                    ? "border-white/10 focus:border-indigo-400 focus:ring-indigo-500/40"
                    : pwValid
                    ? "border-emerald-400/50 focus:ring-emerald-500/40"
                    : "border-amber-400/40 focus:ring-amber-500/30"
                }`}
              />
              <button
                type="button"
                data-testid="signup-password-toggle"
                onClick={() => setShowPw((s) => !s)}
                className="absolute inset-y-0 right-3 my-auto h-fit text-zinc-400 hover:text-white"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {(pwFocused || f.password.length > 0) && (
              <>
                <StrengthMeter score={pwScore} testId="signup-strength" />
                <motion.ul
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  className="mt-3 rounded-xl bg-white/5 border border-white/10 p-3 space-y-1.5 overflow-hidden"
                  data-testid="signup-password-checklist"
                >
                  <Rule ok={pwCheck.length} testId="pw-check-length">At least 8 characters</Rule>
                  <Rule ok={pwCheck.upper} testId="pw-check-upper">One uppercase letter (A–Z)</Rule>
                  <Rule ok={pwCheck.digit} testId="pw-check-digit">One digit (0–9)</Rule>
                  <Rule ok={pwCheck.special} testId="pw-check-special">One special character (e.g. ! @ # $ %)</Rule>
                  <Rule ok={pwCheck.noSpace} testId="pw-check-nospace">No spaces</Rule>
                </motion.ul>
              </>
            )}
          </div>

          {/* Confirm password */}
          <div className="md:col-span-2">
            <label className="text-xs uppercase tracking-widest text-zinc-500">Confirm password</label>
            <div className="relative mt-2">
              <input
                data-testid="signup-confirm-password-input"
                type={showConfirm ? "text" : "password"}
                required
                value={f.confirm_password}
                onChange={update("confirm_password")}
                className={`w-full rounded-xl bg-white/5 border pl-4 pr-11 py-3 text-white focus:ring-2 focus:outline-none transition-colors ${
                  !confirmTouched
                    ? "border-white/10 focus:border-indigo-400 focus:ring-indigo-500/40"
                    : confirmMatches
                    ? "border-emerald-400/50 focus:ring-emerald-500/40"
                    : "border-red-400/50 focus:ring-red-500/30"
                }`}
              />
              <button
                type="button"
                data-testid="signup-confirm-toggle"
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute inset-y-0 right-3 my-auto h-fit text-zinc-400 hover:text-white"
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmTouched && !confirmMatches && (
              <div className="mt-2 text-xs text-red-400" data-testid="signup-confirm-mismatch">Passwords do not match.</div>
            )}
            {confirmTouched && confirmMatches && (
              <div className="mt-2 text-xs text-emerald-300 inline-flex items-center gap-1" data-testid="signup-confirm-match">
                <Check size={12} strokeWidth={3}/> Passwords match
              </div>
            )}
          </div>

          {[
            { k: "college", label: "College", type: "text" },
            { k: "course", label: "Course", type: "text" },
            { k: "year", label: "Year", type: "text" },
            { k: "referral_code", label: "Referral code (optional)", type: "text" },
          ].map((field) => (
            <div key={field.k}>
              <label className="text-xs uppercase tracking-widest text-zinc-500">{field.label}</label>
              <input
                data-testid={`signup-${field.k}-input`}
                type={field.type}
                value={f[field.k]}
                onChange={update(field.k)}
                className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40 focus:outline-none transition-colors"
              />
            </div>
          ))}

          {err && <div data-testid="signup-error" className="md:col-span-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>}
          <button
            data-testid="signup-submit-btn"
            disabled={loading || !canSubmit}
            className="md:col-span-2 w-full inline-flex items-center justify-center gap-2 rounded-full bg-white text-black font-semibold py-3 hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <>Create account <ArrowRight size={14} /></>}
          </button>
        </form>
        <div className="mt-6 text-sm text-zinc-400 text-center">
          Already have an account? <Link to="/login" data-testid="signup-login-link" className="text-white font-semibold hover:text-indigo-300">Log in</Link>
        </div>
      </motion.div>
    </div>
  );
}
