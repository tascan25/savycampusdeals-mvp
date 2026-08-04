import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Ticket, Clock, CheckCircle2, X, Copy, ExternalLink, Globe2, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

function CouponModal({ coupon, onClose }) {
  if (!coupon) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md grid place-items-center overflow-y-auto p-4 sm:p-6"
        onClick={onClose}
        data-testid="coupon-modal"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
          className="glass-heavy my-auto w-full max-w-md rounded-3xl p-5 sm:p-8 relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button data-testid="coupon-modal-close" onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white"><X size={18}/></button>
          <div className="text-[10px] uppercase tracking-[0.3em] text-indigo-300">Partner coupon</div>
          <div className="font-display text-2xl font-extrabold mt-2">{coupon.brand}</div>
          <div className="text-zinc-400 text-sm">{coupon.offer_title}</div>
          <div className="mt-6 rounded-2xl bg-white p-4 grid place-items-center">
            <img src={coupon.qr_data_uri} alt="QR" className="aspect-square h-auto w-full max-w-52" data-testid="coupon-qr"/>
          </div>
          <div className="mt-4 rounded-xl bg-white/5 border border-white/10 p-3 flex flex-col gap-3 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between">
            <span className="min-w-0 break-all font-mono text-base font-bold tracking-widest sm:text-lg" data-testid="coupon-code">{coupon.code}</span>
            <button
              data-testid="coupon-copy-btn"
              onClick={() => { navigator.clipboard.writeText(coupon.code); toast.success("Copied"); }}
              className="text-xs rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 flex items-center gap-1"
            ><Copy size={12}/> Copy</button>
          </div>
          <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100 text-center">
            Ask outlet staff to scan and approve this QR before your bill is closed. Your discount is confirmed only when this coupon shows Redeemed.
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function PartnerCoupons({ coupons, isLoading, onOpen }) {
  if (!isLoading && coupons.length === 0) {
    return <EmptyState message="No partner coupons yet." />;
  }
  return (
    <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="coupons-grid">
      {isLoading && [...Array(3)].map((_, i) => <div key={i} className="rounded-2xl aspect-[16/12] bg-white/5 animate-pulse"/>)}
      {coupons.map((coupon, i) => (
        <motion.button
          key={coupon.id}
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.05 }}
          onClick={() => onOpen(coupon)}
          className="text-left glass rounded-2xl overflow-hidden hover:border-white/20 transition-colors"
          data-testid={`coupon-card-${coupon.id}`}
        >
          <div className="relative aspect-[16/9]">
            <img src={coupon.image_url} alt={coupon.brand} className="w-full h-full object-cover"/>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"/>
            <div className="absolute bottom-3 left-3"><div className="text-[10px] uppercase tracking-widest text-white/80">{coupon.brand}</div><div className="font-display text-xl font-extrabold">{coupon.discount}</div></div>
            <div className="absolute top-3 right-3">
              {coupon.status === "active" ? (
                <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full glass-heavy text-emerald-300 flex items-center gap-1"><Ticket size={10}/> Active</span>
              ) : coupon.status === "redeemed" ? (
                <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full glass-heavy text-zinc-400 flex items-center gap-1"><CheckCircle2 size={10}/> Redeemed</span>
              ) : (
                <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full glass-heavy text-red-300 flex items-center gap-1"><Clock size={10}/> Expired</span>
              )}
            </div>
          </div>
          <div className="p-4"><div className="text-sm text-zinc-300 line-clamp-1">{coupon.offer_title}</div><div className="font-mono text-xs text-zinc-500 mt-1">{coupon.code}</div></div>
        </motion.button>
      ))}
    </div>
  );
}

