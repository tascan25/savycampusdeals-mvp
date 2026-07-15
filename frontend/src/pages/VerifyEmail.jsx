import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { BadgeCheck, Sparkles, Loader2 } from "lucide-react";
import api, { formatApiError } from "@/lib/api";

export default function VerifyEmail() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true, ok: false, err: "" });

  useEffect(() => {
    (async () => {
      try {
        await api.get(`/auth/verify-email/${token}`);
        setState({ loading: false, ok: true, err: "" });
      } catch (e) {
        setState({ loading: false, ok: false, err: formatApiError(e.response?.data?.detail) });
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-[#050505] grain flex items-center justify-center px-6">
      <div className="glass-heavy rounded-3xl p-10 max-w-md text-center">
        {state.loading && <Loader2 className="mx-auto animate-spin text-indigo-400" size={32}/>}
        {!state.loading && state.ok && (
          <>
            <div className="inline-flex h-16 w-16 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 items-center justify-center">
              <BadgeCheck className="text-emerald-400" size={32}/>
            </div>
            <h1 className="font-display text-3xl font-extrabold mt-4">Email verified</h1>
            <p className="text-zinc-400 text-sm mt-2">You're all set.</p>
            <Link to="/dashboard" className="mt-6 inline-flex items-center gap-2 rounded-full bg-white text-black font-semibold px-5 py-2.5">Continue</Link>
          </>
        )}
        {!state.loading && !state.ok && (
          <>
            <Sparkles className="mx-auto text-indigo-400" size={28}/>
            <h1 className="font-display text-2xl font-extrabold mt-3">Link expired</h1>
            <p className="text-zinc-400 text-sm mt-2">{state.err}</p>
            <Link to="/login" className="mt-6 inline-flex rounded-full bg-white text-black font-semibold px-5 py-2.5">Go to login</Link>
          </>
        )}
      </div>
    </div>
  );
}
