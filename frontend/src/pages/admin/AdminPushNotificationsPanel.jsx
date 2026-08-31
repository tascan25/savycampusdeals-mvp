import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  Edit3,
  Loader2,
  MousePointerClick,
  Plus,
  Send,
  ShieldAlert,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import api, { formatApiError } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const inputClass = "mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-400";

const emptyCampaign = () => ({
  title: "",
  message: "",
  audience: "students",
  channel: "deals",
  priority: "normal",
  cta_url: "",
  image_url: "",
  scheduled_at: "",
});

const toLocalDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const dateText = (value) => value
  ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  : "Immediately after confirmation";

const statusStyle = {
  draft: "border-zinc-300/15 bg-white/[0.05] text-zinc-300",
  scheduled: "border-sky-300/20 bg-sky-400/10 text-sky-200",
  preparing: "border-amber-300/20 bg-amber-400/10 text-amber-200",
  sending: "border-violet-300/20 bg-violet-400/10 text-violet-200",
  completed: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
  cancelled: "border-rose-300/20 bg-rose-400/10 text-rose-200",
};

function AndroidPreview({ campaign }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#17171b] p-4 shadow-2xl">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        <span className="grid h-5 w-5 place-items-center rounded-md bg-violet-500 text-white">S</span>
        Savvy Campus <span className="ml-auto normal-case tracking-normal">now</span>
      </div>
      <p className="mt-3 text-sm font-extrabold text-white">{campaign.title || "Notification title"}</p>
      <p className="mt-1 text-xs leading-5 text-zinc-300">{campaign.message || "Your notification message will appear here."}</p>
      {campaign.image_url ? <img src={campaign.image_url} alt="Notification artwork preview" className="mt-3 max-h-36 w-full rounded-xl object-cover" /> : null}
    </div>
  );
}

