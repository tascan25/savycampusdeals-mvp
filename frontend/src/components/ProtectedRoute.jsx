import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * Wraps routes that require BOTH auth AND email verification.
 * - Not authed → /login
 * - Authed but email not verified → /verify-email (OTP page)
 */
export default function ProtectedRoute({ children, requireEmailVerified = true, requireAdmin = false }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (requireAdmin && user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }
  if (requireEmailVerified && user.role === "student" && !user.email_verified) {
    return <Navigate to="/verify-email" state={{ email: user.email }} replace />;
  }
  return children;
}
