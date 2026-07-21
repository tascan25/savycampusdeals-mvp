import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Loader2, QrCode, TicketCheck } from "lucide-react";
import api from "@/lib/api";

const dateText = (value) => {
  if (!value) return "—";
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "—";
  return `${new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
  }).format(date)} IST`;
};

export default function AdminRedemptionsPage() {
  const [outletId, setOutletId] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const report = useQuery({
    queryKey: ["admin-outlet-redemptions", outletId, status, dateFrom, dateTo, page],
    queryFn: async () => (await api.get("/admin/outlet-redemptions", { params: {
      outlet_id: outletId || undefined,
      status: status || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page,
      page_size: 25,
    } })).data,
  });
  const totals = useMemo(() => (report.data?.summary || []).reduce((sum, row) => ({
    issued: sum.issued + row.issued,
    active: sum.active + row.active,
    redeemed: sum.redeemed + row.redeemed,
    expired: sum.expired + row.expired,
  }), { issued: 0, active: 0, redeemed: 0, expired: 0 }), [report.data]);
  const setFilter = (setter) => (event) => { setter(event.target.value); setPage(1); };
  const pages = Math.max(1, Math.ceil((report.data?.total || 0) / 25));

  return (
    <>
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">QR audit</p>
        <h1 className="font-display mt-2 text-3xl font-extrabold">Outlet redemptions</h1>
        <p className="mt-2 text-sm text-zinc-400">Outlet-wise QR issuance and approvals. In the scanner, approval and redemption happen together.</p>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["issued", "QR codes issued", QrCode, "text-indigo-300"],
          ["active", "Active", Clock3, "text-amber-300"],
          ["redeemed", "Approved & redeemed", TicketCheck, "text-emerald-300"],
          ["expired", "Expired", CheckCircle2, "text-zinc-400"],
        ].map(([key, label, Icon, tint]) => (
          <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <Icon className={tint} size={19} />
            <p className="mt-4 text-sm text-zinc-400">{label}</p>
            <p className="mt-1 font-display text-3xl font-extrabold" data-testid={`redemption-total-${key}`}>{report.isLoading ? "—" : totals[key]}</p>
          </div>
        ))}
      </div>

      <div className="mt-7 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2 xl:grid-cols-4">
        <select data-testid="redemptions-outlet-filter" value={outletId} onChange={setFilter(setOutletId)} className="rounded-xl border border-white/10 bg-[#17171b] px-3 py-2.5 text-sm">
          <option value="">All outlets</option>
          {report.data?.outlets?.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name} · {outlet.city}</option>)}
        </select>
        <select data-testid="redemptions-status-filter" value={status} onChange={setFilter(setStatus)} className="rounded-xl border border-white/10 bg-[#17171b] px-3 py-2.5 text-sm">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="redeemed">Approved & redeemed</option>
          <option value="expired">Expired</option>
        </select>
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#17171b] px-3 text-xs text-zinc-400">From <input aria-label="Redemptions from date" type="date" value={dateFrom} onChange={setFilter(setDateFrom)} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none" /></label>
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#17171b] px-3 text-xs text-zinc-400">To <input aria-label="Redemptions to date" type="date" value={dateTo} onChange={setFilter(setDateTo)} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none" /></label>
      </div>

      <div className="mt-7 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[900px] text-left text-sm" data-testid="outlet-redemptions-summary">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-zinc-500"><tr><th className="p-4">Outlet</th><th className="p-4">Issued</th><th className="p-4">Active</th><th className="p-4">Redeemed</th><th className="p-4">Expired</th><th className="p-4">View</th></tr></thead>
          <tbody>{report.isLoading ? <tr><td colSpan="6" className="p-8 text-center"><Loader2 className="mx-auto animate-spin" size={20} /></td></tr> : report.data?.summary?.map((row) => (
            <tr key={row.outlet_id} className="border-b border-white/[0.06] last:border-0"><td className="p-4"><p className="font-semibold">{row.outlet_name}</p><p className="text-xs text-zinc-500">{row.city}</p></td><td className="p-4">{row.issued}</td><td className="p-4 text-amber-200">{row.active}</td><td className="p-4 text-emerald-300">{row.redeemed}</td><td className="p-4 text-zinc-400">{row.expired}</td><td className="p-4"><button onClick={() => { setOutletId(row.outlet_id); setPage(1); }} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5">Details</button></td></tr>
          ))}</tbody>
        </table>
      </div>

      <h2 className="font-display mt-9 text-xl font-bold">QR records</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[1120px] text-left text-sm" data-testid="outlet-redemptions-detail">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-zinc-500"><tr><th className="p-4">Student</th><th className="p-4">Outlet</th><th className="p-4">Offer</th><th className="p-4">Coupon</th><th className="p-4">Status</th><th className="p-4">Claimed</th><th className="p-4">Approved</th><th className="p-4">Approved by</th></tr></thead>
          <tbody>{report.isLoading ? <tr><td colSpan="8" className="p-8 text-center"><Loader2 className="mx-auto animate-spin" size={20} /></td></tr> : report.data?.items?.length ? report.data.items.map((item) => (
            <tr key={item.id} className="border-b border-white/[0.06] last:border-0"><td className="p-4"><p className="font-semibold">{item.student_name || "—"}</p><p className="text-xs text-zinc-500">{item.student_number || item.student_email || "—"}</p></td><td className="p-4">{item.outlet_name || "—"}</td><td className="p-4"><p>{item.offer_title || "—"}</p><p className="text-xs text-zinc-500">{item.discount}</p></td><td className="p-4 font-mono text-xs">{item.code}</td><td className="p-4"><span className={`rounded-full border px-2.5 py-1 text-xs capitalize ${item.status === "redeemed" ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300" : item.status === "active" ? "border-amber-400/20 bg-amber-500/10 text-amber-200" : "border-zinc-400/20 bg-zinc-500/10 text-zinc-300"}`}>{item.status}</span></td><td className="p-4 text-xs text-zinc-400">{dateText(item.claimed_at)}</td><td className="p-4 text-xs text-zinc-400">{dateText(item.approved_at)}</td><td className="p-4"><p>{item.approved_by_name}</p>{item.legacy_approval && <p className="text-xs text-amber-300">Historical record</p>}</td></tr>
          )) : <tr><td colSpan="8" className="p-10 text-center text-zinc-500">No QR records match these filters.</td></tr>}</tbody>
        </table>
      </div>
      {report.isError && <p className="mt-4 text-sm text-rose-300">Could not load outlet redemption data.</p>}
      <div className="mt-5 flex items-center justify-between text-sm text-zinc-400"><span>{report.data?.total || 0} records</span><div className="flex items-center gap-2"><button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-40">Previous</button><span>{page} / {pages}</span><button onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page >= pages} className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-40">Next</button></div></div>
    </>
  );
}
