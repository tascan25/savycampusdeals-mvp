import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Power, Store } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const initialForm = { name: "", email: "", password: "", outlet_id: "" };

export default function AdminPartnersPage() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const partners = useQuery({
    queryKey: ["admin-partners"],
    queryFn: async () => (await api.get("/admin/partners")).data,
  });
  const available = useMemo(
    () => (partners.data?.items || []).filter((item) => !item.partner),
    [partners.data]
  );

  const createPartner = useMutation({
    mutationFn: async () => (await api.post("/admin/partners", form)).data,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["admin-partners"] });
      await client.invalidateQueries({ queryKey: ["admin-dashboard"] });
      setForm(initialForm);
      setOpen(false);
      toast.success("Outlet partner account created.");
    },
    onError: (error) => toast.error(formatApiError(error.response?.data?.detail)),
  });

  const togglePartner = useMutation({
    mutationFn: async ({ id, active }) => (
      await api.patch(`/admin/partners/${id}/status`, { active })
    ).data,
    onSuccess: async (_, variables) => {
      await client.invalidateQueries({ queryKey: ["admin-partners"] });
      await client.invalidateQueries({ queryKey: ["admin-dashboard"] });
      toast.success(variables.active ? "Partner account enabled." : "Partner account disabled.");
    },
    onError: (error) => toast.error(formatApiError(error.response?.data?.detail)),
  });

  const submit = (event) => {
    event.preventDefault();
    createPartner.mutate();
  };

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">Partner access</p>
          <h1 className="font-display mt-2 text-3xl font-extrabold">Outlet partners</h1>
          <p className="mt-2 text-sm text-zinc-400">One secure scanner account per outlet. No staff name entry is needed during redemption.</p>
        </div>
        <button
          data-testid="admin-create-partner-btn"
          onClick={() => setOpen(true)}
          disabled={!available.length}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={16} /> Create partner account
        </button>
      </div>

      {partners.isError && <p className="mt-6 text-sm text-rose-300">Could not load outlet partner accounts.</p>}
      <div className="mt-7 grid gap-4 lg:grid-cols-2" data-testid="admin-partners-list">
        {partners.isLoading ? (
          <div className="col-span-full grid h-40 place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>
        ) : partners.data?.items?.map(({ outlet, partner }) => (
          <article key={outlet.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300"><Store size={18} /></div>
                <div className="min-w-0">
                  <h2 className="font-display truncate text-lg font-bold">{outlet.name}</h2>
                  <p className="text-xs text-zinc-500">{outlet.city || "City unavailable"}</p>
                </div>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-xs ${partner?.active ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300" : partner ? "border-zinc-400/20 bg-zinc-500/10 text-zinc-300" : "border-amber-400/20 bg-amber-500/10 text-amber-200"}`}>
                {partner?.active ? "Active" : partner ? "Disabled" : "Not configured"}
              </span>
            </div>
            {partner ? (
              <div className="mt-5 flex flex-col gap-4 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{partner.name}</p>
                  <p className="truncate text-xs text-zinc-500">{partner.email}</p>
                </div>
                <button
                  data-testid={`admin-toggle-partner-${partner.id}`}
                  onClick={() => togglePartner.mutate({ id: partner.id, active: !partner.active })}
                  disabled={togglePartner.isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/5 disabled:opacity-50"
                >
                  <Power size={14} /> {partner.active ? "Disable" : "Enable"}
                </button>
              </div>
            ) : (
              <p className="mt-5 border-t border-white/[0.07] pt-4 text-sm text-zinc-500">Create an account to enable authenticated scanning for this outlet.</p>
            )}
          </article>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#111114] text-white">
          <DialogHeader>
            <DialogTitle>Create outlet partner</DialogTitle>
            <DialogDescription className="text-zinc-400">The owner signs in once with these credentials. Every approval is then attributed automatically.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-widest text-zinc-500" htmlFor="partner-outlet">Outlet</label>
              <select id="partner-outlet" data-testid="partner-outlet-select" required value={form.outlet_id} onChange={(e) => setForm({ ...form, outlet_id: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-[#17171b] px-3 py-3 text-sm outline-none focus:border-indigo-400">
                <option value="">Select an outlet</option>
                {available.map((item) => <option key={item.outlet.id} value={item.outlet.id}>{item.outlet.name} · {item.outlet.city}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-zinc-500" htmlFor="partner-name">Owner or account name</label>
              <input id="partner-name" data-testid="partner-name-input" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-zinc-500" htmlFor="partner-email">Login email</label>
              <input id="partner-email" data-testid="partner-email-input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-zinc-500" htmlFor="partner-password">Temporary password</label>
              <input id="partner-password" data-testid="partner-password-input" type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="8+ chars, uppercase, number, special" className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm outline-none focus:border-indigo-400" />
            </div>
            <DialogFooter>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-white/10 px-4 py-2 text-sm">Cancel</button>
              <button data-testid="partner-create-submit" disabled={createPartner.isPending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-black disabled:opacity-60">
                {createPartner.isPending && <Loader2 size={15} className="animate-spin" />} Create account
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
