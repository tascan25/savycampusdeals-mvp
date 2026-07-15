import React, { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";

export default function ResetPassword() {
  const { token } = useParams();
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setErr("");
    try {
      await api.post("/auth/reset-password", { token, password });
      toast.success("Password reset. Please log in.");
      nav("/login");
    } catch (e) {
      setErr(formatApiError(e.response?.data?.detail));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#050505] grain flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-heavy rounded-3xl p-10 w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 mb-6">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center"><Sparkles size={16}/></div>
          <span className="font-display font-bold text-lg">Savy<span className="text-indigo-400">.</span></span>
        </Link>
        <h1 className="font-display text-3xl font-extrabold">Set a new password</h1>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <input
            data-testid="reset-password-input"
            type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40 focus:outline-none"
          />
          {err && <div className="text-sm text-red-400">{err}</div>}
          <button data-testid="reset-submit-btn" disabled={loading} className="w-full rounded-full bg-white text-black font-semibold py-3 disabled:opacity-60">
            {loading ? <Loader2 size={16} className="animate-spin inline"/> : "Reset password"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
