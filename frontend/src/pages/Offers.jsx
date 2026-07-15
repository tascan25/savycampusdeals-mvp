import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal } from "lucide-react";
import Navbar from "@/components/Navbar";
import OfferCard from "@/components/OfferCard";
import api from "@/lib/api";
import { toast } from "sonner";

const CATS = ["all", "Food & Drink", "Fashion", "Tech", "Fitness", "Education", "Entertainment"];
const SORTS = [
  { k: "featured", label: "Featured" },
  { k: "trending", label: "Trending" },
  { k: "latest", label: "Latest" },
];

export default function Offers() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("featured");

  const { data = [], refetch, isLoading } = useQuery({
    queryKey: ["offers", q, category, sort],
    queryFn: async () => (await api.get("/offers", { params: { q: q || undefined, category, sort } })).data,
  });

  const toggleSave = async (offer) => {
    try {
      await api.post(`/offers/${offer.id}/save`);
      await refetch();
      toast.success(offer.saved ? "Removed from saved" : "Saved!");
    } catch { toast.error("Login required to save"); }
  };

  return (
    <div className="min-h-screen bg-[#050505] grain">
      <Navbar/>
      <div className="aurora bg-purple-600/20" style={{ width: 500, height: 500, top: 0, right: -100 }} />
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-16 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-[10px] uppercase tracking-[0.3em] text-indigo-400">Perks marketplace</div>
          <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tighter mt-2">All the deals. One place.</h1>
        </motion.div>

        {/* Filters */}
        <div className="mt-8 glass-heavy rounded-3xl p-4 md:p-5 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
            <input
              data-testid="offers-search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search brands, offers…"
              className="w-full rounded-full bg-white/5 border border-white/10 pl-9 pr-4 py-2.5 text-sm text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-zinc-500"/>
            <select
              data-testid="offers-sort-select"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none"
            >
              {SORTS.map(s => <option key={s.k} value={s.k} className="bg-[#0a0a0c]">{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* Category pills */}
        <div className="mt-6 flex flex-wrap gap-2">
          {CATS.map((c) => (
            <button
              key={c}
              data-testid={`offers-cat-${c.toLowerCase().replace(/[^a-z0-9]/g,'-')}`}
              onClick={() => setCategory(c)}
              className={`rounded-full px-4 py-1.5 text-sm border transition-colors ${
                category === c ? "bg-white text-black border-white" : "bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10"
              }`}
            >
              {c === "all" ? "All" : c}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="offers-grid">
          {isLoading && [...Array(6)].map((_, i) => <div key={i} className="rounded-2xl aspect-[16/12] bg-white/5 animate-pulse"/>)}
          {!isLoading && data.length === 0 && (
            <div className="col-span-full text-center py-20 text-zinc-500">No offers match. Try clearing filters.</div>
          )}
          {data.map((o, i) => (
            <OfferCard key={o.id} offer={o} onToggleSave={toggleSave} index={i}/>
          ))}
        </div>
      </div>
    </div>
  );
}
