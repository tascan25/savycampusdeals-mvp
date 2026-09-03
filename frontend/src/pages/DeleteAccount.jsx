import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Mail,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";

const deletedData = [
  "Profile and account details, including your name, email, phone number and academic details",
  "Student-verification records and uploaded verification images",
  "Saved offers, coupons, claims, redemptions and Savvy Points history",
  "Referral records, announcement activity and notification-delivery records",
  "Active login sessions, refresh tokens, push tokens and app-installation identifiers",
];

export default function DeleteAccount() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Delete your account | Savvy Campus";
    return () => {
      document.title = "SavvyCampusDeals - Smart deals for smart students";
    };
  }, []);

  return (
    <div className="grain min-h-screen overflow-hidden bg-[#050505] text-white">
      <Navbar />
      <div className="aurora right-[-180px] top-[-140px] h-[440px] w-[440px] bg-red-600/10" />
      <main className="relative mx-auto max-w-5xl px-5 pb-16 pt-32 sm:px-6 sm:pt-36">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
        >
          <ArrowLeft size={15} /> Back to Savvy
        </Link>

        <header className="mt-8 max-w-3xl">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-red-400/20 bg-red-500/10 text-red-300">
            <Trash2 size={22} />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.25em] text-red-300">
            Savvy Campus account deletion
          </p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
            Delete your account and data.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">
            This page explains how Savvy Campus users can permanently delete their account and
            the personal data associated with it.
          </p>
        </header>

        <section className="mt-12 grid gap-5 lg:grid-cols-2">
          <article className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 sm:p-8">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-300">
              <ShieldCheck size={21} />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">
              Fastest option
            </p>
            <h2 className="mt-2 font-display text-2xl font-extrabold">Delete inside the app</h2>
            <ol className="mt-5 space-y-3 text-sm leading-6 text-zinc-400">
              <li><strong className="text-zinc-200">1.</strong> Open the Savvy Campus app and sign in.</li>
              <li><strong className="text-zinc-200">2.</strong> Open Profile, then Settings.</li>
              <li><strong className="text-zinc-200">3.</strong> Select Delete account.</li>
              <li><strong className="text-zinc-200">4.</strong> Enter your password and type <span className="font-mono text-zinc-200">DELETE</span>.</li>
              <li><strong className="text-zinc-200">5.</strong> Confirm the permanent deletion.</li>
            </ol>
            <p className="mt-6 rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.07] p-4 text-sm leading-6 text-emerald-100/80">
              After a successful in-app request, your active account records and verification
              images are deleted immediately and all signed-in sessions are ended.
            </p>
          </article>

          <article className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 sm:p-8">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/10 text-violet-300">
              <Mail size={21} />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-violet-300">
              Can&rsquo;t access the app?
            </p>
            <h2 className="mt-2 font-display text-2xl font-extrabold">Send a deletion request</h2>
            <p className="mt-4 text-sm leading-6 text-zinc-400">
              Email us from the address registered to your Savvy Campus account. Use the subject
              “Delete my Savvy Campus account” and include the registered email address in your
              message. Never send your password or OTP.
            </p>
            <a
              href="mailto:savycampus@gmail.com?subject=Delete%20my%20Savvy%20Campus%20account&body=Registered%20email%3A%20%0A%0APlease%20delete%20my%20Savvy%20Campus%20account%20and%20associated%20data."
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-zinc-200"
            >
              <Mail size={16} /> Email deletion request
            </a>
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-black/20 p-4">
              <Clock3 className="mt-0.5 shrink-0 text-zinc-400" size={18} />
              <p className="text-sm leading-6 text-zinc-400">
                We may verify that you own the account before acting. Verified email requests are
                completed within 30 days.
              </p>
            </div>
          </article>
        </section>

        <section className="mt-12 rounded-[2rem] border border-white/10 bg-white/[0.025] p-6 sm:p-9">
          <h2 className="font-display text-3xl font-extrabold">Data that is deleted</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">
            Deleting the account is permanent. It removes the following information associated
            with your Savvy Campus account:
          </p>
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {deletedData.map((item) => (
              <li key={item} className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-black/20 p-4 text-sm leading-6 text-zinc-400">
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-400" size={17} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-5 rounded-[2rem] border border-amber-400/15 bg-amber-500/[0.05] p-6 sm:p-9">
          <h2 className="font-display text-2xl font-extrabold text-amber-100">Limited retention</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-400">
            Savvy Campus does not keep an active copy of a deleted account. Limited encrypted
            backup copies and security or email-delivery logs may remain with our service
            providers for up to 30 days before being removed through their normal deletion
            cycles. Information may be retained for longer only where required by applicable law,
            to resolve a dispute, or to investigate fraud or misuse; access remains restricted and
            the information is removed when that reason ends.
          </p>
        </section>

        <p className="mt-8 text-sm leading-6 text-zinc-500">
          For other privacy questions, read our <Link to="/privacy" className="text-indigo-300 hover:text-indigo-200">Privacy Policy</Link> or email{" "}
          <a href="mailto:savycampus@gmail.com" className="text-indigo-300 hover:text-indigo-200">savycampus@gmail.com</a>.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
