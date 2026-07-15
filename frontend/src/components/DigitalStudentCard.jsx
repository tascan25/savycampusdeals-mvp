import React, { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { BadgeCheck, Sparkles } from "lucide-react";

export default function DigitalStudentCard({ card }) {
  const ref = useRef(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotY = useSpring(useTransform(mx, [0, 1], [-12, 12]), { stiffness: 200, damping: 20 });
  const rotX = useSpring(useTransform(my, [0, 1], [10, -10]), { stiffness: 200, damping: 20 });

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => { mx.set(0.5); my.set(0.5); };

  if (!card) return null;
  const expiryDate = card.expiry ? new Date(card.expiry).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "—";

  return (
    <div className="perspective-[1200px] w-full max-w-md mx-auto" data-testid="student-card">
      <motion.div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{ rotateY: rotY, rotateX: rotX, transformStyle: "preserve-3d" }}
        className="holo holo-shine relative rounded-3xl p-6 aspect-[1.586/1] border border-white/10 shadow-[0_30px_80px_-20px_rgba(79,70,229,0.6)] overflow-hidden"
      >
        {/* grain */}
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

        <div className="relative flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">SavyCampusDeals</div>
            <div className="font-display text-2xl font-extrabold mt-1 flex items-center gap-2">
              Student Pass
              <Sparkles size={16} className="text-emerald-300"/>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 border border-emerald-400/30 text-emerald-300 text-[11px] font-semibold" data-testid="student-card-verified-badge">
            <BadgeCheck size={14} />
            Verified
          </div>
        </div>

        <div className="relative mt-6 flex items-end justify-between">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.25em] text-white/50">Name</div>
            <div className="font-display text-lg font-bold truncate max-w-[220px]" data-testid="student-card-name">{card.name}</div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-white/50 mt-3">College</div>
            <div className="text-sm text-white/90 truncate max-w-[220px]" data-testid="student-card-college">{card.college || "—"}</div>
          </div>
          <div className="rounded-xl bg-white p-1.5 shadow-lg">
            {card.qr_data_uri ? (
              <img src={card.qr_data_uri} alt="QR" className="h-20 w-20" data-testid="student-card-qr" />
            ) : (
              <div className="h-20 w-20 grid place-items-center text-black text-xs">QR</div>
            )}
          </div>
        </div>

        <div className="relative mt-4 flex items-center justify-between text-[11px] text-white/70">
          <div>
            <div className="uppercase tracking-[0.25em] text-white/40">ID</div>
            <div className="font-mono font-semibold text-white" data-testid="student-card-number">{card.student_number}</div>
          </div>
          <div className="text-right">
            <div className="uppercase tracking-[0.25em] text-white/40">Valid Till</div>
            <div className="font-semibold text-white" data-testid="student-card-expiry">{expiryDate}</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
