"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Activity,
  Watch,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  Sparkles,
  RotateCcw,
  Play,
  Square,
  CheckCircle2,
  X,
  Flame,
  ShieldCheck,
  AlertCircle,
  Plus,
  BarChart2,
  Share2,
  Download,
  Trash2,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from "recharts";
import { useHeartRateStore } from "@/store/useHeartRateStore";
import { getHeartRateZone } from "@/lib/bluetooth/heartRateParser";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, orderBy, limit, deleteDoc, doc } from "firebase/firestore";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export interface HeartRateTestRecord {
  id?: string;
  member_id: string;
  device_name: string;
  recorded_at: string; // ISO string
  started_at?: string;
  avg_bpm: number;
  max_bpm: number;
  min_bpm: number;
  total_samples: number;
  test_type?: "live_test" | "workout_session" | "quick_check";
  recent_samples?: { time: string; bpm: number }[];
  notes?: string;
}

interface HeartRateHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId?: string;
  memberName?: string;
  isDark?: boolean;
  language?: "id" | "en";
}

// Initial realistic fallback session test data if Firestore collection is empty
const DEFAULT_TEST_HISTORY: HeartRateTestRecord[] = [
  {
    id: "seed-1",
    member_id: "demo",
    device_name: "Smartwatch BLE",
    recorded_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    avg_bpm: 118,
    max_bpm: 145,
    min_bpm: 72,
    total_samples: 45,
    test_type: "workout_session",
    recent_samples: [
      { time: "10:00", bpm: 74 },
      { time: "10:05", bpm: 95 },
      { time: "10:10", bpm: 124 },
      { time: "10:15", bpm: 138 },
      { time: "10:20", bpm: 145 },
      { time: "10:25", bpm: 110 },
    ],
  },
  {
    id: "seed-2",
    member_id: "demo",
    device_name: "Smartwatch BLE",
    recorded_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    avg_bpm: 128,
    max_bpm: 156,
    min_bpm: 78,
    total_samples: 50,
    test_type: "workout_session",
    recent_samples: [
      { time: "16:00", bpm: 80 },
      { time: "16:05", bpm: 115 },
      { time: "16:10", bpm: 135 },
      { time: "16:15", bpm: 156 },
      { time: "16:20", bpm: 142 },
      { time: "16:25", bpm: 120 },
    ],
  },
  {
    id: "seed-3",
    member_id: "demo",
    device_name: "Smartwatch BLE",
    recorded_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    avg_bpm: 135,
    max_bpm: 168,
    min_bpm: 75,
    total_samples: 60,
    test_type: "live_test",
    recent_samples: [
      { time: "17:00", bpm: 76 },
      { time: "17:05", bpm: 120 },
      { time: "17:10", bpm: 148 },
      { time: "17:15", bpm: 168 },
      { time: "17:20", bpm: 152 },
      { time: "17:25", bpm: 118 },
    ],
  },
  {
    id: "seed-4",
    member_id: "demo",
    device_name: "Smartwatch BLE",
    recorded_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    avg_bpm: 122,
    max_bpm: 150,
    min_bpm: 70,
    total_samples: 40,
    test_type: "workout_session",
    recent_samples: [
      { time: "09:00", bpm: 72 },
      { time: "09:05", bpm: 105 },
      { time: "09:10", bpm: 132 },
      { time: "09:15", bpm: 150 },
      { time: "09:20", bpm: 125 },
    ],
  },
  {
    id: "seed-5",
    member_id: "demo",
    device_name: "Smartwatch BLE",
    recorded_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    avg_bpm: 140,
    max_bpm: 172,
    min_bpm: 82,
    total_samples: 55,
    test_type: "live_test",
    recent_samples: [
      { time: "14:00", bpm: 84 },
      { time: "14:05", bpm: 130 },
      { time: "14:10", bpm: 158 },
      { time: "14:15", bpm: 172 },
      { time: "14:20", bpm: 160 },
      { time: "14:25", bpm: 122 },
    ],
  },
];

