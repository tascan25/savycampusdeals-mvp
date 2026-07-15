import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, ShieldAlert, ShieldCheck, Ticket, Bookmark, Gift, ArrowRight, Trophy } from "lucide-react";
import Navbar from "@/components/Navbar";
import DigitalStudentCard from "@/components/DigitalStudentCard";
import OfferCard from "@/components/OfferCard";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const verified = user?.verification_status === "approved";

  const stats = useQuery({ queryKey: ["stats"], queryFn: async () => (await api.get("/dashboard/stats")).data });
  const card = useQuery({
    queryKey: ["card"],
    queryFn: async () => (await api.get("/student-card")).data,
    enabled: verified,
  });
  const offers = useQuery({ queryKey: ["dashboard-offers"], queryFn: async () => (await api.get("/offers", { params: { sort: "featured" } })).data });

  const toggleSave = async (offer) => {
    try {
      await api.post(`/offers/${offer.id}/save`);
      await offers.refetch();
      toast.success(offer.saved ? "Removed from saved" : "Saved!");
    } catch { toast.error("Try again"); }
  };

  return (
    <div className="min-h-screen bg-[#050505] grain">
      <Navbar/>
      <div className="aurora bg-indigo-600/20" style={{ width: 500, height: 500, top: 0, left: -100 }} />
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-16 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-[10px] uppercase tracking-[0.3em] text-indigo-400">Welcome back</div>
          <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tighter mt-2" data-testid="dashboard-heading">Hi, {user?.name?.split(" ")[0]}.</h1>
          <p className="text-zinc-400 mt-2">Your student perks control room.</p>
        </motion.div>

        {/* Verification banner */}
        {!verified && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="mt-8 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5 flex items-center gap-4"
            data-testid="dashboard-verify-banner"
          >
            <ShieldAlert className="text-amber-300 shrink-0" size={24}/>
            <div className="flex-1">
              <div className="font-display font-bold text-amber-100">You're not verified yet</div>
              <div className="text-sm text-amber-100/70">Verify your student status to claim any offer.</div>
            </div>
            <Link to="/verify" data-testid="dashboard-verify-btn" className="rounded-full bg-white text-black font-semibold px-4 py-2 text-sm">Verify now</Link>
          </motion.div>
        )}

        {/* Top grid: student card + stats */}
        <div className="mt-10 grid lg:grid-cols-5 gap-6 items-start">
          <div className="lg:col-span-3">
            {verified && card.data ? (
              <DigitalStudentCard card={card.data}/>
            ) : (
              <div className="rounded-3xl border border-white/10 p-8 h-64 grid place-items-center text-center glass" data-testid="dashboard-card-placeholder">
                <div>
                  <Sparkles className="mx-auto text-indigo-400" size={28}/>
                  <p className="mt-3 font-display font-semibold">Your digital student pass appears here once verified.</p>
                  <Link to="/verify" className="mt-4 inline-flex items-center gap-2 rounded-full bg-white text-black text-sm font-semibold px-4 py-2">Verify now <ArrowRight size={14}/></Link>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 grid grid-cols-2 gap-3">
            {[
              { k: "claimed", label: "Claimed", icon: Ticket, tint: "from-indigo-500 to-purple-600" },
              { k: "saved", label: "Saved", icon: Bookmark, tint: "from-blue-500 to-sky-400" },
              { k: "reward_points", label: "Points", icon: Trophy, tint: "from-amber-400 to-pink-500" },
              { k: "active", label: "Active coupons", icon: Gift, tint: "from-emerald-500 to-teal-400" },
            ].map((s) => (
              <div key={s.k} className="glass rounded-2xl p-4">
                <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${s.tint} grid place-items-center`}>
                  <s.icon size={16} className="text-white"/>
                </div>
                <div className="mt-3 text-[11px] uppercase tracking-widest text-zinc-500">{s.label}</div>
                <div className="font-display text-3xl font-extrabold mt-1" data-testid={`stat-${s.k}`}>{stats.data?.[s.k] ?? 0}</div>
              </div>
            ))}
            <div className="col-span-2 glass rounded-2xl p-4">
              <div className="text-[11px] uppercase tracking-widest text-zinc-500">Your referral code</div>
              <div className="flex items-center justify-between mt-2">
                <div className="font-mono text-lg font-bold text-white" data-testid="dashboard-ref-code">{stats.data?.referral_code || "—"}</div>
                <button
                  data-testid="dashboard-copy-ref"
                  onClick={() => { navigator.clipboard.writeText(stats.data?.referral_code || ""); toast.success("Copied!"); }}
                  className="text-xs rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5"
                >Copy</button>
              </div>
              <div className="text-xs text-zinc-500 mt-2">Refer friends, earn 100 pts each.</div>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="mt-10 grid sm:grid-cols-3 gap-3">
          {[
            { to: "/offers", label: "Browse offers", icon: Sparkles },
            { to: "/coupons", label: "My coupons", icon: Ticket },
            { to: "/saved", label: "Saved offers", icon: Bookmark },
          ].map((q) => (
            <Link key={q.to} to={q.to} data-testid={`quick-${q.label.toLowerCase().replace(/ /g,'-')}`}
              className="glass rounded-2xl p-4 flex items-center gap-3 hover:border-white/20 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-white/5 grid place-items-center"><q.icon size={16}/></div>
              <div className="font-display font-semibold">{q.label}</div>
              <ArrowRight size={14} className="ml-auto text-zinc-500"/>
            </Link>
          ))}
        </div>

        {/* Recommended */}
        <div className="mt-14">
          <div className="flex items-end justify-between mb-5">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-indigo-400">Recommended</div>
              <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight mt-2">Deals for you</h2>
            </div>
            <Link to="/offers" className="text-sm text-zinc-400 hover:text-white">View all</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {offers.data?.slice(0, 6).map((o, i) => (
              <OfferCard key={o.id} offer={o} onToggleSave={toggleSave} index={i}/>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
