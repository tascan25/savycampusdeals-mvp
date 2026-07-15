import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Download } from "lucide-react";
import Navbar from "@/components/Navbar";
import DigitalStudentCard from "@/components/DigitalStudentCard";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function StudentCard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["student-card"],
    queryFn: async () => (await api.get("/student-card")).data,
    enabled: user?.verification_status === "approved",
  });

  if (user?.verification_status !== "approved") {
    return (
      <div className="min-h-screen bg-[#050505] grain">
        <Navbar/>
        <div className="max-w-2xl mx-auto px-6 pt-32 text-center">
          <h1 className="font-display text-4xl font-extrabold">Verify to unlock your pass</h1>
          <p className="text-zinc-400 mt-3">Your digital student card unlocks after verification.</p>
          <Link to="/verify" data-testid="card-goto-verify" className="mt-6 inline-flex items-center gap-2 rounded-full bg-white text-black font-semibold px-6 py-3">
            Verify now <ArrowRight size={14}/>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] grain">
      <Navbar/>
      <div className="aurora bg-purple-600/30" style={{ width: 500, height: 500, top: 50, left: "30%" }}/>
      <div className="max-w-4xl mx-auto px-6 pt-28 pb-16 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-[10px] uppercase tracking-[0.3em] text-indigo-400">Your student pass</div>
          <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tighter mt-2">Show it. Save more.</h1>
          <p className="text-zinc-400 mt-3">Store it on your phone. Show it at partner outlets for instant discounts.</p>
        </motion.div>

        <div className="mt-10">
          {isLoading ? (
            <div className="rounded-3xl w-full max-w-md mx-auto aspect-[1.586/1] bg-white/5 animate-pulse"/>
          ) : (
            <DigitalStudentCard card={data}/>
          )}
        </div>

        <div className="mt-10 grid sm:grid-cols-2 gap-3 max-w-md mx-auto">
          <Link to="/coupons" data-testid="card-my-coupons" className="glass rounded-2xl p-5 flex items-center justify-between hover:border-white/20 transition-colors">
            <span className="font-display font-semibold">My coupons</span>
            <ArrowRight size={16} className="text-zinc-400"/>
          </Link>
          <Link to="/offers" data-testid="card-browse-offers" className="glass rounded-2xl p-5 flex items-center justify-between hover:border-white/20 transition-colors">
            <span className="font-display font-semibold">Browse offers</span>
            <ArrowRight size={16} className="text-zinc-400"/>
          </Link>
        </div>
      </div>
    </div>
  );
}
