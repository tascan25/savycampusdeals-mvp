import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Gift, Loader2, Coffee, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import Navbar from "@/components/Navbar";

const statusLabel = {
  reserved: "Position reserved — complete verification",
  waitlisted: "Freshers rewards waitlist",
  unlocked: "Your passes are ready",
  missed: "Limited rewards have been claimed",
};

function Pass({ title, subtitle, address, code, qr, status }) {
  if (!code) return null;
  return <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">{title}</p>
    <h2 className="mt-2 font-display text-xl font-black">{subtitle}</h2>
    {address && <p className="mt-3 text-sm leading-6 text-zinc-400"><b className="text-zinc-200">Address:</b> {address}</p>}
    <div className="mt-5 inline-block rounded-2xl bg-white p-3"><img src={qr} alt={`${title} QR code`} className="h-48 w-48" /></div>
    <p className="mt-4 font-mono text-sm text-zinc-300">{code}</p>
    <p className="mt-2 text-xs uppercase tracking-wider text-zinc-500">Status: {status}</p>
  </section>;
}

export default function FreshersReward() {
  const reward = useQuery({ queryKey: ["freshers-reward"], queryFn: async () => (await api.get("/freshers/reward")).data, refetchInterval: 15000, retry: false });
  const item = reward.data?.reward;
  return <div className="min-h-screen bg-[#050505] text-white"><Navbar /><main className="mx-auto max-w-5xl px-5 pb-20 pt-28">
    {reward.isLoading ? <div className="grid h-72 place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div> : reward.isError ? <div className="rounded-3xl border border-white/10 p-10 text-center"><Gift className="mx-auto text-zinc-600" /><h1 className="mt-4 font-display text-2xl font-black">No Freshers campaign entry found</h1><Link to="/dashboard" className="mt-5 inline-block rounded-full bg-white px-5 py-2.5 font-bold text-black">Back to dashboard</Link></div> : <>
      <div className="rounded-3xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/15 to-violet-500/5 p-7 md:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-300">KIET Freshers 2026</p>
        <h1 className="mt-3 font-display text-4xl font-black">Registration position #{item.position}</h1>
        <p className="mt-3 text-zinc-300">{statusLabel[item.status] || item.status}</p>
        {item.status === "reserved" && <Link to="/verify" className="mt-6 inline-flex rounded-full bg-white px-5 py-3 font-bold text-black">Complete student verification</Link>}
        {item.expires_at && <p className="mt-5 text-sm text-zinc-400">Valid until {new Date(item.expires_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>}
      </div>
      {item.status === "unlocked" && <div className="mt-7 grid gap-5 md:grid-cols-2">
        <Pass title="Goodies pickup pass" subtitle={item.goodies_description} code={item.goodies_code} qr={item.goodies_qr_data_uri} status={item.goodies_status} />
        <Pass title="Café coupon" subtitle={`${item.cafe_name} · ${item.offer}`} address={item.cafe_address} code={item.cafe_code} qr={item.cafe_qr_data_uri} status={item.cafe_status} />
      </div>}
      {item.pickup_location && <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-5"><ShieldCheck className="text-emerald-300" /><div><b>Goodies pickup</b><p className="mt-1 text-sm text-zinc-400">{item.pickup_location}</p></div></div>}
      {item.cafe_code && <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-5"><Coffee className="text-amber-300" /><p className="text-sm text-zinc-300">Only {item.cafe_name} staff can redeem your café QR. Event staff can redeem only your goodies pass.</p></div>}
    </>}
  </main></div>;
}
