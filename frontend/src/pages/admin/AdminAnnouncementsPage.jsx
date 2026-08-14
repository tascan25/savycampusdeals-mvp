import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3, BellRing, CalendarClock, Edit3, Eye, Loader2, Megaphone,
  MousePointerClick, Plus, Send, Sparkles, Trash2, Users,
} from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const inputClass = "mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-400";
const emptyForm = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return {
    title: "", message: "", category: "new", audience: "students", priority: 1,
    cta_label: "", cta_url: "", image_url: "", starts_at: now.toISOString().slice(0, 16), published: false,
  };
};

const toLocalDateTime = (value) => {
  if (!value) return emptyForm().starts_at;
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return emptyForm().starts_at;
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const dateText = (value) => {
  if (!value) return "—";
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
};

const statusStyle = {
  active: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
  scheduled: "border-sky-300/20 bg-sky-400/10 text-sky-200",
  draft: "border-zinc-300/15 bg-white/[0.05] text-zinc-300",
  expired: "border-rose-300/20 bg-rose-400/10 text-rose-200",
};

function AnnouncementEditor({ editing, onClose }) {
  const client = useQueryClient();
  const [form, setForm] = useState(() => editing ? {
    title: editing.title,
    message: editing.message,
    category: editing.category,
    audience: editing.audience,
    priority: editing.priority,
    cta_label: editing.cta_label || "",
    cta_url: editing.cta_url || "",
    image_url: editing.image_url || "",
    starts_at: toLocalDateTime(editing.starts_at),
    published: editing.published,
  } : emptyForm());
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, priority: Number(form.priority), starts_at: new Date(form.starts_at).toISOString() };
      return editing
        ? (await api.put(`/admin/announcements/${editing.id}`, payload)).data
        : (await api.post("/admin/announcements", payload)).data;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast.success(editing ? "Announcement updated." : form.published ? "Announcement published." : "Draft saved.");
      onClose();
    },
    onError: (error) => toast.error(formatApiError(error.response?.data?.detail)),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto border-white/10 bg-[#101014] text-white sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-extrabold">{editing ? "Edit announcement" : "Create a new drop"}</DialogTitle>
          <DialogDescription className="text-zinc-400">It will remain live for exactly five days from its scheduled start.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2 text-xs font-semibold text-zinc-300">Headline
            <input value={form.title} onChange={(event) => set("title", event.target.value)} maxLength={100} placeholder="Something fresh just dropped ✨" className={inputClass} />
          </label>
          <label className="sm:col-span-2 text-xs font-semibold text-zinc-300">Message
            <textarea value={form.message} onChange={(event) => set("message", event.target.value)} maxLength={600} rows={4} placeholder="Tell students what changed and why they should care." className={`${inputClass} resize-none`} />
            <span className="mt-1 block text-right text-[10px] text-zinc-600">{form.message.length}/600</span>
          </label>
          <label className="text-xs font-semibold text-zinc-300">Category
            <select value={form.category} onChange={(event) => set("category", event.target.value)} className={inputClass}><option value="new">New feature</option><option value="important">Important</option><option value="limited">Limited-time</option></select>
          </label>
          <label className="text-xs font-semibold text-zinc-300">Audience
            <select value={form.audience} onChange={(event) => set("audience", event.target.value)} className={inputClass}><option value="students">Students</option><option value="partners">Outlet partners</option><option value="everyone">Everyone</option></select>
          </label>
          <label className="text-xs font-semibold text-zinc-300">Priority
            <select value={form.priority} onChange={(event) => set("priority", event.target.value)} className={inputClass}><option value="0">Normal</option><option value="1">Featured</option><option value="2">Important — show first</option></select>
          </label>
          <label className="text-xs font-semibold text-zinc-300">Starts at
            <input type="datetime-local" value={form.starts_at} onChange={(event) => set("starts_at", event.target.value)} className={inputClass} />
          </label>
          <label className="text-xs font-semibold text-zinc-300">Button label <span className="text-zinc-600">(optional)</span>
            <input value={form.cta_label} onChange={(event) => set("cta_label", event.target.value)} maxLength={40} placeholder="Explore the feature" className={inputClass} />
          </label>
          <label className="text-xs font-semibold text-zinc-300">Button destination <span className="text-zinc-600">(optional)</span>
            <input value={form.cta_url} onChange={(event) => set("cta_url", event.target.value)} placeholder="/dashboard" className={inputClass} />
          </label>
          <label className="sm:col-span-2 text-xs font-semibold text-zinc-300">Artwork URL <span className="text-zinc-600">(optional HTTPS image)</span>
            <input value={form.image_url} onChange={(event) => set("image_url", event.target.value)} placeholder="https://..." className={inputClass} />
          </label>
          <label className="sm:col-span-2 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <input type="checkbox" checked={form.published} onChange={(event) => set("published", event.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-500" />
            <span><span className="block text-sm font-bold">Publish this announcement</span><span className="mt-1 block text-xs leading-5 text-zinc-500">Turn this off to save it as a draft. Scheduled announcements appear automatically at their start time.</span></span>
          </label>
        </div>
        <DialogFooter className="gap-2">
          <button type="button" onClick={onClose} disabled={save.isPending} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold">Cancel</button>
          <button type="button" onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim() || !form.message.trim() || !form.starts_at} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-extrabold text-black disabled:opacity-50">
            {save.isPending ? <Loader2 size={15} className="animate-spin" /> : form.published ? <Send size={15} /> : <Sparkles size={15} />}{form.published ? "Publish" : "Save draft"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminAnnouncementsPage() {
  const client = useQueryClient();
  const [editor, setEditor] = useState(undefined);
  const announcements = useQuery({ queryKey: ["admin-announcements"], queryFn: async () => (await api.get("/admin/announcements")).data });
  const remove = useMutation({
    mutationFn: async (id) => api.delete(`/admin/announcements/${id}`),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["admin-announcements"] }); toast.success("Announcement deleted."); },
    onError: (error) => toast.error(formatApiError(error.response?.data?.detail)),
  });
  const items = announcements.data?.items || [];
  const active = items.filter((item) => item.status === "active").length;
  const totalViews = items.reduce((sum, item) => sum + (item.stats?.seen || 0), 0);
  const totalClicks = items.reduce((sum, item) => sum + (item.stats?.clicked || 0), 0);

  return (
    <>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs uppercase tracking-[0.25em] text-violet-300">Communication</p><h1 className="mt-2 font-display text-3xl font-extrabold">Announcements</h1><p className="mt-2 max-w-2xl text-sm text-zinc-400">Launch five-day feature drops and important updates without creating modal fatigue.</p></div>
        <button type="button" onClick={() => setEditor(null)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-black"><Plus size={16} /> New announcement</button>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {[[BellRing, "Active now", active, "text-emerald-300"], [Eye, "Total views", totalViews, "text-violet-300"], [MousePointerClick, "CTA clicks", totalClicks, "text-amber-300"]].map(([Icon, label, value, color]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><Icon size={18} className={color} /><p className="mt-4 text-xs text-zinc-500">{label}</p><p className="mt-1 font-display text-3xl font-black">{value}</p></div>
        ))}
      </div>

      <div className="mt-6 grid gap-4">
        {announcements.isLoading ? <div className="grid h-48 place-items-center rounded-2xl border border-white/10"><Loader2 className="animate-spin text-violet-300" /></div> : items.length ? items.map((item) => (
          <article key={item.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-200"><Megaphone size={18} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider ${statusStyle[item.status]}`}>{item.status}</span><span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400">{item.category}</span><span className="inline-flex items-center gap-1 text-[10px] text-zinc-500"><Users size={11} /> {item.audience}</span></div>
                <h2 className="mt-3 font-display text-xl font-extrabold">{item.title}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{item.message}</p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-zinc-500"><span className="inline-flex items-center gap-1.5"><CalendarClock size={12} /> {dateText(item.starts_at)} → {dateText(item.expires_at)}</span>{item.cta_label && <span>CTA: <b className="text-zinc-300">{item.cta_label}</b></span>}</div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => setEditor(item)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold hover:bg-white/[0.06]"><Edit3 size={13} /> Edit</button>
                <button type="button" onClick={() => { if (window.confirm(`Delete “${item.title}”? Its view history will also be removed.`)) remove.mutate(item.id); }} className="grid h-9 w-9 place-items-center rounded-xl border border-rose-300/10 text-rose-300 hover:bg-rose-400/10" aria-label={`Delete ${item.title}`}><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="grid grid-cols-3 border-t border-white/[0.07] bg-black/20">
              {[["Delivered", item.stats?.delivered || 0], ["Viewed", item.stats?.seen || 0], ["Clicked", item.stats?.clicked || 0]].map(([label, value]) => <div key={label} className="border-r border-white/[0.06] px-4 py-3 text-center last:border-0"><p className="font-display text-lg font-extrabold">{value}</p><p className="text-[9px] uppercase tracking-wider text-zinc-600">{label}</p></div>)}
            </div>
          </article>
        )) : <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center"><BarChart3 className="mx-auto text-zinc-600" /><h2 className="mt-4 font-display text-xl font-bold">No announcements yet</h2><p className="mt-2 text-sm text-zinc-500">Create your first five-day feature drop.</p></div>}
        {announcements.isError && <p className="text-sm text-rose-300">Could not load announcements. Please try again.</p>}
      </div>

      {editor !== undefined && <AnnouncementEditor editing={editor} onClose={() => setEditor(undefined)} />}
    </>
  );
}
