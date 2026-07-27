import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  CalendarDays,
  CircleAlert,
  GraduationCap,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import api from "@/lib/api";

const expiryText = (value) => {
  if (!value) return "—";
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value)
    ? value
    : `${value}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

export default function PublicStudentPass() {
  const [params] = useSearchParams();
  const token = params.get("t") || "";
  const pass = useQuery({
    queryKey: ["public-student-pass", token],
    queryFn: async () => (
      await api.get("/public/student-pass", { params: { token } })
    ).data,
    enabled: Boolean(token),
    retry: false,
  });

  const student = pass.data;
  const verified = student?.verified === true;

  return (
    <main className="min-h-screen overflow-hidden bg-[#050505] px-5 py-10 text-white grain">
      <div className="aurora bg-emerald-500/20" style={{ width: 440, height: 440, top: -180, right: -150 }} />
      <div className="aurora bg-indigo-600/25" style={{ width: 420, height: 420, bottom: -180, left: -170 }} />

      <div className="relative z-10 mx-auto w-full max-w-lg">
        <Link to="/" className="inline-flex items-center gap-2">
          <img src="/brand_logo.jpeg" alt="" className="h-9 w-9 rounded-xl object-cover" />
          <span className="font-display text-lg font-bold tracking-tight">
            Savvy<span className="text-indigo-400">.</span>
          </span>
        </Link>

        <section className="mt-10 overflow-hidden rounded-3xl border border-white/10 bg-[#0d0d10]/90 shadow-2xl">
          {pass.isLoading ? (
            <div className="grid min-h-[460px] place-items-center">
              <div className="text-center text-zinc-400">
                <Loader2 className="mx-auto animate-spin text-indigo-300" size={30} />
                <p className="mt-3 text-sm">Checking student pass…</p>
              </div>
            </div>
          ) : !token || pass.isError ? (
            <div className="px-7 py-16 text-center" data-testid="public-pass-invalid">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-rose-400/25 bg-rose-500/10">
                <CircleAlert className="text-rose-300" size={31} />
              </div>
              <h1 className="mt-5 font-display text-3xl font-extrabold">Pass not recognized</h1>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                This QR code is invalid or the student pass is no longer available.
              </p>
            </div>
          ) : (
            <>
              <div className={`border-b px-7 py-8 text-center ${verified ? "border-emerald-400/20 bg-emerald-500/10" : "border-amber-400/20 bg-amber-500/10"}`}>
                <div className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl border ${verified ? "border-emerald-400/30 bg-emerald-500/15" : "border-amber-400/30 bg-amber-500/15"}`}>
                  {verified
                    ? <BadgeCheck className="text-emerald-300" size={34} />
                    : <CircleAlert className="text-amber-300" size={32} />}
                </div>
                <div data-testid="public-pass-status" className={`mt-4 text-xs font-bold uppercase tracking-[0.24em] ${verified ? "text-emerald-300" : "text-amber-300"}`}>
                  {verified ? "Verified student" : "Not currently verified"}
                </div>
                <h1 className="mt-2 break-words font-display text-3xl font-extrabold" data-testid="public-pass-name">
                  {student.name || "Student"}
                </h1>
                <p className="mt-2 break-words text-sm text-zinc-300">{student.college || "College not provided"}</p>
              </div>

              <div className="space-y-5 px-7 py-7">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 shrink-0 text-indigo-300" size={19} />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Savy student number</p>
                    <p className="mt-1 break-all font-mono text-sm font-semibold" data-testid="public-pass-number">{student.student_number}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <GraduationCap className="mt-0.5 shrink-0 text-indigo-300" size={19} />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Academic details</p>
                    <p className="mt-1 text-sm text-zinc-200">
                      {[student.course, student.year].filter(Boolean).join(" • ") || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CalendarDays className="mt-0.5 shrink-0 text-indigo-300" size={19} />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Verification valid until</p>
                    <p className="mt-1 text-sm font-semibold text-zinc-200" data-testid="public-pass-expiry">{expiryText(student.expiry)}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        <p className="mt-5 text-center text-xs leading-relaxed text-zinc-500">
          Live verification by SAVVYCAMPUSDEALS. No email address or phone number is shared.
        </p>
      </div>
    </main>
  );
}
