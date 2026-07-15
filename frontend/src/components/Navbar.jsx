import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Menu, X, Sparkles, LogOut, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const links = [
  { to: "/offers", label: "Offers" },
  { to: "/dashboard", label: "Dashboard", protected: true },
  { to: "/card", label: "My Card", protected: true },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  return (
    <div className="fixed top-4 inset-x-0 z-50 flex justify-center px-4" data-testid="navbar-root">
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="glass-heavy rounded-full px-4 py-2.5 flex items-center gap-2 w-full max-w-5xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
      >
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-2 pl-2 pr-3">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-500 grid place-items-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="font-display font-bold tracking-tight text-white text-lg">Savy<span className="text-indigo-400">.</span></span>
        </Link>
        <div className="hidden md:flex items-center gap-1 ml-2">
          {links.filter(l => !l.protected || user).map(l => (
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
          {user ? (
            <>
              <Link to="/dashboard" data-testid="nav-avatar" className="hidden md:flex h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 items-center justify-center text-sm font-bold">
                {(user.name || "S")[0].toUpperCase()}
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
          {links.filter(l => !l.protected || user).map(l => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="text-zinc-300 hover:text-white py-2 px-2">{l.label}</Link>
          ))}
          {!user && (
            <>
              <Link to="/login" onClick={() => setOpen(false)} className="text-zinc-300 py-2 px-2">Login</Link>
              <Link to="/signup" onClick={() => setOpen(false)} className="rounded-full bg-white text-black font-semibold px-4 py-2 text-center">Get verified</Link>
            </>
          )}
          {user && (
            <button onClick={async () => { await logout(); setOpen(false); nav("/"); }} className="text-left text-zinc-300 py-2 px-2 flex items-center gap-2"><LogOut size={14}/> Logout</button>
          )}
        </div>
      )}
    </div>
  );
}
