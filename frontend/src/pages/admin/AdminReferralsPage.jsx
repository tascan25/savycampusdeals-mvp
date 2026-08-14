import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck, ChevronDown, ChevronLeft, ChevronRight, Gift,
  Loader2, Search, Sparkles, Trophy, UserRoundPlus, Users,
} from "lucide-react";
import api from "@/lib/api";

const statusStyles = {
  approved: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300",
  pending: "border-amber-400/20 bg-amber-500/10 text-amber-200",
  rejected: "border-rose-400/20 bg-rose-500/10 text-rose-300",
  expired: "border-orange-400/20 bg-orange-500/10 text-orange-300",
  not_submitted: "border-zinc-400/20 bg-zinc-500/10 text-zinc-300",
  deleted: "border-zinc-400/20 bg-zinc-500/10 text-zinc-500",
};

const dateText = (value) => {
  if (!value) return "—";
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
};

const statusLabel = (value) => (
  (value || "not_submitted").replaceAll("_", " ")
);

export default function AdminReferralsPage({ openUser }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const referrals = useQuery({
    queryKey: ["admin-referrals", query, page],
    queryFn: async () => (await api.get("/admin/referrals", {
      params: { q: query || undefined, page, page_size: 12 },
    })).data,
  });

  const summary = referrals.data?.summary;
  const lastPage = Math.max(
    1,
    Math.ceil((referrals.data?.total || 0) / (referrals.data?.page_size || 12)),
  );
  const cards = [
    {
      label: "Successful referrals",
      value: summary?.total_referrals,
      detail: "Students who joined with a referral code",
      icon: UserRoundPlus,
      tint: "text-indigo-300",
    },
    {
      label: "Students referring",
      value: summary?.active_referrers,
      detail: "Unique student ambassadors",
      icon: Users,
      tint: "text-violet-300",
    },
    {
      label: "Verified referrals",
      value: summary?.verified_referred,
      detail: "Referred students currently approved",
      icon: BadgeCheck,
      tint: "text-emerald-300",
    },
    {
      label: "Savvy Points awarded",
      value: summary?.points_awarded,
      detail: "Referral rewards issued to referrers",
      icon: Sparkles,
      tint: "text-amber-300",
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-violet-300">Community growth</p>
          <h1 className="font-display mt-2 text-3xl font-extrabold">Referral network</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            See who is growing the community, their referral count, and every student they brought in.
          </p>
        </div>
        <label className="relative block w-full lg:w-80">
          <Search className="absolute left-3 top-3 text-zinc-500" size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search referrer, college or code"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-violet-400"
          />
        </label>
      </div>

      {referrals.isError && (
        <p className="mt-5 rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">
          Referral information could not be loaded. Please refresh and try again.
        </p>
      )}

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, detail, icon: Icon, tint }) => (
          <article key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <Icon size={19} className={tint} />
            <p className="mt-4 text-sm text-zinc-400">{label}</p>
            <p className="mt-1 font-display text-3xl font-extrabold">
              {referrals.isLoading ? "—" : (value ?? 0).toLocaleString("en-IN")}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">{detail}</p>
          </article>
        ))}
      </div>

      {summary?.top_referrer && (
        <section className="relative mt-6 overflow-hidden rounded-2xl border border-amber-300/20 bg-gradient-to-r from-amber-500/15 via-violet-500/10 to-indigo-500/10 p-5 sm:p-6">
          <div className="absolute -right-8 -top-12 h-40 w-40 rounded-full bg-amber-300/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-300 text-black">
                <Trophy size={23} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">Top ambassador</p>
                <h2 className="font-display mt-1 text-xl font-bold">{summary.top_referrer.name}</h2>
                <p className="mt-1 text-sm text-zinc-400">{summary.top_referrer.email}</p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="font-display text-4xl font-extrabold text-amber-200">{summary.top_referrer.referral_count}</p>
              <p className="text-xs uppercase tracking-wider text-zinc-500">successful referrals</p>
            </div>
          </div>
        </section>
      )}

      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold">Student-wise referral count</h2>
          <p className="mt-1 text-sm text-zinc-500">Ranked by successful signups using each student’s code.</p>
        </div>
        {!referrals.isLoading && (
          <p className="shrink-0 text-xs text-zinc-500">{referrals.data?.total || 0} referrers</p>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {referrals.isLoading ? (
          <div className="grid h-56 place-items-center rounded-2xl border border-white/10">
            <Loader2 className="animate-spin text-violet-300" />
          </div>
        ) : referrals.data?.items?.length ? referrals.data.items.map((referrer, index) => {
          const conversion = referrer.referral_count
            ? Math.round(referrer.verified_referrals / referrer.referral_count * 100)
            : 0;
          return (
            <article key={referrer.referrer_id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 font-display font-extrabold">
                    {(page - 1) * 12 + index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => referrer.account_exists && openUser(referrer.referrer_id)}
                        disabled={!referrer.account_exists}
                        className="truncate text-left font-display text-lg font-bold hover:text-violet-300 disabled:cursor-default disabled:text-zinc-500"
                      >
                        {referrer.name}
                      </button>
                      {referrer.referral_code && (
                        <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 font-mono text-[11px] text-violet-200">
                          {referrer.referral_code}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-zinc-400">{referrer.email}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {referrer.college || "College not provided"} · {referrer.points_awarded} referral points awarded
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-white/[0.04] px-4 py-3 text-center">
                    <p className="font-display text-2xl font-extrabold text-violet-200">{referrer.referral_count}</p>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Referred</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.04] px-4 py-3 text-center">
                    <p className="font-display text-2xl font-extrabold text-emerald-300">{referrer.verified_referrals}</p>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Verified</p>
                  </div>
                  <div className="col-span-2 rounded-xl bg-white/[0.04] px-4 py-3 text-center sm:col-span-1">
                    <p className="font-display text-2xl font-extrabold">{conversion}%</p>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Conversion</p>
                  </div>
                </div>
              </div>

              <details className="group border-t border-white/[0.07]">
                <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold text-zinc-300 hover:bg-white/[0.03]">
                  <span className="inline-flex items-center gap-2"><Gift size={16} className="text-violet-300" />See who they referred</span>
                  <ChevronDown size={17} className="transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-white/[0.06]">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="bg-white/[0.025] text-[11px] uppercase tracking-wider text-zinc-500">
                        <tr>
                          <th className="px-5 py-3">Referred student</th>
                          <th className="px-5 py-3">College</th>
                          <th className="px-5 py-3">Verification</th>
                          <th className="px-5 py-3">Joined</th>
                          <th className="px-5 py-3">Reward</th>
                        </tr>
                      </thead>
                      <tbody>
                        {referrer.referred_students.map((student) => (
                          <tr key={student.id || student.email} className="border-t border-white/[0.05]">
                            <td className="px-5 py-3">
                              {student.account_exists ? (
                                <button type="button" onClick={() => openUser(student.id)} className="font-semibold hover:text-violet-300">
                                  {student.name}
                                </button>
                              ) : <span className="font-semibold text-zinc-500">{student.name}</span>}
                              <p className="mt-0.5 text-xs text-zinc-500">{student.email}</p>
                            </td>
                            <td className="px-5 py-3 text-zinc-400">{student.college || "—"}</td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs capitalize ${statusStyles[student.verification_status] || statusStyles.not_submitted}`}>
                                {statusLabel(student.verification_status)}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-zinc-400">{dateText(student.joined_at)}</td>
                            <td className="px-5 py-3 text-amber-200">+{student.points_awarded} Savvy Points</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {referrer.referrals_shown < referrer.referral_count && (
                    <p className="border-t border-white/[0.05] px-5 py-3 text-xs text-zinc-500">
                      Showing the latest {referrer.referrals_shown} of {referrer.referral_count} referrals.
                    </p>
                  )}
                </div>
              </details>
            </article>
          );
        }) : (
          <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center">
            <UserRoundPlus className="mx-auto text-zinc-600" size={28} />
            <h3 className="font-display mt-3 text-lg font-bold">No referrers found</h3>
            <p className="mt-1 text-sm text-zinc-500">
              {query ? "Try a different name, college, email or referral code." : "Referral activity will appear after a student joins using another student’s code."}
            </p>
          </div>
        )}
      </div>

      {referrals.data?.total > referrals.data?.page_size && (
        <div className="mt-6 flex items-center justify-between text-sm text-zinc-400">
          <span>Page {page} of {lastPage}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage((value) => value - 1)} disabled={page <= 1} className="rounded-lg border border-white/10 p-2 hover:bg-white/5 disabled:opacity-40">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={() => setPage((value) => value + 1)} disabled={page >= lastPage} className="rounded-lg border border-white/10 p-2 hover:bg-white/5 disabled:opacity-40">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
