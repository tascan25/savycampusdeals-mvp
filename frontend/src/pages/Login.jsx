import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const requestedFrom = loc.state?.from
    ? `${loc.state.from.pathname}${loc.state.from.search || ""}`
    : null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const r = await login(email, password);
    setLoading(false);
    if (r.ok) {
      toast.success("Welcome back!");
      // If email not verified, gate to OTP page
      if (r.user && r.user.role === "student" && !r.user.email_verified) {
        nav("/verify-email", { replace: true, state: { email: r.user.email } });
      } else {
        const roleHome = r.user?.role === "admin"
          ? "/admin"
          : r.user?.role === "outlet_partner" ? "/scan" : "/dashboard";
        nav(requestedFrom || roleHome, { replace: true });
      }
    } else {
      setErr(r.error);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] grain flex items-center justify-center px-6 relative overflow-hidden">
      <div className="aurora bg-indigo-600/40" style={{ width: 500, height: 500, top: -100, left: -100 }} />
      <div className="aurora bg-purple-600/30" style={{ width: 400, height: 400, bottom: -100, right: -100 }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="glass-heavy rounded-3xl p-8 md:p-10 w-full max-w-md relative z-10"
      >
        <Link to="/" className="inline-flex items-center gap-2 mb-8">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-500 grid place-items-center">
            <Sparkles size={16} className="text-white"/>
          </div>
          <span className="font-display font-bold text-lg">Savy<span className="text-indigo-400">.</span></span>
        </Link>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">Welcome back</h1>
        <p className="text-zinc-400 text-sm mt-2">Log in to access student perks or your partner scanner.</p>

        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="text-xs uppercase tracking-widest text-zinc-500">Email</label>
            <input
              data-testid="login-email-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40 focus:outline-none transition-colors"
              placeholder="you@college.edu"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-zinc-500">Password</label>
            <input
              data-testid="login-password-input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40 focus:outline-none transition-colors"
              placeholder="••••••••"
            />
            <div className="flex justify-end mt-2">
              <Link to="/forgot-password" data-testid="login-forgot-link" className="text-xs text-zinc-400 hover:text-white">Forgot password?</Link>
            </div>
          </div>
          {err && <div data-testid="login-error" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>}
          <button
            data-testid="login-submit-btn"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-white text-black font-semibold py-3 hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin"/> : <>Log in <ArrowRight size={14}/></>}
          </button>
        </form>

        <div className="mt-6 text-sm text-zinc-400 text-center">
          New to Savy? <Link to="/signup" data-testid="login-signup-link" className="text-white font-semibold hover:text-indigo-300">Create account</Link>
        </div>
      </motion.div>
    </div>
  );
}
