import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, CalendarClock, CheckCircle2, Eye, Loader2, Mail, Monitor,
  Palette, PauseCircle, Pencil, Plus, Send, Smartphone, Sparkles, Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const themes = [
  { label: "Ocean", background_color: "#050706", card_color: "#083f46", accent_color: "#2dd4bf", text_color: "#ffffff", muted_color: "#c7dedb", button_text_color: "#042f2e" },
  { label: "Midnight", background_color: "#05050a", card_color: "#17132b", accent_color: "#a78bfa", text_color: "#ffffff", muted_color: "#d5cfea", button_text_color: "#17132b" },
  { label: "Electric", background_color: "#05070d", card_color: "#10275e", accent_color: "#67e8f9", text_color: "#ffffff", muted_color: "#d7e5ff", button_text_color: "#082f49" },
  { label: "Berry", background_color: "#090506", card_color: "#571f3a", accent_color: "#fda4af", text_color: "#fff7f8", muted_color: "#f3d2dc", button_text_color: "#4c0519" },
];

const emptyCampaign = () => ({
  name: "Savvy Card revamp",
  subject: "Your Savvy Card just got a serious glow-up ✨",
  preview_text: "A new premium look. The same verified student identity.",
  eyebrow: "SAVVY CAMPUS UPDATE",
  heading: "Meet your redesigned Savvy Card",
  message: "Your Savvy Card has a fresh new identity. We’ve redesigned it with a premium peacock-teal finish, sharper details and a cleaner verification experience—built to look just as good as the student benefits it unlocks.\n\nYour account, verification and benefits remain unchanged. Open your card and check out its new look.",
  cta_label: "View my new card",
  cta_url: "/card",
  image_url: "",
  audience: "approved_students",
  scheduled_at: "",
  corner_style: "rounded",
  background_color: themes[0].background_color,
  card_color: themes[0].card_color,
  accent_color: themes[0].accent_color,
  text_color: themes[0].text_color,
  muted_color: themes[0].muted_color,
  button_text_color: themes[0].button_text_color,
});

const inputClass = "mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-teal-400";