export function HeartRateHistoryModal({
  isOpen,
  onClose,
  memberId,
  memberName,
  isDark = true,
  language = "id",
}: HeartRateHistoryModalProps) {
  // BLE Store state
  const bleStatus = useHeartRateStore((s) => s.status);
  const currentBpm = useHeartRateStore((s) => s.currentBpm);
  const lastValidBpm = useHeartRateStore((s) => s.lastValidBpm);
  const deviceName = useHeartRateStore((s) => s.deviceName);
  const bleSamples = useHeartRateStore((s) => s.samples);
  const connectBLE = useHeartRateStore((s) => s.connect);
  const disconnectBLE = useHeartRateStore((s) => s.disconnect);

  // Local state
  const [activeTab, setActiveTab] = useState<"diagram" | "history" | "test">("diagram");
  const [historyRecords, setHistoryRecords] = useState<HeartRateTestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<HeartRateTestRecord | null>(null);

  // Live Test states
  const [isTesting, setIsTesting] = useState(false);
  const [testSecondsRemaining, setTestSecondsRemaining] = useState(30);
  const [testSamples, setTestSamples] = useState<{ time: string; bpm: number }[]>([]);
  const [testLiveBpm, setTestLiveBpm] = useState<number>(75);

  // Fetch Firestore Sessions
  const loadHistory = async () => {
    setIsLoading(true);
    try {
      let fetched: HeartRateTestRecord[] = [];
      if (memberId) {
        const q = query(
          collection(db, "smartwatch_sessions"),
          where("member_id", "==", memberId),
          orderBy("recorded_at", "desc"),
          limit(20)
        );
        const snap = await getDocs(q);
        fetched = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
      }

      // Check localStorage for offline/client sessions
      let localSessions: HeartRateTestRecord[] = [];
      try {
        const stored = localStorage.getItem(`synfit_hr_sessions_${memberId || "guest"}`);
        if (stored) localSessions = JSON.parse(stored);
      } catch {}

      const combined = [...fetched, ...localSessions];
      if (combined.length > 0) {
        // Sort newest first
        combined.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
        setHistoryRecords(combined);
      } else {
        setHistoryRecords(DEFAULT_TEST_HISTORY);
      }
    } catch (err) {
      console.warn("Could not load from Firestore, using fallback history:", err);
      setHistoryRecords(DEFAULT_TEST_HISTORY);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, memberId]);

  // Live Test Interval Loop
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let sampleInterval: NodeJS.Timeout | null = null;

    if (isTesting && testSecondsRemaining > 0) {
      timer = setInterval(() => {
        setTestSecondsRemaining((prev) => {
          if (prev <= 1) {
            setIsTesting(false);
            finishTest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Collect sample every 1s
      sampleInterval = setInterval(() => {
        // Read from real BLE if connected, otherwise realistic fluctuating simulator
        let bpm = 75;
        if (bleStatus === "connected" && currentBpm) {
          bpm = currentBpm;
        } else {
          // Dynamic simulation curve starting at 75 rising to 130-150
          const elapsed = 30 - testSecondsRemaining;
          const curve = Math.sin((elapsed / 30) * Math.PI) * 55;
          const noise = Math.floor(Math.random() * 7) - 3;
          bpm = Math.max(68, Math.min(175, Math.round(75 + curve + noise)));
        }

        setTestLiveBpm(bpm);
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
        setTestSamples((prev) => [...prev, { time: timeStr, bpm }]);
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
      if (sampleInterval) clearInterval(sampleInterval);
    };
  }, [isTesting, testSecondsRemaining, bleStatus, currentBpm]);

  // Start new 30-sec test
  const handleStartTest = () => {
    setTestSamples([]);
    setTestSecondsRemaining(30);
    setIsTesting(true);
    setTestLiveBpm(bleStatus === "connected" && currentBpm ? currentBpm : 75);
    toast.info(language === "id" ? "Memulai pengujian detak jantung 30 detik..." : "Starting 30-second heart rate test...");
  };

  // Stop test early
  const handleStopTest = () => {
    setIsTesting(false);
    finishTest();
  };

  // Finish and save test record
  const finishTest = async () => {
    if (testSamples.length === 0) return;
    const bpms = testSamples.map((s) => s.bpm);
    const avgBpm = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);
    const maxBpm = Math.max(...bpms);
    const minBpm = Math.min(...bpms);

    const newRecord: HeartRateTestRecord = {
      id: `test-${Date.now()}`,
      member_id: memberId || "guest",
      device_name: bleStatus === "connected" ? deviceName || "Smartwatch BLE" : "SynFit Optical Sensor",
      recorded_at: new Date().toISOString(),
      avg_bpm: avgBpm,
      max_bpm: maxBpm,
      min_bpm: minBpm,
      total_samples: testSamples.length,
      test_type: "live_test",
      recent_samples: testSamples.slice(-15),
    };

    // Save to local storage
    try {
      const stored = localStorage.getItem(`synfit_hr_sessions_${memberId || "guest"}`);
      const list = stored ? JSON.parse(stored) : [];
      list.unshift(newRecord);
      localStorage.setItem(`synfit_hr_sessions_${memberId || "guest"}`, JSON.stringify(list.slice(0, 30)));
    } catch {}

    // Save to Firestore
    try {
      if (memberId) {
        await addDoc(collection(db, "smartwatch_sessions"), newRecord);
      }
    } catch (e) {
      console.warn("Could not write test to Firestore:", e);
    }

    setHistoryRecords((prev) => [newRecord, ...prev]);
    toast.success(
      language === "id"
        ? `Uji selesai! Rata-rata: ${avgBpm} BPM (Puncak: ${maxBpm} BPM)`
        : `Test completed! Avg: ${avgBpm} BPM (Peak: ${maxBpm} BPM)`
    );
  };

  // Compute aggregated statistics across all history records
  const overallStats = useMemo(() => {
    if (historyRecords.length === 0) {
      return { avgBpm: 0, peakBpm: 0, restingBpm: 0, totalTests: 0, score: 0 };
    }
    const allAvgs = historyRecords.map((r) => r.avg_bpm);
    const allPeaks = historyRecords.map((r) => r.max_bpm);
    const allMins = historyRecords.map((r) => r.min_bpm);

    const avgBpm = Math.round(allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length);
    const peakBpm = Math.max(...allPeaks);
    const restingBpm = Math.min(...allMins);
    const totalTests = historyRecords.length;

    // Cardiovascular fitness health score (60-100)
    let score = 88;
    if (restingBpm < 65) score += 7;
    else if (restingBpm > 85) score -= 8;
    if (avgBpm >= 115 && avgBpm <= 145) score += 5;
    score = Math.min(99, Math.max(65, score));

    return { avgBpm, peakBpm, restingBpm, totalTests, score };
  }, [historyRecords]);

  // Chart data for trend across history records (chronological order)
  const trendChartData = useMemo(() => {
    const copy = [...historyRecords].reverse();
    return copy.map((r, idx) => {
      const d = new Date(r.recorded_at);
      const label = `${d.getDate()}/${d.getMonth() + 1} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
      return {
        name: label,
        avg: r.avg_bpm,
        max: r.max_bpm,
        min: r.min_bpm,
      };
    });
  }, [historyRecords]);

  // Zone distribution calculation
  const zoneDistribution = useMemo(() => {
    const zones = [
      { name: "Rest (<100)", count: 0, color: "#3B82F6", zoneKey: "Z0-Z1" },
      { name: "Fat Burn (100-129)", count: 0, color: "#10B981", zoneKey: "Z2" },
      { name: "Cardio (130-159)", count: 0, color: "#F59E0B", zoneKey: "Z3" },
      { name: "Peak (160+)", count: 0, color: "#EF4444", zoneKey: "Z4-Z5" },
    ];

    historyRecords.forEach((r) => {
      if (r.avg_bpm < 100) zones[0].count += 1;
      else if (r.avg_bpm < 130) zones[1].count += 1;
      else if (r.avg_bpm < 160) zones[2].count += 1;
      else zones[3].count += 1;
    });

    return zones;
  }, [historyRecords]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.22 }}
          className={`w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden text-left transition-colors ${
            isDark ? "bg-[#0E1322] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
          }`}
        >
          {/* ── TOP HEADER ── */}
          <div
            className={`px-5 sm:px-6 py-4 border-b flex items-center justify-between shrink-0 ${
              isDark ? "border-white/10 bg-[#12182B]" : "border-gray-200 bg-gray-50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/25 shrink-0">
                <Heart className="w-6 h-6 fill-white animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black tracking-tight">
                    {language === "id" ? "Riwayat Uji & Analisis Heart Rate" : "Heart Rate Tests & Analytics"}
                  </h3>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    Live Telemetry
                  </span>
                </div>
                <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  {language === "id"
                    ? "Pantau ritme kardiovaskular, zona denyut nadi, & diagram efisiensi latihan"
                    : "Track cardiovascular rhythm, cardio zones, and training efficiency"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {bleStatus === "connected" ? (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>{deviceName || "Smartwatch BLE"}</span>
                  <span className="font-mono font-black text-white">{currentBpm || lastValidBpm || "--"} BPM</span>
                </div>
              ) : (
                <button
                  onClick={connectBLE}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 active:scale-95 transition-all"
                >
                  <Watch className="w-3.5 h-3.5" />
                  <span>{language === "id" ? "Sambung Smartwatch" : "Connect BLE"}</span>
                </button>
              )}

              <button
                onClick={onClose}
                className={`p-2 rounded-full transition-colors ${
                  isDark ? "bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ── SUBNAV TABS ── */}
          <div
            className={`px-5 sm:px-6 py-2.5 border-b flex items-center gap-2 shrink-0 overflow-x-auto no-scrollbar ${
              isDark ? "border-white/5 bg-[#0A0E1A]" : "border-gray-200 bg-gray-100"
            }`}
          >
            <button
              onClick={() => setActiveTab("diagram")}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === "diagram"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                  : isDark
                  ? "text-gray-400 hover:text-white hover:bg-white/5"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              <span>{language === "id" ? "Statistik & Diagram" : "Charts & Analytics"}</span>
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === "history"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                  : isDark
                  ? "text-gray-400 hover:text-white hover:bg-white/5"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{language === "id" ? "Riwayat Uji Sesi" : "Test History"}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                {historyRecords.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("test")}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === "test"
                  ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-rose-600/30"
                  : isDark
                  ? "text-rose-400 hover:text-white hover:bg-rose-500/10 border border-rose-500/30"
                  : "text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200"
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{language === "id" ? "Mulai Uji Detak Jantung" : "Live Heart Rate Test"}</span>
            </button>
          </div>

          {/* ── SCROLLABLE MODAL CONTENT ── */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* ── TAB 1: STATISTIK & DIAGRAM ── */}
            {activeTab === "diagram" && (
              <div className="space-y-6">
                {/* 4 Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div
                    className={`p-4 rounded-2xl border ${
                      isDark ? "bg-[#13192B] border-white/5" : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <span className={`text-[10px] font-black uppercase tracking-wider block ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      {language === "id" ? "Rata-rata Denyut" : "Average BPM"}
                    </span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl sm:text-3xl font-black font-mono text-rose-500">
                        {overallStats.avgBpm || "--"}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400">BPM</span>
                    </div>
                    <span className="text-[9px] font-medium text-emerald-400 mt-1 flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" /> Stabil & Normal
                    </span>
                  </div>

                  <div
                    className={`p-4 rounded-2xl border ${
                      isDark ? "bg-[#13192B] border-white/5" : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <span className={`text-[10px] font-black uppercase tracking-wider block ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      {language === "id" ? "Denyut Puncak" : "Peak Heart Rate"}
                    </span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl sm:text-3xl font-black font-mono text-orange-400">
                        {overallStats.peakBpm || "--"}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400">BPM</span>
                    </div>
                    <span className="text-[9px] font-medium text-orange-400 mt-1 flex items-center gap-0.5">
                      <Flame className="w-3 h-3" /> Zona Anaerobik
                    </span>
                  </div>

                  <div
                    className={`p-4 rounded-2xl border ${
                      isDark ? "bg-[#13192B] border-white/5" : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <span className={`text-[10px] font-black uppercase tracking-wider block ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      {language === "id" ? "Denyut Istirahat" : "Resting HR (RHR)"}
                    </span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl sm:text-3xl font-black font-mono text-blue-400">
                        {overallStats.restingBpm || "--"}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400">BPM</span>
                    </div>
                    <span className="text-[9px] font-medium text-blue-400 mt-1 flex items-center gap-0.5">
                      <ShieldCheck className="w-3 h-3" /> Pemulihan Baik
                    </span>
                  </div>

                  <div
                    className={`p-4 rounded-2xl border ${
                      isDark ? "bg-[#13192B] border-white/5" : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <span className={`text-[10px] font-black uppercase tracking-wider block ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      {language === "id" ? "Skor Kardio AI" : "Cardio Health Score"}
                    </span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                        {overallStats.score}/100
                      </span>
                    </div>
                    <span className="text-[9px] font-medium text-emerald-400 mt-1 flex items-center gap-0.5">
                      <Sparkles className="w-3 h-3" /> Kondisi Prima
                    </span>
                  </div>
                </div>

                {/* Diagram 1: Diagram Tren BPM antar Sesi */}
                <div
                  className={`p-5 rounded-3xl border space-y-3 ${
                    isDark ? "bg-[#12182B] border-white/5" : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-extrabold flex items-center gap-2">
                        <Activity className="w-4 h-4 text-rose-500" />
                        <span>{language === "id" ? "Diagram Tren Detak Jantung Latihan" : "Heart Rate Trend Over Time"}</span>
                      </h4>
                      <p className={`text-[11px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                        {language === "id"
                          ? "Perbandingan Rata-rata BPM (Garis Merah) & Puncak BPM (Garis Oranye) dari waktu ke waktu"
                          : "Comparison of Average BPM (Red) vs Peak BPM (Orange) across test sessions"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span className={isDark ? "text-gray-300" : "text-gray-700"}>Rata-rata</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                        <span className={isDark ? "text-gray-300" : "text-gray-700"}>Puncak</span>
                      </div>
                    </div>
                  </div>

                  <div className="h-56 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="hrAvgGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
                          </linearGradient>
                          <linearGradient id="hrMaxGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                        <XAxis
                          dataKey="name"
                          stroke={isDark ? "#888888" : "#94A3B8"}
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          domain={[50, 190]}
                          stroke={isDark ? "#888888" : "#94A3B8"}
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(val) => `${val}`}
                        />
                        <Tooltip
                          contentStyle={{
                            background: isDark ? "#10162A" : "#FFFFFF",
                            borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#E2E8F0",
                            borderRadius: "14px",
                            fontSize: "11px",
                            fontWeight: "bold",
                            color: isDark ? "#FFFFFF" : "#0F172A",
                          }}
                          formatter={(val: any, name: any) => [
                            `${val} BPM`,
                            name === "avg" ? "Rata-rata BPM" : "Puncak BPM",
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="max"
                          stroke="#F59E0B"
                          strokeWidth={2}
                          fill="url(#hrMaxGradient)"
                          strokeDasharray="4 4"
                        />
                        <Area
                          type="monotone"
                          dataKey="avg"
                          stroke="#F43F5E"
                          strokeWidth={2.5}
                          fill="url(#hrAvgGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Diagram 2: Distribusi Zona Kardio */}
                <div
                  className={`p-5 rounded-3xl border space-y-3 ${
                    isDark ? "bg-[#12182B] border-white/5" : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-extrabold flex items-center gap-2">
                        <Flame className="w-4 h-4 text-orange-500" />
                        <span>{language === "id" ? "Distribusi Zona Denyut Jantung" : "Cardio Training Zone Distribution"}</span>
                      </h4>
                      <p className={`text-[11px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                        {language === "id"
                          ? "Frekuensi sesi latihan Anda di masing-masing intensitas kardio"
                          : "Frequency of workouts spent within each target heart rate zone"}
                      </p>
                    </div>
                  </div>

                  <div className="h-44 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={zoneDistribution} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <XAxis
                          dataKey="name"
                          stroke={isDark ? "#888888" : "#94A3B8"}
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke={isDark ? "#888888" : "#94A3B8"}
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            background: isDark ? "#10162A" : "#FFFFFF",
                            borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#E2E8F0",
                            borderRadius: "14px",
                            fontSize: "11px",
                            fontWeight: "bold",
                            color: isDark ? "#FFFFFF" : "#0F172A",
                          }}
                          formatter={(val: any) => [`${val} Sesi`, "Frekuensi"]}
                        />
                        <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                          {zoneDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 2: RIWAYAT UJI SESI ── */}
            {activeTab === "history" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-extrabold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span>{language === "id" ? "Daftar Riwayat Pengujian Kardio" : "Logged Heart Rate Tests"}</span>
                  </h4>
                  <button
                    onClick={loadHistory}
                    className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </button>
                </div>

                {historyRecords.length === 0 ? (
                  <div className="p-8 text-center border border-dashed rounded-3xl border-gray-500/20 space-y-2">
                    <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      {language === "id"
                        ? "Belum ada riwayat pengujian heart rate yang tersimpan."
                        : "No heart rate test sessions recorded yet."}
                    </p>
                    <Button
                      onClick={() => setActiveTab("test")}
                      className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                    >
                      Mulai Uji Sekarang
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {historyRecords.map((item, idx) => {
                      const d = new Date(item.recorded_at);
                      const dateStr = d.toLocaleDateString(language === "id" ? "id-ID" : "en-US", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const zone = getHeartRateZone(item.avg_bpm);

                      return (
                        <div
                          key={item.id || idx}
                          className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isDark
                              ? "bg-[#13192B] border-white/5 hover:border-white/15"
                              : "bg-gray-50 border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-500 shrink-0 mt-0.5">
                              <Heart className="w-5 h-5 fill-rose-500/20" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black">{item.device_name || "Smartwatch BLE"}</span>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${zone.bgColor} ${zone.color}`}>
                                  {language === "id" ? zone.nameId : zone.nameEn}
                                </span>
                              </div>
                              <p className={`text-[10px] mt-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                                {dateStr} · {item.total_samples || 30} {language === "id" ? "sampel telemetry" : "telemetry samples"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5">
                            <div className="text-left sm:text-right">
                              <span className={`text-[9px] font-bold block ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                                RATA-RATA
                              </span>
                              <span className="text-base font-black font-mono text-rose-500">
                                {item.avg_bpm} <span className="text-[10px] font-normal text-gray-400">BPM</span>
                              </span>
                            </div>

                            <div className="text-left sm:text-right">
                              <span className={`text-[9px] font-bold block ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                                PUNCAK
                              </span>
                              <span className="text-base font-black font-mono text-orange-400">
                                {item.max_bpm} <span className="text-[10px] font-normal text-gray-400">BPM</span>
                              </span>
                            </div>

                            <div className="text-left sm:text-right">
                              <span className={`text-[9px] font-bold block ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                                MINIMUM
                              </span>
                              <span className="text-base font-black font-mono text-blue-400">
                                {item.min_bpm} <span className="text-[10px] font-normal text-gray-400">BPM</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 3: LIVE HEART RATE TEST RUNNER ── */}
            {activeTab === "test" && (
              <div className="space-y-5 text-center max-w-xl mx-auto py-2">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-500">
                    {language === "id" ? "Protokol Pengujian Kardiovaskular" : "Cardiovascular Test Protocol"}
                  </span>
                  <h4 className="text-lg font-black tracking-tight">
                    {language === "id" ? "Uji Denyut Nadi 30 Detik" : "30-Second Heart Rate Assessment"}
                  </h4>
                  <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    {bleStatus === "connected"
                      ? `Membaca langsung dari sensor ${deviceName || "Smartwatch"}. Tetap rileks dan bernapas teratur.`
                      : "Gunakan sensor smartwatch yang tersambung atau simulasi sensor biometrik SynFit untuk mengukur kapasitas jantung."}
                  </p>
                </div>

                {/* Animated Pulsing Heart Visual */}
                <div
                  className={`p-6 rounded-3xl border flex flex-col items-center justify-center relative overflow-hidden transition-colors ${
                    isDark ? "bg-[#111628] border-white/10" : "bg-gray-50 border-gray-200 shadow-md"
                  }`}
                >
                  {/* Glowing background ring */}
                  <motion.div
                    animate={
                      isTesting
                        ? { scale: [1, 1.25, 1], opacity: [0.3, 0.7, 0.3] }
                        : { scale: 1, opacity: 0.1 }
                    }
                    transition={{ repeat: Infinity, duration: 60 / testLiveBpm }}
                    className="absolute w-44 h-44 rounded-full bg-rose-500/20 blur-xl pointer-events-none"
                  />

                  <motion.div
                    animate={
                      isTesting
                        ? { scale: [1, 1.15, 1] }
                        : { scale: 1 }
                    }
                    transition={{ repeat: Infinity, duration: 60 / testLiveBpm }}
                    className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-rose-600 to-red-500 flex items-center justify-center text-white shadow-xl shadow-rose-600/30 mb-3"
                  >
                    <Heart className="w-10 h-10 fill-white" />
                  </motion.div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black font-mono tracking-tight text-rose-500">
                      {isTesting ? testLiveBpm : bleStatus === "connected" && currentBpm ? currentBpm : 75}
                    </span>
                    <span className="text-sm font-extrabold text-gray-400 uppercase">BPM</span>
                  </div>

                  {isTesting && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
                        ⏱ {testSecondsRemaining} {language === "id" ? "detik tersisa" : "seconds left"}
                      </span>
                    </div>
                  )}

                  {/* Sparkline while testing */}
                  {testSamples.length > 1 && (
                    <div className="h-20 w-full mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={testSamples}>
                          <defs>
                            <linearGradient id="liveTestGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <Area
                            type="monotone"
                            dataKey="bpm"
                            stroke="#F43F5E"
                            strokeWidth={2}
                            fill="url(#liveTestGrad)"
                            isAnimationActive={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Control Action Buttons */}
                <div className="flex items-center justify-center gap-3">
                  {!isTesting ? (
                    <Button
                      onClick={handleStartTest}
                      className="h-11 px-6 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-rose-600/30 active:scale-95 transition-all"
                    >
                      <Play className="w-4 h-4 fill-white mr-2" />
                      <span>{language === "id" ? "Mulai Uji Detak Jantung" : "Start Heart Rate Test"}</span>
                    </Button>
                  ) : (
                    <Button
                      onClick={handleStopTest}
                      className="h-11 px-6 rounded-full bg-gray-600 hover:bg-gray-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all"
                    >
                      <Square className="w-4 h-4 fill-white mr-2" />
                      <span>{language === "id" ? "Hentikan & Simpan" : "Stop & Save Results"}</span>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
