import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Check, Copy, Gift, Ticket, Trophy } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

const statCards = [
  { key: "claimed", label: "Claimed Coupons", icon: Ticket, to: "/coupons", tint: "from-indigo-500 to-purple-600" },
  { key: "redeemed", label: "Redeemed Coupons", icon: Check, to: "/coupons", tint: "from-emerald-500 to-teal-500" },
  { key: "reward_points", label: "Reward Points", icon: Trophy, tint: "from-amber-400 to-pink-500" },
];

function StatValue({ loading, value }) {
  if (loading) {
    return <span className="mt-2 block h-8 w-14 animate-pulse rounded-lg bg-white/10" aria-hidden="true" />;
  }
  return <span className="mt-1 block font-display text-3xl font-extrabold">{value ?? "—"}</span>;
}

function StatCard({ stat, loading, value }) {
  const content = (
    <>
      <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${stat.tint} grid place-items-center`}>
        <stat.icon size={16} className="text-white" aria-hidden="true" />
      </div>
      <div className="mt-3 text-[10px] uppercase tracking-widest text-zinc-400">{stat.label}</div>
      <StatValue loading={loading} value={value} />
    </>
  );

  return stat.to ? (
    <Link
      to={stat.to}
      className="glass rounded-2xl p-4 transition-colors hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      aria-label={`View ${stat.label.toLowerCase()}`}
    >
      {content}
    </Link>
  ) : (
    <div className="glass rounded-2xl p-4">{content}</div>
  );
}

export default function MemberOverviewBanner({ user }) {
  const [copied, setCopied] = useState(false);
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const stats = useQuery({
    queryKey: ["dashboard-stats", user.id],
    queryFn: async ({ signal }) => (await api.get("/dashboard/stats", { signal })).data,
    enabled: Boolean(user?.id),
  });
  const referralCode = stats.data?.referral_code || user?.referral_code || "";
  const values = {
    claimed: stats.data?.claimed,
    redeemed: stats.data?.redeemed,
    reward_points: stats.data?.reward_points ?? (!stats.isLoading ? user?.reward_points : undefined),
  };

  useEffect(() => {
    setCopied(false);
  }, [user.id]);

  useEffect(() => {
    if (!copied) return undefined;
    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const copyReferralCode = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
    } catch {
      toast.error("Couldn't copy the referral code. Please copy it manually.");
    }
  };

  return (
    <section className="relative py-24" aria-labelledby="member-overview-title">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-950/80 via-[#111018] to-purple-950/70 p-6 shadow-[0_30px_100px_-45px_rgba(99,102,241,0.8)] md:p-10"
        >
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-purple-500/15 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <div className="max-w-3xl">
              <div className="text-[10px] uppercase tracking-[0.3em] text-indigo-300">Your Savy membership</div>
              <h2 id="member-overview-title" className="mt-3 font-display text-3xl font-extrabold tracking-tight md:text-5xl">
                {firstName ? `Welcome back, ${firstName} 👋` : "Welcome back 👋"}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-300 md:text-base">
                Your student savings are ready. Explore the latest offers, use your rewards and keep track of your benefits.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy={stats.isLoading} aria-label="Member statistics">
              {statCards.map((stat) => (
                <StatCard key={stat.key} stat={stat} loading={stats.isLoading} value={values[stat.key]} />
              ))}

              <div className="glass min-w-0 rounded-2xl p-4">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 grid place-items-center">
                  <Gift size={16} className="text-white" aria-hidden="true" />
                </div>
                <div className="mt-3 text-[10px] uppercase tracking-widest text-zinc-400">Referral Code</div>
                {stats.isLoading ? (
                  <span className="mt-2 block h-8 w-28 animate-pulse rounded-lg bg-white/10" aria-hidden="true" />
                ) : (
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                    <span className="min-w-0 break-all font-mono text-base font-bold md:text-lg">
                      {referralCode || "Not generated yet"}
                    </span>
                    {referralCode && (
                      <button
                        type="button"
                        onClick={copyReferralCode}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 py-1.5 text-xs transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                        aria-label="Copy referral code"
                      >
                        {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/offers" className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-black transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                Explore Offers <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              <Link to="/card" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 font-semibold transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                View Your Pass
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