function BrandOffers({ claims, isLoading, continuingId, onContinue }) {
  if (!isLoading && claims.length === 0) {
    return <EmptyState message="No listed brand offers claimed yet." />;
  }
  return (
    <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="brand-claims-grid">
      {isLoading && [...Array(3)].map((_, i) => <div key={i} className="rounded-2xl aspect-[16/12] bg-white/5 animate-pulse"/>)}
      {claims.map((claim, i) => (
        <motion.div key={claim.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.05 }} className="glass rounded-2xl overflow-hidden" data-testid={`brand-claim-${claim.offer_id}`}>
          <div className="relative aspect-[16/9]">
            <img src={claim.image_url} alt={claim.brand} className="h-full w-full object-cover"/>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"/>
            <div className="absolute top-3 right-3 rounded-full glass-heavy px-2.5 py-1 text-[10px] uppercase tracking-widest text-indigo-200 flex items-center gap-1"><Globe2 size={10}/> Listed offer</div>
            <div className="absolute bottom-3 left-3"><div className="text-[10px] uppercase tracking-widest text-white/80">{claim.brand}</div><div className="font-display text-xl font-extrabold">{claim.discount}</div></div>
          </div>
          <div className="p-4">
            <div className="text-sm text-zinc-200 line-clamp-2">{claim.offer_title}</div>
            <div className="mt-1 text-xs text-zinc-500">Claimed {claim.claimed_at ? new Date(claim.claimed_at).toLocaleDateString("en-IN") : "previously"}</div>
            <p className="mt-3 text-xs leading-relaxed text-zinc-500 line-clamp-3">{claim.disclaimer}</p>
            <button disabled={continuingId === claim.offer_id} onClick={() => onContinue(claim)} className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-60">
              {continuingId === claim.offer_id ? <Loader2 size={14} className="animate-spin"/> : <ExternalLink size={14}/>} Continue to official website
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="mt-10 glass rounded-3xl p-10 text-center text-zinc-400">
      {message} <Link to="/offers" className="text-white underline">Explore offers →</Link>
    </div>
  );
}

export default function MyCoupons() {
  const [active, setActive] = useState(null);
  const [tab, setTab] = useState("partner");
  const [continuingId, setContinuingId] = useState(null);
  const coupons = useQuery({ queryKey: ["coupons"], queryFn: async () => (await api.get("/coupons")).data });
  const brandClaims = useQuery({ queryKey: ["brand-offer-claims"], queryFn: async () => (await api.get("/brand-offer-claims")).data });

  const continueToBrand = async (claim) => {
    setContinuingId(claim.offer_id);
    try {
      const { data } = await api.post(`/offers/${claim.offer_id}/claim`);
      window.location.assign(data.official_url || claim.official_url);
    } catch (error) {
      toast.error(formatApiError(error.response?.data?.detail));
      setContinuingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] grain">
      <Navbar/>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-12 sm:pb-16">
        <div className="text-[10px] uppercase tracking-[0.3em] text-indigo-400">My coupons</div>
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tighter mt-2">Your unlocked perks</h1>
        <div className="mt-8 grid w-full max-w-md grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1 sm:inline-grid sm:w-auto sm:rounded-full">
          <button data-testid="partner-coupons-tab" onClick={() => setTab("partner")} className={`min-h-11 rounded-xl px-2 py-2 text-xs leading-tight transition-colors sm:rounded-full sm:px-4 sm:text-sm ${tab === "partner" ? "bg-white text-black" : "text-zinc-400"}`}>Partner Coupons ({coupons.data?.length || 0})</button>
          <button data-testid="brand-offers-tab" onClick={() => setTab("brand")} className={`min-h-11 rounded-xl px-2 py-2 text-xs leading-tight transition-colors sm:rounded-full sm:px-4 sm:text-sm ${tab === "brand" ? "bg-white text-black" : "text-zinc-400"}`}>Brand Offers ({brandClaims.data?.length || 0})</button>
        </div>
        {tab === "partner" ? (
          <PartnerCoupons coupons={coupons.data || []} isLoading={coupons.isLoading} onOpen={setActive}/>
        ) : (
          <BrandOffers claims={brandClaims.data || []} isLoading={brandClaims.isLoading} continuingId={continuingId} onContinue={continueToBrand}/>
        )}
      </div>
      <CouponModal coupon={active} onClose={() => setActive(null)}/>
    </div>
  );
}