const localDateTime = (value) => {
  if (!value) return "";
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const campaignForm = (campaign) => campaign ? {
  ...campaign,
  scheduled_at: localDateTime(campaign.scheduled_at),
} : emptyCampaign();

const statusClass = {
  draft: "border-zinc-300/15 bg-white/[0.05] text-zinc-300",
  queued: "border-sky-300/20 bg-sky-400/10 text-sky-200",
  scheduled: "border-violet-300/20 bg-violet-400/10 text-violet-200",
  sending: "border-amber-300/20 bg-amber-400/10 text-amber-200",
  completed: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
  paused: "border-orange-300/20 bg-orange-400/10 text-orange-200",
  cancelled: "border-rose-300/20 bg-rose-400/10 text-rose-200",
};

function EmailPreview({ form, mode }) {
  const radius = { soft: 12, rounded: 24, pill: 34 }[form.corner_style] || 24;
  return (
    <div className="overflow-auto rounded-3xl border border-white/10 bg-[#09090b] p-3 sm:p-5">
      <div className="mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500"><Eye size={13} /> Live email preview</div>
      <div className="mx-auto transition-[max-width] duration-300" style={{ maxWidth: mode === "mobile" ? 360 : 660 }}>
        <div className="p-3 sm:p-6" style={{ background: form.background_color }}>
          <div className="overflow-hidden border" style={{ background: form.card_color, color: form.text_color, borderColor: `${form.accent_color}55`, borderRadius: radius, boxShadow: "0 24px 60px rgba(0,0,0,.28)" }}>
            <div className="p-6 sm:p-8">
              <div className="text-[10px] font-extrabold tracking-[0.22em]" style={{ color: form.accent_color }}>{form.eyebrow || "SAVVY CAMPUS"}</div>
              <div className="my-4 h-0.5 w-11 rounded-full" style={{ background: form.accent_color }} />
              {form.image_url && <img src={form.image_url} alt="Campaign artwork preview" className="mb-6 max-h-64 w-full object-cover" style={{ borderRadius: radius }} />}
              <p className="mb-3 text-xs" style={{ color: form.muted_color }}>Hey Aarav,</p>
              <h2 className="font-display text-[clamp(1.9rem,5vw,2.5rem)] font-black leading-[1.05] tracking-tight">{form.heading || "Your headline"}</h2>
              <p className="mt-5 whitespace-pre-line text-sm leading-7" style={{ color: form.muted_color }}>{form.message || "Your campaign message will appear here."}</p>
              {form.cta_label && <span className="mt-7 inline-flex px-5 py-3 text-sm font-extrabold" style={{ background: form.accent_color, color: form.button_text_color, borderRadius: radius }}>{form.cta_label}</span>}
            </div>
            <div className="border-t px-6 py-5 text-[10px] leading-5 sm:px-8" style={{ borderColor: `${form.accent_color}33`, color: form.muted_color }}>
              Sent by SavvyCampusDeals · Student perks, made better.<br /><u>Unsubscribe</u>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorControl({ label, value, onChange }) {
  return <label className="text-[11px] font-semibold text-zinc-400"><span>{label}</span><span className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] p-2"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent" /><input value={value} onChange={(event) => onChange(event.target.value)} maxLength={7} className="min-w-0 flex-1 bg-transparent font-mono text-xs text-zinc-200 outline-none" /></span></label>;
}

function LaunchDialog({ campaign, count, onClose, onLaunched }) {
  const [confirmation, setConfirmation] = useState("");
  const launch = useMutation({
    mutationFn: async () => (await api.post(`/admin/email-campaigns/${campaign.id}/launch`, { recipient_count: count, confirmation })).data,
    onSuccess: (data) => { toast.success(data.status === "scheduled" ? "Campaign scheduled." : "Campaign queued for delivery."); onLaunched(); },
    onError: (error) => toast.error(formatApiError(error.response?.data?.detail)),
  });
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="border-white/10 bg-[#101014] text-white"><DialogHeader><DialogTitle className="font-display text-2xl font-black">Confirm campaign launch</DialogTitle><DialogDescription className="text-zinc-400">This will prepare and send the campaign to the current eligible audience.</DialogDescription></DialogHeader><div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-4"><p className="text-xs text-amber-100/60">Eligible recipients</p><p className="mt-1 font-display text-4xl font-black text-amber-100">{count.toLocaleString("en-IN")}</p><p className="mt-2 text-xs leading-5 text-amber-100/60">The server will recalculate this number before launch. If it changed, sending will stop for another review.</p></div><label className="text-xs font-semibold text-zinc-300">Type <b className="text-white">SEND</b> to confirm<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={inputClass} /></label><DialogFooter><button onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold">Not yet</button><button onClick={() => launch.mutate()} disabled={confirmation.trim().toUpperCase() !== "SEND" || launch.isPending} className="rounded-xl bg-amber-300 px-5 py-2.5 text-sm font-black text-black disabled:opacity-40">{launch.isPending && <Loader2 size={14} className="mr-2 inline animate-spin" />}Launch campaign</button></DialogFooter></DialogContent></Dialog>;
}

function CampaignStudio({ initial, onClose }) {
  const client = useQueryClient();
  const [campaign, setCampaign] = useState(initial || null);
  const [form, setForm] = useState(() => campaignForm(initial));
  const [previewMode, setPreviewMode] = useState("desktop");
  const [testEmail, setTestEmail] = useState("");
  const [launchOpen, setLaunchOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const editable = !campaign || ["draft", "cancelled"].includes(campaign.status);
  const set = (key, value) => { setDirty(true); setForm((current) => ({ ...current, [key]: value })); };
  const applyTheme = (theme) => {
    const { label: _label, ...colors } = theme;
    setDirty(true);
    setForm((current) => ({ ...current, ...colors }));
  };
  const audience = useQuery({ queryKey: ["email-audience-count", form.audience], queryFn: async () => (await api.get("/admin/email-campaigns/audience-count", { params: { audience: form.audience } })).data });
  const payload = useMemo(() => ({ ...form, scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null }), [form]);
  const save = useMutation({
    mutationFn: async () => campaign ? (await api.put(`/admin/email-campaigns/${campaign.id}`, payload)).data : (await api.post("/admin/email-campaigns", payload)).data,
    onSuccess: async (data) => { setCampaign(data); setForm(campaignForm(data)); setDirty(false); await client.invalidateQueries({ queryKey: ["admin-email-campaigns"] }); toast.success("Campaign draft saved."); },
    onError: (error) => toast.error(formatApiError(error.response?.data?.detail)),
  });
  const test = useMutation({
    mutationFn: async () => (await api.post(`/admin/email-campaigns/${campaign.id}/test`, { email: testEmail })).data,
    onSuccess: () => toast.success(`Test email sent to ${testEmail}.`),
    onError: (error) => toast.error(formatApiError(error.response?.data?.detail)),
  });

  return <div>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><button onClick={onClose} className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-white"><ArrowLeft size={14} /> Campaigns</button><p className="text-xs uppercase tracking-[0.25em] text-teal-300">Email studio</p><h1 className="mt-2 font-display text-3xl font-black">{campaign ? campaign.name : "Create a campaign"}</h1><p className="mt-2 text-sm text-zinc-400">Shape every visual detail, preview it, then send a test before launch.</p></div><div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] p-1"><button onClick={() => setPreviewMode("desktop")} className={`rounded-lg p-2 ${previewMode === "desktop" ? "bg-white text-black" : "text-zinc-500"}`} aria-label="Desktop preview"><Monitor size={16} /></button><button onClick={() => setPreviewMode("mobile")} className={`rounded-lg p-2 ${previewMode === "mobile" ? "bg-white text-black" : "text-zinc-500"}`} aria-label="Mobile preview"><Smartphone size={16} /></button></div></div>

    <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(480px,1.1fr)]">
      <div className="space-y-5">
        <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5"><div className="flex items-center gap-2"><Mail size={17} className="text-teal-300" /><h2 className="font-display text-lg font-bold">Campaign content</h2></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-zinc-300">Internal campaign name<input disabled={!editable} value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={100} className={inputClass} /></label><label className="text-xs font-semibold text-zinc-300">Email subject<input disabled={!editable} value={form.subject} onChange={(e) => set("subject", e.target.value)} maxLength={150} className={inputClass} /></label><label className="sm:col-span-2 text-xs font-semibold text-zinc-300">Inbox preview text<input disabled={!editable} value={form.preview_text} onChange={(e) => set("preview_text", e.target.value)} maxLength={180} className={inputClass} /></label><label className="text-xs font-semibold text-zinc-300">Eyebrow<input disabled={!editable} value={form.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} maxLength={60} className={inputClass} /></label><label className="text-xs font-semibold text-zinc-300">Headline<input disabled={!editable} value={form.heading} onChange={(e) => set("heading", e.target.value)} maxLength={120} className={inputClass} /></label><label className="sm:col-span-2 text-xs font-semibold text-zinc-300">Message<textarea disabled={!editable} value={form.message} onChange={(e) => set("message", e.target.value)} maxLength={2000} rows={7} className={`${inputClass} resize-y`} /></label><label className="text-xs font-semibold text-zinc-300">Button label<input disabled={!editable} value={form.cta_label} onChange={(e) => set("cta_label", e.target.value)} maxLength={40} className={inputClass} /></label><label className="text-xs font-semibold text-zinc-300">Button destination<input disabled={!editable} value={form.cta_url} onChange={(e) => set("cta_url", e.target.value)} placeholder="/card" className={inputClass} /></label><label className="sm:col-span-2 text-xs font-semibold text-zinc-300">Artwork URL <span className="text-zinc-600">(HTTPS, optional)</span><input disabled={!editable} value={form.image_url} onChange={(e) => set("image_url", e.target.value)} placeholder="https://..." className={inputClass} /></label></div></section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5"><div className="flex items-center gap-2"><Palette size={17} className="text-violet-300" /><h2 className="font-display text-lg font-bold">Visual direction</h2></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{themes.map((theme) => <button disabled={!editable} key={theme.label} onClick={() => applyTheme(theme)} className="rounded-xl border border-white/10 p-2 text-left hover:border-white/25 disabled:opacity-50"><div className="h-10 rounded-lg" style={{ background: `linear-gradient(135deg, ${theme.card_color}, ${theme.accent_color})` }} /><p className="mt-2 text-xs font-bold">{theme.label}</p></button>)}</div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3"><ColorControl label="Page" value={form.background_color} onChange={(value) => set("background_color", value)} /><ColorControl label="Email card" value={form.card_color} onChange={(value) => set("card_color", value)} /><ColorControl label="Accent & button" value={form.accent_color} onChange={(value) => set("accent_color", value)} /><ColorControl label="Main text" value={form.text_color} onChange={(value) => set("text_color", value)} /><ColorControl label="Muted text" value={form.muted_color} onChange={(value) => set("muted_color", value)} /><ColorControl label="Button text" value={form.button_text_color} onChange={(value) => set("button_text_color", value)} /></div><label className="mt-4 block text-xs font-semibold text-zinc-300">Corner character<select disabled={!editable} value={form.corner_style} onChange={(e) => set("corner_style", e.target.value)} className={inputClass}><option value="soft">Soft · 12px</option><option value="rounded">Premium rounded · 24px</option><option value="pill">Playful · 34px</option></select></label></section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5"><div className="flex items-center gap-2"><Users size={17} className="text-sky-300" /><h2 className="font-display text-lg font-bold">Audience & timing</h2></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-zinc-300">Audience<select disabled={!editable} value={form.audience} onChange={(e) => set("audience", e.target.value)} className={inputClass}><option value="approved_students">Approved students</option><option value="email_verified_students">All email-verified students</option><option value="all_students">All students</option></select></label><label className="text-xs font-semibold text-zinc-300">Schedule <span className="text-zinc-600">(optional)</span><input disabled={!editable} type="datetime-local" value={form.scheduled_at} onChange={(e) => set("scheduled_at", e.target.value)} className={inputClass} /></label></div><div className="mt-4 rounded-2xl border border-sky-300/10 bg-sky-300/[0.045] p-4"><p className="text-xs text-sky-100/55">Current eligible audience</p><p className="mt-1 font-display text-3xl font-black text-sky-100">{audience.isLoading ? "—" : (audience.data?.count || 0).toLocaleString("en-IN")}</p><p className="mt-1 text-[11px] text-sky-100/45">Opted-out students are always excluded.</p></div></section>

        <div className="flex flex-wrap gap-2">{editable && <button onClick={() => save.mutate()} disabled={save.isPending || (!dirty && Boolean(campaign))} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-black disabled:opacity-50">{save.isPending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}Save draft</button>}{campaign && <><div className="flex min-w-[260px] flex-1 gap-2"><input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="Test recipient email" className={`${inputClass} mt-0`} /><button onClick={() => test.mutate()} disabled={!testEmail || test.isPending || dirty} className="shrink-0 rounded-xl border border-white/10 px-4 text-sm font-bold disabled:opacity-40">Send test</button></div>{campaign.status === "draft" && <button onClick={() => setLaunchOpen(true)} disabled={dirty} className="inline-flex items-center gap-2 rounded-xl bg-teal-300 px-5 py-3 text-sm font-black text-teal-950 disabled:opacity-40"><Send size={15} />Review launch</button>}</>}{dirty && campaign && <p className="w-full text-[11px] text-amber-200/70">Save your latest changes before sending a test or launching.</p>}</div>
      </div>
      <div className="xl:sticky xl:top-8 xl:self-start"><EmailPreview form={form} mode={previewMode} /><div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-xs leading-5 text-zinc-500">The preview uses the same colours, spacing, artwork and content as the delivered template. Email clients may render fonts slightly differently.</div></div>
    </div>
    {launchOpen && <LaunchDialog campaign={campaign} count={audience.data?.count || 0} onClose={() => setLaunchOpen(false)} onLaunched={async () => { await client.invalidateQueries({ queryKey: ["admin-email-campaigns"] }); setLaunchOpen(false); onClose(); }} />}
  </div>;
}

export default function AdminEmailCampaignsPage() {
  const client = useQueryClient();
  const [editor, setEditor] = useState(undefined);
  const campaigns = useQuery({ queryKey: ["admin-email-campaigns"], queryFn: async () => (await api.get("/admin/email-campaigns")).data, refetchInterval: 10000 });
  const action = useMutation({
    mutationFn: async ({ id, kind }) => kind === "delete" ? api.delete(`/admin/email-campaigns/${id}`) : api.post(`/admin/email-campaigns/${id}/${kind}`),
    onSuccess: async (_, variables) => { await client.invalidateQueries({ queryKey: ["admin-email-campaigns"] }); toast.success(variables.kind === "delete" ? "Campaign deleted." : variables.kind === "cancel" ? "Campaign cancelled." : "Campaign resumed."); },
    onError: (error) => toast.error(formatApiError(error.response?.data?.detail)),
  });
  if (editor !== undefined) return <CampaignStudio initial={editor} onClose={() => setEditor(undefined)} />;
  const items = campaigns.data?.items || [];
  return <div><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs uppercase tracking-[0.25em] text-teal-300">Communication</p><h1 className="mt-2 font-display text-3xl font-black">Email campaigns</h1><p className="mt-2 max-w-2xl text-sm text-zinc-400">Design, test, schedule and safely deliver polished student emails.</p></div><button onClick={() => setEditor(null)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-black"><Plus size={16} />New campaign</button></div><div className="mt-7 grid gap-4">{campaigns.isLoading ? <div className="grid h-48 place-items-center rounded-2xl border border-white/10"><Loader2 className="animate-spin text-teal-300" /></div> : items.length ? items.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"><div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: `${item.accent_color}22`, color: item.accent_color }}><Mail size={19} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider ${statusClass[item.status] || statusClass.draft}`}>{item.status}</span><span className="text-[10px] text-zinc-500">{item.audience.replaceAll("_", " ")}</span></div><h2 className="mt-2 font-display text-xl font-bold">{item.name}</h2><p className="mt-1 truncate text-sm text-zinc-500">{item.subject}</p></div><div className="grid grid-cols-4 gap-4 text-center"><div><p className="font-display text-lg font-black">{item.stats?.recipients || 0}</p><p className="text-[9px] uppercase text-zinc-600">Audience</p></div><div><p className="font-display text-lg font-black text-sky-200">{item.stats?.pending || 0}</p><p className="text-[9px] uppercase text-zinc-600">Pending</p></div><div><p className="font-display text-lg font-black text-emerald-300">{item.stats?.sent || 0}</p><p className="text-[9px] uppercase text-zinc-600">Sent</p></div><div><p className="font-display text-lg font-black text-rose-300">{item.stats?.failed || 0}</p><p className="text-[9px] uppercase text-zinc-600">Failed</p></div></div><div className="flex shrink-0 gap-2"><button onClick={() => setEditor(item)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold hover:bg-white/[0.06]">{["draft", "cancelled"].includes(item.status) ? <Pencil size={13} /> : <Eye size={13} />} {["draft", "cancelled"].includes(item.status) ? "Edit" : "View"}</button>{["queued", "scheduled", "sending"].includes(item.status) && <button onClick={() => action.mutate({ id: item.id, kind: "cancel" })} className="rounded-xl border border-amber-300/10 p-2 text-amber-200" title="Cancel remaining sends"><PauseCircle size={15} /></button>}{item.status === "paused" && <button onClick={() => action.mutate({ id: item.id, kind: "resume" })} className="rounded-xl border border-teal-300/10 p-2 text-teal-200" title="Resume"><Send size={15} /></button>}{["draft", "cancelled"].includes(item.status) && <button onClick={() => { if (window.confirm(`Delete “${item.name}”?`)) action.mutate({ id: item.id, kind: "delete" }); }} className="rounded-xl border border-rose-300/10 p-2 text-rose-300"><Trash2 size={15} /></button>}</div></div>{item.scheduled_at && <div className="flex items-center gap-2 border-t border-white/[0.06] px-5 py-3 text-[11px] text-zinc-500"><CalendarClock size={12} /> Scheduled for {new Date(item.scheduled_at).toLocaleString("en-IN")}</div>}</article>) : <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center"><CheckCircle2 className="mx-auto text-zinc-600" /><h2 className="mt-4 font-display text-xl font-bold">No campaigns yet</h2><p className="mt-2 text-sm text-zinc-500">Create the Savvy Card launch email and send yourself a test.</p></div>}{campaigns.isError && <p className="text-sm text-rose-300">Could not load email campaigns.</p>}</div></div>;
}
