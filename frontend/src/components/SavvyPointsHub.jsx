import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowUpRight, Backpack, BadgeCheck, Check, Clock3, Coffee, Gift,
  Crown, Gem, LockKeyhole, MapPin, PartyPopper, Pizza, QrCode, Sparkles, Star, TicketCheck, Trophy,
  UserRoundPlus, Zap,
} from "lucide-react";
import { toast } from "sonner";

const eventIcons = {
  redemption: TicketCheck,
  referral: UserRoundPlus,
  verification: BadgeCheck,
  welcome: PartyPopper,
  legacy_balance: Sparkles,
};

const earningIcons = {
  redeem: MapPin,
  verify: BadgeCheck,
  refer: UserRoundPlus,
};

const dateText = (value) => {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(date);
};

const fullDateText = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

function LoadingHub() {
  return (
    <div className="mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 md:p-8" aria-label="Loading Savvy Points">
      <div className="h-7 w-40 animate-pulse rounded-lg bg-white/10" />
      <div className="mt-6 h-24 animate-pulse rounded-2xl bg-white/[0.06]" />
    </div>
  );
}

function CampusIconCardPreview({ unlocked }) {
  return (
    <div className="mt-8" data-testid="campus-icon-card-preview">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-[0.24em] text-amber-300">The final form</p>
          <p className="mt-1 text-xs font-semibold text-zinc-300">Your Campus Icon edition</p>
        </div>
        <span className="rounded-full border border-amber-200/15 bg-amber-300/[0.07] px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-[0.18em] text-amber-200">
          {unlocked ? "Unlocked" : "Preview"}
        </span>
      </div>

      <motion.div
        whileHover={{ y: -4, rotateX: 1.5, rotateY: -1.5 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="group relative aspect-[1.586/1] w-full rounded-[1.65rem] bg-gradient-to-br from-[#fff2a1] via-[#7d5010] to-[#f6ce63] p-px shadow-[0_26px_60px_-26px_rgba(251,191,36,0.65)] [perspective:1000px]"
        aria-label={`Campus Icon premium card ${unlocked ? "unlocked" : "preview"}`}
      >
        <div className="relative h-full overflow-hidden rounded-[calc(1.65rem-1px)] bg-[#090806] p-5 sm:p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_8%,rgba(255,224,130,0.28),transparent_30%),radial-gradient(circle_at_8%_92%,rgba(168,105,16,0.22),transparent_32%),linear-gradient(125deg,#090806_4%,#211707_46%,#070604_78%)]" />
          <div className="absolute inset-0 opacity-30 [background-image:repeating-linear-gradient(115deg,transparent_0,transparent_10px,rgba(255,224,130,0.035)_11px,transparent_12px)]" />
          <motion.div
            aria-hidden="true"
            initial={{ x: "-160%" }}
            animate={{ x: "220%" }}
            transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 4.5, ease: "easeInOut" }}
            className="absolute -inset-y-12 w-16 rotate-12 bg-gradient-to-r from-transparent via-amber-100/10 to-transparent blur-sm"
          />
          <div className="absolute -right-9 -top-10 h-32 w-32 rounded-full border border-amber-200/10 sm:h-40 sm:w-40" />
          <div className="absolute -right-3 top-7 h-20 w-20 rounded-full border border-amber-200/[0.07] sm:h-24 sm:w-24" />

          <div className="relative flex h-full flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl border border-amber-100/25 bg-gradient-to-br from-[#ffe991] via-[#bd7d16] to-[#6c4008] text-[#150d02] shadow-[inset_0_1px_1px_rgba(255,255,255,0.65),0_8px_22px_-10px_rgba(251,191,36,0.9)] sm:h-10 sm:w-10">
                  <Crown size={18} fill="currentColor" />
                </div>
                <div>
                  <p className="font-display text-[11px] font-black tracking-[0.18em] text-amber-50 sm:text-xs">SAVY CAMPUS</p>
                  <p className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.28em] text-amber-300/60 sm:text-[8px]">Icon Society</p>
                </div>
              </div>
              <Gem size={17} className="text-amber-200/70 drop-shadow-[0_0_8px_rgba(253,230,138,0.5)] sm:size-5" />
            </div>

            <div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[7px] font-extrabold uppercase tracking-[0.32em] text-amber-300/55 sm:text-[8px]">Ultimate status</p>
                  <p className="mt-1 bg-gradient-to-b from-[#fff8c9] via-[#f6d469] to-[#ad7112] bg-clip-text font-display text-[clamp(1.35rem,5.2vw,2.35rem)] font-black leading-none tracking-[-0.04em] text-transparent drop-shadow-[0_3px_12px_rgba(180,113,14,0.2)]">
                    CAMPUS ICON
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-lg font-black leading-none text-amber-100 sm:text-2xl">5K</p>
                  <p className="mt-1 text-[6px] font-bold uppercase tracking-[0.22em] text-amber-300/55 sm:text-[7px]">Club</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-amber-200/10 pt-3 sm:mt-4 sm:pt-4">
                <p className="text-[7px] font-bold uppercase tracking-[0.18em] text-amber-50/55 sm:text-[8px]">Earned. Rare. Recognised.</p>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[7px] font-extrabold uppercase tracking-[0.12em] sm:px-2.5 sm:text-[8px] ${unlocked ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" : "border-amber-200/15 bg-black/25 text-amber-100/75"}`}>
                  {unlocked ? <Check size={9} /> : <LockKeyhole size={8} />} {unlocked ? "Icon status" : "5,000 points"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <p className="mt-3 text-center text-[10px] leading-relaxed text-zinc-500">
        {unlocked ? "You made it. Your Campus Icon identity is now unlocked." : "Reach 5,000 lifetime Savvy Points to unlock Icon status."}
      </p>
    </div>
  );
}

export default function SavvyPointsHub({ overview, loading }) {
  const [selectedRewardTier, setSelectedRewardTier] = React.useState(null);

  if (loading || !overview) return <LoadingHub />;

  const {
    balance, lifetime, tier, activity = [], ways_to_earn: ways = [],
    pending_referrals: pending = 0, level_rewards: levelRewards = [],
  } = overview;
  const nextName = tier.next_tier?.name;
  const rewardsByTier = Object.fromEntries(levelRewards.map((reward) => [reward.tier_key, reward]));
  const rewardTiers = overview.tiers.slice(1);
  const suggestedRewardTier = rewardTiers.slice().reverse().find((item) => rewardsByTier[item.key]?.status === "active")
    || tier.next_tier
    || rewardTiers[rewardTiers.length - 1];
  const focusedRewardTier = rewardTiers.find((item) => item.key === selectedRewardTier)
    || suggestedRewardTier;
  const focusedReward = rewardsByTier[focusedRewardTier?.key];
  const focusedRewardReached = focusedRewardTier ? lifetime >= focusedRewardTier.minimum : false;
  const focusedRewardActive = focusedReward?.status === "active";
  const rewardIcon = {
    deal_hunter: Coffee,
    savvy_insider: Pizza,
    campus_icon: Backpack,
  };

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Referral code copied — send it to your crew!");
    } catch {
      toast.error("Couldn't copy the code. Please copy it manually.");
    }
  };

  return (
    <section className="mt-8" aria-labelledby="savvy-points-title" data-testid="savvy-points-hub">
      <div className="relative isolate overflow-hidden rounded-[2rem] border border-violet-300/20 bg-[#0d0b15] shadow-[0_28px_100px_-40px_rgba(139,92,246,0.75)]">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_8%_10%,rgba(251,191,36,0.18),transparent_32%),radial-gradient(circle_at_88%_18%,rgba(139,92,246,0.3),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.04),transparent_48%)]" />
        <div className="absolute -right-16 -top-16 -z-10 h-56 w-56 rounded-full border border-white/10" />

        <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[0.9fr_1.35fr] lg:p-10">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200">
                <Star size={12} fill="currentColor" /> {tier.name}
              </span>
              <span className="text-xs text-zinc-500">{lifetime.toLocaleString("en-IN")} lifetime earned</span>
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">Your balance</p>
            <div className="mt-2 flex items-end gap-3">
              <h2 id="savvy-points-title" className="font-display text-5xl font-black tracking-[-0.05em] text-white sm:text-6xl" data-testid="savvy-points-balance">
                {balance.toLocaleString("en-IN")}
              </h2>
              <span className="pb-2 text-sm font-semibold text-zinc-400">Savvy Points</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-400">{tier.benefit}</p>
            <CampusIconCardPreview unlocked={lifetime >= 5000} />
          </div>

          <div className="self-end rounded-3xl border border-white/10 bg-black/20 p-5 backdrop-blur-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Status journey</p>
                <p className="mt-2 font-display text-xl font-bold">
                  {nextName ? `${tier.points_to_next.toLocaleString("en-IN")} points to ${nextName}` : "You've reached icon status"}
                </p>
              </div>
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-500 text-black shadow-lg shadow-amber-500/20">
                <Trophy size={20} />
              </div>
            </div>
            <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Progress to next Savvy tier" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(tier.progress_percent)}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${tier.progress_percent}%` }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-amber-300 shadow-[0_0_22px_rgba(216,180,254,0.6)]"
              />
            </div>
            <div className="mt-5 grid grid-cols-4 gap-1.5 sm:gap-2.5" aria-label="Savvy Points journey stages">
              {overview.tiers.map((item, index) => {
                const isCurrent = index === tier.index;
                const isReached = index < tier.index;
                return (
                  <div
                    key={item.name}
                    aria-current={isCurrent ? "step" : undefined}
                    className={`min-w-0 rounded-xl px-1.5 py-2.5 transition-colors sm:px-2.5 ${
                      isCurrent
                        ? "bg-violet-400/15 ring-1 ring-violet-300/30"
                        : "bg-white/[0.025]"
                    }`}
                  >
                    <div className={`mb-2.5 h-1.5 rounded-full ${isCurrent ? "bg-gradient-to-r from-violet-400 to-amber-300 shadow-[0_0_12px_rgba(196,181,253,0.55)]" : isReached ? "bg-violet-400" : "bg-white/15"}`} />
                    <p className={`font-display text-[11px] font-extrabold leading-[1.15] sm:text-sm ${isCurrent ? "text-amber-100" : isReached ? "text-violet-100" : "text-zinc-300"}`}>
                      {item.name}
                    </p>
                    <p className={`mt-1 text-[10px] font-semibold sm:text-[11px] ${isCurrent ? "text-violet-200" : "text-zinc-400"}`}>
                      {item.minimum.toLocaleString("en-IN")}+
                    </p>
                    {isCurrent && <p className="mt-1.5 text-[8px] font-bold uppercase tracking-wider text-amber-200 sm:text-[9px]">Current</p>}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 border-t border-white/10 pt-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-amber-300">
                    <Sparkles size={12} /> Reward collection
                  </div>
                  <h3 className="mt-1 font-display text-xl font-extrabold sm:text-2xl">Your next flex is waiting</h3>
                  <p className="mt-1 text-xs text-zinc-500">Tap a level to explore what you’ll unlock.</p>
                </div>
                <div className="hidden h-11 w-11 place-items-center rounded-full border border-violet-300/20 bg-violet-400/10 text-violet-200 sm:grid">
                  <Gift size={19} />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2" role="tablist" aria-label="Savvy tier rewards">
                {rewardTiers.map((item) => {
                  const RewardIcon = rewardIcon[item.key] || Gift;
                  const reward = rewardsByTier[item.key];
                  const reached = lifetime >= item.minimum;
                  const selected = focusedRewardTier?.key === item.key;
                  return (
                    <motion.button
                      key={item.key}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls="savvy-reward-spotlight"
                      onClick={() => setSelectedRewardTier(item.key)}
                      whileTap={{ scale: 0.97 }}
                      className={`group relative min-w-0 overflow-hidden rounded-2xl border p-2.5 text-left transition duration-300 sm:p-3.5 ${
                        selected
                          ? "border-amber-200/40 bg-gradient-to-br from-violet-500/20 via-white/[0.07] to-amber-300/10 shadow-[0_14px_35px_-20px_rgba(196,181,253,0.8)]"
                          : "border-white/[0.07] bg-white/[0.025] hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.05]"
                      }`}
                      data-testid={`level-reward-${item.key}`}
                    >
                      {selected && <motion.div layoutId="reward-glow" className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-amber-200 to-transparent" />}
                      <div className="flex items-center justify-between gap-1">
                        <div className={`grid h-8 w-8 place-items-center rounded-xl transition sm:h-9 sm:w-9 ${selected ? "bg-gradient-to-br from-amber-200 to-orange-400 text-zinc-950 shadow-lg shadow-amber-500/20" : reached ? "bg-violet-400/15 text-violet-200" : "bg-white/[0.05] text-zinc-500"}`}>
                          <RewardIcon size={15} />
                        </div>
                        {reward?.status === "active" ? (
                          <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.9)]" title="Ready to redeem" />
                        ) : reached ? <Check size={13} className="text-emerald-300" /> : <LockKeyhole size={12} className="text-zinc-600" />}
                      </div>
                      <p className={`mt-3 truncate font-display text-[11px] font-extrabold sm:text-sm ${selected ? "text-white" : "text-zinc-300"}`}>{item.name}</p>
                      <p className={`mt-0.5 text-[9px] font-bold sm:text-[10px] ${selected ? "text-amber-200" : "text-zinc-500"}`}>{item.minimum.toLocaleString("en-IN")} PTS</p>
                    </motion.button>
                  );
                })}
              </div>

              {focusedRewardTier && (() => {
                const RewardIcon = rewardIcon[focusedRewardTier.key] || Gift;
                return (
                  <motion.article
                    id="savvy-reward-spotlight"
                    role="tabpanel"
                    key={focusedRewardTier.key}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="relative mt-3 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.075] via-violet-500/[0.06] to-amber-300/[0.055] p-5 sm:p-6"
                  >
                    <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-violet-500/15 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-16 left-10 h-32 w-32 rounded-full bg-amber-300/10 blur-3xl" />

                    <div className="relative flex items-start gap-4">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/25 text-amber-200 shadow-inner sm:h-14 sm:w-14">
                        <RewardIcon size={22} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-display text-xl font-black text-white sm:text-2xl">{focusedRewardTier.name}</h4>
                          <span className={`rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider ${focusedRewardActive ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200" : focusedReward?.status === "redeemed" ? "border-violet-300/20 bg-violet-400/10 text-violet-200" : focusedReward?.status === "expired" ? "border-rose-300/20 bg-rose-400/10 text-rose-200" : "border-white/10 bg-white/[0.05] text-zinc-300"}`}>
                            {focusedRewardActive ? "Unlocked" : focusedReward?.status || (focusedRewardReached ? "Unlocked" : "Locked")}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold leading-relaxed text-amber-50 sm:text-base">{focusedRewardTier.reward}</p>
                      </div>
                    </div>

                    {!focusedRewardReached && (
                      <div className="relative mt-5 rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                        <div className="flex items-center justify-between gap-4 text-xs">
                          <span className="font-semibold text-zinc-300">Your progress</span>
                          <span className="font-bold text-amber-200">{(focusedRewardTier.minimum - lifetime).toLocaleString("en-IN")} points to go</span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (lifetime / focusedRewardTier.minimum) * 100)}%` }} className="h-full rounded-full bg-gradient-to-r from-violet-500 to-amber-300" />
                        </div>
                        <p className="mt-3 text-xs text-zinc-500">Every partner deal gets you 50 points closer.</p>
                      </div>
                    )}

                    {focusedReward && (
                      <div className="relative mt-5 border-t border-white/[0.08] pt-5">
                        {focusedRewardActive ? (
                          <div className="flex flex-col items-center gap-5 sm:flex-row">
                            <div className="relative rounded-[1.35rem] bg-white p-2.5 shadow-[0_16px_45px_-14px_rgba(255,255,255,0.4)]">
                              <img src={focusedReward.qr_data_uri} alt={`${focusedRewardTier.name} reward QR`} className="h-36 w-36 rounded-xl sm:h-32 sm:w-32" data-testid={`level-reward-qr-${focusedRewardTier.key}`} />
                              <span className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-emerald-400 text-zinc-950 ring-4 ring-[#17131f]"><Check size={14} strokeWidth={3} /></span>
                            </div>
                            <div className="min-w-0 flex-1 text-center sm:text-left">
                              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-300/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-200"><QrCode size={13} /> Ready to claim</div>
                              <p className="mt-3 font-mono text-base font-bold tracking-wider text-white">{focusedReward.code}</p>
                              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-zinc-300"><Clock3 size={13} className="text-amber-200" /> Use before {fullDateText(focusedReward.expires_at)}</p>
                              <p className="mt-2 text-xs leading-relaxed text-zinc-500">Show this one-time QR at a participating Savvy partner cafe.</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 rounded-2xl bg-black/20 p-4 text-sm text-zinc-300">
                            {focusedReward.status === "redeemed" ? <Check className="text-emerald-300" size={18} /> : <Clock3 className="text-rose-300" size={18} />}
                            <span>{focusedReward.status === "redeemed" ? `Claimed on ${fullDateText(focusedReward.redeemed_at)} — nice one!` : `This reward expired on ${fullDateText(focusedReward.expires_at)}`}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.article>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300">Keep the momentum</p>
              <h3 className="mt-1 font-display text-xl font-bold">Ways to earn</h3>
            </div>
            <Zap className="text-amber-300" size={20} fill="currentColor" />
          </div>
          <div className="mt-5 grid gap-3">
            {ways.map((way) => {
              const Icon = earningIcons[way.type] || Gift;
              const content = (
                <>
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/[0.07] text-violet-200"><Icon size={18} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{way.title}</p>
                      {way.completed && <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-emerald-300"><Check size={11} /> Done</span>}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">{way.description}</p>
                    {way.type === "refer" && pending > 0 && <p className="mt-1 text-xs text-amber-200">{pending} reward{pending === 1 ? "" : "s"} pending verification</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-lg font-extrabold text-amber-200">+{way.points}</p>
                    <p className="text-[9px] uppercase tracking-wider text-zinc-600">points</p>
                  </div>
                </>
              );
              if (way.type === "refer") {
                return <button key={way.type} type="button" onClick={() => copyCode(way.referral_code)} className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-left transition hover:border-violet-400/25 hover:bg-violet-500/[0.06]">{content}</button>;
              }
              return <Link key={way.type} to={way.href} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition hover:border-violet-400/25 hover:bg-violet-500/[0.06]">{content}<ArrowUpRight size={15} className="text-zinc-600" /></Link>;
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300">Your wins</p>
            <h3 className="mt-1 font-display text-xl font-bold">Points activity</h3>
          </div>
          <div className="mt-5 space-y-1" data-testid="savvy-points-activity">
            {activity.length ? activity.map((item) => {
              const Icon = eventIcons[item.event_type] || Sparkles;
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-2xl px-2 py-3 transition-colors hover:bg-white/[0.035]">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-amber-300/10 text-violet-200"><Icon size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">{item.description || dateText(item.created_at)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display font-bold text-emerald-300">+{item.amount}</p>
                    <p className="text-[10px] text-zinc-600">{dateText(item.created_at)}</p>
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
                <Gift className="mx-auto text-zinc-600" size={22} />
                <p className="mt-3 text-sm font-semibold">Your first win is waiting</p>
                <p className="mt-1 text-xs text-zinc-500">Use a partner deal to start your activity feed.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
