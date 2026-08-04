import React, { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Bookmark, MapPin, ShieldCheck, Ticket, Loader2, Sparkles, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export default function OfferDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [claiming, setClaiming] = useState(false);
  const [brandModalOpen, setBrandModalOpen] = useState(false);

  const { data: offer, refetch } = useQuery({
    queryKey: ["offer", id],
    queryFn: async () => (await api.get(`/offers/${id}`)).data,
  });

  const claim = async () => {
    if (!user) { nav("/login"); return; }
    if (offer.brand_url && !offer.outlet_id) {
      setBrandModalOpen(true);
      return;
    }
    setClaiming(true);
    try {
      const { data } = await api.post(`/offers/${id}/claim`);
      toast.success("Coupon ready!");
      nav("/coupons", { state: { justClaimed: data.id } });
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setClaiming(false); }
  };

  const continueToBrand = async () => {
    setClaiming(true);
    try {
      const { data } = await api.post(`/offers/${id}/claim`);
      const officialUrl = data.official_url || offer.brand_url;
      setBrandModalOpen(false);
      toast.success("Offer claimed. Continuing to the official website…");
      window.location.assign(officialUrl);
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
  const rawClaimsCount = Number(offer.claims_count);
  const claimsCount = Number.isFinite(rawClaimsCount) && rawClaimsCount >= 0
    ? Math.floor(rawClaimsCount)
    : 0;
  const claimsLabel = `${claimsCount.toLocaleString("en-IN")} ${claimsCount === 1 ? "Student" : "Students"}`;
  const validity = typeof offer.validity === "string" && offer.validity.trim()
    ? offer.validity
    : "Ongoing";
  const outletHours = typeof offer.outlet_hours === "string" && offer.outlet_hours.trim()
    ? offer.outlet_hours
    : "Contact outlet";
  const isListedBrand = Boolean(offer.brand_url && !offer.outlet_id);
  let officialHost = offer.brand;
  try { officialHost = new URL(offer.brand_url).hostname; } catch {}

  return (
    <div className="min-h-screen bg-[#050505] grain">
      <Navbar/>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-12 sm:pb-16 relative z-10">
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
              <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-white/70">
                  {(offer.categories?.length ? offer.categories : [offer.category]).join(" · ")}
                </div>
                <div className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold mt-1 break-words" data-testid="offer-discount">{offer.discount}</div>
                <div className="text-sm text-zinc-300 mt-1 flex items-center gap-1"><MapPin size={12}/>{offer.location}</div>
              </div>
            </div>

            <div className="mt-8">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">{offer.brand}</div>
              <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight mt-1" data-testid="offer-title">{offer.title}</h1>
              <p className="text-zinc-400 mt-4 leading-relaxed">{offer.description}</p>
            </div>

            {offer.outlet_id ? (
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="outlet-offer-info-grid">
                <div className="glass rounded-2xl p-5 min-w-0">
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500">Validity</div>
                  <div className="font-display font-semibold mt-1 break-words" data-testid="outlet-offer-validity">{validity}</div>
                </div>
                <div className="glass rounded-2xl p-5 min-w-0">
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500">Verified offer</div>
                  <div className="font-display font-semibold mt-1" data-testid="outlet-offer-verified">✓ Partner Verified</div>
                </div>
                <div className="glass rounded-2xl p-5 min-w-0">
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500">Hours</div>
                  <div className="font-display font-semibold mt-1 break-words" data-testid="outlet-offer-hours">{outletHours}</div>
                </div>
                <div className="glass rounded-2xl p-5 min-w-0">
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500">Claimed by</div>
                  <div className="font-display font-semibold mt-1" data-testid="outlet-offer-claims">{claimsLabel}</div>
                </div>
              </div>
            ) : (
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
            )}

            <div className="mt-8 glass rounded-2xl p-5">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">Terms & Conditions</div>
              <p className="text-sm text-zinc-300 mt-2 leading-relaxed">{offer.terms}</p>
            </div>
            {isListedBrand && (
              <div className="mt-4 rounded-2xl border border-indigo-400/25 bg-indigo-500/10 p-5" data-testid="brand-offer-disclaimer">
                <div className="flex items-center gap-2 text-sm font-semibold text-indigo-200"><Info size={15}/> Listed brand offer</div>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">{offer.disclaimer}</p>
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-2">
            <div className="glass-heavy rounded-3xl p-6 sticky top-24">
              <div className="text-[10px] uppercase tracking-widest text-indigo-300 flex items-center gap-1"><Sparkles size={12}/> {isListedBrand ? "Listed brand offer" : "Student exclusive"}</div>
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
                {claiming ? <Loader2 size={16} className="animate-spin"/> :
                  offer.brand_url && !offer.outlet_id ? (
                    <><ExternalLink size={16}/> {user ? "Claim & continue to website" : "Log in to claim"}</>
                  ) : (
                    <><Ticket size={16}/> {user ? "Claim coupon" : "Log in to claim"}</>
                  )
                }
              </button>
              {offer.brand_url && !offer.outlet_id && user && canClaim && (
                <div className="mt-2 text-[11px] text-zinc-500 text-center">
                  You'll be redirected to <span className="text-white">{officialHost}</span> to activate.
                </div>
              )}
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
      <Dialog open={brandModalOpen} onOpenChange={(open) => !claiming && setBrandModalOpen(open)}>
        <DialogContent className="w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border-white/10 bg-[#111114] p-5 text-white sm:p-6" data-testid="brand-leaving-modal">
          <DialogHeader>
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-indigo-500/15 text-indigo-300 sm:mx-0"><ExternalLink size={20}/></div>
            <DialogTitle className="font-display text-xl leading-tight sm:text-2xl">You’re leaving SavvyCampusDeals</DialogTitle>
            <DialogDescription className="pt-2 leading-relaxed text-zinc-400">
              You’re leaving SavvyCampusDeals and continuing to the brand’s official website.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-widest text-indigo-300">{offer.brand}</div>
            <div className="mt-1 font-display text-lg font-bold">{offer.title}</div>
            <p className="mt-3 text-xs leading-relaxed text-zinc-400">{offer.disclaimer}</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <button disabled={claiming} onClick={() => setBrandModalOpen(false)} className="min-h-11 rounded-full border border-white/10 px-5 py-2.5 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50">Cancel</button>
            <button data-testid="brand-continue-btn" disabled={claiming} onClick={continueToBrand} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-60">
              {claiming ? <Loader2 size={15} className="animate-spin"/> : <ExternalLink size={15}/>} Continue to official website
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
