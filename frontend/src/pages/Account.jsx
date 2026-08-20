import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, LockKeyhole, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import StudentAvatar, { STUDENT_AVATARS } from "@/components/StudentAvatar";
import { useAuth } from "@/context/AuthContext";
import api, { formatApiError } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Account() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState("");

  const closeDialog = (nextOpen) => {
    if (deleting) return;
    setOpen(nextOpen);
    if (!nextOpen) {
      setPassword("");
      setConfirmation("");
      setError("");
    }
  };

  const deleteAccount = async (event) => {
    event.preventDefault();
    setDeleting(true);
    setError("");
    try {
      await api.delete("/account", { data: { password, confirmation } });
      localStorage.removeItem("scd_token");
      setUser(false);
      navigate("/", { replace: true });
      toast.success("Your account and associated data have been permanently deleted.", {
        duration: 6000,
      });
    } catch (requestError) {
      setError(formatApiError(requestError.response?.data?.detail));
      setDeleting(false);
    }
  };

  const canDelete = password.length > 0 && confirmation === "DELETE" && !deleting;

  const chooseAvatar = async (avatarKey) => {
    if (savingAvatar || avatarKey === (user?.avatar_key || "")) return;
    setSavingAvatar(avatarKey || "initials");
    try {
      const { data } = await api.patch("/profile", { avatar_key: avatarKey });
      setUser(data);
      toast.success(avatarKey ? "Avatar updated." : "Using your initial again.");
    } catch (requestError) {
      toast.error(formatApiError(requestError.response?.data?.detail));
    } finally {
      setSavingAvatar("");
    }
  };

  return (
    <div className="grain min-h-screen overflow-hidden bg-[#050505] text-white">
      <Navbar />
      <div className="aurora right-[-140px] top-[-100px] h-[420px] w-[420px] bg-indigo-600/15" />
      <main className="relative mx-auto max-w-4xl px-5 pb-20 pt-32 sm:px-6 sm:pt-36">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-300">Account</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Your account, your control.</h1>
          <p className="mt-4 max-w-2xl text-zinc-400">Review your membership details and manage what happens to your data.</p>
        </header>

        <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.035] p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <StudentAvatar avatarKey={user?.avatar_key} name={user?.name} size={48} />
            <div>
              <h2 className="font-display text-xl font-bold">Profile</h2>
              <p className="text-sm text-zinc-500">Your current Savvy membership details</p>
            </div>
          </div>
          <dl className="mt-7 grid gap-4 sm:grid-cols-2">
            {[
              ["Name", user?.name || "—"],
              ["Email", user?.email || "—"],
              ["College", user?.college || "Not added"],
              ["Verification", user?.verification_status?.replaceAll("_", " ") || "Not submitted"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                <dt className="text-xs uppercase tracking-wider text-zinc-600">{label}</dt>
                <dd className="mt-1 break-words text-sm font-semibold capitalize text-zinc-200">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 border-t border-white/[0.07] pt-7">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-300"><UserRound size={17} /></div>
              <div>
                <h3 className="font-display text-lg font-bold">Choose your avatar</h3>
                <p className="mt-1 text-sm text-zinc-500">Pick a Savvy avatar for your profile. You can change it anytime.</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-9" data-testid="avatar-options">
              <button
                type="button"
                onClick={() => chooseAvatar("")}
                aria-label="Use my initial"
                aria-pressed={!user?.avatar_key}
                disabled={Boolean(savingAvatar)}
                className={`group rounded-2xl border p-2.5 transition ${!user?.avatar_key ? "border-indigo-400/70 bg-indigo-500/10 ring-2 ring-indigo-400/15" : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"} disabled:opacity-60`}
              >
                <StudentAvatar name={user?.name} size={44} className="mx-auto" />
                <span className="mt-2 block truncate text-[10px] text-zinc-500">Initial</span>
              </button>
              {STUDENT_AVATARS.map((avatar) => {
                const selected = user?.avatar_key === avatar.key;
                return (
                  <button
                    type="button"
                    key={avatar.key}
                    onClick={() => chooseAvatar(avatar.key)}
                    aria-label={`Choose ${avatar.label}`}
                    aria-pressed={selected}
                    disabled={Boolean(savingAvatar)}
                    data-testid={`avatar-option-${avatar.key}`}
                    className={`group rounded-2xl border p-2.5 transition ${selected ? "border-indigo-400/70 bg-indigo-500/10 ring-2 ring-indigo-400/15" : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"} disabled:opacity-60`}
                  >
                    <StudentAvatar avatarKey={avatar.key} name={user?.name} size={44} className="mx-auto transition-transform group-hover:scale-105" />
                    <span className="mt-2 block truncate text-[10px] text-zinc-500">{avatar.label.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
            {savingAvatar && <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500"><Loader2 size={13} className="animate-spin" /> Saving your avatar…</p>}
          </div>
        </section>

        <section className="mt-10 border-t border-white/[0.07] pt-6" data-testid="account-danger-zone">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600">Account actions</p>
          <div className="mt-3 flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.018] p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
            <div>
              <h2 className="text-sm font-semibold text-zinc-300">Delete account</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-600">Permanently remove your account and associated data.</p>
            </div>
            <button type="button" onClick={() => setOpen(true)} data-testid="delete-account-open" className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-zinc-500 transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-200 sm:self-auto">
              <Trash2 size={14} /> Delete account
            </button>
          </div>
        </section>
      </main>
      <SiteFooter />

      <Dialog open={open} onOpenChange={closeDialog}>
        <DialogContent className="border-red-500/25 bg-[#111116] text-white sm:rounded-3xl">
          <DialogHeader>
            <div className="mb-2 grid h-11 w-11 place-items-center rounded-2xl bg-red-500/15 text-red-300"><LockKeyhole size={20} /></div>
            <DialogTitle className="font-display text-2xl">Permanently delete your account?</DialogTitle>
            <DialogDescription className="leading-6 text-zinc-400">There is no recovery period. Enter your password and type <strong className="text-white">DELETE</strong> to confirm.</DialogDescription>
          </DialogHeader>
          <form onSubmit={deleteAccount} className="mt-2 space-y-4">
            <label className="block text-sm font-semibold text-zinc-300">
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" disabled={deleting} data-testid="delete-account-password" className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-red-400/50" />
            </label>
            <label className="block text-sm font-semibold text-zinc-300">
              Type DELETE
              <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" disabled={deleting} data-testid="delete-account-confirmation" className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-white outline-none transition focus:border-red-400/50" />
            </label>
            {error && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
            <DialogFooter className="gap-2 pt-2 sm:space-x-0">
              <button type="button" onClick={() => closeDialog(false)} disabled={deleting} className="rounded-full border border-white/10 px-5 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-white/5 disabled:opacity-50">Keep my account</button>
              <button type="submit" disabled={!canDelete} data-testid="delete-account-submit" className="inline-flex items-center justify-center gap-2 rounded-full bg-red-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40">
                {deleting ? <><Loader2 size={16} className="animate-spin" /> Deleting…</> : <><Trash2 size={16} /> Delete permanently</>}
              </button>
            </DialogFooter>
          </form>
          <div className="flex items-center gap-2 text-xs text-zinc-600"><ShieldCheck size={14} /> Your database records remain in place if secure image removal fails.</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
