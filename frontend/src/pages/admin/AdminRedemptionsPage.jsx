import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, CircleAlert, Clock3, ExternalLink, Loader2,
  RotateCcw, Store, TicketCheck, UsersRound,
} from "lucide-react";
import api, { formatApiError } from "@/lib/api";

const dateText = (value) => {
  if (!value) return "—";
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "—";
  return `${new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit",
    minute: "2-digit", timeZone: "Asia/Kolkata",
  }).format(date)} IST`;
};

const timeRemaining = (expiry, nowValue) => {
  if (!expiry) return "";
  const milliseconds = new Date(expiry).getTime() - new Date(nowValue || Date.now()).getTime();
  if (milliseconds <= 0) return "Expired";
  const minutes = Math.ceil(milliseconds / 60000);
  if (minutes < 60) return `${minutes}m remaining`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 48) return `${hours}h remaining`;
  return `${Math.ceil(hours / 24)}d remaining`;
};

const statusClass = {
  claimed: "border-violet-400/20 bg-violet-500/10 text-violet-200",
  active: "border-amber-400/20 bg-amber-500/10 text-amber-200",
  redeemed: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300",
  expired: "border-rose-400/20 bg-rose-500/10 text-rose-200",
};

function StatusBadge({ status }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusClass[status] || statusClass.expired}`}>{status}</span>;
}

function TypeBadge({ type }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${type === "brand" ? "border-violet-400/20 bg-violet-500/10 text-violet-200" : "border-cyan-400/20 bg-cyan-500/10 text-cyan-200"}`}>{type === "brand" ? "Listed brand" : "Outlet coupon"}</span>;
}

function SummaryCard({ label, value, icon: Icon, tint, testId }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><Icon className={tint} size={19} /><p className="mt-4 text-sm text-zinc-400">{label}</p><p className="mt-1 font-display text-3xl font-extrabold" data-testid={testId}>{value}</p></div>;
}

function ExpiryCell({ item, generatedAt }) {
  if (item.type === "brand") {
    return <div><p className="font-medium text-violet-200">No Savvy coupon expiry</p><p className="mt-1 text-xs text-zinc-500">{item.validity || "Validity is managed by the brand"}</p></div>;
  }
  if (!item.expires_at) return <span className="text-zinc-500">Expiry unavailable</span>;
  const remaining = timeRemaining(item.expires_at, generatedAt);
  return <div><p className={item.status === "expired" ? "font-medium text-rose-200" : item.status === "active" ? "font-medium text-amber-200" : "text-zinc-300"}>{item.status === "expired" ? "Expired" : item.status === "active" ? remaining : "Coupon window"}</p><p className="mt-1 text-xs text-zinc-500">{dateText(item.expires_at)}</p></div>;
}

