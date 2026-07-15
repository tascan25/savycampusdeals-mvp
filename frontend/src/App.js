import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import VerifyEmail from "@/pages/VerifyEmail";
import Dashboard from "@/pages/Dashboard";
import Verify from "@/pages/Verify";
import Offers from "@/pages/Offers";
import OfferDetail from "@/pages/OfferDetail";
import StudentCard from "@/pages/StudentCard";
import SavedOffers from "@/pages/SavedOffers";
import MyCoupons from "@/pages/MyCoupons";
import Outlets from "@/pages/Outlets";
import OutletDetail from "@/pages/OutletDetail";
import Scan from "@/pages/Scan";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster theme="dark" position="top-center" richColors closeButton />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/verify-email/:token" element={<VerifyEmail />} />
          <Route path="/offers" element={<Offers />} />
          <Route path="/offers/:id" element={<OfferDetail />} />
          <Route path="/outlets" element={<Outlets />} />
          <Route path="/outlets/:id" element={<OutletDetail />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/verify" element={<ProtectedRoute><Verify /></ProtectedRoute>} />
          <Route path="/card" element={<ProtectedRoute><StudentCard /></ProtectedRoute>} />
          <Route path="/saved" element={<ProtectedRoute><SavedOffers /></ProtectedRoute>} />
          <Route path="/coupons" element={<ProtectedRoute><MyCoupons /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
