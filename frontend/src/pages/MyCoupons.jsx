import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Ticket, Clock, CheckCircle2, X, Copy } from "lucide-react";
import Navbar from "@/components/Navbar";
import api from "@/lib/api";
import { toast } from "sonner";

function CouponModal({ coupon, onClose }) {
  if (!coupon) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md grid place-items-center p-6"
        onClick={onClose}
        data-testid="coupon-modal"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
          className="glass-heavy rounded-3xl p-8 w-full max-w-md relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button data-testid="coupon-modal-close" onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white"><X size={18}/></button>
          <div className="text-[10px] uppercase tracking-[0.3em] text-indigo-300">Coupon</div>
          <div className="font-display text-2xl font-extrabold mt-2">{coupon.brand}</div>
          <div className="text-zinc-400 text-sm">{coupon.offer_title}</div>
          <div className="mt-6 rounded-2xl bg-white p-4 grid place-items-center">
            <img src={coupon.qr_data_uri} alt="QR" className="h-52 w-52" data-testid="coupon-qr"/>
          </div>
          <div className="mt-4 rounded-xl bg-white/5 border border-white/10 p-3 flex items-center justify-between">
            <span className="font-mono text-lg font-bold tracking-widest" data-testid="coupon-code">{coupon.code}</span>
            <button
              data-testid="coupon-copy-btn"
              onClick={() => { navigator.clipboard.writeText(coupon.code); toast.success("Copied"); }}
              className="text-xs rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 flex items-center gap-1"
            ><Copy size={12}/> Copy</button>
          </div>
          <div className="mt-4 text-xs text-zinc-500 text-center">Show this QR at checkout. One-time use.</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function MyCoupons() {
  const [active, setActive] = useState(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["coupons"],
    queryFn: async () => (await api.get("/coupons")).data,
  });

  return (
    <div className="min-h-screen bg-[#050505] grain">
      <Navbar/>
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-16">
        <div className="text-[10px] uppercase tracking-[0.3em] text-indigo-400">My coupons</div>
        <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tighter mt-2">Your unlocked perks</h1>

        {!isLoading && data.length === 0 && (
          <div className="mt-12 glass rounded-3xl p-10 text-center text-zinc-400" data-testid="coupons-empty">
            No coupons yet. <Link to="/offers" className="text-white underline">Claim your first →</Link>
          </div>
        )}

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="coupons-grid">
          {data.map((c, i) => (
            <motion.button
              key={c.id}
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.05 }}
              onClick={() => setActive(c)}
              className="text-left glass rounded-2xl overflow-hidden hover:border-white/20 transition-colors"
              data-testid={`coupon-card-${c.id}`}
            >
              <div className="relative aspect-[16/9]">
                <img src={c.image_url} alt={c.brand} className="w-full h-full object-cover"/>
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"/>
                <div className="absolute bottom-3 left-3">
                  <div className="text-[10px] uppercase tracking-widest text-white/80">{c.brand}</div>
                  <div className="font-display text-xl font-extrabold">{c.discount}</div>
                </div>
                <div className="absolute top-3 right-3">
                  {c.status === "active" ? (
                    <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full glass-heavy text-emerald-300 flex items-center gap-1"><Ticket size={10}/> Active</span>
                  ) : c.status === "redeemed" ? (
                    <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full glass-heavy text-zinc-400 flex items-center gap-1"><CheckCircle2 size={10}/> Redeemed</span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full glass-heavy text-red-300 flex items-center gap-1"><Clock size={10}/> Expired</span>
                  )}
                </div>
              </div>
              <div className="p-4">
                <div className="text-sm text-zinc-300 line-clamp-1">{c.offer_title}</div>
                <div className="font-mono text-xs text-zinc-500 mt-1">{c.code}</div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
      <CouponModal coupon={active} onClose={() => setActive(null)}/>
    </div>
  );
}
