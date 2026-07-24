import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, Sparkles, ShieldCheck, Zap, Users, Star, ChevronDown, MapPin, Utensils, Instagram, Mail } from "lucide-react";
import Navbar from "@/components/Navbar";
import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import OfferCard from "@/components/OfferCard";
import MemberOverviewBanner from "@/components/MemberOverviewBanner";
import { useAuth } from "@/context/AuthContext";

const BRANDS = ["Spotify","Apple","YouTube","GitHub","Adobe","Figma","Notion","Canva","Swiggy","Zomato","Coursera","Microsoft","Amazon Prime"];

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
  const { user, ready } = useAuth();
  const { data: offers = [] } = useQuery({
    queryKey: ["landing-offers"],
    queryFn: async () => (await api.get("/offers", { params: { sort: "featured" } })).data,
  });
  const { data: outlets = [] } = useQuery({
    queryKey: ["landing-outlets"],
    queryFn: async () => (await api.get("/outlets")).data,
  });

  return (
    <div className="min-h-screen bg-[#050505] text-white grain relative overflow-x-hidden">
      <Navbar />

      {/* Aurora */}
      <div className="aurora bg-indigo-600/40" style={{ width: 500, height: 500, top: -100, left: -100 }} />
      <div className="aurora bg-purple-600/30" style={{ width: 500, height: 500, top: 100, right: -100 }} />
      <div className="aurora bg-emerald-500/10" style={{ width: 400, height: 400, top: 500, left: "40%" }} />

      {/* HERO */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10 grid lg:grid-cols-12 gap-12 items-center">
          {/* Left column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
            className="lg:col-span-7"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 rounded-full glass-heavy px-3 py-1.5 text-xs text-indigo-200 mb-6"
              data-testid="hero-badge"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"/>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"/>
              </span>
              LIVE — India's student perks club
            </motion.div>

            <h1 className="font-display text-[3rem] sm:text-6xl lg:text-[5.5rem] font-extrabold leading-[0.95] tracking-tighter">
              Your student ID is
              <br />
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">a cheat code</span>
                <motion.span
                  initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.8, duration: 0.6, ease: "easeOut" }}
                  className="absolute -bottom-2 left-0 right-0 h-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 origin-left"
                />
              </span>
              <br />
              for the good life.
            </h1>

            <p className="mt-8 text-lg md:text-xl text-zinc-400 max-w-xl leading-relaxed">
              Verified college students unlock <span className="text-white font-semibold">real, exclusive deals</span> from Spotify, Apple, Swiggy, Zomato, GitHub, Adobe & 500+ more. Get your digital pass in <span className="text-emerald-300 font-semibold">under 60 seconds</span>.
            </p>

            <div className="mt-9 flex min-h-[52px] flex-wrap gap-3">
              {!ready ? (
                <div className="h-[52px] w-52 animate-pulse rounded-full bg-white/10" aria-label="Loading account actions" />
              ) : (
                <Link to={user ? "/card" : "/signup"} data-testid="hero-cta-primary" className="group inline-flex items-center gap-2 rounded-full bg-white text-black font-semibold px-7 py-3.5 hover:scale-[1.03] active:scale-[0.97] transition-transform shadow-[0_10px_40px_-10px_rgba(255,255,255,0.35)]">
                  {user ? "View Your Student Pass" : "Get your pass — free"}
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5"/>
                </Link>
              )}
              <Link to="/offers" data-testid="hero-cta-secondary" className="inline-flex items-center gap-2 rounded-full glass-heavy px-7 py-3.5 hover:bg-white/10 transition-colors">
                Browse offers
              </Link>
            </div>

            {/* Live stats strip */}
            <div className="mt-10 grid grid-cols-3 gap-3 max-w-lg">
              {[
                { n: "12,847", l: "Verified students", g: "from-indigo-400 to-purple-400" },
                { n: "₹1.2Cr", l: "Saved this year", g: "from-emerald-400 to-teal-400" },
                { n: "500+", l: "Partner brands", g: "from-pink-400 to-amber-400" },
              ].map((s, i) => (
                <motion.div
                  key={s.l}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.1 }}
                  className="glass rounded-2xl p-3"
                >
                  <div className={`font-display font-extrabold text-xl md:text-2xl bg-gradient-to-r ${s.g} bg-clip-text text-transparent`}>{s.n}</div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">{s.l}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right column — floating pass showcase */}
          <div className="lg:col-span-5 relative min-h-[520px] hidden lg:block">
            {/* Ambient glow */}
            <div className="absolute -inset-12 rounded-full bg-indigo-600/20 blur-3xl"/>

            {/* Main student card */}
            <motion.div
              initial={{ opacity: 0, y: 40, rotate: -6 }}
              animate={{ opacity: 1, y: 0, rotate: -6 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-8 right-4 w-[400px]"
              style={{ transform: "perspective(1200px) rotateY(-14deg) rotateX(6deg) rotate(-6deg)" }}
            >
              <div className="holo holo-shine rounded-3xl p-6 aspect-[1.586/1] border border-white/10 shadow-[0_40px_100px_-20px_rgba(79,70,229,0.55)] overflow-hidden relative">
                <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}/>
                <div className="relative flex items-start justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">SavyCampusDeals</div>
                    <div className="font-display text-2xl font-extrabold mt-1 flex items-center gap-2">Student Pass <Sparkles size={16} className="text-emerald-300"/></div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-semibold px-2.5 py-1">
                    <BadgeCheck size={14}/> Verified
                  </div>
                </div>
                <div className="relative mt-6 flex items-end justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.25em] text-white/50">Name</div>
                    <div className="font-display text-lg font-bold">Aarav Sharma</div>
                    <div className="text-[10px] uppercase tracking-[0.25em] text-white/50 mt-3">College</div>
                    <div className="text-sm text-white/90">IIT Bombay</div>
                  </div>
                  <div className="rounded-xl bg-white p-1.5">
                    <div className="h-20 w-20 grid grid-cols-8 grid-rows-8 gap-[1px]">
                      {[...Array(64)].map((_, k) => <div key={k} className={`${(k * 7) % 3 === 0 ? "bg-black" : "bg-white"}`}/>)}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Floating brand chip #1 (Spotify) */}
            <motion.div
              initial={{ opacity: 0, y: -30, x: -30 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              transition={{ duration: 0.7, delay: 0.6 }}
              className="absolute top-0 left-0 glass-heavy rounded-2xl p-3 pr-4 flex items-center gap-2.5 shadow-2xl"
            >
              <div className="h-9 w-9 rounded-lg bg-emerald-500 grid place-items-center">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="#000"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.5 17.3c-.2.3-.6.4-.9.2-2.5-1.5-5.6-1.9-9.4-1-.3.1-.6-.1-.7-.5s.1-.6.5-.7c4-.9 7.5-.5 10.2 1.2.4.2.5.6.3.8zm1.5-3c-.3.4-.7.5-1.1.3-2.8-1.7-7.1-2.2-10.5-1.2-.5.1-1-.2-1.1-.6s.2-1 .6-1.1c3.9-1.2 8.6-.7 11.9 1.4.3.2.4.7.2 1.2zm.1-3.1C15.7 9.5 9.6 9.4 6 10.4c-.6.2-1.2-.2-1.4-.7s.2-1.2.7-1.4c4.1-1.2 10.8-1 15 1.6.5.3.7 1 .4 1.5-.3.4-1 .6-1.5.3z"/></svg>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Just claimed</div>
                <div className="text-sm font-semibold">Spotify Premium <span className="text-emerald-300">₹59/mo</span></div>
              </div>
            </motion.div>

            {/* Floating brand chip #2 (Swiggy) */}
            <motion.div
              initial={{ opacity: 0, y: 30, x: 30 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              transition={{ duration: 0.7, delay: 0.85 }}
              className="absolute bottom-16 right-0 glass-heavy rounded-2xl p-3 pr-4 flex items-center gap-2.5 shadow-2xl"
            >
              <div className="h-9 w-9 rounded-lg bg-orange-500 grid place-items-center font-display font-extrabold text-white">S</div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Trending</div>
                <div className="text-sm font-semibold">Swiggy One Lite <span className="text-emerald-300">₹1 / 3 mo</span></div>
              </div>
            </motion.div>

            {/* Floating brand chip #3 (GitHub) */}
            <motion.div
              initial={{ opacity: 0, y: 20, x: -40 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              transition={{ duration: 0.7, delay: 1.05 }}
              className="absolute bottom-0 left-8 glass-heavy rounded-2xl p-3 pr-4 flex items-center gap-2.5 shadow-2xl"
            >
              <div className="h-9 w-9 rounded-lg bg-white grid place-items-center">
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#000" d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.5-1.4-1.4-1.8-1.4-1.8-1.1-.7 0-.7 0-.7 1.2.1 1.9 1.2 1.9 1.2 1.1 1.9 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.3-3.2-.1-.3-.6-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.6.2 2.9.1 3.2.8.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1.1.9 2.3v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/></svg>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Dev pack</div>
                <div className="text-sm font-semibold">GitHub Student <span className="text-emerald-300">FREE</span></div>
              </div>
            </motion.div>
          </div>
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

      {/* LOCAL OUTLETS */}
      <section className="relative py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-400 flex items-center gap-2"><Utensils size={12}/> Around you</div>
              <h2 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight mt-3">Local outlets, real perks.</h2>
              <p className="text-zinc-400 mt-3 max-w-xl">Walk in with your Savy pass. Walk out with the discount. Deals at your favourite neighbourhood spots.</p>
            </div>
            <Link to="/outlets" data-testid="landing-view-all-outlets" className="hidden md:inline-flex items-center gap-1 text-sm text-zinc-300 hover:text-white">All outlets <ArrowRight size={14}/></Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {outlets.slice(0, 6).map((o, i) => (
              <motion.div
                key={o.id}
                initial={{ y: 24, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.5, delay: (i % 6) * 0.06 }}
                data-testid={`landing-outlet-${o.id}`}
              >
                <Link to={`/outlets/${o.id}`} className="group block rounded-2xl bg-[#0A0A0C] border border-white/5 hover:border-white/20 overflow-hidden">
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <img src={o.image_url} alt={o.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"/>
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"/>
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 glass-heavy rounded-full px-2.5 py-1 text-[10px] uppercase tracking-widest text-white"><MapPin size={10}/> {o.city}</div>
                    <div className="absolute top-3 right-3 flex items-center gap-1 glass-heavy rounded-full px-2.5 py-1 text-[11px] text-amber-300"><Star size={11} fill="currentColor"/> {o.rating.toFixed(1)}</div>
                    <div className="absolute bottom-3 left-3">
                      <div className="text-[10px] uppercase tracking-widest text-white/70">{o.cuisine}</div>
                      <div className="font-display text-xl font-extrabold">{o.name}</div>
                    </div>
                  </div>
                  <div className="p-4 flex items-center justify-between">
                    <div className="text-sm text-zinc-400 line-clamp-1">{o.tagline}</div>
                    <div className="inline-flex items-center gap-1 text-xs rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 px-2.5 py-1">{o.offer_count} deals</div>
                  </div>
                </Link>
              </motion.div>
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
      {!ready ? (
        <section className="relative py-24" aria-label="Loading account overview">
          <div className="max-w-4xl mx-auto px-6">
            <div className="h-72 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
          </div>
        </section>
      ) : user ? (
        <MemberOverviewBanner user={user} />
      ) : (
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
      )}

      <footer className="relative border-t border-white/5 py-10 mt-10">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-[1.35fr_1fr_1.3fr] gap-8 md:gap-10 items-start text-sm">
          <div className="min-w-0 flex items-start gap-3">
            <div className="h-6 w-6 shrink-0 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600"/>
            <div className="min-w-0">
              <div className="font-display font-bold text-white">SavyCampusDeals</div>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-zinc-500">
                Student deals, local offers and exclusive savings.
              </p>
            </div>
          </div>

          <div className="min-w-0 flex flex-col items-start gap-3">
            <a
              href="https://www.instagram.com/savvycampusdeals?igsh=NzlseDJ0Nm90MDFy"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow SavyCampusDeals on Instagram"
              className="inline-flex max-w-full items-center gap-2 text-zinc-400 transition-colors hover:text-pink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 focus-visible:ring-offset-4 focus-visible:ring-offset-[#050505] rounded-sm"
            >
              <Instagram size={17} className="shrink-0" aria-hidden="true"/>
              <span className="[overflow-wrap:anywhere]">@savvycampusdeals</span>
            </a>
            <a
              href="mailto:savycampus@gmail.com"
              className="inline-flex max-w-full items-center gap-2 text-zinc-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 focus-visible:ring-offset-4 focus-visible:ring-offset-[#050505] rounded-sm"
            >
              <Mail size={17} className="shrink-0" aria-hidden="true"/>
              <span className="[overflow-wrap:anywhere]">savycampus@gmail.com</span>
            </a>
          </div>

          <div className="min-w-0 text-left leading-relaxed text-zinc-500 md:text-right">
            © 2026 Savy Campus. Made in India for Indian students.
          </div>
        </div>
      </footer>
    </div>
  );
}
