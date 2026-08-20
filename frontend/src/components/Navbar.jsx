import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Bell, Menu, X, LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAnnouncements } from "@/context/AnnouncementsContext";
import StudentAvatar from "@/components/StudentAvatar";

const links = [
  { to: "/offers", label: "Offers" },
  { to: "/outlets", label: "Outlets" },
  { to: "/dashboard", label: "Dashboard", protected: true },
  { to: "/coupons", label: "My Coupons", protected: true },
  { to: "/card", label: "My Card", protected: true },
];

export default function Navbar() {
  const { user, ready, logout } = useAuth();
  const { unreadCount, openAnnouncements } = useAnnouncements();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const visibleLinks = user?.role === "outlet_partner"
    ? [{ to: "/scan", label: "Scanner" }]
    : links.filter(l => !l.protected || user?.role === "student");
  const accountHome = user?.role === "outlet_partner" ? "/scan" : user?.role === "admin" ? "/admin" : "/dashboard";

  return (
    <div className="fixed top-4 inset-x-0 z-50 flex justify-center px-4" data-testid="navbar-root">
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="glass-heavy rounded-full px-4 py-2.5 flex items-center gap-2 w-full max-w-5xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
      >
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-2 pl-2 pr-3">
          <img src="/brand_logo.jpeg" alt="" className="h-7 w-7 rounded-lg object-cover" />
          <span className="font-display font-bold tracking-tight text-white text-lg">Savvy<span className="text-indigo-400">.</span></span>
        </Link>
        <div className="hidden md:flex items-center gap-1 ml-2">
          {visibleLinks.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              data-testid={`nav-link-${l.label.toLowerCase()}`}
              className={({ isActive }) =>
                `px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isActive ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!ready ? (
            <div className="h-9 w-24 animate-pulse rounded-full bg-white/10" aria-label="Loading account navigation" />
          ) : user ? (
            <>
              {["student", "outlet_partner"].includes(user.role) && (
                <button type="button" onClick={openAnnouncements} aria-label={`What’s new${unreadCount ? `, ${unreadCount} unread` : ""}`} className="relative grid h-9 w-9 place-items-center rounded-full text-zinc-300 transition hover:bg-white/10 hover:text-white" data-testid="nav-announcements">
                  <Bell size={16} />
                  {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-violet-300 ring-2 ring-[#111116]" />}
                </button>
              )}
              <Link to={user.role === "student" ? "/account" : accountHome} aria-label="Account settings" data-testid="nav-avatar" className="hidden md:flex h-9 w-9 items-center justify-center rounded-full">
                <StudentAvatar avatarKey={user.role === "student" ? user.avatar_key : ""} name={user.name} size={36} />
              </Link>
              <button
                data-testid="nav-logout-btn"
                onClick={async () => { await logout(); nav("/"); }}
                className="hidden md:inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm text-zinc-300 hover:text-white hover:bg-white/5"
              >
                <LogOut size={14} /> Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" data-testid="nav-login" className="hidden md:inline-flex px-3.5 py-1.5 text-sm text-zinc-300 hover:text-white rounded-full">Login</Link>
              <Link to="/signup" data-testid="nav-signup" className="rounded-full bg-white text-black text-sm font-semibold px-4 py-1.5 hover:scale-[1.03] active:scale-[0.97] transition-transform">
                Get verified
              </Link>
            </>
          )}
          <button data-testid="nav-mobile-toggle" className="md:hidden p-2 text-white" onClick={() => setOpen(v => !v)}>
            {open ? <X size={20}/> : <Menu size={20}/>}
          </button>
        </div>
      </motion.nav>
      {open && (
        <div className="md:hidden absolute top-16 left-4 right-4 glass-heavy rounded-2xl p-4 flex flex-col gap-2" data-testid="nav-mobile-menu">
          {visibleLinks.map(l => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="text-zinc-300 hover:text-white py-2 px-2">{l.label}</Link>
          ))}
          {ready && !user && (
            <>
              <Link to="/login" onClick={() => setOpen(false)} className="text-zinc-300 py-2 px-2">Login</Link>
              <Link to="/signup" onClick={() => setOpen(false)} className="rounded-full bg-white text-black font-semibold px-4 py-2 text-center">Get verified</Link>
            </>
          )}
          {user && (
            <>
              {user.role === "student" && <Link to="/account" onClick={() => setOpen(false)} className="text-zinc-300 py-2 px-2 flex items-center gap-2"><UserRound size={14} /> Account</Link>}
              <button onClick={async () => { await logout(); setOpen(false); nav("/"); }} className="text-left text-zinc-300 py-2 px-2 flex items-center gap-2"><LogOut size={14}/> Logout</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