function CampaignEditor({ campaign, onClose }) {
  const client = useQueryClient();
  const [form, setForm] = useState(() => campaign ? {
    title: campaign.title,
    message: campaign.message,
    audience: campaign.audience,
    channel: campaign.channel,
    priority: campaign.priority,
    cta_url: campaign.cta_url || "",
    image_url: campaign.image_url || "",
    scheduled_at: toLocalDateTime(campaign.scheduled_at),
  } : emptyCampaign());
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      };
      return campaign
        ? (await api.put(`/admin/push-campaigns/${campaign.id}`, payload)).data
        : (await api.post("/admin/push-campaigns", payload)).data;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["admin-push-campaigns"] });
      toast.success("Notification draft saved. Review the audience before sending.");
      onClose();
    },
    onError: (error) => toast.error(formatApiError(error.response?.data?.detail)),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto border-white/10 bg-[#101014] text-white sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-extrabold">{campaign ? "Edit push draft" : "Compose push notification"}</DialogTitle>
          <DialogDescription className="text-zinc-400">Saving never sends. You will review the exact device count in a separate confirmation step.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2 text-xs font-semibold text-zinc-300">Title
              <input value={form.title} onChange={(event) => set("title", event.target.value)} maxLength={100} placeholder="A new campus deal just dropped" className={inputClass} />
            </label>
            <label className="sm:col-span-2 text-xs font-semibold text-zinc-300">Message
              <textarea value={form.message} onChange={(event) => set("message", event.target.value)} maxLength={240} rows={4} placeholder="Keep it clear, useful and honest." className={`${inputClass} resize-none`} />
              <span className="mt-1 block text-right text-[10px] text-zinc-600">{form.message.length}/240</span>
            </label>
            <label className="text-xs font-semibold text-zinc-300">Audience
              <select value={form.audience} onChange={(event) => set("audience", event.target.value)} className={inputClass}>
                <option value="students">Students</option><option value="partners">Outlet partners</option><option value="everyone">Everyone</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-zinc-300">Android channel
              <select value={form.channel} onChange={(event) => set("channel", event.target.value)} className={inputClass}>
                <option value="deals">Deals and announcements</option><option value="reminders">Reminders</option><option value="account">Important account updates</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-zinc-300">Priority
              <select value={form.priority} onChange={(event) => set("priority", event.target.value)} className={inputClass}>
                <option value="normal">Normal</option><option value="high">High</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-zinc-300">Schedule <span className="text-zinc-600">(optional)</span>
              <input type="datetime-local" value={form.scheduled_at} onChange={(event) => set("scheduled_at", event.target.value)} className={inputClass} />
            </label>
            <label className="sm:col-span-2 text-xs font-semibold text-zinc-300">Tap destination <span className="text-zinc-600">(optional site path or HTTPS URL)</span>
              <input value={form.cta_url} onChange={(event) => set("cta_url", event.target.value)} placeholder="/offers" className={inputClass} />
            </label>
            <label className="sm:col-span-2 text-xs font-semibold text-zinc-300">Artwork URL <span className="text-zinc-600">(optional HTTPS image)</span>
              <input value={form.image_url} onChange={(event) => set("image_url", event.target.value)} placeholder="https://..." className={inputClass} />
            </label>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Android preview</p>
            <AndroidPreview campaign={form} />
            <p className="mt-3 text-[11px] leading-5 text-zinc-600">Android may truncate text or render artwork differently depending on device settings. Sensitive account data must never be placed here.</p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button type="button" onClick={onClose} disabled={save.isPending} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold">Cancel</button>
          <button type="button" onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim() || !form.message.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-extrabold text-black disabled:opacity-50">
            {save.isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Save draft
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LaunchConfirmation({ campaign, onClose }) {
  const client = useQueryClient();
  const count = useQuery({
    queryKey: ["admin-push-audience", campaign.audience],
    queryFn: async () => (await api.get("/admin/push-campaigns/audience-count", { params: { audience: campaign.audience } })).data,
  });
  const queue = useMutation({
    mutationFn: async () => (await api.post(`/admin/push-campaigns/${campaign.id}/queue`, {
      recipient_count: count.data.devices,
      confirmation: "SEND",
    })).data,
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ["admin-push-campaigns"] });
      toast.success(result.status === "scheduled" ? "Notification scheduled." : "Notification queued for delivery.");
      onClose();
    },
    onError: (error) => {
      toast.error(formatApiError(error.response?.data?.detail));
      void count.refetch();
    },
  });
  const scheduled = campaign.scheduled_at && new Date(campaign.scheduled_at) > new Date();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl border-white/10 bg-[#101014] text-white sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-extrabold">Final delivery check</DialogTitle>
          <DialogDescription className="text-zinc-400">After confirmation, content and audience are frozen. This operation is intentionally not repeatable.</DialogDescription>
        </DialogHeader>
        <AndroidPreview campaign={campaign} />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/[0.04] p-4"><Users size={16} className="text-violet-300" /><p className="mt-3 font-display text-2xl font-black">{count.isLoading ? "…" : count.data?.devices ?? "—"}</p><p className="text-[10px] uppercase tracking-wider text-zinc-500">registered devices</p></div>
          <div className="rounded-2xl bg-white/[0.04] p-4"><CalendarClock size={16} className="text-sky-300" /><p className="mt-3 text-sm font-bold">{dateText(campaign.scheduled_at)}</p><p className="text-[10px] uppercase tracking-wider text-zinc-500">delivery time</p></div>
        </div>
        <DialogFooter className="gap-2">
          <button type="button" onClick={onClose} disabled={queue.isPending} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold">Go back</button>
          <button type="button" onClick={() => queue.mutate()} disabled={queue.isPending || count.isLoading || count.isError || !count.data?.devices} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-extrabold text-black disabled:opacity-50">
            {queue.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}{scheduled ? `Schedule for ${count.data?.devices ?? 0}` : `Send to ${count.data?.devices ?? 0} devices`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPushNotificationsPanel() {
  const client = useQueryClient();
  const [editor, setEditor] = useState(undefined);
  const [launching, setLaunching] = useState(null);
  const campaigns = useQuery({
    queryKey: ["admin-push-campaigns"],
    queryFn: async () => (await api.get("/admin/push-campaigns")).data,
  });
  const remove = useMutation({
    mutationFn: async (id) => api.delete(`/admin/push-campaigns/${id}`),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["admin-push-campaigns"] }); toast.success("Push draft deleted."); },
    onError: (error) => toast.error(formatApiError(error.response?.data?.detail)),
  });
  const cancel = useMutation({
    mutationFn: async (id) => api.post(`/admin/push-campaigns/${id}/cancel`),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["admin-push-campaigns"] }); toast.success("Scheduled notification cancelled."); },
    onError: (error) => toast.error(formatApiError(error.response?.data?.detail)),
  });
  const items = useMemo(() => campaigns.data?.items || [], [campaigns.data?.items]);
  const totals = useMemo(() => items.reduce((result, item) => ({
    accepted: result.accepted + (item.stats?.accepted || 0),
    opened: result.opened + (item.stats?.opened || 0),
    failed: result.failed + (item.stats?.failed || 0),
  }), { accepted: 0, opened: 0, failed: 0 }), [items]);
  const deliveryReady = campaigns.data?.push_enabled && campaigns.data?.provider_configured;

  return (
    <section className="mt-14 border-t border-white/10 pt-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs uppercase tracking-[0.25em] text-violet-300">Android delivery</p><h2 className="mt-2 font-display text-3xl font-extrabold">Push notifications</h2><p className="mt-2 max-w-2xl text-sm text-zinc-400">Compose, preview, schedule and audit Firebase notifications. Drafting is always safe; sending requires configured production credentials.</p></div>
        <button type="button" onClick={() => setEditor(null)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-black"><Plus size={16} /> Compose push</button>
      </div>

      {!campaigns.isLoading && !deliveryReady ? <div className="mt-5 flex gap-3 rounded-2xl border border-amber-300/15 bg-amber-400/[0.06] p-4 text-sm text-amber-100"><ShieldAlert className="mt-0.5 shrink-0" size={18} /><div><p className="font-bold">Delivery is locked in {campaigns.data?.environment || "this"} environment</p><p className="mt-1 text-xs leading-5 text-amber-100/65">Set PUSH_ENABLED and the server-side Firebase credentials before sending. Drafts and previews remain available.</p></div></div> : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[[CheckCircle2, "Accepted by FCM", totals.accepted, "text-emerald-300"], [MousePointerClick, "Opened", totals.opened, "text-violet-300"], [XCircle, "Failed", totals.failed, "text-rose-300"]].map(([Icon, label, value, iconColor]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><Icon size={18} className={iconColor} /><p className="mt-4 text-xs text-zinc-500">{label}</p><p className="mt-1 font-display text-3xl font-black">{value}</p></div>)}
      </div>

      <div className="mt-6 grid gap-4">
        {campaigns.isLoading ? <div className="grid h-40 place-items-center rounded-2xl border border-white/10"><Loader2 className="animate-spin text-violet-300" /></div> : items.length ? items.map((item) => {
          const editable = ["draft", "cancelled"].includes(item.status);
          return <article key={item.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-200"><BellRing size={18} /></div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider ${statusStyle[item.status] || statusStyle.draft}`}>{item.status}</span><span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400">{item.audience}</span><span className="text-[10px] text-zinc-500">{item.channel} · {item.priority}</span></div><h3 className="mt-3 font-display text-xl font-extrabold">{item.title}</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{item.message}</p><p className="mt-3 text-[11px] text-zinc-500"><CalendarClock size={12} className="mr-1 inline" />{dateText(item.scheduled_at)}</p></div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {editable ? <button type="button" onClick={() => setEditor(item)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold hover:bg-white/[0.06]"><Edit3 size={13} /> Edit</button> : null}
                {item.status === "draft" ? <button type="button" onClick={() => setLaunching(item)} disabled={!deliveryReady} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-extrabold text-black disabled:opacity-40"><Send size={13} /> Review send</button> : null}
                {item.status === "scheduled" ? <button type="button" onClick={() => cancel.mutate(item.id)} className="rounded-xl border border-amber-300/15 px-3 py-2 text-xs font-bold text-amber-200">Cancel</button> : null}
                {editable ? <button type="button" onClick={() => window.confirm(`Delete “${item.title}”?`) && remove.mutate(item.id)} className="grid h-9 w-9 place-items-center rounded-xl border border-rose-300/10 text-rose-300 hover:bg-rose-400/10" aria-label={`Delete ${item.title}`}><Trash2 size={14} /></button> : null}
              </div>
            </div>
            <div className="grid grid-cols-4 border-t border-white/[0.07] bg-black/20">{[["Devices", item.stats?.devices || 0], ["Accepted", item.stats?.accepted || 0], ["Failed", item.stats?.failed || 0], ["Opened", item.stats?.opened || 0]].map(([label, value]) => <div key={label} className="border-r border-white/[0.06] px-3 py-3 text-center last:border-0"><p className="font-display text-lg font-extrabold">{value}</p><p className="text-[9px] uppercase tracking-wider text-zinc-600">{label}</p></div>)}</div>
          </article>;
        }) : <div className="rounded-3xl border border-dashed border-white/15 p-10 text-center"><BellRing className="mx-auto text-zinc-600" /><h3 className="mt-4 font-display text-xl font-bold">No push campaigns yet</h3><p className="mt-2 text-sm text-zinc-500">Compose a draft without sending anything.</p></div>}
      </div>

      {editor !== undefined ? <CampaignEditor campaign={editor} onClose={() => setEditor(undefined)} /> : null}
      {launching ? <LaunchConfirmation campaign={launching} onClose={() => setLaunching(null)} /> : null}
    </section>
  );
}
