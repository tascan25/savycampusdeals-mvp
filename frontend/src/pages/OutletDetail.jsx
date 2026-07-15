import React, { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Star, Phone, Clock, Utensils, Ticket, Sparkles, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function OutletDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [claimingId, setClaimingId] = useState(null);

  const { data: outlet, refetch } = useQuery({
    queryKey: ["outlet", id],
    queryFn: async () => (await api.get(`/outlets/${id}`)).data,
  });

  const claim = async (offerId) => {
    if (!user) { nav("/login"); return; }
    setClaimingId(offerId);
    try {
      await api.post(`/offers/${offerId}/claim`);
      toast.success("Coupon ready! Head to My Coupons.");
      nav("/coupons");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setClaimingId(null); }
  };

  if (!outlet) {
    return (
      <div className="min-h-screen bg-[#050505] grain">
        <Navbar />
        <div className="max-w-7xl mx-auto px-6 pt-32">
          <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  const canClaim = user?.verification_status === "approved";
  const mapEmbed = `https://www.google.com/maps?q=${outlet.lat},${outlet.lng}&z=15&output=embed`;

  return (
    <div className="min-h-screen bg-[#050505] grain">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 pt-24 pb-16 relative z-10">
        <Link to="/outlets" data-testid="outlet-back" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white mb-4">
          <ArrowLeft size={14} /> Back to outlets
        </Link>

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative rounded-3xl overflow-hidden border border-white/10 aspect-[16/7]">
          <img src={outlet.cover_url || outlet.image_url} alt={outlet.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-emerald-300 flex items-center gap-1"><Utensils size={12} /> {outlet.cuisine}</div>
              <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tighter mt-1" data-testid="outlet-name">{outlet.name}</h1>
              <div className="text-zinc-300 mt-1">{outlet.tagline}</div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="glass-heavy rounded-full px-3 py-1.5 text-xs flex items-center gap-1"><Star size={12} className="text-amber-300" fill="currentColor" />{outlet.rating.toFixed(1)}</span>
              <span className="glass-heavy rounded-full px-3 py-1.5 text-xs flex items-center gap-1"><MapPin size={12} />{outlet.city}</span>
              <span className="glass-heavy rounded-full px-3 py-1.5 text-xs flex items-center gap-1"><Clock size={12} />{outlet.hours}</span>
            </div>
          </div>
        </motion.div>

        <div className="mt-10 grid lg:grid-cols-5 gap-8">
          {/* Left: Deals list */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Available deals</h2>
              <span className="text-xs text-zinc-500">{outlet.offers.length} active</span>
            </div>

            {outlet.already_redeemed_here && (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 text-amber-100 text-sm p-4 mb-4" data-testid="outlet-gate-notice">
                <ShieldCheck className="inline mr-1" size={14} /> You've already redeemed a deal here. You can claim a fresh one once this outlet posts a newer deal.
              </div>
            )}

            <div className="space-y-3">
              {outlet.offers.length === 0 && (
                <div className="glass rounded-2xl p-8 text-center text-zinc-400">No active deals right now. Check back soon.</div>
              )}
              {outlet.offers.map((o) => (
                <motion.div
                  key={o.id}
                  initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }}
                  className="glass rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4"
                  data-testid={`outlet-offer-${o.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-widest text-emerald-300">{o.category}</span>
                      {o.featured && <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">Featured</span>}
                    </div>
                    <div className="font-display text-lg font-bold mt-1">{o.title}</div>
                    <div className="text-sm text-zinc-400 mt-1 line-clamp-2">{o.description}</div>
                    <div className="text-[11px] text-zinc-500 mt-2">{o.terms} · {o.validity}</div>
                  </div>
                  <div className="flex md:flex-col items-center md:items-end gap-3 shrink-0">
                    <div className="font-display text-2xl font-extrabold text-white">{o.discount}</div>
                    <button
                      data-testid={`outlet-claim-btn-${o.id}`}
                      onClick={() => claim(o.id)}
                      disabled={claimingId === o.id || outlet.already_redeemed_here || (user && !canClaim)}
                      className="rounded-full bg-white text-black text-sm font-semibold px-4 py-2 hover:scale-[1.03] active:scale-[0.97] transition-transform disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                    >
                      {claimingId === o.id ? <Loader2 size={14} className="animate-spin" /> : <><Ticket size={14} /> Claim</>}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            {user && !canClaim && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 text-sm p-4 text-zinc-300">
                <Sparkles className="inline mr-1 text-indigo-400" size={14} /> Get verified to claim deals here. <Link to="/verify" className="underline text-white">Verify now →</Link>
              </div>
            )}
            {!user && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 text-sm p-4 text-zinc-300">
                <Link to="/signup" className="underline text-white">Sign up</Link> to unlock student deals here.
              </div>
            )}
          </div>

          {/* Right: Address + map */}
          <div className="lg:col-span-2">
            <div className="glass-heavy rounded-3xl p-6 sticky top-24">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">Address</div>
              <div className="mt-1 text-white flex items-start gap-2">
                <MapPin size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                <span data-testid="outlet-address">{outlet.address}</span>
              </div>
              {outlet.phone && (
                <div className="mt-4 flex items-center gap-2 text-sm text-zinc-300">
                  <Phone size={14} className="text-indigo-400" /> {outlet.phone}
                </div>
              )}
              <div className="mt-4 flex items-center gap-2 text-sm text-zinc-300">
                <Clock size={14} className="text-indigo-400" /> {outlet.hours}
              </div>
              <div className="mt-5 aspect-square rounded-2xl overflow-hidden border border-white/10">
                <iframe
                  title="map"
                  src={mapEmbed}
                  className="w-full h-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <a
                data-testid="outlet-directions-btn"
                href={`https://www.google.com/maps/dir/?api=1&destination=${outlet.lat},${outlet.lng}`}
                target="_blank" rel="noreferrer"
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full bg-white text-black text-sm font-semibold py-2.5 hover:scale-[1.02] transition-transform"
              >
                Get directions
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
