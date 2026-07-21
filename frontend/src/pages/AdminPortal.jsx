import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3, CheckCircle2, ChevronLeft, ChevronRight, CircleUserRound, Clock3,
  FileText, Handshake, LayoutDashboard, Loader2, LogOut, Menu, Search, Settings,
  ShieldCheck, Store, Ticket, TicketCheck, Users, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import AdminPartnersPage from "@/pages/admin/AdminPartnersPage";
import AdminRedemptionsPage from "@/pages/admin/AdminRedemptionsPage";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/pending-verifications", label: "Pending verification", icon: ShieldCheck },
  { to: "/admin/partners", label: "Outlet partners", icon: Handshake },
  { to: "/admin/redemptions", label: "Redemptions", icon: TicketCheck },
  { to: "/admin/brands", label: "Brands", icon: Store, placeholder: true },
  { to: "/admin/coupons", label: "Coupons", icon: Ticket, placeholder: true },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3, placeholder: true },
  { to: "/admin/settings", label: "Settings", icon: Settings, placeholder: true },
];

const statusStyle = {
  approved: "bg-emerald-500/10 text-emerald-300 border-emerald-400/20",
  pending: "bg-amber-500/10 text-amber-200 border-amber-400/20",
  rejected: "bg-rose-500/10 text-rose-300 border-rose-400/20",
  not_submitted: "bg-zinc-500/10 text-zinc-300 border-zinc-400/20",
};

const dateText = (value) => {
  if (!value) return "—";
  // MongoDB returns UTC datetimes without an offset. Treat those values as UTC
  // before formatting so the admin's browser timezone cannot shift signup times.
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "—";
  return `${new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(date)} IST`;
};

