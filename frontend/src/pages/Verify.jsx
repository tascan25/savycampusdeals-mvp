import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Upload, Loader2, BadgeCheck, ShieldCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

function ImageUpload({ label, value, onChange, testId }) {
  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
  };
  return (
    <label className="block cursor-pointer" data-testid={`${testId}-label`}>
      <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">{label}</div>
      <div className={`relative rounded-2xl border-2 border-dashed transition-colors p-6 h-56 flex items-center justify-center overflow-hidden ${
          value ? "border-indigo-400/40" : "border-white/10 hover:border-white/30"
        }`}>
        {value ? (
          <img src={value} alt={label} className="absolute inset-0 h-full w-full object-cover"/>
        ) : (
          <div className="text-center text-zinc-500">
            <Upload size={22} className="mx-auto"/>
            <div className="text-sm mt-2">Tap to upload</div>
            <div className="text-xs">JPG/PNG, up to 5MB</div>
          </div>
        )}
        <input data-testid={testId} type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={onFile}/>
      </div>
    </label>
  );
}

export default function Verify() {
  const { user, refreshUser } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({
    college_id_image: "", selfie_image: "",
    college_name: user?.college || "", course: user?.course || "", year: user?.year || "",
    student_id_number: "",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const update = (k, v) => setF((p) => ({ ...p, [k]: v }));

  if (user?.verification_status === "approved") {
    return (
      <div className="min-h-screen bg-[#050505] grain">
        <Navbar/>
        <div className="max-w-2xl mx-auto px-6 pt-32 text-center">
          <div className="inline-flex h-16 w-16 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 items-center justify-center">
            <BadgeCheck className="text-emerald-400" size={32}/>
          </div>
          <h1 className="font-display text-4xl font-extrabold mt-4">You're verified!</h1>
          <p className="text-zinc-400 mt-2">Your student pass is ready. Head to your dashboard.</p>
          <Link to="/dashboard" data-testid="verify-go-dashboard" className="mt-6 inline-flex items-center gap-2 rounded-full bg-white text-black font-semibold px-6 py-3">
            Go to dashboard <ArrowRight size={14}/>
          </Link>
        </div>
      </div>
    );
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!f.college_id_image || !f.selfie_image) { setErr("Please upload both images"); return; }
    setErr("");
    setLoading(true);
    try {
      await api.post("/verification/submit", f);
      await refreshUser();
      toast.success("Verified! Your pass is ready 🎉");
      nav("/card");
    } catch (e) {
      setErr(formatApiError(e.response?.data?.detail));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#050505] grain">
      <Navbar/>
      <div className="aurora bg-indigo-600/30" style={{ width: 500, height: 500, top: 0, right: -100 }} />
      <div className="max-w-4xl mx-auto px-6 pt-32 pb-20 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-indigo-200 mb-4">
            <ShieldCheck size={12}/> Student verification
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tighter">Prove you're a student</h1>
          <p className="text-zinc-400 mt-3 max-w-xl">Upload your college ID and a selfie. We keep everything encrypted and delete once verified.</p>
        </motion.div>

        <form onSubmit={onSubmit} className="mt-10 glass-heavy rounded-3xl p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <ImageUpload label="Upload College ID" value={f.college_id_image} onChange={(v) => update("college_id_image", v)} testId="verify-collegeid-input"/>
          <ImageUpload label="Upload Selfie" value={f.selfie_image} onChange={(v) => update("selfie_image", v)} testId="verify-selfie-input"/>

          {[
            { k: "college_name", label: "College name", required: true },
            { k: "student_id_number", label: "Student ID number", required: true },
            { k: "course", label: "Course (e.g. B.Tech CSE)", required: true },
            { k: "year", label: "Year (e.g. 3rd)", required: true },
          ].map((field) => (
            <div key={field.k}>
              <label className="text-xs uppercase tracking-widest text-zinc-500">{field.label}</label>
              <input
                data-testid={`verify-${field.k.replace(/_/g,'-')}-input`}
                required={field.required}
                value={f[field.k]}
                onChange={(e) => update(field.k, e.target.value)}
                className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40 focus:outline-none"
              />
            </div>
          ))}

          {err && <div data-testid="verify-error" className="md:col-span-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>}
          <button data-testid="verify-submit-btn" disabled={loading} className="md:col-span-2 w-full inline-flex items-center justify-center gap-2 rounded-full bg-white text-black font-semibold py-3 hover:scale-[1.02] transition-transform disabled:opacity-60">
            {loading ? <Loader2 size={16} className="animate-spin"/> : <>Submit for verification <ArrowRight size={14}/></>}
          </button>
        </form>
      </div>
    </div>
  );
}