export default function AdminRedemptionsPage() {
  const [type, setType] = useState("all");
  const [partnerId, setPartnerId] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const updateFilter = (setter) => (event) => { setter(event.target.value); setPage(1); };
  const report = useQuery({
    queryKey: ["admin-offer-activity", type, partnerId, status, dateFrom, dateTo, page],
    queryFn: async () => (await api.get("/admin/offer-activity", { params: {
      type, partner_id: partnerId || undefined, status: status || undefined,
      date_from: dateFrom || undefined, date_to: dateTo || undefined,
      page, page_size: 25,
    } })).data,
  });
  const summary = report.data?.summary || {};
  const pages = Math.max(1, Math.ceil((report.data?.total || 0) / 25));
  const resetFilters = () => { setType("all"); setPartnerId(""); setStatus(""); setDateFrom(""); setDateTo(""); setPage(1); };
  const selectPartner = (group) => { setType(group.type); setPartnerId(group.id); setStatus(""); setPage(1); };

  return <>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs uppercase tracking-[0.25em] text-indigo-300">Offer audit</p><h1 className="font-display mt-2 text-3xl font-extrabold">Offer activity & redemptions</h1><p className="mt-2 max-w-3xl text-sm text-zinc-400">A unified view of outlet coupon lifecycles and student interactions with listed-brand offers.</p></div><button onClick={resetFilters} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5"><RotateCcw size={15} /> Reset filters</button></div>

    <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <SummaryCard label="Total claims" value={report.isLoading ? "—" : summary.total_claims || 0} icon={UsersRound} tint="text-indigo-300" testId="redemption-total-issued" />
      <SummaryCard label="Unique students" value={report.isLoading ? "—" : summary.unique_students || 0} icon={UsersRound} tint="text-sky-300" />
      <SummaryCard label="Brand claims" value={report.isLoading ? "—" : summary.brand_claims || 0} icon={Store} tint="text-violet-300" />
      <SummaryCard label="Active coupons" value={report.isLoading ? "—" : summary.active || 0} icon={Clock3} tint="text-amber-300" testId="redemption-total-active" />
      <SummaryCard label="Redeemed" value={report.isLoading ? "—" : summary.redeemed || 0} icon={TicketCheck} tint="text-emerald-300" testId="redemption-total-redeemed" />
      <SummaryCard label="Expired" value={report.isLoading ? "—" : summary.expired || 0} icon={CircleAlert} tint="text-rose-300" testId="redemption-total-expired" />
    </div>

    <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <select value={type} onChange={(event) => { setType(event.target.value); setPartnerId(""); setStatus(""); setPage(1); }} className="rounded-xl border border-white/10 bg-[#17171b] px-3 py-2.5 text-sm"><option value="all">All activity types</option><option value="outlet">Outlet coupons</option><option value="brand">Listed-brand claims</option></select>
      <select value={partnerId} onChange={updateFilter(setPartnerId)} className="rounded-xl border border-white/10 bg-[#17171b] px-3 py-2.5 text-sm"><option value="">All partners</option>{report.data?.partners?.map((partner) => <option key={`${partner.type}-${partner.id}`} value={partner.id}>{partner.name}{partner.location ? ` · ${partner.location}` : ""}</option>)}</select>
      <select value={status} onChange={updateFilter(setStatus)} className="rounded-xl border border-white/10 bg-[#17171b] px-3 py-2.5 text-sm"><option value="">All statuses</option>{type !== "outlet" && <option value="claimed">Brand claimed</option>}{type !== "brand" && <><option value="active">Coupon active</option><option value="redeemed">Coupon redeemed</option><option value="expired">Coupon expired</option></>}</select>
      <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#17171b] px-3 text-xs text-zinc-400">From <input aria-label="Activity from date" type="date" value={dateFrom} onChange={updateFilter(setDateFrom)} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none" /></label>
      <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#17171b] px-3 text-xs text-zinc-400">To <input aria-label="Activity to date" type="date" value={dateTo} onChange={updateFilter(setDateTo)} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none" /></label>
    </div><p className="mt-3 text-xs text-zinc-500">{report.data?.date_basis || "Date filters use the original claim time."}</p></div>

    <div className="mt-5 flex gap-2 rounded-xl border border-violet-400/15 bg-violet-500/[0.06] p-3 text-xs text-violet-100"><ExternalLink className="mt-0.5 shrink-0" size={15} /><p><strong>Listed-brand claims are not Savvy coupons.</strong> They record when a student continues to a brand's official website, so they do not have active, redeemed, or expired coupon states.</p></div>

    <section className="mt-8"><div><h2 className="font-display text-xl font-bold">Partner overview</h2><p className="mt-1 text-sm text-zinc-500">Compare offer engagement by outlet and brand.</p></div><div className="mt-4 overflow-x-auto rounded-2xl border border-white/10"><table className="w-full min-w-[1000px] text-left text-sm" data-testid="outlet-redemptions-summary"><thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-zinc-500"><tr><th className="p-4">Partner</th><th className="p-4">Type</th><th className="p-4">Claims</th><th className="p-4">Students</th><th className="p-4">Active</th><th className="p-4">Redeemed</th><th className="p-4">Expired</th><th className="p-4">View</th></tr></thead><tbody>{report.isLoading ? <tr><td colSpan="8" className="p-8 text-center"><Loader2 className="mx-auto animate-spin text-indigo-300" size={20} /></td></tr> : report.data?.groups?.length ? report.data.groups.map((group) => <tr key={`${group.type}-${group.id}`} className="border-b border-white/[0.06] last:border-0"><td className="p-4"><p className="font-semibold">{group.name}</p><p className="text-xs text-zinc-500">{group.location || "Online"}</p></td><td className="p-4"><TypeBadge type={group.type} /></td><td className="p-4 font-semibold">{group.claimed}</td><td className="p-4">{group.unique_students}</td><td className="p-4 text-amber-200">{group.type === "brand" ? "—" : group.active}</td><td className="p-4 text-emerald-300">{group.type === "brand" ? "—" : group.redeemed}</td><td className="p-4 text-rose-200">{group.type === "brand" ? "—" : group.expired}</td><td className="p-4"><button onClick={() => selectPartner(group)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5">Show activity</button></td></tr>) : <tr><td colSpan="8" className="p-9 text-center text-zinc-500">No partner activity matches this period.</td></tr>}</tbody></table></div></section>

    <section className="mt-9"><div><h2 className="font-display text-xl font-bold">Activity ledger</h2><p className="mt-1 text-sm text-zinc-500">Student-level claim, expiry, visit, and redemption details.</p></div><div className="mt-4 overflow-x-auto rounded-2xl border border-white/10"><table className="w-full min-w-[1380px] text-left text-sm" data-testid="outlet-redemptions-detail"><thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-zinc-500"><tr><th className="p-4">Partner / type</th><th className="p-4">Student</th><th className="p-4">Offer</th><th className="p-4">Reference</th><th className="p-4">Status</th><th className="p-4">Claimed</th><th className="p-4">Expiry / validity</th><th className="p-4">Redemption / engagement</th></tr></thead><tbody>{report.isLoading ? <tr><td colSpan="8" className="p-10 text-center"><Loader2 className="mx-auto animate-spin text-indigo-300" size={21} /></td></tr> : report.data?.items?.length ? report.data.items.map((item) => <tr key={`${item.type}-${item.id}`} className="border-b border-white/[0.06] align-top last:border-0"><td className="p-4"><p className="font-semibold">{item.partner_name || "—"}</p><div className="mt-1"><TypeBadge type={item.type} /></div></td><td className="p-4"><p className="font-semibold">{item.student_name || "Unknown student"}</p><p className="text-xs text-zinc-500">{item.student_email || item.student_number || "—"}</p><p className="mt-1 text-xs text-zinc-600">{item.student_college || ""}</p></td><td className="max-w-xs p-4"><p>{item.offer_title || "—"}</p><p className="text-xs text-zinc-500">{item.discount || "—"}</p></td><td className="p-4 font-mono text-xs text-zinc-400">{item.code || "Official link"}</td><td className="p-4"><StatusBadge status={item.status} /></td><td className="p-4 text-xs text-zinc-400">{dateText(item.claimed_at)}</td><td className="p-4 text-xs"><ExpiryCell item={item} generatedAt={report.data.generated_at} /></td><td className="p-4 text-xs text-zinc-400">{item.type === "brand" ? <div><p className="text-violet-200">{item.visit_count || 1} official-link visit{item.visit_count === 1 ? "" : "s"}</p><p className="mt-1 text-zinc-500">Last visit: {dateText(item.last_visited_at)}</p></div> : item.status === "redeemed" ? <div><p className="text-emerald-300">Redeemed {dateText(item.redeemed_at)}</p><p className="mt-1 text-zinc-500">{item.approved_by_name ? `Approved by ${item.approved_by_name}` : "Historical approval"}</p></div> : <span>Not redeemed</span>}</td></tr>) : <tr><td colSpan="8" className="p-10 text-center text-zinc-500">No offer activity matches these filters.</td></tr>}</tbody></table></div>
    {report.isError && <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">{formatApiError(report.error?.response?.data?.detail) || "Could not load offer activity."}</div>}
    <div className="mt-5 flex items-center justify-between text-sm text-zinc-400"><span>{report.data?.total || 0} matching records</span><div className="flex items-center gap-2"><button aria-label="Previous activity page" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="rounded-lg border border-white/10 p-2 disabled:opacity-40"><ChevronLeft size={16} /></button><span>Page {page} / {pages}</span><button aria-label="Next activity page" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page >= pages} className="rounded-lg border border-white/10 p-2 disabled:opacity-40"><ChevronRight size={16} /></button></div></div></section>
  </>;
}
