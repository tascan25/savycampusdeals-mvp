import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, Sparkles, ShieldCheck, Zap, Users, Star, ChevronDown } from "lucide-react";
import Navbar from "@/components/Navbar";
import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import OfferCard from "@/components/OfferCard";

const BRANDS = ["Nike","Apple","Spotify","Notion","Zomato","BookMyShow","Ray-Ban","cult.fit","Coursera","YouTube","Blue Tokai","Zudio"];

const STEPS = [
  { t: "Sign up in seconds", d: "Register with your student email and set up your profile.", i: Users },
  { t: "Verify your ID", d: "Upload your college ID + a selfie. Get your digital pass in minutes.", i: ShieldCheck },
  { t: "Claim your perks", d: "Show the QR at checkout — online or in-store. Save. Repeat.", i: Zap },
];

const TESTIMONIALS = [
  { n: "Aarav • IIT Bombay", q: "Got my Spotify + Notion + Nike deal in one afternoon. It's basically cheat codes for college." },
  { n: "Priya • DU", q: "The digital student card looks so good I use it as a flex. Also saved ₹6000 this sem." },
  { n: "Kabir • BITS Pilani", q: "Verified in 3 minutes. Blue Tokai discount alone paid for the sem's caffeine addiction." },
];

const FAQS = [
  { q: "Who can join SavyCampusDeals?", a: "Any Indian college student with a valid student ID card. Undergrad, PG, diploma — all welcome." },
  { q: "How does verification work?", a: "Upload your college ID plus a selfie. Our team reviews within 24 hours. Verified once — perks for a full year." },
  { q: "Is it really free?", a: "100%. Businesses pay us to give you the perks. Your job: enjoy them." },
  { q: "How do I redeem an offer?", a: "Every claim generates a unique QR-coded coupon. Show it at checkout — online or in-store." },
];

