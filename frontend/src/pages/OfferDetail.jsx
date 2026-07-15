import React, { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Bookmark, MapPin, ShieldCheck, Ticket, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function OfferDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [claiming, setClaiming] = useState(false);

  const { data: offer, refetch } = useQuery({
    queryKey: ["offer", id],
    queryFn: async () => (await api.get(`/offers/${id}`)).data,
  });

  const claim = async () => {
    if (!user) { nav("/login"); return; }
    setClaiming(true);
    try {
      const { data } = await api.post(`/offers/${id}/claim`);
      toast.success("Coupon ready!");
      nav(`/coupons`, { state: { justClaimed: data.id } });
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setClaiming(false); }
  };

  const toggleSave = async () => {
    if (!user) { nav("/login"); return; }
    try {
      await api.post(`/offers/${id}/save`);
      await refetch();
    } catch { toast.error("Try again"); }
  };

  if (!offer) return (
    <div className="min-h-screen bg-[#050505] grain"><Navbar/>
      <div className="max-w-7xl mx-auto px-6 pt-32"><div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"/></div>
    </div>
  );

  const canClaim = user?.verification_status === "approved";

  return (
    <div className="min-h-screen bg-[#050505] grain">
      <Navbar/>
      <div className="max-w-6xl mx-auto px-6 pt-28 pb-16 relative z-10">
        <Link to="/offers" data-testid="offer-back" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white mb-6"><ArrowLeft size={14}/> Back to offers</Link>

        <div className="grid lg:grid-cols-5 gap-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-3">
            <div className="relative rounded-3xl overflow-hidden aspect-[16/10] border border-white/10">
              <img src={offer.image_url} alt={offer.title} className="w-full h-full object-cover"/>
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"/>
              <div className="absolute top-4 left-4 flex gap-2">
                {offer.featured && <span className="glass-heavy text-[10px] uppercase tracking-widest px-2 py-1 rounded-full text-indigo-300">Featured</span>}
                {offer.trending && <span className="glass-heavy text-[10px] uppercase tracking-widest px-2 py-1 rounded-full text-emerald-300">Trending</span>}
              </div>
              <div className="absolute bottom-6 left-6">
                <div className="text-[10px] uppercase tracking-widest text-white/70">{offer.category}</div>
                <div className="font-display text-4xl md:text-5xl font-extrabold mt-1" data-testid="offer-discount">{offer.discount}</div>
                <div className="text-sm text-zinc-300 mt-1 flex items-center gap-1"><MapPin size={12}/>{offer.location}</div>
              </div>
            </div>

            <div className="mt-8">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">{offer.brand}</div>
              <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight mt-1" data-testid="offer-title">{offer.title}</h1>
              <p className="text-zinc-400 mt-4 leading-relaxed">{offer.description}</p>
            </div>

            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              <div className="glass rounded-2xl p-5">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Validity</div>
                <div className="font-display font-semibold mt-1">{offer.validity}</div>
              </div>
              <div className="glass rounded-2xl p-5">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Claimed by</div>
                <div className="font-display font-semibold mt-1">{offer.claims_count.toLocaleString()} students</div>
              </div>
            </div>

            <div className="mt-8 glass rounded-2xl p-5">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">Terms & Conditions</div>
              <p className="text-sm text-zinc-300 mt-2 leading-relaxed">{offer.terms}</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-2">
            <div className="glass-heavy rounded-3xl p-6 sticky top-24">
              <div className="text-[10px] uppercase tracking-widest text-indigo-300 flex items-center gap-1"><Sparkles size={12}/> Student exclusive</div>
              <div className="font-display text-3xl font-extrabold mt-2">{offer.discount}</div>
              <div className="text-sm text-zinc-400 mt-1">{offer.brand}</div>

              {!user && (
                <div className="mt-5 rounded-xl bg-white/5 border border-white/10 p-4 text-sm text-zinc-300">
                  <ShieldCheck size={16} className="inline text-emerald-400 mr-1"/> Log in and verify to unlock this deal.
                </div>
              )}
              {user && !canClaim && (
                <div className="mt-5 rounded-xl bg-amber-500/10 border border-amber-400/30 p-4 text-sm text-amber-100">
                  Get verified to claim this offer.
                  <Link to="/verify" className="ml-1 underline">Verify now</Link>
                </div>
              )}

              <button
                data-testid="offer-claim-btn"
                onClick={claim}
                disabled={claiming || (user && !canClaim)}
                className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full bg-white text-black font-semibold py-3 hover:scale-[1.02] transition-transform disabled:opacity-60"
              >
                {claiming ? <Loader2 size={16} className="animate-spin"/> : <><Ticket size={16}/> {user ? "Claim coupon" : "Log in to claim"}</>}
              </button>
              <button
                data-testid="offer-save-detail-btn"
                onClick={toggleSave}
                className={`mt-3 w-full inline-flex items-center justify-center gap-2 rounded-full border py-3 text-sm font-medium transition-colors ${
                  offer.saved ? "bg-indigo-500/15 border-indigo-400/30 text-indigo-300" : "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10"
                }`}
              >
                <Bookmark size={14} fill={offer.saved ? "currentColor" : "none"}/> {offer.saved ? "Saved" : "Save for later"}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
