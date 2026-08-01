import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2, Clock3, Download, ExternalLink, Eye, Loader2, MapPin,
  Search, Store, TicketCheck, UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const dateText = (value) => {
  if (!value) return "—";
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "—";
  return `${new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(date)} IST`;
};

const statusClass = {
  active: "border-amber-400/20 bg-amber-500/10 text-amber-200",
  redeemed: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300",
  expired: "border-zinc-400/20 bg-zinc-500/10 text-zinc-300",
};

function StatusBadge({ status }) {
  return <span className={`rounded-full border px-2.5 py-1 text-xs capitalize ${statusClass[status] || statusClass.expired}`}>{status}</span>;
}

function PartnerLogo({ item, size = "h-14 w-14" }) {
  const [failed, setFailed] = useState(false);
  if (item.type === "brand") {
    return <div aria-hidden="true" className={`${size} grid shrink-0 place-items-center rounded-xl border border-violet-400/15 bg-gradient-to-br from-violet-500/20 to-indigo-500/10 font-display text-lg font-extrabold uppercase text-violet-200`}>{item.name?.trim()?.charAt(0) || "B"}</div>;
  }
  if (!item.logo_url || failed) {
    return <div className={`${size} grid shrink-0 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300`}><Store size={19} /></div>;
  }
  return <div className={`${size} grid shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.06]`}><img src={item.logo_url} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover" /></div>;
}

function MetricCard({ label, value, icon: Icon, tint }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><Icon className={tint} size={19} /><p className="mt-4 text-sm text-zinc-400">{label}</p><p className="mt-1 font-display text-3xl font-extrabold">{value}</p></div>;
}

