import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BadgeCheck, CircleHelp, Mail, ShieldCheck, TicketCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";

const topics = [
  { icon: BadgeCheck, title: "Verification help", text: "OTP trouble, rejected documents, changing your email or renewing student status." },
  { icon: TicketCheck, title: "Offers and coupons", text: "Questions about claiming, redemption limits, expired coupons or a partner outlet." },
  { icon: ShieldCheck, title: "Account and privacy", text: "Login issues, account safety, privacy requests or deleting your account." },
];

const faqs = [
  ["My verification code did not arrive. What now?", "Check spam and promotions, confirm the email shown on the verification screen, then request a new code after the one-minute cooldown."],
  ["How long does student verification take?", "College-email verification may be instant. Document submissions are normally reviewed within 24 hours, though busy periods can take longer."],
  ["A deal is not working at an outlet.", "Check the offer conditions and expiry first. If it should be valid, email us the offer name, outlet and what happened—never send your password or OTP."],
  ["How do I delete my account?", "While signed in, open Account from your profile icon and use Delete account in the Danger zone. You will need your password and must confirm the permanent deletion."],
];

export default function Support() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Support | Savvy Campus";
    return () => { document.title = "SavvyCampusDeals - Smart deals for smart students"; };
  }, []);

  return (
    <div className="grain min-h-screen overflow-hidden bg-[#050505] text-white">
      <Navbar />
      <div className="aurora right-[-160px] top-[-120px] h-[420px] w-[420px] bg-emerald-600/15" />
      <main className="relative mx-auto max-w-5xl px-5 pb-16 pt-32 sm:px-6 sm:pt-36">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"><ArrowLeft size={15} /> Back to Savvy</Link>
        <header className="mt-8 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">Savvy Support</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-6xl">Got a question?<br />We&rsquo;ve got you.</h1>
          <p className="mt-5 text-base leading-7 text-zinc-400">Find a quick answer below or send our team the details. No robotic runaround.</p>
        </header>

        <section className="mt-12 grid gap-4 md:grid-cols-3">
          {topics.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/10 text-indigo-300"><Icon size={19} /></div>
              <h2 className="mt-5 font-display text-xl font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">{text}</p>
            </article>
          ))}
        </section>

        <section className="mt-14 grid gap-10 md:grid-cols-[1fr_1.35fr]">
          <div>
            <CircleHelp className="text-indigo-300" size={26} />
            <h2 className="mt-4 font-display text-3xl font-extrabold">Quick answers</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-500">The greatest hits from our support inbox.</p>
          </div>
          <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {faqs.map(([question, answer]) => (
              <details key={question} className="group py-5">
                <summary className="cursor-pointer list-none pr-6 font-semibold text-zinc-200 marker:hidden">{question}</summary>
                <p className="mt-3 text-sm leading-6 text-zinc-500">{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-[2rem] border border-indigo-400/20 bg-gradient-to-br from-indigo-500/15 to-emerald-500/[0.07] p-7 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-9">
          <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-300">Still stuck?</p><h2 className="mt-2 font-display text-2xl font-extrabold">Talk to a human.</h2><p className="mt-2 text-sm text-zinc-400">Include your registered email and a short description. Never share your password or OTP.</p></div>
          <a href="mailto:savycampus@gmail.com?subject=Savvy%20Support%20Request" className="mt-5 inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-black sm:mt-0"><Mail size={16} /> Email Support</a>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
