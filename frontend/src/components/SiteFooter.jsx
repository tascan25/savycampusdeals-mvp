import React from "react";
import { Instagram, Linkedin, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { openCookieSettings } from "@/lib/cookieConsent";

const policyLinks = [
  ["Terms of Service", "/terms"],
  ["Privacy Policy", "/privacy"],
  ["Cookie Policy", "/cookies"],
  ["Support", "/support"],
];

export default function SiteFooter() {
  return (
    <footer className="relative mt-10 border-t border-white/5 py-10" data-testid="site-footer">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-8 px-6 text-sm md:grid-cols-[1.1fr_1fr_1fr_1.2fr] md:gap-10">
        <div className="flex min-w-0 items-start gap-3">
          <img src="/brand_logo.jpeg" alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0">
            <div className="font-display font-bold text-white">Savvy Campus</div>
            <p className="mt-2 max-w-xs leading-relaxed text-zinc-500">Student deals, local offers and exclusive savings.</p>
          </div>
        </div>

        <nav aria-label="Legal and support" className="flex min-w-0 flex-col items-start gap-2.5">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">Info</p>
          {policyLinks.map(([label, to]) => (
            <Link key={to} to={to} className="text-zinc-400 transition-colors hover:text-white">{label}</Link>
          ))}
          <button type="button" onClick={openCookieSettings} className="text-left text-zinc-400 transition-colors hover:text-white">
            Cookie settings
          </button>
        </nav>

        <div className="flex min-w-0 flex-col items-start gap-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">Say hello</p>
          <a href="https://www.instagram.com/savvycampusdeals?igsh=NzlseDJ0Nm90MDFy" target="_blank" rel="noopener noreferrer" aria-label="Follow Savvy Campus on Instagram" className="inline-flex max-w-full items-center gap-2 text-zinc-400 transition-colors hover:text-pink-300">
            <Instagram size={17} className="shrink-0" aria-hidden="true" />
            <span className="[overflow-wrap:anywhere]">@savvycampusdeals</span>
          </a>
          <a href="https://www.linkedin.com/company/savvy-campus/posts/?feedView=all&viewAsMember=true" target="_blank" rel="noopener noreferrer" aria-label="Follow Savvy Campus on LinkedIn" className="inline-flex max-w-full items-center gap-2 text-zinc-400 transition-colors hover:text-sky-300">
            <Linkedin size={17} className="shrink-0" aria-hidden="true" />
            <span>Savvy Campus</span>
          </a>
          <a href="mailto:savycampus@gmail.com" className="inline-flex max-w-full items-center gap-2 text-zinc-400 transition-colors hover:text-white">
            <Mail size={17} className="shrink-0" aria-hidden="true" />
            <span className="[overflow-wrap:anywhere]">savycampus@gmail.com</span>
          </a>
        </div>

        <div className="min-w-0 leading-relaxed text-zinc-500 md:text-right">
          © 2026 Savvy Campus.<br className="hidden md:block" /> Made in India for Indian students.
        </div>
      </div>
    </footer>
  );
}
