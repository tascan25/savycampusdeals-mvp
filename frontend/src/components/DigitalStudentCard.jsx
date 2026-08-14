import React, { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { BadgeCheck } from "lucide-react";

export default function DigitalStudentCard({ card }) {
  const ref = useRef(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotY = useSpring(useTransform(mx, [0, 1], [-8, 8]), { stiffness: 180, damping: 22 });
  const rotX = useSpring(useTransform(my, [0, 1], [7, -7]), { stiffness: 180, damping: 22 });
  const lightX = useTransform(mx, [0, 1], [18, 82]);
  const lightY = useTransform(my, [0, 1], [10, 90]);
  const lightXPct = useTransform(lightX, (value) => `${value}%`);
  const lightYPct = useTransform(lightY, (value) => `${value}%`);

  const onMove = (event) => {
    if (!ref.current) return;
    const bounds = ref.current.getBoundingClientRect();
    mx.set((event.clientX - bounds.left) / bounds.width);
    my.set((event.clientY - bounds.top) / bounds.height);
  };

  const onLeave = () => {
    mx.set(0.5);
    my.set(0.5);
  };

  if (!card) return null;

  const expiryDate = card.expiry
    ? new Date(card.expiry).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
    : "—";

  return (
    <div className="w-full max-w-md mx-auto [perspective:1200px]" data-testid="student-card">
      <motion.div
        ref={ref}
        data-student-card-surface
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{ rotateY: rotY, rotateX: rotX, transformStyle: "preserve-3d" }}
        className="savvy-pass relative aspect-[1.586/1] overflow-hidden rounded-[1.6rem] border border-teal-100/25 shadow-[0_34px_90px_-28px_rgba(20,184,166,0.72)]"
      >
        <div className="savvy-pass-grid absolute inset-0 pointer-events-none" aria-hidden="true" />
        <div className="savvy-pass-orbit absolute pointer-events-none" aria-hidden="true" />
        <div className="absolute -right-[7%] -top-[24%] select-none font-display text-[clamp(8rem,36vw,12rem)] font-black leading-none tracking-[-0.12em] text-teal-50/[0.045]" aria-hidden="true">
          S
        </div>
        <motion.div
          className="savvy-pass-light absolute inset-0 pointer-events-none"
          style={{ "--pass-light-x": lightXPct, "--pass-light-y": lightYPct }}
          aria-hidden="true"
        />

        <div className="relative z-10 flex h-full flex-col p-[clamp(1rem,5vw,1.5rem)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-[0.55rem] border border-white/25 bg-white/95 shadow-[0_8px_20px_-9px_rgba(0,0,0,0.65)]">
                  <span className="font-display text-sm font-black italic text-teal-950">S</span>
                </div>
                <div>
                  <p className="text-[clamp(0.42rem,1.7vw,0.58rem)] font-extrabold uppercase tracking-[0.28em] text-teal-50/90">Savvy Campus</p>
                  <p className="mt-0.5 text-[clamp(0.42rem,1.55vw,0.52rem)] font-semibold uppercase tracking-[0.2em] text-teal-50/45">Student membership</p>
                </div>
              </div>
            </div>

            <div
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/70 bg-[#f1fffb]/95 px-2.5 py-1 text-[clamp(0.48rem,1.8vw,0.65rem)] font-extrabold text-teal-950 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.75),inset_0_1px_0_white]"
              data-testid="student-card-verified-badge"
            >
              <BadgeCheck size={13} strokeWidth={2.25} />
              Verified
            </div>
          </div>

          <div className="mt-auto flex min-h-0 items-end justify-between gap-3">
            <div className="min-w-0 flex-1 pb-0.5">
              <div className="mb-3 h-0.5 w-10 bg-gradient-to-r from-teal-200 via-cyan-300 to-transparent" aria-hidden="true" />
              <p className="text-[clamp(0.42rem,1.6vw,0.55rem)] font-bold uppercase tracking-[0.24em] text-teal-50/45">Member</p>
              <p className="mt-1 truncate font-display text-[clamp(1rem,4.8vw,1.35rem)] font-extrabold leading-none tracking-[-0.025em] text-white" data-testid="student-card-name">
                {card.name}
              </p>
              <p className="mt-2 truncate text-[clamp(0.56rem,2.5vw,0.76rem)] font-semibold text-teal-50/70" data-testid="student-card-college">
                {card.college || "—"}
              </p>
            </div>

            <div className="shrink-0 rounded-[0.9rem] border border-white/25 bg-white p-1.5 shadow-[0_14px_30px_-12px_rgba(0,0,0,0.72)]">
              {card.qr_data_uri ? (
                <img src={card.qr_data_uri} alt="Scan to verify student membership" className="h-[clamp(3.7rem,18vw,5rem)] w-[clamp(3.7rem,18vw,5rem)]" data-testid="student-card-qr" />
              ) : (
                <div className="grid h-[clamp(3.7rem,18vw,5rem)] w-[clamp(3.7rem,18vw,5rem)] place-items-center text-xs text-black">QR</div>
              )}
            </div>
          </div>

          <div className="mt-[clamp(0.55rem,2.6vw,0.9rem)] flex items-end justify-between border-t border-teal-50/15 pt-[clamp(0.5rem,2.3vw,0.75rem)]">
            <div className="min-w-0">
              <p className="text-[clamp(0.38rem,1.5vw,0.48rem)] font-bold uppercase tracking-[0.24em] text-teal-50/40">Member ID</p>
              <p className="mt-0.5 truncate font-mono text-[clamp(0.48rem,1.9vw,0.63rem)] font-bold tracking-[0.08em] text-teal-50/85" data-testid="student-card-number">{card.student_number}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[clamp(0.38rem,1.5vw,0.48rem)] font-bold uppercase tracking-[0.24em] text-teal-50/40">Valid through</p>
              <p className="mt-0.5 text-[clamp(0.48rem,1.9vw,0.63rem)] font-bold text-teal-50/85" data-testid="student-card-expiry">{expiryDate}</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
