import React from "react";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/Navbar";
import OfferCard from "@/components/OfferCard";
import api from "@/lib/api";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function SavedOffers() {
  const { data = [], refetch, isLoading } = useQuery({
    queryKey: ["saved"],
    queryFn: async () => (await api.get("/saved")).data,
  });

  const toggleSave = async (o) => {
    try { await api.post(`/offers/${o.id}/save`); await refetch(); toast.success("Removed"); } catch { toast.error("Try again"); }
  };

  return (
    <div className="min-h-screen bg-[#050505] grain">
      <Navbar/>
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-16">
        <div className="text-[10px] uppercase tracking-[0.3em] text-indigo-400">Saved</div>
        <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tighter mt-2">Your bookmarks</h1>

        {!isLoading && data.length === 0 && (
          <div className="mt-12 glass rounded-3xl p-10 text-center text-zinc-400">
            No saved offers yet. <Link to="/offers" data-testid="saved-empty-browse" className="text-white underline">Explore now →</Link>
          </div>
        )}

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="saved-grid">
          {data.map((o, i) => <OfferCard key={o.id} offer={o} onToggleSave={toggleSave} index={i}/>)}
        </div>
      </div>
    </div>
  );
}
