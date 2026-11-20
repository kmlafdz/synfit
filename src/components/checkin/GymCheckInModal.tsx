"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  QrCode,
  MapPin,
  X,
  RefreshCw,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  LogOut,
  Navigation,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Member } from "@/types";
import { Button } from "@/components/ui/button";

interface GymCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  status: string;
  daysLeft: number;
  isDark: boolean;
  isRefreshingToken: boolean;
  onRefreshToken: () => void;
  activeCheckinId: string | null;
  isCheckingGPS: boolean;
  onOpenGpsCheckIn: () => void;
  onManualCheckout: () => void;
  activeSessionDuration?: number;
}

export function GymCheckInModal({
  isOpen,
  onClose,
  member,
  status,
  daysLeft,
  isDark,
  isRefreshingToken,
  onRefreshToken,
  activeCheckinId,
  isCheckingGPS,
  onOpenGpsCheckIn,
  onManualCheckout,
  activeSessionDuration = 0,
}: GymCheckInModalProps) {
  const [activeTab, setActiveTab] = useState<"qr" | "gps">("qr");

  if (!isOpen || !member) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[120] flex items-center justify-center p-3 sm:p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className={`w-full max-w-sm rounded-3xl border p-5 sm:p-6 space-y-4 shadow-2xl relative ${
            isDark ? "bg-[#101424] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/30 text-[#FF5A2C] flex items-center justify-center">
                <QrCode className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black">Check-In SynFit GYM</h3>
                <p className="text-[10px] text-gray-400">Pilih metode check-in kehadiran</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Segmented Switcher: QR Pass vs GPS */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-black/20 border border-white/5">
            <button
              onClick={() => setActiveTab("qr")}
              className={`py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "qr"
                  ? isDark
                    ? "bg-gradient-to-r from-orange-600 to-[#FF5A2C] text-white shadow-md shadow-orange-950/30"
                    : "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <QrCode className="h-3.5 w-3.5" />
              <span>Barcode / QR Pass</span>
            </button>

            <button
              onClick={() => setActiveTab("gps")}
              className={`py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "gps"
                  ? isDark
                    ? "bg-gradient-to-r from-orange-600 to-[#FF5A2C] text-white shadow-md shadow-orange-950/30"
                    : "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>Check-in GPS</span>
            </button>
          </div>

          {/* TAB 1: BARCODE / QR MEMBER */}
          {activeTab === "qr" && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3.5"
            >
              {/* QR Code Container with High Contrast */}
              <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white shadow-xl text-gray-900">
                {status !== "Expired" ? (
                  <QRCodeSVG
                    value={member.qr_token}
                    size={180}
                    level="H"
                    className="rounded-lg shadow-inner"
                  />
                ) : (
                  <div className="w-[180px] h-[180px] bg-gray-100 rounded-lg flex items-center justify-center">
                    <span className="text-base font-black text-red-500 rotate-[-45deg] tracking-widest">
                      KARTU EXPIRED
                    </span>
                  </div>
                )}

                <div className="mt-3 text-center">
                  <span className="text-xs font-mono font-black text-gray-900 tracking-widest px-2.5 py-0.5 rounded bg-gray-100">
                    {member.qr_token}
                  </span>
                  <p className="text-[10px] text-gray-500 font-medium mt-1">
                    Arahkan ke optical scanner turnstile gate gym
                  </p>
                </div>
              </div>

              {/* Status and Refresh */}
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{daysLeft > 0 ? `Sisa ${daysLeft} Hari Aktif` : "Expired"}</span>
                </span>
                <button
                  onClick={onRefreshToken}
                  disabled={isRefreshingToken}
                  className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <RefreshCw className={`h-3 w-3 ${isRefreshingToken ? "animate-spin" : ""}`} />
                  <span>Refresh Kode</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* TAB 2: GPS CHECK-IN */}
          {activeTab === "gps" && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div
                className={`p-4 rounded-2xl border text-center space-y-2 ${
                  isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                  <Navigation className="h-6 w-6 animate-pulse" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-black">Deteksi Geofence Lokasi Gym</h4>
                  <p className="text-[10px] text-gray-400">
                    Presensi otomatis berbasis satelit GPS saat Anda berada di dalam area SynFit Gym (&lt; 100m).
                  </p>
                </div>
              </div>

              {activeCheckinId ? (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between">
                    <span className="font-bold">Status: Sedang Latihan di Gym</span>
                    <span className="font-mono text-[11px]">{Math.floor(activeSessionDuration / 60)} Mnt</span>
                  </div>
                  <Button
                    onClick={() => {
                      onManualCheckout();
                      onClose();
                    }}
                    disabled={isCheckingGPS}
                    className="w-full h-11 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs shadow-md shadow-orange-600/30"
                  >
                    {isCheckingGPS ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4 mr-1.5" />}
                    <span>Check-out dari Gym</span>
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => {
                    onOpenGpsCheckIn();
                    onClose();
                  }}
                  disabled={isCheckingGPS || status === "Expired"}
                  className="w-full h-11 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md shadow-blue-900/30 active:scale-95 transition-all"
                >
                  {isCheckingGPS ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4 mr-1.5" />}
                  <span>Verifikasi Lokasi & Check-in Sekarang</span>
                </Button>
              )}
            </motion.div>
          )}

          {/* Close CTA */}
          <div className="pt-1">
            <button
              onClick={onClose}
              className={`w-full py-2.5 rounded-xl border text-xs font-bold transition-all ${
                isDark ? "border-white/10 text-gray-400 hover:text-white" : "border-gray-200 text-gray-600"
              }`}
            >
              Tutup
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
