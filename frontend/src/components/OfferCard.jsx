import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Bookmark, MapPin, TrendingUp } from "lucide-react";

export default function OfferCard({ offer, onToggleSave, index = 0 }) {
  return (
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: (index % 6) * 0.05 }}
      className="group relative rounded-2xl overflow-hidden bg-[#0A0A0C] border border-white/5 hover:border-white/20 transition-colors"
      data-testid={`offer-card-${offer.id}`}
    >
      <Link to={`/offers/${offer.id}`} className="block">
        <div className="relative aspect-[16/10] overflow-hidden">
          <img
            src={offer.image_url}
            alt={offer.title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute top-3 left-3 flex gap-1.5">
            {offer.featured && <span className="glass-heavy text-[10px] uppercase tracking-widest px-2 py-1 rounded-full text-indigo-300 border-indigo-400/30">Featured</span>}
            {offer.trending && <span className="glass-heavy text-[10px] uppercase tracking-widest px-2 py-1 rounded-full text-emerald-300 border-emerald-400/30 flex items-center gap-1"><TrendingUp size={10}/>Trending</span>}
          </div>
          <div className="absolute bottom-3 left-3">
            <span className="font-display text-2xl font-extrabold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{offer.discount}</span>
          </div>
        </div>
      </Link>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500">{offer.category}</span>
          <span className="text-zinc-700">•</span>
          <span className="text-[11px] text-zinc-500 flex items-center gap-1"><MapPin size={10}/>{offer.location}</span>
        </div>
        <Link to={`/offers/${offer.id}`} className="block">
          <h3 className="font-display text-base font-bold text-white line-clamp-1">{offer.brand}</h3>
          <p className="text-sm text-zinc-400 line-clamp-2 mt-1">{offer.title}</p>
        </Link>
        {onToggleSave && (
          <button
            data-testid={`offer-save-btn-${offer.id}`}
            onClick={(e) => { e.preventDefault(); onToggleSave(offer); }}
            className={`mt-3 inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 border transition-colors ${
              offer.saved
                ? "bg-indigo-500/15 text-indigo-300 border-indigo-400/30"
                : "bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10"
            }`}
          >
            <Bookmark size={12} fill={offer.saved ? "currentColor" : "none"} />
            {offer.saved ? "Saved" : "Save"}
          </button>
        )}
      </div>
    </motion.div>
  );
}
