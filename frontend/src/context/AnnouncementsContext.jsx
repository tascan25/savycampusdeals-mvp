import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Bell, Clock3, Megaphone, Sparkles } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const AnnouncementsContext = createContext({
  announcements: [],
  unreadCount: 0,
  openAnnouncements: () => {},
});

const categoryStyle = {
  new: "border-violet-300/20 bg-violet-400/10 text-violet-200",
  important: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  limited: "border-rose-300/20 bg-rose-400/10 text-rose-200",
};

const expiryText = (value) => {
  if (!value) return "";
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date);
};

function CategoryBadge({ category }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.18em] ${categoryStyle[category] || categoryStyle.new}`}>
      {category === "new" ? "New drop" : category}
    </span>
  );
}

export function AnnouncementProvider({ children }) {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const client = useQueryClient();
  const handled = useRef(new Set());
  const [spotlight, setSpotlight] = useState(null);
  const [centreOpen, setCentreOpen] = useState(false);
  const enabled = ready && Boolean(user) && ["student", "outlet_partner"].includes(user?.role);
  const announcements = useQuery({
    queryKey: ["announcements", user?.id],
    queryFn: async ({ signal }) => (await api.get("/announcements", { signal })).data,
    enabled,
    staleTime: 30_000,
  });

  useEffect(() => {
    const announcement = announcements.data?.modal;
    if (!announcement || handled.current.has(announcement.id)) return;
    handled.current.add(announcement.id);
    setSpotlight(announcement);
    api.post(`/announcements/${announcement.id}/seen`).then(() => {
      client.setQueryData(["announcements", user?.id], (current) => {
        if (!current) return current;
        const items = current.items.map((item) => item.id === announcement.id ? { ...item, seen: true } : item);
        return {
          ...current,
          items,
          modal: null,
          unread_count: items.filter((item) => !item.seen).length,
        };
      });
    }).catch(() => {});
  }, [announcements.data?.modal, client, user?.id]);

  const followCta = async (announcement) => {
    try { await api.post(`/announcements/${announcement.id}/click`); } catch {}
    setSpotlight(null);
    setCentreOpen(false);
    if (announcement.cta_url.startsWith("/")) navigate(announcement.cta_url);
    else window.location.assign(announcement.cta_url);
  };

  const items = announcements.data?.items || [];
  const unreadCount = announcements.data?.unread_count || 0;

  return (
    <AnnouncementsContext.Provider value={{ announcements: items, unreadCount, openAnnouncements: () => setCentreOpen(true) }}>
      {children}

      <Dialog open={Boolean(spotlight)} onOpenChange={(open) => !open && setSpotlight(null)}>
        <DialogContent className="max-h-[92vh] max-w-xl overflow-hidden border-violet-300/20 bg-[#0c0a13] p-0 text-white shadow-[0_35px_120px_-30px_rgba(139,92,246,0.8)] sm:rounded-[2rem]">
          {spotlight && (
            <div data-testid="announcement-spotlight">
              <div className="relative isolate overflow-hidden px-6 pb-7 pt-12 sm:px-9 sm:pb-9">
                <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_85%_5%,rgba(251,191,36,0.24),transparent_30%),radial-gradient(circle_at_8%_60%,rgba(139,92,246,0.35),transparent_42%),linear-gradient(145deg,#161023,#09080f)]" />
                <div className="absolute -right-10 -top-12 -z-10 h-44 w-44 rounded-full border border-white/10" />
                <div className="flex items-center justify-between gap-3">
                  <CategoryBadge category={spotlight.category} />
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-400"><Clock3 size={12} /> Until {expiryText(spotlight.expires_at)}</span>
                </div>
                {spotlight.image_url ? (
                  <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                    <img src={spotlight.image_url} alt="" className="max-h-52 w-full object-cover" />
                  </div>
                ) : (
                  <div className="mt-7 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25">
                    <Sparkles size={24} fill="currentColor" />
                  </div>
                )}
                <DialogHeader className="mt-6 text-left">
                  <DialogTitle className="font-display text-3xl font-black leading-tight tracking-tight sm:text-4xl">{spotlight.title}</DialogTitle>
                  <DialogDescription className="pt-2 text-sm leading-6 text-zinc-300 sm:text-base">{spotlight.message}</DialogDescription>
                </DialogHeader>
                {spotlight.cta_label && (
                  <button type="button" onClick={() => followCta(spotlight)} className="group mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-extrabold text-black transition hover:scale-[1.015] active:scale-[0.985]" data-testid="announcement-cta">
                    {spotlight.cta_label}<ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                  </button>
                )}
                <button type="button" onClick={() => { setSpotlight(null); setCentreOpen(true); }} className="mt-3 w-full py-2 text-xs font-semibold text-zinc-500 transition hover:text-zinc-300">View all announcements</button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={centreOpen} onOpenChange={setCentreOpen}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto border-white/10 bg-[#0d0d12] text-white sm:rounded-[2rem]">
          <DialogHeader className="text-left">
            <div className="mb-2 grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/15 text-violet-200"><Bell size={19} /></div>
            <DialogTitle className="font-display text-2xl font-black">What’s new</DialogTitle>
            <DialogDescription className="text-zinc-400">Fresh updates, launches, and important Savvy news.</DialogDescription>
          </DialogHeader>
          <div className="mt-3 grid gap-3" data-testid="announcement-centre">
            {items.length ? items.map((announcement) => (
              <article key={announcement.id} className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
                {!announcement.seen && <span className="absolute right-4 top-4 h-2 w-2 rounded-full bg-violet-300 shadow-[0_0_10px_rgba(196,181,253,0.8)]" />}
                <div className="flex flex-wrap items-center gap-2"><CategoryBadge category={announcement.category} /><span className="text-[10px] text-zinc-500">Until {expiryText(announcement.expires_at)}</span></div>
                <h3 className="mt-3 font-display text-lg font-extrabold">{announcement.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{announcement.message}</p>
                {announcement.cta_label && <button type="button" onClick={() => followCta(announcement)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-violet-200 hover:text-white">{announcement.cta_label}<ArrowRight size={14} /></button>}
              </article>
            )) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
                <Megaphone className="mx-auto text-zinc-600" size={24} />
                <p className="mt-3 font-semibold">You’re all caught up</p>
                <p className="mt-1 text-xs text-zinc-500">New Savvy drops will appear here.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AnnouncementsContext.Provider>
  );
}

export function useAnnouncements() {
  return useContext(AnnouncementsContext);
}
