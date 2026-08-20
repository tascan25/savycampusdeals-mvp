import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, FileCheck2, LockKeyhole, Cookie } from "lucide-react";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { openCookieSettings } from "@/lib/cookieConsent";

const EFFECTIVE_DATE = "16 August 2026";

const policies = {
  "/terms": {
    eyebrow: "The fair-play rules",
    title: "Terms of Service",
    description: "The ground rules for using Savvy Campus and accessing student deals.",
    icon: FileCheck2,
    sections: [
      ["1. About Savvy Campus", [
        "Savvy Campus helps eligible students discover offers, access partner promotions, collect Savvy Points and use a digital student pass. References to “Savvy,” “we,” “us” or “our” mean the operator of the Savvy Campus service.",
        "These Terms form an agreement between you and Savvy. By creating an account or using the service, you agree to them. If you do not agree, please do not use Savvy.",
      ]],
      ["2. Who may use Savvy", [
        "You must be legally capable of entering this agreement under applicable Indian law. If you are under 18, you may use Savvy only with permission from a parent or legal guardian.",
        "Student-only features require accurate enrolment information and a valid college ID or another accepted verification method. You must keep your account information current and must not create an account for someone else.",
      ]],
      ["3. Accounts and security", [
        "You are responsible for your login credentials and activity on your account. Tell us promptly at savycampus@gmail.com if you believe your account has been compromised.",
        "One person may not operate multiple accounts to claim duplicate benefits, manipulate referrals or bypass offer limits. We may request additional verification when we reasonably suspect misuse.",
      ]],
      ["4. Student verification", [
        "Verification confirms student eligibility for a limited period; it does not verify identity for banking, employment, government or other official purposes. Verification may expire and may need to be renewed.",
        "We may approve, reject, pause or revoke student verification where submitted information is inaccurate, expired, unreadable, fraudulent or inconsistent with offer requirements.",
      ]],
      ["5. Offers, coupons and partners", [
        "Offers may have additional eligibility rules, dates, locations, stock limits and redemption conditions set by the participating brand or outlet. Unless an offer is marked as a Partner Offer, Savvy only helps you discover the offer and does not control the brand’s fulfilment.",
        "Prices and availability can change. A partner may refuse or cancel a redemption that is expired, duplicated, altered, ineligible or inconsistent with its published conditions. Coupons and student passes may not be sold, transferred or reproduced.",
      ]],
      ["6. Savvy Points", [
        "Savvy Points are promotional loyalty points, not money, stored value or a financial product. They have no cash value and cannot be sold, transferred or withdrawn. Rewards, earning rules and redemption thresholds may change as the programme evolves.",
        "We may reverse points obtained through errors, duplicate actions, fraudulent referrals or misuse. If we discontinue a points feature, we will aim to provide reasonable notice where practical.",
      ]],
      ["7. Acceptable use", [
        "Do not scrape the service, interfere with security, upload malicious material, impersonate others, submit false documents, abuse partner staff, automate redemptions or use Savvy for unlawful activity.",
        "You retain rights in material you submit, but grant us permission to host, process and review it only as needed to operate, secure and improve the service and comply with law.",
      ]],
      ["8. Suspension and termination", [
        "You may stop using Savvy at any time and can contact Support about account deletion. We may limit or suspend access where necessary to protect students, partners or the service, investigate suspected misuse, comply with law or enforce these Terms.",
      ]],
      ["9. Disclaimers and liability", [
        "Savvy is provided on an “as available” basis. We work to keep information accurate and the service reliable, but cannot guarantee uninterrupted availability or that every third-party offer will remain available.",
        "To the extent permitted by law, Savvy is not responsible for indirect or consequential losses, or for a partner’s products, services, acts or omissions. Nothing in these Terms excludes rights or liability that cannot legally be excluded, including applicable consumer rights.",
      ]],
      ["10. Changes and governing law", [
        "We may update these Terms to reflect service, legal or security changes. Material updates will be communicated through the service or by email where appropriate. Continued use after an update means the revised Terms apply.",
        "These Terms are governed by the laws of India. Courts with jurisdiction under applicable Indian law will handle disputes that cannot be resolved informally.",
      ]],
      ["11. Contact", [
        "Questions about these Terms can be sent to savycampus@gmail.com. We will use the contact details available on the Support page for formal service communications.",
      ]],
    ],
  },
  "/privacy": {
    eyebrow: "Privacy, minus the mystery",
    title: "Privacy Policy",
    description: "What information Savvy uses, why we use it, and the choices you have.",
    icon: LockKeyhole,
    sections: [
      ["1. Scope", [
        "This Privacy Policy explains how Savvy Campus processes personal data when you visit our website, create an account, verify student status, claim offers, contact Support or interact with a partner through Savvy.",
      ]],
      ["2. Information we collect", [
        "Account information: name, email address, password hash, phone number when provided, college, course and academic year.",
        "Verification information: college ID details and images, a verification selfie, student number, verification outcome and expiry. Please avoid including unrelated sensitive information in uploaded images.",
        "Activity information: saved offers, claims, coupons, redemptions, referral activity, Savvy Points, announcements and interactions with the service.",
        "Technical information: IP address, browser and device information, security logs, cookie preferences and, only with analytics consent, product usage and session insights collected through PostHog.",
        "Support information: messages and information you choose to share when requesting help.",
      ]],
      ["3. How we use information", [
        "We use personal data to create and secure accounts, verify student eligibility, deliver offers and coupons, administer Savvy Points and referrals, provide support, prevent fraud, troubleshoot the service, communicate transactional updates and comply with legal obligations.",
        "With your consent, we use analytics to understand feature usage and improve Savvy. You can withdraw analytics consent at any time through Cookie settings.",
      ]],
      ["4. Legal grounds", [
        "Depending on the activity and applicable law, we process data to perform our agreement with you, comply with legal obligations, pursue legitimate interests such as security and service improvement, and based on your consent where required.",
      ]],
      ["5. Who receives information", [
        "We share only what is reasonably needed with service providers that support hosting, database operations, email delivery, student-document storage and analytics. Current service categories include MongoDB infrastructure, Cloudinary for verification images, Resend for email delivery and PostHog for consent-based analytics.",
        "Participating outlets receive limited information needed to validate a pass or redeem a coupon. They should not receive your uploaded verification documents through the normal redemption flow.",
        "We may disclose information when required by law, to protect rights and safety, investigate misuse, or as part of a business reorganisation subject to appropriate protections. We do not sell personal data.",
      ]],
      ["6. Storage, transfers and retention", [
        "Our service providers may process information in India or other countries. Where data moves across borders, we use provider safeguards and contractual protections appropriate to the transfer.",
        "We keep information only as long as needed for the purposes described here, including account operation, fraud prevention, dispute resolution and legal compliance. Verification images should be removed or anonymised when no longer reasonably needed for verification, appeals or security.",
      ]],
      ["7. Security", [
        "We use measures such as password hashing, access controls, encrypted transport and restricted administrative access. No online service is risk-free, so please use a strong, unique password and contact us if something looks off.",
      ]],
      ["8. Your choices and rights", [
        "You may ask to access, correct or delete personal data, withdraw consent, raise a grievance or request information about processing, subject to applicable exceptions. You can change optional analytics choices through Cookie settings.",
        "You can permanently delete your account and its associated account data from the Account page. For other privacy requests, email savycampus@gmail.com from your registered address. We may verify your identity before completing a request and will respond within the period required by applicable law.",
      ]],
      ["9. Children", [
        "Savvy is intended for college students. Users under 18 should use the service only with permission from a parent or legal guardian. Contact us if you believe a child has provided information without appropriate permission.",
      ]],
      ["10. Updates and contact", [
        "We may update this Policy as Savvy changes. Material changes will be highlighted through the service or by email where appropriate.",
        "For privacy questions or grievances, contact savycampus@gmail.com with the subject “Privacy request.”",
      ]],
    ],
  },
  "/cookies": {
    eyebrow: "Small files, clear choices",
    title: "Cookie Policy",
    description: "How essential storage and optional analytics work on Savvy Campus.",
    icon: Cookie,
    sections: [
      ["1. What cookies and local storage are", [
        "Cookies are small files stored by your browser. Local storage is a similar browser feature that keeps data on your device. Savvy uses both where needed to keep you signed in, protect the service and remember your choices.",
      ]],
      ["2. Essential storage", [
        "The access_token cookie supports secure authentication. It is HTTP-only, sent only over secure connections in production and expires after up to seven days. A matching local token may be used as an authentication fallback for supported deployments.",
        "We also store your cookie preference locally so the consent prompt does not appear on every visit. Essential storage cannot be disabled through our settings because core login and security features would stop working, but you can remove it using your browser controls.",
      ]],
      ["3. Optional analytics", [
        "If you choose Accept all or enable Analytics in Cookie settings, Savvy loads PostHog to measure product usage and diagnose experience issues. This may include page interactions, device and browser information, approximate network location, session identifiers and session recordings.",
        "PostHog analytics stays off until you consent. Passwords, OTPs and uploaded verification documents should not be intentionally captured in analytics. We configure person profiles only for identified usage and disable performance capture in session recording.",
      ]],
      ["4. Managing your choice", [
        "You can accept optional analytics, reject it or change your choice at any time. Withdrawing consent stops future analytics capture on that browser; information already processed may be retained where legally permitted and operationally necessary.",
      ]],
      ["5. Browser controls and updates", [
        "Most browsers let you inspect, block or delete cookies and site data. Blocking essential storage may sign you out or prevent parts of Savvy from working.",
        "We may update this Policy when our technology or providers change. The effective date at the top shows the latest revision. Questions can be sent to savycampus@gmail.com.",
      ]],
    ],
  },
};

