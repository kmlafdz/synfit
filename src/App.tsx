import React, { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "sonner";
import AuthProvider from "@/components/AuthProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { QRScannerFAB } from "@/components/QRScannerFAB";
import { AdminChatFAB } from "@/components/AdminChatFAB";
import { NotificationProvider } from "@/components/NotificationProvider";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { useUIStore } from "@/store/useUIStore";
import { usePathname } from "@/lib/navigation";

// Lazy-loaded pages
const HomePage = lazy(() => import("@/app/page"));
const NotFoundPage = lazy(() => import("@/app/not-found"));
const AdminChatPage = lazy(() => import("@/app/admin/chat/page"));
const AdminDashboardPage = lazy(() => import("@/app/admin/dashboard/page"));
const AdminEquipmentPage = lazy(() => import("@/app/admin/equipment/page"));
const AdminMadingPage = lazy(() => import("@/app/admin/mading/page"));
const AdminMembersPage = lazy(() => import("@/app/admin/members/page"));
const AdminMonthlyCheckinPage = lazy(() => import("@/app/admin/monthly-checkin/page"));
const AdminReportsPage = lazy(() => import("@/app/admin/reports/page"));
const AdminScannerPage = lazy(() => import("@/app/admin/scanner/page"));
const AdminSettingsPage = lazy(() => import("@/app/admin/settings/page"));
const AdminSpkPage = lazy(() => import("@/app/admin/spk/page"));
const AdminTransactionsPage = lazy(() => import("@/app/admin/transactions/page"));
const AdminUsersPage = lazy(() => import("@/app/admin/users/page"));
const CreditsPage = lazy(() => import("@/app/credits/page"));
const CustomerPage = lazy(() => import("@/app/customer/page"));
const LoginMemberPage = lazy(() => import("@/app/login/member/page"));
const LoginAdminPage = lazy(() => import("@/app/login-admin/page"));
const MemberDashboardPage = lazy(() => import("@/app/member/dashboard/page"));
const MembershipPage = lazy(() => import("@/app/membership/page"));
const PaymentPage = lazy(() => import("@/app/payment/page"));
const PrivacyPolicyPage = lazy(() => import("@/app/privacy-policy/page"));
const SearchPage = lazy(() => import("@/app/search/page"));
const TermsOfUsePage = lazy(() => import("@/app/terms-of-use/page"));
const TutorialsPage = lazy(() => import("@/app/tutorials/page"));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function OfflineDetector() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-xs"
        >
          <div className="bg-red-500/10 backdrop-blur-2xl border border-red-500/20 p-6 rounded-[2rem] shadow-2xl flex flex-col items-center text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-red-500/20 flex items-center justify-center">
              <span className="text-2xl">📡</span>
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase tracking-widest heading-font">
                Koneksi Terputus
              </p>
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mt-1">
                Periksa internet Anda
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AppShell() {
  const { adminTheme, memberTheme } = useUIStore();
  const [mounted, setMounted] = useState(() => {
    try {
      return sessionStorage.getItem("synfit_splash_shown") === "1";
    } catch {
      return true;
    }
  });
  const pathname = usePathname();

  const activeTheme =
    pathname === "/"
      ? "dark"
      : pathname.startsWith("/admin") || pathname === "/login-admin"
      ? adminTheme
      : memberTheme;

  // Sync theme class on <html>
  useEffect(() => {
    const theme = mounted ? activeTheme : "dark";
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [mounted, activeTheme]);

  // Brief first-session splash only (350ms), instant on subsequent loads
  useEffect(() => {
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    if (mounted) return;
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem("synfit_splash_shown", "1");
      } catch {
        // Ignore storage errors
      }
      setMounted(true);
    }, 350);
    return () => clearTimeout(timer);
  }, [mounted]);

  // Multi-frame guaranteed scroll reset on route transition
  useEffect(() => {
    const resetScroll = () => {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      } catch {
        window.scrollTo(0, 0);
      }
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    resetScroll();
    const rafId = requestAnimationFrame(resetScroll);
    const t1 = setTimeout(resetScroll, 50);
    const t2 = setTimeout(resetScroll, 150);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [pathname]);

  return (
    <>
      <AnimatePresence mode="wait">
        {!mounted && <LoadingScreen key="loader" />}
      </AnimatePresence>
      <AuthProvider>
        <NotificationProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/admin/chat" element={<AdminChatPage />} />
              <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
              <Route path="/admin/equipment" element={<AdminEquipmentPage />} />
              <Route path="/admin/mading" element={<AdminMadingPage />} />
              <Route path="/admin/members" element={<AdminMembersPage />} />
              <Route path="/admin/monthly-checkin" element={<AdminMonthlyCheckinPage />} />
              <Route path="/admin/reports" element={<AdminReportsPage />} />
              <Route path="/admin/scanner" element={<AdminScannerPage />} />
              <Route path="/admin/settings" element={<AdminSettingsPage />} />
              <Route path="/admin/spk" element={<AdminSpkPage />} />
              <Route path="/admin/transactions" element={<AdminTransactionsPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/credits" element={<CreditsPage />} />
              <Route path="/customer" element={<CustomerPage />} />
              <Route path="/login/member" element={<LoginMemberPage />} />
              <Route path="/login-admin" element={<LoginAdminPage />} />
              <Route path="/member/dashboard" element={<MemberDashboardPage />} />
              <Route path="/membership" element={<MembershipPage />} />
              <Route path="/payment" element={<PaymentPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/terms-of-use" element={<TermsOfUsePage />} />
              <Route path="/tutorials" element={<TutorialsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
          <QRScannerFAB />
          <AdminChatFAB />
          <Toaster
            theme={mounted ? (activeTheme as "light" | "dark") : "dark"}
            position="top-right"
            richColors
            toastOptions={{
              style: {
                background: "rgba(255, 255, 255, 0.08)",
                backdropFilter: "blur(40px) saturate(220%)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "1.5rem",
                padding: "20px",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              },
              className: "group !font-sans",
            }}
          />
          <OfflineDetector />
        </NotificationProvider>
      </AuthProvider>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