function StatusBadge({ status }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusStyle[status] || statusStyle.not_submitted}`}>{(status || "not submitted").replace("_", " ")}</span>;
}

function ImagePreview({ label, src, onOpen }) {
  const valid = typeof src === "string" && src.startsWith("data:image/");
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <div className="px-4 py-3 text-sm font-semibold">{label}</div>
      {valid ? (
        <button type="button" onClick={() => onOpen(src, label)} className="block w-full h-44 bg-black/30 focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <img src={src} alt={label} className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
        </button>
      ) : <div className="h-44 grid place-items-center px-5 text-center text-sm text-zinc-500">No valid image was submitted.</div>}
    </div>
  );
}

function Pager({ data, page, onPage }) {
  if (!data) return null;
  const lastPage = Math.max(1, Math.ceil(data.total / data.page_size));
  return <div className="mt-5 flex items-center justify-between text-sm text-zinc-400">
    <span>Showing {data.items.length} of {data.total}</span>
    <div className="flex items-center gap-2">
      <button onClick={() => onPage(page - 1)} disabled={page <= 1} className="rounded-lg border border-white/10 p-2 disabled:opacity-40 hover:bg-white/5"><ChevronLeft size={16} /></button>
      <span>Page {page} / {lastPage}</span>
      <button onClick={() => onPage(page + 1)} disabled={page >= lastPage} className="rounded-lg border border-white/10 p-2 disabled:opacity-40 hover:bg-white/5"><ChevronRight size={16} /></button>
    </div>
  </div>;
}

function AdminSidebar({ pathname, onNavigate, mobileOpen }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const active = (to) => to === "/admin" ? pathname === to || pathname === "/admin/" : pathname.startsWith(to);
  return <aside className={`${mobileOpen ? "block" : "hidden"} w-full md:block md:w-64 shrink-0 md:min-h-screen border-b md:border-b-0 md:border-r border-white/10 bg-[#09090b] p-4 md:sticky md:top-0`}>
    <div className="flex items-center gap-3 px-2 py-3">
      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 grid place-items-center"><ShieldCheck size={19} /></div>
      <div><div className="font-display font-bold">Savy Admin</div><div className="text-[10px] uppercase tracking-[0.18em] text-indigo-300">Control centre</div></div>
    </div>
    <nav className="mt-5 flex md:flex-col gap-1 overflow-x-auto pb-1">
      {navItems.map((item) => <Link key={item.to} to={item.to} onClick={onNavigate} className={`whitespace-nowrap flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${active(item.to) ? "bg-indigo-500/15 text-indigo-100" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}>
        <item.icon size={17} /> {item.label}
      </Link>)}
    </nav>
    <button onClick={async () => { await logout(); navigate("/login"); }} className="mt-5 md:absolute md:bottom-5 inline-flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-white"><LogOut size={16} /> Sign out</button>
  </aside>;
}

function DashboardPage() {
  const stats = useQuery({ queryKey: ["admin-dashboard"], queryFn: async () => (await api.get("/admin/dashboard")).data });
  const cards = [
    ["total_users", "Total users", Users, "text-indigo-300"], ["verified_students", "Verified students", CheckCircle2, "text-emerald-300"],
    ["pending_verifications", "Pending requests", Clock3, "text-amber-300"], ["rejected_verifications", "Rejected verifications", XCircle, "text-rose-300"],
    ["today_signups", "Today's signups", CircleUserRound, "text-sky-300"], ["total_brands", "Total brands", Store, "text-violet-300"],
    ["outlet_partners", "Active outlet partners", Handshake, "text-cyan-300"], ["outlet_redemptions", "Outlet redemptions", TicketCheck, "text-emerald-300"],
  ];
  return <><div><p className="text-xs uppercase tracking-[0.25em] text-indigo-300">Administration</p><h1 className="font-display mt-2 text-3xl font-extrabold">Dashboard</h1><p className="mt-2 text-sm text-zinc-400">A live overview of SavyCampusDeals.</p></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map(([key, label, Icon, tint]) => <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><Icon className={tint} size={20} /><div className="mt-5 text-sm text-zinc-400">{label}</div><div className="mt-1 font-display text-4xl font-extrabold">{stats.isLoading ? "—" : stats.data?.[key] ?? 0}</div></div>)}
    </div>
    {stats.isError && <div className="mt-5 rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">Could not load dashboard data. Please refresh and try again.</div>}
  </>;
}

function UsersPage({ openUser }) {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  const users = useQuery({ queryKey: ["admin-users", status, debouncedSearch, page], queryFn: async () => (await api.get("/admin/users", { params: { status: status || undefined, q: debouncedSearch || undefined, page, page_size: 20 } })).data });
  const filters = [["", "All"], ["approved", "Verified"], ["pending", "Pending"], ["rejected", "Rejected"]];
  return <><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs uppercase tracking-[0.25em] text-indigo-300">Directory</p><h1 className="font-display mt-2 text-3xl font-extrabold">Users</h1><p className="mt-2 text-sm text-zinc-400">Search and inspect registered students.</p></div><div className="relative w-full lg:w-80"><Search size={16} className="absolute left-3 top-3 text-zinc-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, college" className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400" /></div></div>
    <div className="mt-6 flex gap-2 overflow-x-auto">{filters.map(([value, label]) => <button key={value} onClick={() => { setStatus(value); setPage(1); }} className={`rounded-full px-4 py-2 text-sm ${status === value ? "bg-indigo-500 text-white" : "bg-white/[0.05] text-zinc-400 hover:text-white"}`}>{label}</button>)}</div>
    <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-zinc-500"><tr><th className="p-4">Name</th><th className="p-4">Email</th><th className="p-4">College</th><th className="p-4">Status</th><th className="p-4">Joined</th><th className="p-4">Actions</th></tr></thead><tbody>{users.isLoading ? <tr><td colSpan="6" className="p-10 text-center text-zinc-500"><Loader2 className="mx-auto animate-spin" size={22} /></td></tr> : users.data?.items.length ? users.data.items.map((user) => <tr key={user.id} className="border-b border-white/[0.06] last:border-0"><td className="p-4 font-semibold">{user.name || "—"}</td><td className="p-4 text-zinc-400">{user.email}</td><td className="p-4 text-zinc-400">{user.college || "—"}</td><td className="p-4"><StatusBadge status={user.verification_status} /></td><td className="p-4 text-zinc-400">{dateText(user.created_at)}</td><td className="p-4"><button onClick={() => openUser(user.id)} className="rounded-lg bg-white/8 px-3 py-1.5 text-xs font-semibold hover:bg-white/15">View</button></td></tr>) : <tr><td colSpan="6" className="p-10 text-center text-zinc-500">No users match this filter.</td></tr>}</tbody></table></div>
    {users.isError && <p className="mt-4 text-sm text-rose-300">Could not load users. Please try again.</p>}<Pager data={users.data} page={page} onPage={setPage} />
  </>;
}

function PendingPage({ openUser, review }) {
  const [page, setPage] = useState(1);
  const pending = useQuery({ queryKey: ["admin-pending", page], queryFn: async () => (await api.get("/admin/pending-verifications", { params: { page, page_size: 20 } })).data });
  return <><div><p className="text-xs uppercase tracking-[0.25em] text-indigo-300">Review queue</p><h1 className="font-display mt-2 text-3xl font-extrabold">Pending verification</h1><p className="mt-2 text-sm text-zinc-400">Only document requests awaiting review appear here.</p></div>
    <div className="mt-7 grid gap-4">{pending.isLoading ? <div className="h-44 grid place-items-center rounded-2xl border border-white/10"><Loader2 className="animate-spin text-indigo-300" /></div> : pending.data?.items.length ? pending.data.items.map((request) => <article key={request.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center"><div className="flex-1"><div className="flex items-center gap-3"><h2 className="font-display text-xl font-bold">{request.name || "Unnamed student"}</h2><StatusBadge status="pending" /></div><p className="mt-1 text-sm text-zinc-400">{request.email}</p><div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-zinc-400 sm:grid-cols-4"><span><b className="text-zinc-200">College:</b> {request.college_name || "—"}</span><span><b className="text-zinc-200">Course:</b> {request.course || "—"}</span><span><b className="text-zinc-200">Year:</b> {request.year || "—"}</span><span><b className="text-zinc-200">Student ID:</b> {request.student_id_number || "—"}</span></div><p className="mt-3 text-xs text-zinc-500">Submitted {dateText(request.submitted_at)}</p></div><div className="flex shrink-0 flex-wrap gap-2"><button onClick={() => review(request)} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-black">Review</button><button onClick={() => openUser(request.user_id)} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/5">Profile</button></div></div></article>) : <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center"><CheckCircle2 className="mx-auto text-emerald-300" /><h2 className="mt-3 font-display text-xl font-bold">All caught up</h2><p className="mt-1 text-sm text-zinc-500">There are no pending verification requests.</p></div>}</div>
    {pending.isError && <p className="mt-4 text-sm text-rose-300">Could not load pending requests. Please try again.</p>}<Pager data={pending.data} page={page} onPage={setPage} />
  </>;
}

function PlaceholderPage({ title }) { return <div className="min-h-[420px] grid place-items-center rounded-3xl border border-dashed border-white/15 bg-white/[0.02] text-center"><div><FileText className="mx-auto text-indigo-300" size={30} /><h1 className="font-display mt-4 text-2xl font-bold">{title}</h1><p className="mt-2 text-sm text-zinc-500">This section is ready for a future release.</p></div></div>; }

function UserDialog({ userId, onClose, selectedVerification, onReview }) {
  const detail = useQuery({ queryKey: ["admin-user", userId], queryFn: async () => (await api.get(`/admin/user/${userId}`)).data, enabled: Boolean(userId) });
  const [image, setImage] = useState(null);
  const user = detail.data?.user;
  const verification = useMemo(() => detail.data?.verifications?.find((item) => item.id === selectedVerification) || detail.data?.verifications?.[0], [detail.data, selectedVerification]);
  return <><Dialog open={Boolean(userId)} onOpenChange={(open) => !open && onClose()}><DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto bg-[#111114] text-white"><DialogHeader><DialogTitle>{detail.isLoading ? "Loading profile…" : user?.name || "Student profile"}</DialogTitle><DialogDescription className="text-zinc-400">Review identity details and uploaded documents.</DialogDescription></DialogHeader>{detail.isError ? <p className="text-rose-300">This user is no longer available.</p> : detail.isLoading ? <div className="h-64 grid place-items-center"><Loader2 className="animate-spin" /></div> : <div className="space-y-7"><div className="grid gap-4 rounded-2xl bg-white/[0.04] p-4 sm:grid-cols-2 lg:grid-cols-3"><div><p className="text-xs text-zinc-500">Email</p><p className="mt-1 text-sm">{user?.email}</p></div><div><p className="text-xs text-zinc-500">College</p><p className="mt-1 text-sm">{user?.college || "—"}</p></div><div><p className="text-xs text-zinc-500">Verification status</p><div className="mt-1"><StatusBadge status={user?.verification_status} /></div></div><div><p className="text-xs text-zinc-500">Course / academic year</p><p className="mt-1 text-sm">{user?.course || "—"} {user?.year ? `• ${user.year}` : ""}</p></div><div><p className="text-xs text-zinc-500">Student ID</p><p className="mt-1 text-sm">{verification?.student_id_number || "—"}</p></div><div><p className="text-xs text-zinc-500">Submitted</p><p className="mt-1 text-sm">{dateText(verification?.submitted_at)}</p></div></div><div><h3 className="font-display text-lg font-bold">Uploaded documents</h3><div className="mt-3 grid gap-4 sm:grid-cols-2"><ImagePreview label="College ID card" src={verification?.college_id_image} onOpen={(src, label) => setImage({ src, label })} /><ImagePreview label="Selfie with college ID" src={verification?.selfie_image || verification?.selfie_with_id} onOpen={(src, label) => setImage({ src, label })} /></div></div>{user?.verification_rejection_reason && <p className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">Previous rejection: {user.verification_rejection_reason}</p>}{verification?.status === "pending" && <DialogFooter><button onClick={() => onReview(verification, "approve")} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-black">Approve</button><button onClick={() => onReview(verification, "reject")} className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white">Reject</button></DialogFooter>}</div>}</DialogContent></Dialog>
    <Dialog open={Boolean(image)} onOpenChange={(open) => !open && setImage(null)}><DialogContent className="max-h-[94vh] max-w-5xl overflow-auto bg-[#111114] text-white"><DialogHeader><DialogTitle>{image?.label}</DialogTitle></DialogHeader>{image && <img src={image.src} alt={image.label} className="max-h-[76vh] w-full object-contain" />}</DialogContent></Dialog>
  </>;
}

function ReviewDialog({ action, onClose }) {
  const client = useQueryClient();
  const [reason, setReason] = useState("Image is blurry");
  const [other, setOther] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isReject = action?.kind === "reject";
  const submit = async () => { const finalReason = reason === "Other" ? other.trim() : reason; if (isReject && !finalReason) { toast.error("Enter a rejection reason."); return; } setSubmitting(true); try { const { data } = await api.post(isReject ? "/admin/reject-verification" : "/admin/approve-verification", { verification_id: action.verification.id, rejection_reason: finalReason }); await Promise.all([client.invalidateQueries({ queryKey: ["admin-pending"] }), client.invalidateQueries({ queryKey: ["admin-dashboard"] }), client.invalidateQueries({ queryKey: ["admin-users"] }), client.invalidateQueries({ queryKey: ["admin-user"] })]); toast.success(isReject ? "Verification rejected." : "Verification approved."); if (!data.email_sent) toast.warning("The review was saved, but the email could not be sent."); onClose(); } catch (error) { toast.error(formatApiError(error.response?.data?.detail)); } finally { setSubmitting(false); } };
  return <Dialog open={Boolean(action)} onOpenChange={(open) => !open && onClose()}><DialogContent className="bg-[#111114] text-white"><DialogHeader><DialogTitle>{isReject ? "Reject verification" : "Approve verification"}</DialogTitle><DialogDescription className="text-zinc-400">{isReject ? "Tell the student what they need to correct." : "This will verify the student, award their verification points, and send the confirmation email."}</DialogDescription></DialogHeader>{isReject && <div className="space-y-3">{["Image is blurry", "Invalid Student ID", "Selfie missing", "Other"].map((option) => <label key={option} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 p-3 text-sm"><input type="radio" name="rejection-reason" checked={reason === option} onChange={() => setReason(option)} />{option}</label>)}{reason === "Other" && <textarea value={other} onChange={(e) => setOther(e.target.value)} placeholder="Explain what the student should provide" className="min-h-24 w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm outline-none focus:border-indigo-400" />}</div>}<DialogFooter><button onClick={onClose} disabled={submitting} className="rounded-xl border border-white/10 px-4 py-2 text-sm">Cancel</button><button onClick={submit} disabled={submitting} className={`rounded-xl px-4 py-2 text-sm font-bold ${isReject ? "bg-rose-500 text-white" : "bg-emerald-500 text-black"}`}>{submitting && <Loader2 className="mr-2 inline animate-spin" size={15} />}{isReject ? "Reject request" : "Approve student"}</button></DialogFooter></DialogContent></Dialog>;
}

export default function AdminPortal() {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userId, setUserId] = useState(null);
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [reviewAction, setReviewAction] = useState(null);
  const openUser = (id, verificationId = null) => { setUserId(id); setSelectedVerification(verificationId); };
  const review = (verification, kind = "approve") => { setReviewAction({ verification, kind }); };
  let page = <DashboardPage />;
  if (pathname.startsWith("/admin/users")) page = <UsersPage openUser={openUser} />;
  else if (pathname.startsWith("/admin/pending-verifications")) page = <PendingPage openUser={(id) => openUser(id)} review={(request) => openUser(request.user_id, request.id)} />;
  else if (pathname.startsWith("/admin/partners")) page = <AdminPartnersPage />;
  else if (pathname.startsWith("/admin/redemptions")) page = <AdminRedemptionsPage />;
  else { const item = navItems.find((entry) => entry.placeholder && pathname.startsWith(entry.to)); if (item) page = <PlaceholderPage title={item.label} />; }
  return <div className="min-h-screen bg-[#050505] text-white md:flex"><AdminSidebar pathname={pathname} mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} /><main className="min-w-0 flex-1"><div className="border-b border-white/10 px-5 py-4 md:hidden"><button onClick={() => setMobileOpen(!mobileOpen)} className="inline-flex items-center gap-2 text-sm text-zinc-300"><Menu size={18} /> Menu</button></div><div className="mx-auto max-w-7xl p-5 md:p-9">{page}</div></main><UserDialog userId={userId} onClose={() => setUserId(null)} selectedVerification={selectedVerification} onReview={review} /><ReviewDialog action={reviewAction} onClose={() => { setReviewAction(null); setUserId(null); }} /></div>;
}