export default function LegalPage() {
  const { pathname } = useLocation();
  const policy = policies[pathname] || policies["/terms"];
  const Icon = policy.icon;

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${policy.title} | Savvy Campus`;
    return () => { document.title = "SavvyCampusDeals - Smart deals for smart students"; };
  }, [policy]);

  return (
    <div className="grain min-h-screen overflow-hidden bg-[#050505] text-white">
      <Navbar />
      <div className="aurora left-[-180px] top-[-140px] h-[420px] w-[420px] bg-indigo-600/20" />
      <main className="relative mx-auto max-w-4xl px-5 pb-16 pt-32 sm:px-6 sm:pt-36">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"><ArrowLeft size={15} /> Back to Savvy</Link>
        <header className="mt-8 border-b border-white/10 pb-10">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300"><Icon size={22} /></div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.25em] text-indigo-300">{policy.eyebrow}</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-6xl">{policy.title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">{policy.description}</p>
          <p className="mt-5 text-xs text-zinc-600">Effective {EFFECTIVE_DATE}</p>
        </header>

        <div className="py-4">
          {policy.sections.map(([heading, paragraphs]) => (
            <section key={heading} className="border-b border-white/[0.07] py-8 last:border-0">
              <h2 className="font-display text-xl font-bold text-zinc-100 sm:text-2xl">{heading}</h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-zinc-400 sm:text-[15px]">
                {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}
        </div>

        {pathname === "/cookies" && (
          <div className="rounded-3xl border border-indigo-400/20 bg-indigo-500/[0.08] p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div><h2 className="font-display text-xl font-bold">Want to update your choice?</h2><p className="mt-1 text-sm text-zinc-400">Your settings apply to this browser.</p></div>
            <button type="button" onClick={openCookieSettings} className="mt-4 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black sm:mt-0">Open Cookie settings</button>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
