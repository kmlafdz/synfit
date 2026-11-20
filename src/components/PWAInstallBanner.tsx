"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, Download, X, Share, PlusSquare, Sparkles, CheckCircle2 } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Check if already running in standalone / fullscreen mode (already installed as PWA)
    const isInStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://") ||
      localStorage.getItem("pwa_installed") === "true";

    if (isInStandaloneMode) {
      setIsStandalone(true);
      return;
    }

    const handleAppInstalled = () => {
      localStorage.setItem("pwa_installed", "true");
      setIsStandalone(true);
      setIsVisible(false);
      setShowIOSGuide(false);
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    // 2. Register Service Worker for PWA compliance
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("[PWA] Service Worker registered with scope:", reg.scope);
          })
          .catch((err) => {
            console.warn("[PWA] Service Worker registration failed:", err);
          });
      });
    }

    // 3. Detect iOS Safari
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    const isSafari = /safari/.test(ua) && !/chrome|crios|fxios/.test(ua);
    if (isIosDevice && isSafari && !isInStandaloneMode) {
      setIsIOS(true);
    }

    // 4. Capture native beforeinstallprompt (Android Chrome / Edge / Chromium)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Check if user previously dismissed recently (within 48 hours)
      const dismissedUntil = localStorage.getItem("synfit_pwa_dismissed_until");
      if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
        return;
      }

      // Proactively suggest after 3.5 seconds
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3500);

      return () => clearTimeout(timer);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Also show for iOS if not dismissed
    if (isIosDevice && isSafari && !isInStandaloneMode) {
      const dismissedUntil = localStorage.getItem("synfit_pwa_dismissed_until");
      if (!dismissedUntil || Date.now() >= parseInt(dismissedUntil, 10)) {
        const timer = setTimeout(() => {
          setIsVisible(true);
        }, 4000);
        return () => clearTimeout(timer);
      }
    }

    // Manual open listener for buttons elsewhere in the app
    const handleManualOpen = () => {
      setIsVisible(true);
      if (isIOS) setShowIOSGuide(true);
    };
    window.addEventListener("open-pwa-install", handleManualOpen);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("open-pwa-install", handleManualOpen);
    };
  }, [isIOS]);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (!deferredPrompt) {
      // Fallback if browser doesn't expose prompt or already fired
      alert("Untuk menginstal di smartphone: ketuk menu browser (tiga titik di kanan atas) dan pilih 'Instal Aplikasi' atau 'Tambahkan ke Layar Utama'.");
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        console.log("[PWA] User accepted the install prompt");
        setIsVisible(false);
      } else {
        console.log("[PWA] User dismissed the install prompt");
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.error("[PWA] Error triggering install prompt:", err);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setShowIOSGuide(false);
    // Dismiss for 48 hours
    const snoozeTime = Date.now() + 48 * 60 * 60 * 1000;
    localStorage.setItem("synfit_pwa_dismissed_until", snoozeTime.toString());
  };

  if (isStandalone || (!isVisible && !showIOSGuide)) {
    return null;
  }

  return (
    <>
      {/* ── 1. Floating Banner Suggestion ── */}
      <AnimatePresence>
        {isVisible && !showIOSGuide && (
          <motion.div
            initial={{ opacity: 0, y: 80, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 80, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="fixed bottom-5 sm:bottom-8 left-4 right-4 sm:left-auto sm:right-8 sm:w-[420px] z-[9999]"
          >
            <div className="relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br from-[#121727]/95 via-[#0D111E]/95 to-[#070912]/95 border border-orange-500/35 backdrop-blur-2xl shadow-2xl shadow-orange-950/40 text-white">
              {/* Subtle Ambient Glow */}
              <div className="absolute -top-16 -right-16 w-36 h-36 bg-[#FF5A2C]/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

              {/* Close Button */}
              <button
                onClick={handleDismiss}
                className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                aria-label="Tutup saran instalasi"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-start gap-3.5 pr-6">
                {/* App Icon (White Background) */}
                <div className="relative w-12 h-12 rounded-2xl p-1 bg-white shrink-0 shadow-lg shadow-black/20 flex items-center justify-center overflow-hidden border border-white/20">
                  <img
                    src="/icon-192.png"
                    alt="SynFit Logo"
                    width={48}
                    height={48}
                    className="w-full h-full object-contain rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-orange-500/20 text-[#FF5A2C] border border-orange-500/30 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      Instal Aplikasi
                    </span>
                    <span className="text-[10px] text-gray-400 font-bold">SynFit</span>
                  </div>
                  <h3 className="text-sm font-black text-white tracking-tight">
                    Pasang SynFit di Smartphone Anda
                  </h3>
                  <p className="text-[11px] text-gray-300 leading-snug">
                    Akses instan ke kartu member digital, AI Form Coach & Smartwatch tanpa repot buka browser!
                  </p>
                </div>
              </div>

              {/* Value Badges */}
              <div className="mt-3.5 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-[10px] text-gray-300">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Ringan & Cepat (PWA)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Bisa Akses Offline</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex items-center gap-2.5">
                <button
                  onClick={handleInstallClick}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#FF5A2C] via-orange-500 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Download className="w-4 h-4 animate-bounce" />
                  <span>{isIOS ? "Lihat Cara Pasang" : "Instal Sekarang"}</span>
                </button>
                <button
                  onClick={handleDismiss}
                  className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-bold transition-colors"
                >
                  Nanti
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 2. iOS Safari Step-by-Step Guide Modal ── */}
      <AnimatePresence>
        {showIOSGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[10000] flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl p-6 bg-[#101424] border border-white/15 text-white shadow-2xl relative space-y-4"
            >
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 text-gray-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-black text-white">Instal di iPhone / iPad</h4>
                  <p className="text-xs text-gray-400">Petunjuk Safari Web App</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <Share className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-gray-200">
                    1. Ketuk tombol <strong className="text-white">Bagikan (Share)</strong> pada bilah bawah browser Safari.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                    <PlusSquare className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-gray-200">
                    2. Geser menu ke bawah lalu pilih <strong className="text-white">&apos;Tambahkan ke Layar Utama&apos;</strong> (Add to Home Screen).
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-gray-200">
                    3. Ketuk <strong className="text-white">&apos;Tambah&apos; (Add)</strong> di pojok kanan atas. Aplikasi SynFit akan muncul di beranda ponsel Anda!
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-3 rounded-xl bg-[#FF5A2C] hover:bg-orange-600 font-bold text-xs uppercase tracking-wider text-white shadow-lg transition-all"
              >
                Saya Mengerti
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
