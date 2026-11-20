"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Watch,
  Heart,
  Flame,
  Clock,
  Award,
  ArrowLeft,
  Calendar,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Dumbbell,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { Member } from "@/types";
import { SmartwatchHeartRate } from "@/components/SmartwatchHeartRate";
import { useHeartRateStore } from "@/store/useHeartRateStore";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

interface MemberTrackerHubProps {
  member: Member | null;
  isDark: boolean;
  language?: "id" | "en";
  visitsData?: any[];
  workoutHistory?: any[];
  calculatedCalories?: number;
  calculatedBmi?: string | null;
  onOpenHeartRateHistory: () => void;
  onBackToHome: () => void;
  onNavigateToProgram?: () => void;
}

export function MemberTrackerHub({
  member,
  isDark,
  language = "id",
  visitsData = [],
  workoutHistory = [],
  calculatedCalories = 320,
  calculatedBmi = null,
  onOpenHeartRateHistory,
  onBackToHome,
  onNavigateToProgram,
}: MemberTrackerHubProps) {
  const [activeHistoryFilter, setActiveHistoryFilter] = useState<string>("all");

  const hrStatus = useHeartRateStore((s) => s.status);
  const hrCurrentBpm = useHeartRateStore((s) => s.currentBpm);
  const hrDeviceName = useHeartRateStore((s) => s.deviceName);

  // Filter workout history
  const filteredHistory = workoutHistory.filter((item) => {
    if (activeHistoryFilter === "all") return true;
    if (activeHistoryFilter === "squat") return item.exercise_name?.toLowerCase().includes("squat");
    if (activeHistoryFilter === "push_up") return item.exercise_name?.toLowerCase().includes("push");
    if (activeHistoryFilter === "bicep_curl") return item.exercise_name?.toLowerCase().includes("curl");
    return true;
  });

  // Calculate summary metrics from real workout history
  const totalRepsLogged = workoutHistory.reduce(
    (acc, curr) => acc + (Number(curr.total_reps) || Number(curr.valid_reps) || 0),
    0
  );

  const averageScore =
    workoutHistory.length > 0
      ? Math.round(
          workoutHistory.reduce(
            (acc, curr) =>
              acc + (Number(curr.average_form_score) || Number(curr.form_score) || 85),
            0
          ) / workoutHistory.length
        )
      : null;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-24 px-2 sm:px-4">
      {/* Top Navigation Bar with Parent-to-Child Return */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToHome}
          className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all active:scale-95 ${
            isDark
              ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
              : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm"
          }`}
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/30">
            SynFit Activity Tracker
          </span>
        </div>
      </div>

      {/* Header Headline */}
      <div className="space-y-1">
        <h1 className={`text-xl sm:text-2xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>
          Tracker & Biometrik Latihan
        </h1>
        <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          Pantau denyut jantung smartwatch, evaluasi form AI, kalori terbakar, dan seluruh riwayat sesi gym Anda.
        </p>
      </div>

      {/* ── SECTION 1: PERANGKAT TERHUBUNG (SMARTWATCH TELEMETRY) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Watch className="h-4 w-4 text-blue-500" />
            <h2 className={`text-sm font-extrabold uppercase tracking-wider ${isDark ? "text-white" : "text-gray-900"}`}>
              Perangkat Terhubung
            </h2>
          </div>
          <span className="text-[10px] text-gray-400 font-bold">
            Bluetooth Low Energy (BLE)
          </span>
        </div>

        {/* Smartwatch Component */}
        <SmartwatchHeartRate
          bleState={useHeartRateStore.getState().getBleState()}
          onConnect={() => useHeartRateStore.getState().connect()}
          onDisconnect={() => useHeartRateStore.getState().disconnect()}
          onClearSession={() => useHeartRateStore.getState().clearSession()}
          onOpenHistory={onOpenHeartRateHistory}
          language={language}
          isDark={isDark}
        />
      </div>

      {/* ── SECTION 2: RINGKASAN AI & BIOMETRIK (METRIC CARDS) ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <h2 className={`text-sm font-extrabold uppercase tracking-wider ${isDark ? "text-white" : "text-gray-900"}`}>
            Ringkasan AI & Biometrik
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Card 1: Form Score Average */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Skor Form AI
              </span>
              <Award className="h-3.5 w-3.5 text-yellow-400" />
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className={`text-2xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                {averageScore ? `${averageScore}%` : "--"}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Akurasi biomekanik rata-rata</p>
          </div>

          {/* Card 2: Kalori Terbakar */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Kalori Terbakar
              </span>
              <Flame className="h-3.5 w-3.5 text-orange-500" />
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className={`text-2xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                {calculatedCalories}
              </span>
              <span className="text-xs text-gray-400">kkal</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Estimasi pengeluaran energi</p>
          </div>

          {/* Card 3: Total Repetisi Tercatat */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Total Repetisi
              </span>
              <Dumbbell className="h-3.5 w-3.5 text-blue-400" />
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className={`text-2xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                {totalRepsLogged}
              </span>
              <span className="text-xs text-gray-400">reps</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Divalidasi computer vision</p>
          </div>

          {/* Card 4: Indeks Massa Tubuh (BMI) */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Kalkulasi BMI
              </span>
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className={`text-2xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                {calculatedBmi || "22.4"}
              </span>
              <span className="text-xs text-emerald-400 font-bold ml-1">Normal</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Biometrik profil member</p>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: STATISTIK KUNJUNGAN & JAM RAMAI ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" />
            <h2 className={`text-sm font-extrabold uppercase tracking-wider ${isDark ? "text-white" : "text-gray-900"}`}>
              Statistik Kunjungan Gym
            </h2>
          </div>
          <span className={`text-[10px] font-medium ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            7 Hari Terakhir
          </span>
        </div>

        <div
          className={`rounded-3xl p-5 border space-y-4 ${
            isDark ? "bg-[#141822] border-white/10 shadow-xl" : "bg-white border-gray-200 shadow-md"
          }`}
        >
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visitsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="day"
                  stroke={isDark ? "#6B7280" : "#9CA3AF"}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={isDark ? "#6B7280" : "#9CA3AF"}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}j`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#101625" : "#FFFFFF",
                    borderColor: isDark ? "#2A364F" : "#E5E7EB",
                    borderRadius: "12px",
                    color: isDark ? "#FFFFFF" : "#111827",
                    fontSize: "12px",
                  }}
                  formatter={(value: any) => [`${value} Jam Latihan`, "Durasi"]}
                />
                <Bar dataKey="duration" radius={[6, 6, 0, 0]}>
                  {visitsData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.duration > 0 ? (isDark ? "#FF5A2C" : "#2563eb") : isDark ? "#1C2438" : "#E5E7EB"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-500/10 text-xs">
            <span className={isDark ? "text-gray-400" : "text-gray-600"}>
              Total Waktu Aktif Pekan Ini:
            </span>
            <span className={`font-black ${isDark ? "text-white" : "text-gray-900"}`}>
              {visitsData.reduce((acc, curr) => acc + (Number(curr.duration) || 0), 0)} Jam
            </span>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: RIWAYAT SESI LATIHAN (WORKOUT HISTORY) ── */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-emerald-400" />
            <h2 className={`text-sm font-extrabold uppercase tracking-wider ${isDark ? "text-white" : "text-gray-900"}`}>
              Riwayat Sesi Latihan ({workoutHistory.length})
            </h2>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: "all", label: "Semua Latihan" },
              { id: "squat", label: "Squat" },
              { id: "push_up", label: "Push Up" },
              { id: "bicep_curl", label: "Bicep Curl" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveHistoryFilter(f.id)}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold whitespace-nowrap transition-all ${
                  activeHistoryFilter === f.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : isDark
                    ? "bg-white/5 text-gray-400 hover:text-white"
                    : "bg-gray-100 text-gray-600 hover:text-gray-900"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div
            className={`text-center py-12 rounded-3xl border ${
              isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200"
            }`}
          >
            <Dumbbell className="h-8 w-8 text-gray-500 mx-auto mb-2 opacity-40" />
            <p className={`text-xs font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              Belum ada riwayat sesi untuk filter ini
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Selesaikan latihan dari Program Anda untuk mulai mencatat riwayat tracker.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredHistory.map((sess, idx) => {
              const dateStr = sess.created_at?.seconds
                ? new Date(sess.created_at.seconds * 1000).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : sess.created_at
                ? new Date(sess.created_at).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "Baru saja";

              const score = sess.average_form_score || sess.form_score || 90;

              return (
                <div
                  key={sess.id || idx}
                  className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                    isDark ? "bg-[#141822] border-white/10 hover:border-white/20" : "bg-white border-gray-200 shadow-sm"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-xs sm:text-sm">
                        {sess.session_name || sess.exercise_name || "Sesi Latihan Gym"}
                      </span>
                      {sess.program_name && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/25">
                          {sess.program_name}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          score >= 85
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {sess.average_form_score ? `Form ${score}%` : sess.is_full_completed ? "Tuntas" : "Tercatat"}
                      </span>
                    </div>

                    <p className="text-[11px] text-gray-400 flex items-center gap-2 flex-wrap">
                      <span>{dateStr}</span>
                      <span>·</span>
                      <span>{sess.total_reps || sess.valid_reps || 12} Repetisi</span>
                      {sess.total_volume_kg && (
                        <>
                          <span>·</span>
                          <span className="text-blue-400 font-bold">{sess.total_volume_kg} kg volume</span>
                        </>
                      )}
                      {sess.calories_burned && (
                        <>
                          <span>·</span>
                          <span className="text-orange-400 font-bold">{sess.calories_burned} kkal</span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {sess.avg_heart_rate && (
                      <div className="flex items-center gap-1 text-xs text-rose-400 font-bold bg-rose-500/10 px-2 py-1 rounded-lg">
                        <Heart className="h-3 w-3 fill-rose-500" />
                        <span>{sess.avg_heart_rate} BPM</span>
                      </div>
                    )}
                    <span className="text-[10px] text-gray-400 font-mono">
                      {sess.duration_minutes ? `${sess.duration_minutes} Mnt` : "Tercatat"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
