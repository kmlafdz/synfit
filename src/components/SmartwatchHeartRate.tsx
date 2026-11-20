"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Activity,
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  AlertTriangle,
  RotateCcw,
  Clock,
  Radio,
  CheckCircle2,
  Loader2,
  Watch,
  Info,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { HeartRateBleState } from "@/lib/bluetooth/types";
import { getHeartRateZone } from "@/lib/bluetooth/heartRateParser";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/useUIStore";

interface SmartwatchHeartRateProps {
  bleState: HeartRateBleState;
  onConnect: () => void;
  onDisconnect: () => void;
  onClearSession?: () => void;
  onOpenHistory?: () => void;
  language?: "id" | "en";
  compact?: boolean;
  isDark?: boolean;
}

export function SmartwatchHeartRate({
  bleState,
  onConnect,
  onDisconnect,
  onClearSession,
  onOpenHistory,
  language = "id",
  compact = false,
  isDark: propIsDark,
}: SmartwatchHeartRateProps) {
  const storeTheme = useUIStore((s) => s.memberTheme);
  const isDark = propIsDark !== undefined ? propIsDark : storeTheme === "dark";
  const {
    status,
    deviceName,
    currentBpm,
    lastValidBpm,
    lastSampleTime,
    isStale,
    sensorContactSupported,
    sensorContactDetected,
    errorMessage,
    samples,
    stats,
    isSupported,
  } = bleState;

  const [showDetail, setShowDetail] = useState(false);

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";
  const isError = status === "error";

  // Calculate formatted relative time for last sample
  const relativeTimeString = useMemo(() => {
    if (!lastSampleTime) return null;
    const diffSec = Math.floor((Date.now() - lastSampleTime) / 1000);
    if (diffSec < 3) return language === "id" ? "Baru saja" : "Just now";
    if (diffSec < 60) return `${diffSec} ${language === "id" ? "dtk lalu" : "s ago"}`;
    const diffMin = Math.floor(diffSec / 60);
    return `${diffMin} ${language === "id" ? "mnt lalu" : "m ago"}`;
  }, [lastSampleTime, language]);

  // Heart Rate Zone for Current or Last BPM
  const displayBpm = isConnected ? currentBpm : lastValidBpm;
  const currentZone = displayBpm ? getHeartRateZone(displayBpm) : null;

  // Chart data bounded & formatted
  const chartData = useMemo(() => {
    return samples.map((s) => ({
      time: s.time,
      bpm: s.bpm,
    }));
  }, [samples]);

  // Determine chart Y-axis domain
  const yDomain = useMemo(() => {
    if (samples.length === 0) return [50, 160];
    const bpms = samples.map((s) => s.bpm);
    const min = Math.max(30, Math.min(...bpms) - 10);
    const max = Math.min(220, Math.max(...bpms) + 10);
    return [min, max];
  }, [samples]);

  // ── COMPACT HUD (Used in live camera view) ──
  if (compact) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-[#101322]/85 backdrop-blur-xl border border-white/15 text-white shadow-xl select-none">
        <div className="relative">
          <Heart
            className={`h-4 w-4 ${
              isConnected
                ? "text-red-500 fill-red-500 animate-pulse"
                : "text-gray-400"
            }`}
          />
          {isConnected && !isStale && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#D7FF38] animate-ping" />
          )}
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-sm font-black font-mono text-[#F4F5FC] tracking-tight">
            {isConnected && currentBpm !== null ? currentBpm : "--"}
          </span>
          <span className="text-[9px] font-bold text-[#B5B9CC]">BPM</span>
        </div>

        {isConnected && currentZone && (
          <span
            className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${currentZone.bgColor} ${currentZone.color}`}
          >
            {currentZone.zone}
          </span>
        )}

        {isStale && isConnected && (
          <span className="text-[8px] font-bold text-amber-300 bg-amber-500/20 px-1 py-0.5 rounded">
            STALE
          </span>
        )}
      </div>
    );
  }

  // ── REDESIGNED "HEART RATE MONITOR" CARD (PART 3) ──
  return (
    <div
      className={`w-full rounded-3xl p-5 sm:p-6 transition-all text-left space-y-4 shadow-md ${
        isDark
          ? "bg-gradient-to-br from-[#121A38] via-[#0E152F] to-[#0A0E21] border border-blue-500/30 text-white shadow-blue-950/40"
          : "bg-gradient-to-br from-blue-50/90 via-indigo-50/40 to-white border-2 border-blue-200 text-slate-900 shadow-blue-500/5"
      }`}
    >
      {/* 1. STATUS KONEKSI & HEADER */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b ${
          isDark ? "border-white/10" : "border-blue-100"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
              isDark
                ? "bg-blue-600/25 text-blue-400 border border-blue-500/40"
                : "bg-blue-600 text-white shadow-blue-500/30"
            }`}
          >
            <Watch className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Heart Rate Monitor
              </span>
              {sensorContactSupported && isConnected && (
                <span
                  className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                    sensorContactDetected
                      ? "text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                      : "text-amber-500 dark:text-amber-400 bg-amber-500/10 border-amber-500/20"
                  }`}
                >
                  {sensorContactDetected
                    ? language === "id"
                      ? "Kontak Kulit"
                      : "Wrist Contact"
                    : language === "id"
                    ? "Sensor Lepas"
                    : "No Contact"}
                </span>
              )}
            </div>
            <div className={`flex items-center gap-1.5 text-xs font-bold mt-0.5 ${isDark ? "text-white" : "text-slate-900"}`}>
              <span>{deviceName || (language === "id" ? "Smartwatch" : "Smartwatch")}</span>
              <span className="text-gray-400">·</span>
              {isConnected ? (
                <span className="inline-flex items-center gap-1 text-emerald-500 dark:text-emerald-400 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {language === "id" ? "Terhubung" : "Connected"}
                </span>
              ) : isConnecting ? (
                <span className="inline-flex items-center gap-1 text-amber-500 font-bold">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {language === "id" ? "Menghubungkan..." : "Connecting..."}
                </span>
              ) : (
                <span className="text-gray-400 font-medium">
                  {language === "id" ? "Belum terhubung" : "Disconnected"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isConnected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onDisconnect}
              className="h-8 px-3 rounded-xl bg-gray-100 hover:bg-red-500/10 dark:bg-white/5 dark:hover:bg-red-500/20 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 text-xs font-bold transition-all active:scale-95"
            >
              <BluetoothOff className="h-3.5 w-3.5 mr-1" />
              <span>{language === "id" ? "Putuskan" : "Disconnect"}</span>
            </Button>
          ) : isConnecting ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onDisconnect}
              className="h-8 px-3 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              {language === "id" ? "Batal" : "Cancel"}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onConnect}
              className="h-8 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-blue-500/25"
            >
              <BluetoothConnected className="h-3.5 w-3.5 mr-1.5" />
              <span>{language === "id" ? "Hubungkan Smartwatch" : "Connect Smartwatch"}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Error Notice */}
      <AnimatePresence>
        {isError && errorMessage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-2.5 text-xs text-red-600 dark:text-red-300"
          >
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-bold">
                {language === "id" ? "Koneksi Smartwatch Terkendala" : "Smartwatch Connection Issue"}
              </p>
              <p className="text-[11px] text-red-600/80 dark:text-red-300/80 leading-relaxed">
                {errorMessage}
              </p>
              <button
                onClick={onConnect}
                className="text-[11px] font-bold text-red-600 dark:text-red-300 underline hover:no-underline pt-0.5"
              >
                {language === "id" ? "Coba Sambungkan Lagi" : "Retry Connection"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Web Bluetooth Support Notice */}
      {!isSupported && (
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2 text-xs text-amber-600 dark:text-amber-300">
          <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            {language === "id"
              ? "Browser ini belum mendukung Web Bluetooth API secara native. Gunakan Google Chrome pada Android/PC untuk membaca BLE Smartwatch."
              : "Browser does not support Web Bluetooth API. Use Google Chrome on Android or PC for BLE reading."}
          </p>
        </div>
      )}

      {/* 2 & 3 & 4. NILAI BPM AKTUAL, WAKTU UPDATE, & MINI HEART RATE CHART */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
        {/* Left Column: BPM & Status Info */}
        <div className="sm:col-span-5 space-y-1.5">
          <div className="flex items-baseline gap-2">
            <span
              className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${
                isConnected && currentBpm !== null
                  ? isStale
                    ? "text-amber-500 dark:text-amber-300"
                    : "text-gray-900 dark:text-white"
                  : lastValidBpm !== null
                  ? "text-gray-500 dark:text-gray-400"
                  : "text-gray-400 dark:text-gray-600"
              }`}
            >
              {isConnected && currentBpm !== null
                ? currentBpm
                : lastValidBpm !== null
                ? lastValidBpm
                : "--"}
            </span>
            <span className="text-sm font-bold text-gray-500 dark:text-[#B5B9CC] uppercase">
              BPM
            </span>

            {/* Heart Icon / Pulse */}
            <div className="inline-flex items-center ml-1">
              <Heart
                className={`h-5 w-5 ${
                  isConnected && !isStale
                    ? "text-[#FF5A2C] fill-[#FF5A2C] animate-pulse"
                    : "text-gray-400 fill-gray-400/20"
                }`}
              />
            </div>

            {/* Zone Tag */}
            {isConnected && currentZone && (
              <span
                className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${currentZone.bgColor} ${currentZone.color}`}
              >
                {currentZone.zone}
              </span>
            )}
          </div>

          {/* Subtitle / Update Timestamp */}
          <div className="text-xs text-gray-500 dark:text-[#B5B9CC] space-y-0.5">
            {isConnected ? (
              isStale ? (
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
                  <AlertTriangle className="h-3 w-3" />
                  <span>
                    {language === "id"
                      ? `Data tidak terbaru (terakhir ${relativeTimeString || "sebentar lalu"})`
                      : `Stale data (last ${relativeTimeString || "recently"})`}
                  </span>
                </div>
              ) : (
                <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  {language === "id" ? "Live heart rate" : "Live heart rate"}
                  {relativeTimeString ? ` · ${relativeTimeString}` : ""}
                </p>
              )
            ) : lastValidBpm !== null ? (
              <p className="text-[11px]">
                {language === "id"
                  ? `BPM Terakhir tersimpan${relativeTimeString ? ` (${relativeTimeString})` : ""}`
                  : `Last recorded BPM${relativeTimeString ? ` (${relativeTimeString})` : ""}`}
              </p>
            ) : (
              <p className="text-[11px] text-gray-400 leading-snug">
                {language === "id"
                  ? (deviceName ? `Hubungkan ${deviceName} untuk pemantauan detak jantung live.` : "Hubungkan smartwatch untuk pemantauan detak jantung live.")
                  : (deviceName ? `Connect ${deviceName} to monitor live workout heart rate.` : "Connect smartwatch to monitor live workout heart rate.")}
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Mini Heart Rate Chart (Sparkline) */}
        <div
          className={`sm:col-span-7 h-16 relative rounded-2xl p-1 overflow-hidden flex items-center justify-center transition-colors ${
            isDark
              ? "bg-[#090D1E] border border-blue-500/25"
              : "bg-white/90 border-2 border-blue-200/80 shadow-xs"
          }`}
        >
          {chartData.length >= 2 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 2 }}>
                <defs>
                  <linearGradient id="miniHrGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.4} />
                    <stop offset="60%" stopColor="#3B82F6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="bpm"
                  stroke="#FF6B00"
                  strokeWidth={2}
                  fill="url(#miniHrGradient)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div
              className={`flex items-center gap-2 text-[11px] font-medium px-2 ${
                isDark ? "text-blue-300/70" : "text-blue-800/70"
              }`}
            >
              <Activity className="h-3.5 w-3.5 text-blue-500" />
              <span>
                {isConnected
                  ? language === "id"
                    ? "Mengumpulkan data grafik detak jantung..."
                    : "Collecting heart rate data..."
                  : language === "id"
                  ? "Grafik aktif saat jam tersambung"
                  : "Chart plots when connected"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 5. TOMBOL DISCLOSURE "LIHAT DETAIL →" & RIWAYAT UJI */}
      <div className="pt-1 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDetail((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 rounded-lg py-1 px-1.5 -ml-1.5 ${
              isDark
                ? "text-blue-400 hover:text-blue-300"
                : "text-blue-700 hover:text-blue-800"
            }`}
          >
            <span>
              {showDetail
                ? language === "id"
                  ? "Sembunyikan Detail"
                  : "Hide Details"
                : language === "id"
                ? "Lihat Detail"
                : "View Details"}
            </span>
            {showDetail ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5" />
            )}
          </button>

          {onOpenHistory && (
            <button
              type="button"
              onClick={onOpenHistory}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-400 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/25 px-2.5 py-1 rounded-lg transition-all active:scale-95"
            >
              <Heart className="h-3 w-3 fill-rose-500/30" />
              <span>{language === "id" ? "Riwayat Uji & Diagram" : "Tests & Charts"}</span>
            </button>
          )}
        </div>

        {stats.totalSamples > 0 && (
          <span
            className={`text-[10px] font-mono font-medium ${
              isDark ? "text-blue-300/70" : "text-blue-800/70"
            }`}
          >
            {stats.totalSamples} {language === "id" ? "sampel" : "samples"}
          </span>
        )}
      </div>

      {/* EXPANDABLE DETAIL ACCORDION PANEL */}
      <AnimatePresence>
        {showDetail && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className={`pt-3 border-t space-y-4 overflow-hidden ${
              isDark ? "border-blue-500/20" : "border-blue-100"
            }`}
          >
            {/* Interactive Full Chart */}
            <div className="space-y-2">
              <div
                className={`flex items-center justify-between text-xs font-bold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-blue-500" />
                  <span>{language === "id" ? "Grafik Riwayat Sesi" : "Session History Chart"}</span>
                </span>
                {onClearSession && samples.length > 0 && (
                  <button
                    onClick={onClearSession}
                    className="text-[10px] font-bold text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>{language === "id" ? "Reset Sesi" : "Reset Session"}</span>
                  </button>
                )}
              </div>

              <div
                className={`w-full h-44 rounded-2xl p-2 transition-colors ${
                  isDark
                    ? "bg-[#090D1E] border border-blue-500/25"
                    : "bg-white border-2 border-blue-200/80 shadow-xs"
                }`}
              >
                {chartData.length >= 2 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 8, right: 12, left: -20, bottom: 4 }}
                    >
                      <defs>
                        <linearGradient id="fullHrBpmGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 9, fill: isDark ? "#94a3b8" : "#64748b" }}
                        axisLine={{ stroke: isDark ? "rgba(148, 163, 184, 0.2)" : "rgba(100, 116, 139, 0.2)" }}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={yDomain}
                        tick={{ fontSize: 9, fill: isDark ? "#94a3b8" : "#64748b" }}
                        axisLine={{ stroke: isDark ? "rgba(148, 163, 184, 0.2)" : "rgba(100, 116, 139, 0.2)" }}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? "#101935" : "#ffffff",
                          borderColor: isDark ? "rgba(59, 130, 246, 0.3)" : "rgba(59, 130, 246, 0.4)",
                          borderRadius: "0.75rem",
                          fontSize: "11px",
                          color: isDark ? "#ffffff" : "#0f172a",
                          fontWeight: "bold",
                        }}
                        labelStyle={{ color: isDark ? "#93c5fd" : "#1e40af" }}
                        formatter={(val: any) => [`${val} BPM`, "Heart Rate"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="bpm"
                        stroke="#3B82F6"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#fullHrBpmGradient)"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                    <p
                      className={`text-xs font-medium ${
                        isDark ? "text-blue-300/70" : "text-blue-800/70"
                      }`}
                    >
                      {language === "id"
                        ? "Belum ada sampel grafik yang cukup."
                        : "No session samples recorded yet."}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Session Stats Breakdown (Min, Max, Avg) */}
            <div className="grid grid-cols-3 gap-2.5">
              <div
                className={`p-3.5 rounded-2xl space-y-0.5 ${
                  isDark
                    ? "bg-[#101935] border border-blue-500/25"
                    : "bg-blue-50/70 border-2 border-blue-200"
                }`}
              >
                <span
                  className={`text-[9px] font-black uppercase tracking-wider block ${
                    isDark ? "text-blue-400" : "text-blue-700"
                  }`}
                >
                  MIN BPM
                </span>
                <div className="flex items-baseline gap-1">
                  <span
                    className={`text-xl font-black font-mono ${
                      isDark ? "text-blue-300" : "text-blue-900"
                    }`}
                  >
                    {stats.minBpm !== null ? stats.minBpm : "--"}
                  </span>
                  <span className="text-[9px] text-gray-400 font-bold">BPM</span>
                </div>
                <span
                  className={`text-[8px] font-medium block truncate ${
                    isDark ? "text-blue-300/70" : "text-blue-700/70"
                  }`}
                >
                  {language === "id" ? "Terendah" : "Minimum"}
                </span>
              </div>

              <div
                className={`p-3.5 rounded-2xl space-y-0.5 ${
                  isDark
                    ? "bg-[#2A1506] border border-orange-500/30"
                    : "bg-orange-50/70 border-2 border-orange-200"
                }`}
              >
                <span
                  className={`text-[9px] font-black uppercase tracking-wider block ${
                    isDark ? "text-orange-400" : "text-orange-700"
                  }`}
                >
                  PEAK BPM
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black font-mono text-[#FF6B00]">
                    {stats.maxBpm !== null ? stats.maxBpm : "--"}
                  </span>
                  <span className="text-[9px] text-gray-400 font-bold">BPM</span>
                </div>
                <span
                  className={`text-[8px] font-medium block truncate ${
                    isDark ? "text-orange-300/70" : "text-orange-700/70"
                  }`}
                >
                  {language === "id" ? "Maksimum" : "Maximum"}
                </span>
              </div>

              <div
                className={`p-3.5 rounded-2xl space-y-0.5 ${
                  isDark
                    ? "bg-[#101935] border border-blue-500/25"
                    : "bg-indigo-50/70 border-2 border-indigo-200"
                }`}
              >
                <span
                  className={`text-[9px] font-black uppercase tracking-wider block ${
                    isDark ? "text-indigo-400" : "text-indigo-700"
                  }`}
                >
                  AVG BPM
                </span>
                <div className="flex items-baseline gap-1">
                  <span
                    className={`text-xl font-black font-mono ${
                      isDark ? "text-indigo-300" : "text-indigo-900"
                    }`}
                  >
                    {stats.avgBpm !== null ? stats.avgBpm : "--"}
                  </span>
                  <span className="text-[9px] text-gray-400 font-bold">BPM</span>
                </div>
                <span
                  className={`text-[8px] font-medium block truncate ${
                    isDark ? "text-indigo-300/70" : "text-indigo-700/70"
                  }`}
                >
                  {stats.totalSamples >= 2
                    ? `${stats.totalSamples} ${language === "id" ? "sampel" : "samples"}`
                    : "--"}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