export default function Landing() {
  const { data: offers = [] } = useQuery({
    queryKey: ["landing-offers"],
    queryFn: async () => (await api.get("/offers", { params: { sort: "featured" } })).data,
  });

  return (
    <div className="min-h-screen bg-[#050505] text-white grain relative overflow-x-hidden">
      <Navbar />

      {/* Aurora */}
      <div className="aurora bg-indigo-600/40" style={{ width: 500, height: 500, top: -100, left: -100 }} />
      <div className="aurora bg-purple-600/30" style={{ width: 500, height: 500, top: 100, right: -100 }} />
      <div className="aurora bg-emerald-500/10" style={{ width: 400, height: 400, top: 500, left: "40%" }} />

      {/* HERO */}
      <section className="relative pt-32 pb-24 md:pt-40 md:pb-32">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-indigo-200 mb-6" data-testid="hero-badge">
              <Sparkles size={12} className="text-emerald-300"/> India's student perks club
            </div>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.02] tracking-tighter">
              Your student ID is now <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">a golden ticket.</span>
            </h1>
            <p className="mt-6 text-lg text-zinc-400 max-w-xl">
              Verified college students unlock exclusive deals on food, fashion, tech, fitness and edtech.
              Get your digital pass in minutes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup" data-testid="hero-cta-primary" className="group inline-flex items-center gap-2 rounded-full bg-white text-black font-semibold px-6 py-3 hover:scale-[1.03] active:scale-[0.97] transition-transform">
                Get verified — it's free
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5"/>
              </Link>
              <Link to="/offers" data-testid="hero-cta-secondary" className="inline-flex items-center gap-2 rounded-full glass px-6 py-3 hover:bg-white/10 transition-colors">
                Browse offers
              </Link>
            </div>
            <div className="mt-10 flex items-center gap-6 text-sm text-zinc-500">
              <div className="flex items-center gap-2"><BadgeCheck size={16} className="text-emerald-400"/> 12,000+ verified students</div>
              <div className="hidden sm:flex items-center gap-2"><Star size={16} className="text-amber-400"/> 4.9 rating</div>
            </div>
          </motion.div>

          {/* floating showcase */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-16 grid md:grid-cols-3 gap-4 max-w-4xl"
          >
            {["Nike","Spotify","Apple"].map((b, i) => (
              <div key={b} className="glass rounded-2xl p-5 flex items-center justify-between hover:border-white/20 transition-colors">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500">Student deal</div>
                  <div className="font-display font-bold text-lg mt-1">{b}</div>
                  <div className="text-sm text-indigo-300 mt-1">{["₹500 OFF","3 mo free","25% OFF"][i]}</div>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 grid place-items-center">
                  <Sparkles size={20} className="text-white/70"/>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* BRANDS MARQUEE */}
      <section className="relative border-y border-white/5 py-6 overflow-hidden">
        <div className="text-center text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-4">Trusted by 500+ brands</div>
        <div className="flex overflow-hidden">
          <div className="animate-marquee flex gap-12 whitespace-nowrap min-w-max">
            {[...BRANDS, ...BRANDS].map((b, i) => (
              <span key={i} className="font-display text-2xl md:text-3xl font-bold text-zinc-600 hover:text-white transition-colors">{b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="max-w-2xl mb-12">
            <div className="text-[10px] uppercase tracking-[0.3em] text-indigo-400">How it works</div>
            <h2 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight mt-3">Three steps. Zero hassle.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.t}
                initial={{ y: 30, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="glass rounded-2xl p-6 hover:border-white/20 transition-colors"
              >
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center">
                  <s.i size={20} className="text-white"/>
                </div>
                <div className="text-xs text-zinc-500 mt-4">Step {i + 1}</div>
                <div className="font-display text-xl font-bold mt-1">{s.t}</div>
                <div className="text-sm text-zinc-400 mt-2 leading-relaxed">{s.d}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* POPULAR DEALS */}
      <section className="relative py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-indigo-400">Trending now</div>
              <h2 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight mt-3">Popular deals this week</h2>
            </div>
            <Link to="/offers" data-testid="landing-view-all-offers" className="hidden md:inline-flex items-center gap-1 text-sm text-zinc-300 hover:text-white">View all <ArrowRight size={14}/></Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {offers.slice(0, 6).map((o, i) => (
              <OfferCard key={o.id} offer={o} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="relative py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-[10px] uppercase tracking-[0.3em] text-indigo-400">Loved by students</div>
          <h2 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight mt-3 max-w-2xl">Not our words. Theirs.</h2>
          <div className="grid md:grid-cols-3 gap-4 mt-10">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={i}
                initial={{ y: 30, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="glass rounded-2xl p-6"
              >
                <div className="flex gap-1 mb-3 text-amber-400">
                  {[...Array(5)].map((_, k) => <Star key={k} size={14} fill="currentColor"/>)}
                </div>
                <p className="text-zinc-200 leading-relaxed">"{t.q}"</p>
                <div className="mt-4 text-sm text-zinc-500">{t.n}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative py-24">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-[10px] uppercase tracking-[0.3em] text-indigo-400 text-center">FAQ</div>
          <h2 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight text-center mt-3">Questions? Answered.</h2>
          <div className="mt-10 space-y-3">
            {FAQS.map((f, i) => (
              <details key={i} className="glass rounded-2xl p-5 group" data-testid={`faq-item-${i}`}>
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <span className="font-display font-semibold">{f.q}</span>
                  <ChevronDown size={18} className="text-zinc-400 group-open:rotate-180 transition-transform"/>
                </summary>
                <p className="text-sm text-zinc-400 mt-3 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="relative rounded-3xl p-10 md:p-16 text-center holo overflow-hidden border border-white/10">
            <h2 className="font-display text-4xl md:text-6xl font-extrabold tracking-tighter">Ready to unlock your perks?</h2>
            <p className="mt-4 text-zinc-300 max-w-xl mx-auto">Join thousands of Indian students already saving on their favourite brands.</p>
            <Link to="/signup" data-testid="cta-signup" className="mt-8 inline-flex items-center gap-2 rounded-full bg-white text-black font-semibold px-6 py-3 hover:scale-[1.03] transition-transform">
              Get your student pass <ArrowRight size={16}/>
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative border-t border-white/5 py-10 mt-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600"/>
            <span className="font-display font-bold text-white">SavyCampusDeals</span>
          </div>
          <div>© {new Date().getFullYear()} Savy Labs. Made in India for Indian students.</div>
        </div>
      </footer>
    </div>
  );
}
