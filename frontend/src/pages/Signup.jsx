import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function Signup() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", email: "", password: "", college: "", course: "", year: "", referral_code: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const update = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const r = await register(f);
    setLoading(false);
    if (r.ok) {
      toast.success("Account created! Now let's verify you.");
      nav("/verify");
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
            <Sparkles size={16} className="text-white"/>
          </div>
          <span className="font-display font-bold text-lg">Savy<span className="text-indigo-400">.</span></span>
        </Link>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">Get your student pass</h1>
        <p className="text-zinc-400 text-sm mt-2">Free, forever. Just verified students, real perks.</p>

        <form className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={onSubmit}>
          {[
            { k: "name", label: "Full name", type: "text", required: true, span: 2 },
            { k: "email", label: "Email", type: "email", required: true, span: 2 },
            { k: "password", label: "Password (min 6 chars)", type: "password", required: true, span: 2 },
            { k: "college", label: "College", type: "text" },
            { k: "course", label: "Course", type: "text" },
            { k: "year", label: "Year", type: "text" },
            { k: "referral_code", label: "Referral code (optional)", type: "text" },
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
          {err && <div data-testid="signup-error" className="md:col-span-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>}
          <button
            data-testid="signup-submit-btn"
            disabled={loading}
            className="md:col-span-2 w-full inline-flex items-center justify-center gap-2 rounded-full bg-white text-black font-semibold py-3 hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin"/> : <>Create account <ArrowRight size={14}/></>}
          </button>
        </form>
        <div className="mt-6 text-sm text-zinc-400 text-center">
          Already have an account? <Link to="/login" data-testid="signup-login-link" className="text-white font-semibold hover:text-indigo-300">Log in</Link>
        </div>
      </motion.div>
    </div>
  );
}
