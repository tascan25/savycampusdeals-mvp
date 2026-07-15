import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Star, Ticket, Utensils } from "lucide-react";
import Navbar from "@/components/Navbar";
import api from "@/lib/api";

export default function Outlets() {
  const [city, setCity] = React.useState("all");
  const [q, setQ] = React.useState("");

  const { data: cities = [] } = useQuery({
    queryKey: ["outlet-cities"],
    queryFn: async () => (await api.get("/outlets/cities")).data,
  });
  const { data: outlets = [], isLoading } = useQuery({
    queryKey: ["outlets", city, q],
    queryFn: async () => (await api.get("/outlets", { params: { city, q: q || undefined } })).data,
  });

  return (
    <div className="min-h-screen bg-[#050505] grain">
      <Navbar />
      <div className="aurora bg-emerald-500/15" style={{ width: 500, height: 500, top: 0, left: -100 }} />
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-16 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-400 flex items-center gap-2">
            <Utensils size={12} /> Nearby
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tighter mt-2">
            Local outlets giving students the good stuff.
          </h1>
          <p className="text-zinc-400 mt-3 max-w-xl">
            Cafés, restaurants and hangouts in your city with student-only offers. Show your Savy pass at the counter.
          </p>
        </motion.div>

        <div className="mt-8 glass-heavy rounded-3xl p-4 md:p-5 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <input
            data-testid="outlets-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search cafés, restaurants…"
            className="flex-1 rounded-full bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none"
          />
          <select
            data-testid="outlets-city-select"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="rounded-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none"
          >
            <option value="all" className="bg-[#0a0a0c]">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c} className="bg-[#0a0a0c]">{c}</option>
            ))}
          </select>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="outlets-grid">
          {isLoading && [...Array(6)].map((_, i) => <div key={i} className="rounded-2xl aspect-[16/12] bg-white/5 animate-pulse" />)}
          {!isLoading && outlets.length === 0 && (
            <div className="col-span-full text-center py-16 text-zinc-500">No outlets match your search.</div>
          )}
          {outlets.map((o, i) => (
            <motion.div
              key={o.id}
              initial={{ y: 24, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.4, delay: (i % 6) * 0.05 }}
              data-testid={`outlet-card-${o.id}`}
            >
              <Link to={`/outlets/${o.id}`} className="group block rounded-2xl bg-[#0A0A0C] border border-white/5 hover:border-white/20 transition-colors overflow-hidden">
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img src={o.image_url} alt={o.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 glass-heavy rounded-full px-2.5 py-1 text-[10px] uppercase tracking-widest text-white">
                    <MapPin size={10} /> {o.city}
                  </div>
                  <div className="absolute top-3 right-3 flex items-center gap-1 glass-heavy rounded-full px-2.5 py-1 text-[11px] text-amber-300">
                    <Star size={11} fill="currentColor" /> {o.rating.toFixed(1)}
                  </div>
                  <div className="absolute bottom-3 left-3">
                    <div className="text-[10px] uppercase tracking-widest text-white/70">{o.cuisine}</div>
                    <div className="font-display text-xl font-extrabold">{o.name}</div>
                  </div>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div className="text-sm text-zinc-400 line-clamp-1">{o.tagline}</div>
                  <div className="inline-flex items-center gap-1 text-xs rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 px-2.5 py-1">
                    <Ticket size={11} /> {o.offer_count} {o.offer_count === 1 ? "deal" : "deals"}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