function PartnerDetails({ item, open, onClose, onExport, exporting }) {
  const safeWebsite = /^https?:\/\//i.test(item.website || "") ? item.website : "";
  return <Dialog open={open} onOpenChange={(next) => !next && onClose()}><DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto bg-[#111114] text-white">
    <DialogHeader>
      <div className="flex items-start gap-3 pr-8"><PartnerLogo item={item} size="h-16 w-16" /><div><div className="flex flex-wrap items-center gap-2"><DialogTitle className="font-display text-2xl">{item.name}</DialogTitle><span className="rounded-full bg-indigo-500/15 px-2.5 py-1 text-xs capitalize text-indigo-200">{item.type}</span></div><DialogDescription className="mt-1 text-zinc-400">{item.address || item.city || "Online brand"}</DialogDescription></div></div>
    </DialogHeader>
    <div className="flex flex-wrap items-center justify-between gap-3 border-y border-white/[0.07] py-4">
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400">
        {item.address && <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{item.address}</span>}
        {safeWebsite && <a href={safeWebsite} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-indigo-300 hover:text-indigo-200">Visit website <ExternalLink size={13} /></a>}
        <span>Last redemption: {dateText(item.last_redeemed_at)}</span>
      </div>
      <button onClick={() => onExport(item)} disabled={exporting} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-black disabled:opacity-60">{exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Export CSV</button>
    </div>
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {[["Offers", item.offer_count], ["Claimed", item.claimed], ["Active", item.active], ["Redeemed", item.redeemed], ["Expired", item.expired], ["Unique students", item.unique_students]].map(([label, value]) => <div key={label} className="rounded-xl bg-white/[0.04] p-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>)}
    </div>
    <div><h3 className="font-display text-lg font-bold">Offer performance</h3><div className="mt-3 overflow-x-auto rounded-2xl border border-white/10"><table className="w-full min-w-[820px] text-left text-sm"><thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-zinc-500"><tr><th className="p-4">Offer</th><th className="p-4">Claimed</th><th className="p-4">Active</th><th className="p-4">Redeemed</th><th className="p-4">Expired</th><th className="p-4">Students</th><th className="p-4">Rate</th></tr></thead><tbody>{item.offers.length ? item.offers.map((offer) => <tr key={offer.id} className="border-b border-white/[0.06] last:border-0"><td className="p-4"><p className="font-semibold">{offer.title}</p><p className="text-xs text-zinc-500">{offer.discount || "—"}</p></td><td className="p-4">{offer.claimed}</td><td className="p-4 text-amber-200">{offer.active}</td><td className="p-4 text-emerald-300">{offer.redeemed}</td><td className="p-4 text-zinc-400">{offer.expired}</td><td className="p-4">{offer.unique_students}</td><td className="p-4">{offer.redemption_rate}%</td></tr>) : <tr><td colSpan="7" className="p-8 text-center text-zinc-500">No offers are currently linked to this partner.</td></tr>}</tbody></table></div></div>
    <div><h3 className="font-display text-lg font-bold">Recent coupon activity</h3><div className="mt-3 overflow-x-auto rounded-2xl border border-white/10"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-zinc-500"><tr><th className="p-4">Coupon</th><th className="p-4">Offer</th><th className="p-4">Status</th><th className="p-4">Claimed</th><th className="p-4">Redeemed</th></tr></thead><tbody>{item.recent_activity.length ? item.recent_activity.map((activity) => <tr key={activity.id} className="border-b border-white/[0.06] last:border-0"><td className="p-4 font-mono text-xs">{activity.code || "—"}</td><td className="p-4">{activity.offer_title || "—"}</td><td className="p-4"><StatusBadge status={activity.status} /></td><td className="p-4 text-xs text-zinc-400">{dateText(activity.claimed_at)}</td><td className="p-4 text-xs text-zinc-400">{dateText(activity.redeemed_at)}</td></tr>) : <tr><td colSpan="5" className="p-8 text-center text-zinc-500">No coupons were claimed in this period.</td></tr>}</tbody></table></div></div>
  </DialogContent></Dialog>;
}

export default function AdminBrandsOutletsPage() {
  const [type, setType] = useState("all");
  const [city, setCity] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState(null);
  const [exporting, setExporting] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const report = useQuery({
    queryKey: ["admin-brands-outlets", type, city, query, dateFrom, dateTo],
    queryFn: async () => (await api.get("/admin/brands-outlets", { params: {
      type, city: city || undefined, q: query || undefined,
      date_from: dateFrom || undefined, date_to: dateTo || undefined,
    } })).data,
  });
  useEffect(() => {
    if (!selected) return;
    const refreshed = report.data?.items?.find((item) => item.type === selected.type && item.id === selected.id);
    if (refreshed) setSelected(refreshed);
    else if (!report.isFetching) setSelected(null);
  }, [report.data, report.isFetching, selected]);

  const exportCsv = async (item) => {
    setExporting(true);
    try {
      const response = await api.get("/admin/brands-outlets/export", { params: {
        type: item.type, entity_id: item.id,
        date_from: dateFrom || undefined, date_to: dateTo || undefined,
      }, responseType: "blob" });
      const disposition = response.headers["content-disposition"] || "";
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || `${item.name}-coupon-report.csv`;
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("CSV report downloaded.");
    } catch (error) {
      toast.error(formatApiError(error.response?.data?.detail) || "Could not export this report.");
    } finally { setExporting(false); }
  };
  const summary = report.data?.summary || {};
  return <>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs uppercase tracking-[0.25em] text-indigo-300">Partner performance</p><h1 className="font-display mt-2 text-3xl font-extrabold">Brands & Outlets</h1><p className="mt-2 text-sm text-zinc-400">Track offer reach, coupon status, and redemptions for every partner.</p></div><div className="relative w-full lg:w-80"><Search size={16} className="absolute left-3 top-3 text-zinc-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search partner or location" className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400" /></div></div>
    <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard label="Partners" value={report.isLoading ? "—" : summary.entities || 0} icon={Building2} tint="text-indigo-300" />
      <MetricCard label="Offers" value={report.isLoading ? "—" : summary.offers || 0} icon={Store} tint="text-violet-300" />
      <MetricCard label="Coupons claimed" value={report.isLoading ? "—" : summary.claimed || 0} icon={UsersRound} tint="text-sky-300" />
      <MetricCard label="Active" value={report.isLoading ? "—" : summary.active || 0} icon={Clock3} tint="text-amber-300" />
      <MetricCard label="Redeemed" value={report.isLoading ? "—" : summary.redeemed || 0} icon={TicketCheck} tint="text-emerald-300" />
    </div>
    <div className="mt-7 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2 xl:grid-cols-4">
      <select value={type} onChange={(event) => { setType(event.target.value); setCity(""); }} className="rounded-xl border border-white/10 bg-[#17171b] px-3 py-2.5 text-sm"><option value="all">All partner types</option><option value="outlet">Outlets</option><option value="brand">Online brands</option></select>
      <select value={city} onChange={(event) => setCity(event.target.value)} disabled={type === "brand"} className="rounded-xl border border-white/10 bg-[#17171b] px-3 py-2.5 text-sm disabled:opacity-50"><option value="">All cities</option>{report.data?.cities?.map((name) => <option key={name} value={name}>{name}</option>)}</select>
      <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#17171b] px-3 text-xs text-zinc-400">From <input aria-label="Report from date" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none" /></label>
      <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#17171b] px-3 text-xs text-zinc-400">To <input aria-label="Report to date" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none" /></label>
    </div>
    <p className="mt-3 text-xs text-zinc-500">{report.data?.date_basis || "Date filters use the coupon claim date."}</p>
    <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10"><table className="w-full min-w-[1080px] text-left text-sm" data-testid="brands-outlets-table"><thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-zinc-500"><tr><th className="p-4">Partner</th><th className="p-4">Location</th><th className="p-4">Offers</th><th className="p-4">Claimed</th><th className="p-4">Active</th><th className="p-4">Redeemed</th><th className="p-4">Expired</th><th className="p-4">Rate</th><th className="p-4">Actions</th></tr></thead><tbody>{report.isLoading ? <tr><td colSpan="9" className="p-10 text-center"><Loader2 className="mx-auto animate-spin text-indigo-300" /></td></tr> : report.data?.items?.length ? report.data.items.map((item) => <tr key={`${item.type}-${item.id}`} className="border-b border-white/[0.06] last:border-0"><td className="p-4"><div className="flex items-center gap-3"><PartnerLogo item={item} /><div><p className="font-semibold">{item.name}</p><p className="mt-0.5 text-xs capitalize text-zinc-500">{item.type}</p></div></div></td><td className="max-w-xs p-4 text-zinc-400">{item.address || item.city || "Online"}</td><td className="p-4">{item.offer_count}</td><td className="p-4">{item.claimed}</td><td className="p-4 text-amber-200">{item.active}</td><td className="p-4 text-emerald-300">{item.redeemed}</td><td className="p-4 text-zinc-400">{item.expired}</td><td className="p-4">{item.redemption_rate}%</td><td className="p-4"><div className="flex gap-2"><button onClick={() => setSelected(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/5"><Eye size={13} /> Details</button><button aria-label={`Export ${item.name} CSV`} onClick={() => exportCsv(item)} disabled={exporting} className="rounded-lg border border-white/10 p-2 hover:bg-white/5 disabled:opacity-50"><Download size={14} /></button></div></td></tr>) : <tr><td colSpan="9" className="p-10 text-center text-zinc-500">No brands or outlets match these filters.</td></tr>}</tbody></table></div>
    {report.isError && <p className="mt-4 text-sm text-rose-300">{formatApiError(report.error?.response?.data?.detail) || "Could not load partner reports."}</p>}
    {selected && <PartnerDetails item={selected} open onClose={() => setSelected(null)} onExport={exportCsv} exporting={exporting} />}
  </>;
}
