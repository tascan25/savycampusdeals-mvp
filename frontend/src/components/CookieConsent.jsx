import React, { useEffect, useState } from "react";
import { Cookie, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { disableAnalytics, enableAnalytics } from "@/lib/analytics";
import {
  COOKIE_SETTINGS_EVENT,
  readCookiePreferences,
  saveCookiePreferences,
} from "@/lib/cookieConsent";

export default function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const saved = readCookiePreferences();
    if (saved) {
      setAnalytics(saved.analytics);
      if (saved.analytics) enableAnalytics();
    } else {
      setOpen(true);
    }

    const showSettings = () => {
      const current = readCookiePreferences();
      setAnalytics(Boolean(current?.analytics));
      setCustomizing(true);
      setOpen(true);
    };
    window.addEventListener(COOKIE_SETTINGS_EVENT, showSettings);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, showSettings);
  }, []);

  const choose = (allowAnalytics) => {
    saveCookiePreferences(allowAnalytics);
    if (allowAnalytics) enableAnalytics();
    else disableAnalytics();
    setAnalytics(allowAnalytics);
    setOpen(false);
    setCustomizing(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-3 backdrop-blur-sm sm:p-6" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-consent-title"
        className="w-full max-w-3xl rounded-[1.75rem] border border-white/10 bg-[#101014] p-5 shadow-2xl shadow-black/60 sm:p-7"
        data-testid="cookie-consent"
      >
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-indigo-500/15 text-indigo-300">
            <Cookie size={21} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-indigo-300">Your choice, always</p>
            <h2 id="cookie-consent-title" className="mt-1 font-display text-2xl font-extrabold">
              {customizing ? "Cookie settings" : "A quick cookie check-in"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              We use essential storage to keep Savvy secure. With your permission, analytics help us understand what students actually use and improve the experience.
            </p>
          </div>
        </div>

        {customizing && (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div>
                <div className="flex items-center gap-2 font-semibold"><ShieldCheck size={16} className="text-emerald-300" /> Essential</div>
                <p className="mt-1 text-xs leading-5 text-zinc-500">Required for authentication, security and remembering your cookie choice.</p>
              </div>
              <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">Always on</span>
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div>
                <span className="font-semibold">Analytics and session insights</span>
                <p className="mt-1 text-xs leading-5 text-zinc-500">Allows PostHog analytics and session recording so we can diagnose issues and improve Savvy.</p>
              </div>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(event) => setAnalytics(event.target.checked)}
                aria-label="Allow analytics cookies"
                className="h-5 w-5 shrink-0 accent-indigo-500"
              />
            </label>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link to="/cookies" onClick={() => setOpen(false)} className="text-center text-xs text-zinc-500 underline decoration-zinc-700 underline-offset-4 hover:text-zinc-300 sm:mr-auto">
            Read our Cookie Policy
          </Link>
          {!customizing && (
            <button type="button" onClick={() => setCustomizing(true)} className="rounded-full border border-white/10 px-5 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-white/5">
              Customize
            </button>
          )}
          <button type="button" onClick={() => choose(customizing ? analytics : false)} className="rounded-full border border-white/10 px-5 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-white/5">
            {customizing ? "Save preferences" : "Reject optional"}
          </button>
          {!customizing && (
            <button type="button" onClick={() => choose(true)} className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black hover:bg-zinc-200">
              Accept all
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
