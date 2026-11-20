"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  SlidersHorizontal,
  Calendar,
  CheckCircle2,
  Clock,
  Dumbbell,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  RotateCcw,
  Zap,
  Bot,
  Flame,
  ShieldAlert,
  Play,
  Edit3,
  Trash2,
  Plus,
  RefreshCw,
  Info,
  Check,
  X,
  Target,
  Activity,
  Heart,
  HelpCircle,
  ExternalLink,
  BookOpen,
  Camera,
} from "lucide-react";
import { Member } from "@/types";
import {
  WorkoutProgram,
  ProgramPreferences,
  ProgramRecommendationOption,
  ProgramSession,
  ProgramExercise,
} from "@/types/workoutProgram";
import {
  WORKOUT_EXERCISE_CATALOG,
  getExerciseById,
  getValidExercisesForMuscle,
} from "@/data/workoutExerciseCatalog";
import { EQUIPMENT_TUTORIALS } from "@/data/equipmentTutorials";
import { generateProgramRecommendations } from "@/lib/program/programGenerator";
import { validateProgramStructure } from "@/lib/program/programValidator";
import {
  extractPreferencesFromFreeText,
  ClarificationQuestion,
} from "@/lib/program/aiExtractor";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { toast } from "sonner";
import { useRouter } from "@/lib/navigation";
import {
  formatLocalDate,
  formatDisplayDate,
  computeProgramSchedule,
  addDays,
} from "@/lib/program/programCalendar";
import { IntegratedWorkoutSessionModal } from "./IntegratedWorkoutSessionModal";

interface PersonalWorkoutProgramHubProps {
  member: Member | null;
  session: any;
  isDark: boolean;
  language?: "id" | "en";
  onOpenAiCoach?: (exerciseType?: "squat" | "push_up" | "bicep_curl") => void;
  onBackToHome?: () => void;
}

type BuilderStep =
  | "view_active"
  | "landing"
  | "manual_wizard"
  | "ai_wizard"
  | "recommendations"
  | "editor";

export function PersonalWorkoutProgramHub({
  member,
  session,
  isDark,
  language = "id",
  onOpenAiCoach,
  onBackToHome,
}: PersonalWorkoutProgramHubProps) {
  const router = useRouter();

  // State
  const [viewStep, setViewStep] = useState<BuilderStep>("landing");
  const [activeProgram, setActiveProgram] = useState<WorkoutProgram | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actualLoggedCount, setActualLoggedCount] = useState<number>(0);
  const [showSwitchModal, setShowSwitchModal] = useState<boolean>(false);

  // Manual Wizard State (5 Steps)
  const [manualStep, setManualStep] = useState<number>(1);
  const [preferences, setPreferences] = useState<ProgramPreferences>({
    goal: "hypertrophy",
    goalCustom: "",
    experienceLevel: "pemula",
    daysPerWeek: 3,
    sessionDurationMinutes: 60,
    preferredTime: "pagi",
    facility: "full_gym",
    equipmentAvailable: ["Semua"],
    preferredModality: "combined",
    priorityMuscles: ["Dada", "Bahu"],
    avoidMuscles: [],
    splitPreference: "auto",
    constraints: {
      hasConstraints: false,
      injuredAreas: [],
      notes: "",
    },
  });

  // AI Wizard State
  const [aiPromptText, setAiPromptText] = useState<string>("");
  const [isAiAnalyzing, setIsAiAnalyzing] = useState<boolean>(false);
  const [clarificationQuestions, setClarificationQuestions] = useState<ClarificationQuestion[]>([]);
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, any>>({});
  const [aiExtractionSummary, setAiExtractionSummary] = useState<string | null>(null);

  // Recommendations & Editor State
  const [recommendations, setRecommendations] = useState<ProgramRecommendationOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<ProgramRecommendationOption | null>(null);
  const [customizingProgram, setCustomizingProgram] = useState<WorkoutProgram | null>(null);
  const [programSource, setProgramSource] = useState<"manual" | "ai">("manual");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Exercise Swap Modal State in Editor
  const [swapModalSessionIndex, setSwapModalSessionIndex] = useState<number | null>(null);
  const [swapModalExerciseIndex, setSwapModalExerciseIndex] = useState<number | null>(null);

  // Start Date Picker Modal for Activation / Edit Start Date
  const [showStartDateModal, setShowStartDateModal] = useState<boolean>(false);
  const [selectedStartDate, setSelectedStartDate] = useState<string>(() => formatLocalDate(new Date()));
  const [isEditingActiveStartDate, setIsEditingActiveStartDate] = useState<boolean>(false);

  // Active Program Schedule & Calendar Navigation
  const [viewWeek, setViewWeek] = useState<number>(1);

  // Integrated Workout Session Modal State
  const [activeSessionExecution, setActiveSessionExecution] = useState<{
    session: ProgramSession;
    scheduledDate: string;
    initialExerciseIndex?: number;
    initialMode?: "manual" | "camera";
  } | null>(null);

  // Load Active Program & Actual Tracker Logged Sessions
  useEffect(() => {
    if (!member?.id) {
      setIsLoading(false);
      return;
    }

    const loadProgramData = async () => {
      try {
        setIsLoading(true);

        // 1. Fetch active program from Firestore / Local Cache
        let programFound: WorkoutProgram | null = null;
        try {
          const q = query(
            collection(db, "workout_programs"),
            where("memberId", "==", member.id),
            where("status", "==", "active")
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            const docData = snap.docs[0].data() as WorkoutProgram;
            programFound = { ...docData, id: snap.docs[0].id };
          }
        } catch {
          // Fallback to local cache
        }

        if (!programFound) {
          try {
            const cached = localStorage.getItem(`synfit_active_program_${member.id}`);
            if (cached) {
              programFound = JSON.parse(cached);
            }
          } catch {}
        }

        // 2. Fetch actual completed sessions from tracker (never fabricated!)
        try {
          const qSessions = query(
            collection(db, "workout_sessions"),
            where("member_id", "==", member.id)
          );
          const snapS = await getDocs(qSessions);
          setActualLoggedCount(snapS.size);
        } catch {
          // Local fallback
          try {
            const offline = localStorage.getItem(`synfit_offline_workouts_${member.id}`);
            if (offline) {
              const list = JSON.parse(offline);
              if (Array.isArray(list)) setActualLoggedCount(list.length);
            }
          } catch {}
        }

        if (programFound) {
          setActiveProgram(programFound);
          if (programFound.startDate) {
            setSelectedStartDate(programFound.startDate);
            const sched = computeProgramSchedule(programFound);
            setViewWeek(sched.currentWeek);
          }
          setViewStep("view_active");
        } else {
          setViewStep("landing");
        }
      } catch (err) {
        console.error("Error loading program:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadProgramData();
  }, [member?.id]);

  // Handle Generating Recommendations (Shared by Manual & AI)
  const handleCompileRecommendations = (prefs: ProgramPreferences, source: "manual" | "ai") => {
    setProgramSource(source);
    const recs = generateProgramRecommendations(prefs);
    setRecommendations(recs);
    setSelectedOption(recs[0] || null);
    setViewStep("recommendations");
  };

  // Convert recommendation option to editable WorkoutProgram
  const handleOpenEditor = (option: ProgramRecommendationOption) => {
    if (!member?.id) return;
    const editable: WorkoutProgram = {
      id: "draft-" + Date.now(),
      memberId: member.id,
      name: option.name,
      description: option.description,
      source: programSource,
      status: "draft",
      preferences,
      sessions: JSON.parse(JSON.stringify(option.sessions)),
      currentWeek: 1,
      totalWeeks: 8,
      completedSessionIds: [],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCustomizingProgram(editable);
    setViewStep("editor");
  };

  // Save Program (as Draft or Active)
  const handleSaveProgram = async (status: "draft" | "active") => {
    if (!customizingProgram || !member?.id) return;

    // Validate before committing
    const valResult = validateProgramStructure(customizingProgram.sessions, preferences);
    if (!valResult.isValid) {
      toast.error(valResult.errors[0] || "Struktur program belum memenuhi validasi.");
      return;
    }

    try {
      setIsSaving(true);
      const totalWeeks = customizingProgram.totalWeeks || 8;
      const startDateStr = selectedStartDate || formatLocalDate(new Date());
      const startDateObj = new Date(startDateStr);
      const endDateObj = addDays(startDateObj, totalWeeks * 7 - 1);
      const endDateStr = formatLocalDate(endDateObj);

      const programToSave: WorkoutProgram = {
        ...customizingProgram,
        id: customizingProgram.id.startsWith("draft-")
          ? "prog-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7)
          : customizingProgram.id,
        status,
        startDate: status === "active" ? startDateStr : undefined,
        endDate: status === "active" ? endDateStr : undefined,
        updatedAt: new Date().toISOString(),
        activatedAt: status === "active" ? new Date().toISOString() : undefined,
      };

      // 1. Try server API
      let finalProgram = programToSave;
      try {
        const res = await fetch("/api/member/programs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-member-session-token": session?.token || "",
          },
          body: JSON.stringify(programToSave),
        });
        const data = await res.json();
        if (res.ok && data.success && data.program) {
          finalProgram = data.program;
        }
      } catch (apiErr) {
        console.warn("Server API save notice (will persist via direct Firestore):", apiErr);
      }

      // 2. Direct Firestore persistence (ensures database sync in all environments)
      try {
        if (status === "active") {
          // Archive previous active programs for this specific member in Firestore
          const qExisting = query(
            collection(db, "workout_programs"),
            where("memberId", "==", member.id),
            where("status", "==", "active")
          );
          const snapExisting = await getDocs(qExisting);
          for (const d of snapExisting.docs) {
            if (d.id !== finalProgram.id) {
              await setDoc(
                doc(db, "workout_programs", d.id),
                { status: "archived", archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                { merge: true }
              );
            }
          }
        }
        await setDoc(doc(db, "workout_programs", finalProgram.id), finalProgram);
      } catch (fErr) {
        console.warn("Direct firestore save warning:", fErr);
      }

      // 3. Local storage persistence (instant offline/fast load)
      if (status === "active") {
        localStorage.setItem(
          `synfit_active_program_${member.id}`,
          JSON.stringify(finalProgram)
        );
        setActiveProgram(finalProgram);
        setViewStep("view_active");
        toast.success("ðŸŽ‰ Program latihan resmi Anda telah tersimpan dan aktif!");
      } else {
        localStorage.setItem(
          `synfit_draft_program_${member.id}`,
          JSON.stringify(programToSave)
        );
        toast.success("Draft program berhasil disimpan.");
        setViewStep("landing");
      }
    } catch (e: any) {
      toast.error("Gagal menyimpan program: " + (e.message || "Kesalahan jaringan"));
    } finally {
      setIsSaving(false);
    }
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // RENDER VIEW 1: ACTIVE PROGRAM HUB
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (viewStep === "view_active" && activeProgram) {
    // Compute dynamic schedule
    const schedule = computeProgramSchedule(activeProgram, viewWeek);
    const activeWeek = schedule.activeWeekData;
    const nextSessionSchedule = schedule.nextScheduledDay;

    return (
      <div className="w-full max-w-5xl mx-auto space-y-6 pb-20 px-2 sm:px-4">
        {/* Top Back Navigation to Last Opened View */}
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
        </div>

        {/* Top Active Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                â— Program Aktif
              </span>
              <span className="text-xs text-gray-400 font-bold">
                Versi {activeProgram.version}.0 Â· {activeProgram.source === "ai" ? "SynFit AI" : "Manual"}
              </span>
            </div>
            <h2 className={`text-xl sm:text-2xl font-black mt-1 ${isDark ? "text-white" : "text-gray-900"}`}>
              {activeProgram.name}
            </h2>
            <p className={`text-xs mt-0.5 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              {activeProgram.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setIsEditingActiveStartDate(true);
                setSelectedStartDate(schedule.startDateStr);
                setShowStartDateModal(true);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                isDark
                  ? "bg-white/5 border-white/10 text-gray-200 hover:bg-white/10"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm"
              }`}
            >
              <Calendar className="h-3.5 w-3.5 text-blue-400" />
              <span>Ubah Tanggal Mulai</span>
            </button>
            <button
              onClick={() => {
                setCustomizingProgram(JSON.parse(JSON.stringify(activeProgram)));
                setViewStep("editor");
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                isDark
                  ? "bg-white/5 border-white/10 text-gray-200 hover:bg-white/10"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm"
              }`}
            >
              <Edit3 className="h-3.5 w-3.5 text-blue-400" />
              <span>Edit Gerakan</span>
            </button>
            <button
              onClick={() => setShowSwitchModal(true)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-orange-500/15 border border-orange-500/30 text-[#FF5A2C] hover:bg-orange-500/25 transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Ganti Program</span>
            </button>
          </div>
        </div>

        {/* Real Progress Metrics & Timeline Card */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            className={`p-4 rounded-2xl border ${
              isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Minggu Program
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className={`text-2xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                Minggu {schedule.currentWeek}
              </span>
              <span className="text-xs text-gray-400">/ {schedule.totalWeeks}</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {schedule.daysRemaining > 0 ? `${schedule.daysRemaining} hari tersisa` : "Program Selesai"}
            </p>
          </div>

          <div
            className={`p-4 rounded-2xl border ${
              isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Periode Program
            </span>
            <p className={`text-xs font-black mt-1.5 leading-snug ${isDark ? "text-white" : "text-gray-900"}`}>
              {formatDisplayDate(schedule.startDateStr)} - {formatDisplayDate(schedule.endDateStr)}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">Total {schedule.totalWeeks * 7} hari kalender</p>
          </div>

          <div
            className={`p-4 rounded-2xl border ${
              isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Progres Minggu Ini
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className={`text-2xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                {activeWeek.completedSessionsInWeek}
              </span>
              <span className="text-xs text-gray-400">/ {activeWeek.totalSessionsInWeek} sesi</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {activeWeek.allWeeklySessionsCompleted ? "Target mingguan tercapai!" : "Jadwal sedang berjalan"}
            </p>
          </div>

          <div
            className={`p-4 rounded-2xl border ${
              isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Total Sesi Tercatat
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className={`text-2xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                {actualLoggedCount}
              </span>
              <span className="text-xs text-gray-400">sesi tuntas</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Tersinkronisasi ke Tracker</p>
          </div>
        </div>

        {/* â”€â”€ JADWAL LATIHAN MINGGUAN (CALENDAR WITH PREV/NEXT NAVIGATION) â”€â”€ */}
        <div
          className={`p-5 rounded-3xl border space-y-4 ${
            isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
          }`}
        >
          {/* Week Navigation Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-base font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                  Jadwal Latihan: Minggu {activeWeek.weekNumber} dari {schedule.totalWeeks}
                </h3>
                {activeWeek.isCurrentWeek && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    Minggu Berjalan
                  </span>
                )}
                {activeWeek.allWeeklySessionsCompleted && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Target Tercapai ðŸŽ‰
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatDisplayDate(activeWeek.startDateStr)} â€“ {formatDisplayDate(activeWeek.endDateStr)}
              </p>
            </div>

            {/* Prev / Next Week Navigation */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <button
                disabled={activeWeek.weekNumber <= 1}
                onClick={() => setViewWeek((prev) => Math.max(1, prev - 1))}
                className={`p-2 rounded-xl border text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  isDark ? "border-white/10 hover:bg-white/10 text-white" : "border-gray-200 hover:bg-gray-100 text-gray-800"
                }`}
                title="Minggu Sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewWeek(schedule.currentWeek)}
                className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold ${
                  viewWeek === schedule.currentWeek
                    ? "bg-blue-600 text-white border-blue-600"
                    : isDark
                    ? "border-white/10 text-gray-300 hover:bg-white/5"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                Minggu Ini
              </button>
              <button
                disabled={activeWeek.weekNumber >= schedule.totalWeeks}
                onClick={() => setViewWeek((prev) => Math.min(schedule.totalWeeks, prev + 1))}
                className={`p-2 rounded-xl border text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  isDark ? "border-white/10 hover:bg-white/10 text-white" : "border-gray-200 hover:bg-gray-100 text-gray-800"
                }`}
                title="Minggu Berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 7 Days Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-2.5">
            {activeWeek.days.map((day) => {
              const hasSession = Boolean(day.session);
              const isDone = day.status === "completed";
              const isNext = day.status === "next_workout";
              const isRest = day.status === "rest";
              const isMissed = day.status === "missed";

              return (
                <div
                  key={day.dateStr}
                  className={`p-3 rounded-2xl border flex flex-col justify-between transition-all relative ${
                    isNext
                      ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-950/20 ring-1 ring-blue-500"
                      : isDone
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : isMissed
                      ? "border-amber-500/30 bg-amber-500/5"
                      : isRest
                      ? isDark
                        ? "border-white/5 bg-white/[0.02]"
                        : "border-gray-100 bg-gray-50/50"
                      : isDark
                      ? "border-white/10 bg-[#10141F]"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="space-y-1.5">
                    {/* Day & Date Header */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-gray-400">
                        {day.dayNameShort}
                      </span>
                      <span
                        className={`text-xs font-mono font-bold ${
                          day.isToday ? "text-blue-400 underline font-black" : "text-gray-400"
                        }`}
                      >
                        {day.dateStr.slice(8, 10)}/{day.dateStr.slice(5, 7)}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isDone && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <Check className="h-2.5 w-2.5" /> Selesai
                        </span>
                      )}
                      {isNext && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-500 text-white shadow-sm">
                          <Play className="h-2.5 w-2.5 fill-current" /> Sesi Terdekat
                        </span>
                      )}
                      {isMissed && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          Terlewat
                        </span>
                      )}
                      {day.status === "scheduled" && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-white/5 text-gray-400 border border-white/10">
                          Terjadwal
                        </span>
                      )}
                      {isRest && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-gray-500/10 text-gray-400">
                          Istirahat
                        </span>
                      )}
                    </div>

                    {/* Session Details or Rest Day Message */}
                    {hasSession && day.session ? (
                      <div className="pt-1">
                        <p className={`text-xs font-black leading-tight line-clamp-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                          {day.session.dayName}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">
                          {day.session.focus}
                        </p>
                        <p className="text-[9px] text-gray-500 font-mono mt-1">
                          {day.session.exercises.length} gerakan Â· ~{day.session.estimatedDurationMinutes} mnt
                        </p>
                      </div>
                    ) : (
                      <div className="pt-2 text-center">
                        <span className="text-[10px] text-gray-500 italic block">Recovery Day</span>
                      </div>
                    )}
                  </div>

                  {/* Start Workout Button on Active Session Days */}
                  {hasSession && day.session && (
                    <div className="pt-3">
                      <button
                        onClick={() => {
                          setActiveSessionExecution({
                            session: day.session!,
                            scheduledDate: day.dateStr,
                          });
                        }}
                        className={`w-full py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 transition-all ${
                          isDone
                            ? "bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10"
                            : isNext
                            ? "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/30"
                            : "bg-white/10 hover:bg-white/20 text-white"
                        }`}
                      >
                        <Play className="h-3 w-3 fill-current" />
                        <span>{isDone ? "Ulangi Latihan" : "Mulai Latihan"}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Highlighted Next Session / Execution Card */}
        {nextSessionSchedule && nextSessionSchedule.session && (
          <div
            className={`p-5 sm:p-6 rounded-3xl border relative overflow-hidden transition-all ${
              isDark
                ? "bg-gradient-to-br from-[#12182b] via-[#101424] to-[#0d101c] border-blue-500/30 text-white shadow-xl shadow-blue-950/20"
                : "bg-gradient-to-br from-blue-50 via-indigo-50/50 to-white border-blue-200 text-gray-900 shadow-md"
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-400/30">
                  <Play className="h-2.5 w-2.5 fill-current" /> Latihan Terdekat ({formatDisplayDate(nextSessionSchedule.dateStr)})
                </span>
                <h3 className="text-lg sm:text-xl font-black">{nextSessionSchedule.session.dayName}</h3>
                <p className={`text-xs ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                  Fokus: <strong className="text-blue-400">{nextSessionSchedule.session.focus}</strong> Â· {nextSessionSchedule.session.exercises.length} Gerakan Â· Estimasi ~{nextSessionSchedule.session.estimatedDurationMinutes} Menit
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setActiveSessionExecution({
                      session: nextSessionSchedule.session!,
                      scheduledDate: nextSessionSchedule.dateStr,
                    });
                  }}
                  className="px-5 py-3 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-blue-600/25 hover:bg-blue-500 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Mulai Sesi Latihan</span>
                </button>
              </div>
            </div>

            {/* Exercise preview pills */}
            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {nextSessionSchedule.session.exercises.map((ex, i) => (
                <div
                  key={ex.exerciseId + i}
                  onClick={() => {
                    setActiveSessionExecution({
                      session: nextSessionSchedule.session!,
                      scheduledDate: nextSessionSchedule.dateStr,
                      initialExerciseIndex: i,
                      initialMode: ex.hasAiCoach ? "camera" : "manual",
                    });
                  }}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer hover:border-blue-500/50 transition-all group ${
                    isDark ? "bg-white/5 border-white/10 hover:bg-white/[0.08]" : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                  title="Klik untuk langsung melatih gerakan ini"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-extrabold truncate group-hover:text-blue-400 transition-colors">{ex.name}</p>
                    <p className="text-[10px] text-gray-400">
                      {ex.targetSets} Set Â· {ex.targetReps}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {ex.hasAiCoach && (
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setActiveSessionExecution({
                            session: nextSessionSchedule.session!,
                            scheduledDate: nextSessionSchedule.dateStr,
                            initialExerciseIndex: i,
                            initialMode: "camera",
                          });
                        }}
                        title="Mulai deteksi kamera Live AI untuk gerakan ini"
                        className="px-2 py-1 rounded-lg text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 flex items-center gap-1 transition-all"
                      >
                        <Camera className="h-2.5 w-2.5" />
                        <span>Live AI</span>
                      </button>
                    )}
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        router.push(`/tutorials?id=${ex.equipmentId || "dumbbell"}`);
                      }}
                      title={`Buka Tutorial ${ex.name} (${ex.equipmentName})`}
                      className="p-1 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-white/10 transition-all flex items-center gap-1"
                    >
                      <BookOpen className="h-3 w-3 text-blue-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weekly Sessions Detail Listing */}
        <div className="space-y-3">
          <h3 className={`text-sm font-black uppercase tracking-wider ${isDark ? "text-gray-300" : "text-gray-700"}`}>
            Daftar Gerakan Sesi ({activeProgram.sessions.length} Sesi Terjadwal)
          </h3>

          <div className="space-y-3">
            {activeProgram.sessions.map((sess, idx) => (
              <div
                key={sess.sessionId}
                className={`p-4 rounded-2xl border transition-all ${
                  isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className={`text-sm font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                      {sess.dayName}
                    </h4>
                    <p className="text-[11px] text-gray-400">
                      Fokus: {sess.focus} Â· {sess.exercises.length} Latihan
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      ~{sess.estimatedDurationMinutes} Mnt
                    </span>
                    <button
                      onClick={() => {
                        setActiveSessionExecution({
                          session: sess,
                          scheduledDate: schedule.startDateStr,
                        });
                      }}
                      className="px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      <span>Latih</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {sess.exercises.map((e, eIdx) => (
                    <div
                      key={e.exerciseId + eIdx}
                      onClick={() => {
                        setActiveSessionExecution({
                          session: sess,
                          scheduledDate: schedule.startDateStr,
                          initialExerciseIndex: eIdx,
                          initialMode: e.hasAiCoach ? "camera" : "manual",
                        });
                      }}
                      className={`p-2 rounded-xl text-xs border flex items-center justify-between cursor-pointer transition-all group ${
                        isDark ? "bg-[#090B10] border-white/5 hover:border-blue-500/40 hover:bg-white/[0.04]" : "bg-gray-50 border-gray-100 hover:border-blue-300 hover:bg-blue-50/30"
                      }`}
                      title="Klik untuk langsung melatih gerakan ini"
                    >
                      <div className="flex items-center gap-1.5 truncate pr-1">
                        <span className="truncate font-medium group-hover:text-blue-400 transition-colors">{e.name}</span>
                        {e.hasAiCoach && (
                          <button
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setActiveSessionExecution({
                                session: sess,
                                scheduledDate: schedule.startDateStr,
                                initialExerciseIndex: eIdx,
                                initialMode: "camera",
                              });
                            }}
                            title="Latih dengan Live AI Camera"
                            className="p-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 shrink-0"
                          >
                            <Camera className="h-2.5 w-2.5" />
                          </button>
                        )}
                        <button
                          onClick={(ev) => {
                            ev.stopPropagation();
                            router.push(`/tutorials?id=${e.equipmentId || "dumbbell"}`);
                          }}
                          title={`Tutorial ${e.equipmentName}`}
                          className="text-gray-400 hover:text-blue-400 shrink-0"
                        >
                          <BookOpen className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {e.targetSets}x{e.targetReps.replace(" reps", "")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Integrated Workout Session Active Modal Launcher */}
        <AnimatePresence>
          {member && activeSessionExecution && (
            <IntegratedWorkoutSessionModal
              member={member}
              sessionObj={activeSessionExecution.session}
              programId={activeProgram.id}
              programName={activeProgram.name}
              scheduledDate={activeSessionExecution.scheduledDate}
              isDark={isDark}
              language={language}
              initialExerciseIndex={activeSessionExecution.initialExerciseIndex}
              initialMode={activeSessionExecution.initialMode}
              onClose={() => setActiveSessionExecution(null)}
              onFinishSession={async (result) => {
                setActiveSessionExecution(null);
                // Update program completedSessionIds and sessionHistory without duplicate records
                try {
                  const updatedHistory = [...(activeProgram.sessionHistory || [])];
                  const existingIdx = updatedHistory.findIndex(
                    (h) => h.sessionId === result.sessionId && h.scheduledDate === result.scheduledDate
                  );

                  const historyEntry = {
                    sessionId: result.sessionId,
                    scheduledDate: result.scheduledDate,
                    actualDate: result.actualDate,
                    actualCompletedAt: new Date().toISOString(),
                    workoutSessionDocId: result.workoutSessionDocId,
                    status: "completed" as const,
                  };

                  if (existingIdx >= 0) {
                    updatedHistory[existingIdx] = historyEntry;
                  } else {
                    updatedHistory.push(historyEntry);
                  }

                  const updatedCompletedIds = Array.from(
                    new Set([...(activeProgram.completedSessionIds || []), result.sessionId])
                  );

                  const updatedProg: WorkoutProgram = {
                    ...activeProgram,
                    completedSessionIds: updatedCompletedIds,
                    sessionHistory: updatedHistory,
                    updatedAt: new Date().toISOString(),
                  };

                  setActiveProgram(updatedProg);
                  setActualLoggedCount((prev) => prev + 1);

                  // Persist to local & Firestore
                  if (member?.id) {
                    localStorage.setItem(`synfit_active_program_${member.id}`, JSON.stringify(updatedProg));
                  }
                  try {
                    await setDoc(doc(db, "workout_programs", updatedProg.id), updatedProg);
                  } catch {}

                  toast.success("Kalender program latihan diperbarui dengan sesi yang tuntas!");
                } catch (updateErr) {
                  console.error("Failed to update program session history:", updateErr);
                }
              }}
            />
          )}
        </AnimatePresence>

        {/* Modal: Ubah Tanggal Mulai Program */}
        <AnimatePresence>
          {showStartDateModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[150] flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
                  isDark ? "bg-[#141822] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
                }`}
              >
                <div className={`flex items-center justify-between pb-2 border-b ${isDark ? "border-white/10" : "border-gray-200"}`}>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    <h3 className="text-base font-black">
                      {isEditingActiveStartDate ? "Ubah Tanggal Mulai Program" : "Tentukan Tanggal Mulai"}
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowStartDateModal(false)}
                    className={`p-1 rounded-full ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <p className={`leading-relaxed ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    Pilih tanggal mulai program latihan Anda. Kalender mingguan, hari latihan, dan hari istirahat akan otomatis dihitung secara akurat.
                  </p>

                  <div className="space-y-1">
                    <label className={`text-[10px] font-bold uppercase ${isDark ? "text-gray-400" : "text-gray-700"}`}>Tanggal Mulai (Local Date):</label>
                    <input
                      type="date"
                      value={selectedStartDate}
                      onChange={(e) => setSelectedStartDate(e.target.value)}
                      className={`w-full p-3 rounded-2xl border text-sm font-bold outline-none ${
                        isDark ? "bg-[#0A0D14] border-white/10 text-white" : "bg-gray-50 border-gray-300 text-gray-900"
                      }`}
                    />
                  </div>

                  {selectedStartDate && (
                    <div className={`p-3 rounded-2xl border space-y-1 text-[11px] ${
                      isDark ? "border-blue-500/20 bg-blue-500/10 text-blue-300" : "border-blue-200 bg-blue-50 text-blue-900"
                    }`}>
                      <p>
                        <strong>Tanggal Mulai:</strong> {formatDisplayDate(selectedStartDate)}
                      </p>
                      <p>
                        <strong>Estimasi Selesai (8 Minggu):</strong>{" "}
                        {formatDisplayDate(formatLocalDate(addDays(new Date(selectedStartDate), 8 * 7 - 1)))}
                      </p>
                    </div>
                  )}

                  {isEditingActiveStartDate && actualLoggedCount > 0 && (
                    <div className={`p-3 rounded-2xl border text-[11px] ${
                      isDark ? "border-amber-500/20 bg-amber-500/10 text-amber-300" : "border-amber-200 bg-amber-50 text-amber-900"
                    }`}>
                      âš ï¸ <strong>Catatan:</strong> Mengubah tanggal mulai tidak akan menghapus riwayat sesi latihan yang telah Anda selesaikan di Tracker.
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowStartDateModal(false)}
                    className={`flex-1 py-2.5 rounded-xl border text-xs font-bold ${
                      isDark ? "border-white/10 text-gray-300" : "border-gray-200 text-gray-700"
                    }`}
                  >
                    Batal
                  </button>
                  <button
                    onClick={async () => {
                      if (!selectedStartDate) {
                        toast.error("Pilih tanggal mulai yang valid.");
                        return;
                      }

                      if (isEditingActiveStartDate && activeProgram) {
                        const totalWeeks = activeProgram.totalWeeks || 8;
                        const startDateObj = new Date(selectedStartDate);
                        const endDateObj = addDays(startDateObj, totalWeeks * 7 - 1);
                        const endDateStr = formatLocalDate(endDateObj);

                        const updated: WorkoutProgram = {
                          ...activeProgram,
                          startDate: selectedStartDate,
                          endDate: endDateStr,
                          updatedAt: new Date().toISOString(),
                        };

                        setActiveProgram(updated);
                        if (member?.id) {
                          localStorage.setItem(`synfit_active_program_${member.id}`, JSON.stringify(updated));
                        }
                        try {
                          await setDoc(doc(db, "workout_programs", updated.id), updated);
                        } catch {}

                        const sched = computeProgramSchedule(updated);
                        setViewWeek(sched.currentWeek);
                        toast.success("Tanggal mulai dan kalender program berhasil diperbarui!");
                      } else {
                        // Triggered during activation
                        await handleSaveProgram("active");
                      }
                      setShowStartDateModal(false);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md shadow-blue-900/30"
                  >
                    {isEditingActiveStartDate ? "Simpan Perubahan" : "Konfirmasi & Aktifkan"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirmation Modal for Switching Program */}
        <AnimatePresence>
          {showSwitchModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className={`p-6 rounded-3xl border w-full max-w-md space-y-4 shadow-2xl relative ${
                  isDark ? "bg-[#141822] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-[#FF5A2C] flex items-center justify-center mx-auto">
                  <RotateCcw className="h-6 w-6" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-black">Ganti Program Latihan?</h3>
                  <p className="text-xs text-gray-400">
                    Program aktif saat ini akan diarsipkan. Seluruh riwayat sesi latihan dan data Tracker Anda yang sudah tercatat sebelumnya <strong>tetap aman dan tidak akan dihapus</strong>.
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowSwitchModal(false)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold border ${
                      isDark ? "border-white/10 text-gray-300" : "border-gray-200 text-gray-700"
                    }`}
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => {
                      setShowSwitchModal(false);
                      setViewStep("landing");
                    }}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#FF5A2C] text-white shadow-md shadow-orange-950/30 hover:bg-orange-600"
                  >
                    Lanjutkan Ganti
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // RENDER VIEW 2: LANDING (Build Your Own Program - Two Choice Cards)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (viewStep === "landing") {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6 pb-20 px-2 sm:px-4 text-center">
        {/* Top Back Navigation to Last Opened View */}
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

          {activeProgram && (
            <button
              onClick={() => setViewStep("view_active")}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                isDark ? "border-white/10 text-gray-300 hover:text-white" : "border-gray-200 text-gray-700 hover:text-gray-900"
              }`}
            >
              <span>Lihat Program Aktif</span>
            </button>
          )}
        </div>

        {/* Main Headline & Subheadline */}
        <div className="space-y-2 pt-2">
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
            SynFit Workout Architecture
          </span>
          <h1 className={`text-2xl sm:text-4xl font-black tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
            Build Your Own Program
          </h1>
          <p className={`text-xs sm:text-sm max-w-md mx-auto ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Rancang latihan sesuai tujuan, waktu, dan kebutuhanmu.
          </p>
        </div>

        {/* Two Main Cards: Manual vs AI */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-4 text-left">
          {/* Card A: Buat Program Manual */}
          <motion.div
            whileHover={{ y: -4 }}
            className={`rounded-3xl p-6 border flex flex-col justify-between transition-all relative overflow-hidden group shadow-lg ${
              isDark
                ? "bg-[#141822] border-white/10 hover:border-blue-500/50"
                : "bg-white border-gray-200 hover:border-blue-400 shadow-gray-200/50"
            }`}
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <SlidersHorizontal className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className={`text-lg font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                  Buat Program Manual
                </h3>
                <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  Atur sendiri tujuan, jadwal, dan preferensi latihanmu.
                </p>
              </div>

              <ul className={`space-y-2 text-xs pt-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <span>Formulir wizard bertahap 5 langkah ringkas</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <span>Pilih jadwal 2â€“6 hari & durasi fleksibel</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <span>Tetapkan prioritas otot dan batasan gerak</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => {
                setManualStep(1);
                setViewStep("manual_wizard");
              }}
              className="mt-6 w-full py-3 rounded-2xl font-extrabold text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/30 transition-all flex items-center justify-center gap-2 active:scale-98"
            >
              <span>Buat Manual</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </motion.div>

          {/* Card B: Buat Program dengan AI */}
          <motion.div
            whileHover={{ y: -4 }}
            className={`rounded-3xl p-6 border flex flex-col justify-between transition-all relative overflow-hidden group shadow-lg ${
              isDark
                ? "bg-gradient-to-br from-[#16152b] via-[#141822] to-[#101424] border-purple-500/30 hover:border-purple-400/60"
                : "bg-gradient-to-br from-purple-50/50 via-white to-indigo-50/40 border-purple-200 hover:border-purple-400 shadow-purple-100"
            }`}
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <h3 className={`text-lg font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                    Buat Program dengan AI
                  </h3>
                  <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-purple-500/20 text-purple-300 uppercase">
                    Smart
                  </span>
                </div>
                <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  Ceritakan tujuanmu dan dapatkan rekomendasi program yang sesuai.
                </p>
              </div>

              <ul className={`space-y-2 text-xs pt-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                  <span>Input bahasa bebas seperti berbicara dengan coach</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                  <span>Ekstraksi kebutuhan cerdas & klarifikasi adaptif</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                  <span>2â€“3 opsi program terverifikasi katalog SynFit</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => {
                setAiPromptText("");
                setClarificationQuestions([]);
                setClarificationAnswers({});
                setAiExtractionSummary(null);
                setViewStep("ai_wizard");
              }}
              className="mt-6 w-full py-3 rounded-2xl font-extrabold text-xs bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:opacity-95 text-white shadow-md shadow-purple-900/30 transition-all flex items-center justify-center gap-2 active:scale-98"
            >
              <span>Buat dengan AI</span>
              <Sparkles className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // RENDER VIEW 3: MANUAL WIZARD (5 STEPS)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (viewStep === "manual_wizard") {
    const goalsList = [
      { id: "hypertrophy", label: "Membangun massa otot", desc: "Membentuk ukuran dan definisi serat otot" },
      { id: "strength", label: "Meningkatkan kekuatan", desc: "Fokus peningkatan beban angkatan dan power" },
      { id: "fat_loss", label: "Mengurangi lemak tubuh", desc: "Kombinasi latihan beban dan pembakaran kalori" },
      { id: "endurance", label: "Meningkatkan stamina & kebugaran", desc: "Kebugaran kardiovaskular dan daya tahan tubuh" },
      { id: "habit", label: "Membangun kebiasaan latihan", desc: "Konsistensi gym teratur ramah pemula" },
      { id: "other", label: "Tujuan lainnya", desc: "Tuliskan tujuan spesifik personal Anda" },
    ];

    return (
      <div className="w-full max-w-2xl mx-auto space-y-6 pb-20 px-2 sm:px-4">
        {/* Wizard Header & Stepper */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              if (manualStep > 1) setManualStep((s) => s - 1);
              else setViewStep("landing");
            }}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
              isDark ? "border-white/10 text-gray-300" : "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{manualStep > 1 ? "Kembali" : "Batal"}</span>
          </button>
          <span className="text-xs font-extrabold text-blue-500">
            Langkah {manualStep} dari 5
          </span>
        </div>

        {/* Progress Dots */}
        <div className="grid grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5].map((step) => (
            <div
              key={step}
              className={`h-1.5 rounded-full transition-all ${
                manualStep >= step ? "bg-blue-600" : isDark ? "bg-white/10" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Tujuan Latihan */}
        {manualStep === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className={`text-xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                Apa tujuan utama latihanmu?
              </h2>
              <p className={`text-xs mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Pilih satu target utama yang ingin kamu capai dalam periode program ini.
              </p>
            </div>

            <div className="space-y-2">
              {goalsList.map((g) => (
                <div
                  key={g.id}
                  onClick={() => setPreferences((p) => ({ ...p, goal: g.id as any }))}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    preferences.goal === g.id
                      ? isDark
                        ? "border-blue-500 bg-blue-500/10 text-white"
                        : "border-blue-500 bg-blue-50/90 text-blue-950 shadow-sm"
                      : isDark
                      ? "border-white/10 bg-[#141822] hover:border-white/20 text-gray-300"
                      : "border-gray-200 bg-white hover:border-gray-300 text-gray-800"
                  }`}
                >
                  <div>
                    <p
                      className={`font-extrabold text-xs ${
                        preferences.goal === g.id
                          ? isDark
                            ? "text-white"
                            : "text-blue-950 font-black"
                          : isDark
                          ? "text-gray-200"
                          : "text-gray-900"
                      }`}
                    >
                      {g.label}
                    </p>
                    <p
                      className={`text-[11px] mt-0.5 ${
                        preferences.goal === g.id
                          ? isDark
                            ? "text-blue-200"
                            : "text-blue-700 font-semibold"
                          : isDark
                          ? "text-gray-400"
                          : "text-gray-500"
                      }`}
                    >
                      {g.desc}
                    </p>
                  </div>
                  {preferences.goal === g.id && (
                    <CheckCircle2 className={`h-4 w-4 shrink-0 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
                  )}
                </div>
              ))}
            </div>

            {preferences.goal === "other" && (
              <input
                type="text"
                placeholder="Deskripsikan tujuan spesifikmu..."
                value={preferences.goalCustom || ""}
                onChange={(e) => setPreferences((p) => ({ ...p, goalCustom: e.target.value }))}
                className={`w-full p-3 rounded-xl border text-xs outline-none ${
                  isDark ? "bg-[#141822] border-white/10 text-white" : "bg-white border-gray-300 text-gray-900"
                }`}
              />
            )}
          </div>
        )}

        {/* Step 2: Profil Latihan */}
        {manualStep === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className={`text-xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                Profil dan Waktu Latihan
              </h2>
              <p className={`text-xs mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Tentukan ketersediaan hari dan durasi per sesi.
              </p>
            </div>

            {/* Experience Level */}
            <div className="space-y-2">
              <label className={`text-xs font-bold ${isDark ? "text-gray-400" : "text-gray-700"}`}>
                Tingkat Pengalaman
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "pemula", label: "Pemula", sub: "0 - 6 bulan" },
                  { id: "menengah", label: "Menengah", sub: "6 - 24 bulan" },
                  { id: "lanjutan", label: "Lanjutan", sub: "2+ tahun" },
                ].map((lvl) => (
                  <button
                    key={lvl.id}
                    onClick={() => setPreferences((p) => ({ ...p, experienceLevel: lvl.id as any }))}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      preferences.experienceLevel === lvl.id
                        ? isDark
                          ? "border-blue-500 bg-blue-500/10 text-white"
                          : "border-blue-500 bg-blue-50/90 text-blue-950 shadow-sm"
                        : isDark
                        ? "border-white/10 bg-[#141822] text-gray-400"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <p
                      className={`font-extrabold text-xs ${
                        preferences.experienceLevel === lvl.id
                          ? isDark
                            ? "text-white"
                            : "text-blue-950 font-black"
                          : isDark
                          ? "text-gray-200"
                          : "text-gray-800"
                      }`}
                    >
                      {lvl.label}
                    </p>
                    <p
                      className={`text-[10px] ${
                        preferences.experienceLevel === lvl.id
                          ? isDark
                            ? "text-blue-200"
                            : "text-blue-700 font-semibold"
                          : isDark
                          ? "text-gray-400"
                          : "text-gray-500"
                      }`}
                    >
                      {lvl.sub}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Days per week */}
            <div className="space-y-2">
              <label className={`text-xs font-bold ${isDark ? "text-gray-400" : "text-gray-700"}`}>
                Hari Latihan per Minggu
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[2, 3, 4, 5, 6].map((d) => (
                  <button
                    key={d}
                    onClick={() => setPreferences((p) => ({ ...p, daysPerWeek: d }))}
                    className={`py-3 rounded-2xl border font-black text-sm transition-all ${
                      preferences.daysPerWeek === d
                        ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                        : isDark
                        ? "border-white/10 bg-[#141822] text-gray-400 hover:border-white/20"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {d} Hari
                  </button>
                ))}
              </div>
            </div>

            {/* Session duration */}
            <div className="space-y-2">
              <label className={`text-xs font-bold ${isDark ? "text-gray-400" : "text-gray-700"}`}>
                Durasi Tersedia per Sesi
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[30, 45, 60, 90].map((dur) => (
                  <button
                    key={dur}
                    onClick={() => setPreferences((p) => ({ ...p, sessionDurationMinutes: dur }))}
                    className={`py-3 rounded-2xl border font-black text-xs transition-all ${
                      preferences.sessionDurationMinutes === dur
                        ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                        : isDark
                        ? "border-white/10 bg-[#141822] text-gray-400 hover:border-white/20"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {dur} Menit
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Fasilitas dan Preferensi */}
        {manualStep === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className={`text-xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                Fasilitas dan Fokus Otot
              </h2>
              <p className={`text-xs mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Pilih peralatan yang tersedia dan kelompok otot yang diprioritaskan.
              </p>
            </div>

            {/* Modality preference */}
            <div className="space-y-2">
              <label className={`text-xs font-bold ${isDark ? "text-gray-400" : "text-gray-700"}`}>
                Preferensi Alat
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "combined", label: "Kombinasi (Mesin + Free Weights)" },
                  { id: "machines", label: "Hanya Mesin Gym Terpandu" },
                  { id: "freeweights", label: "Dominan Free Weights (Dumbbell/Barbell)" },
                  { id: "bodyweight", label: "Bodyweight & Kalistenik" },
                ].map((mod) => (
                  <button
                    key={mod.id}
                    onClick={() => setPreferences((p) => ({ ...p, preferredModality: mod.id as any }))}
                    className={`p-3 rounded-2xl border text-left text-xs font-bold transition-all ${
                      preferences.preferredModality === mod.id
                        ? isDark
                          ? "border-blue-500 bg-blue-500/10 text-white"
                          : "border-blue-500 bg-blue-50/90 text-blue-950 font-black shadow-sm"
                        : isDark
                        ? "border-white/10 bg-[#141822] text-gray-400"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {mod.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority muscles */}
            <div className="space-y-2">
              <label className={`text-xs font-bold ${isDark ? "text-gray-400" : "text-gray-700"}`}>
                Kelompok Otot Prioritas (Pilih 1â€“3)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["Dada", "Bahu", "Punggung", "Kaki", "Lengan", "Core"].map((m) => {
                  const isSelected = preferences.priorityMuscles.includes(m);
                  return (
                    <button
                      key={m}
                      onClick={() => {
                        setPreferences((p) => {
                          const cur = p.priorityMuscles;
                          return {
                            ...p,
                            priorityMuscles: isSelected
                              ? cur.filter((x) => x !== m)
                              : [...cur, m],
                          };
                        });
                      }}
                      className={`py-2.5 px-3 rounded-2xl border text-xs font-extrabold transition-all flex items-center justify-between ${
                        isSelected
                          ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                          : isDark
                          ? "border-white/10 bg-[#141822] text-gray-400 hover:border-white/20"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <span>{m}</span>
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Batasan dan Keselamatan */}
        {manualStep === 4 && (
          <div className="space-y-4">
            <div>
              <h2 className={`text-xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                Batasan dan Keselamatan Gerak
              </h2>
              <p className={`text-xs mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Informasikan jika ada area tubuh yang perlu dihindari dari tekanan berlebih.
              </p>
            </div>

            <div className="space-y-2">
              {[
                { id: "none", label: "Tidak ada batasan, siap latihan penuh" },
                { id: "bahu", label: "Ada nyeri/keterbatasan pada bahu" },
                { id: "lutut", label: "Ada riwayat nyeri lutut (hindari impact tinggi)" },
                { id: "pinggang", label: "Ada keluhan pinggang/punggung bawah" },
                { id: "pergelangan", label: "Pergelangan tangan sensitif beban dorong" },
              ].map((c) => {
                const isNone = c.id === "none";
                const isSelected = isNone
                  ? !preferences.constraints.hasConstraints
                  : (preferences.constraints.injuredAreas || []).includes(c.id);

                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      if (isNone) {
                        setPreferences((p) => ({
                          ...p,
                          constraints: { hasConstraints: false, injuredAreas: [], notes: "" },
                        }));
                      } else {
                        setPreferences((p) => {
                          const old = p.constraints.injuredAreas || [];
                          const updated = old.includes(c.id)
                            ? old.filter((x) => x !== c.id)
                            : [...old, c.id];
                          return {
                            ...p,
                            constraints: {
                              hasConstraints: updated.length > 0,
                              injuredAreas: updated,
                              notes: p.constraints.notes,
                            },
                          };
                        });
                      }
                    }}
                    className={`p-3.5 rounded-2xl border cursor-pointer text-xs font-bold transition-all flex items-center justify-between ${
                      isSelected
                        ? isDark
                          ? "border-blue-500 bg-blue-500/10 text-white"
                          : "border-blue-500 bg-blue-50/90 text-blue-950 font-black shadow-sm"
                        : isDark
                        ? "border-white/10 bg-[#141822] text-gray-400 hover:border-white/20"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <span>{c.label}</span>
                    {isSelected && (
                      <Check className={`h-4 w-4 shrink-0 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Safety Disclaimer Banner */}
            <div
              className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
                isDark
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              <ShieldAlert className={`h-4 w-4 shrink-0 mt-0.5 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
              <p className="leading-relaxed text-[11px]">
                <strong>Catatan Keselamatan:</strong> SynFit tidak membuat klaim atau diagnosis medis. Jika Anda memiliki riwayat cedera tulang atau penyakit kronis, konsultasikan dengan dokter atau pelatih spesialis sebelum mengangkat beban berat.
              </p>
            </div>
          </div>
        )}

        {/* Step 5: Review Kebutuhan */}
        {manualStep === 5 && (
          <div className="space-y-4">
            <div>
              <h2 className={`text-xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                Review Kebutuhan Program
              </h2>
              <p className={`text-xs mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Periksa rangkuman parameter latihan Anda sebelum SynFit menyusun program.
              </p>
            </div>

            <div
              className={`p-5 rounded-3xl border space-y-3.5 text-xs ${
                isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
              }`}
            >
              <div className={`flex justify-between items-center pb-2 border-b ${isDark ? "border-white/10" : "border-gray-100"}`}>
                <span className={isDark ? "text-gray-400" : "text-gray-500"}>Tujuan Latihan</span>
                <span className={`font-extrabold capitalize ${isDark ? "text-blue-400" : "text-blue-600"}`}>{preferences.goal}</span>
              </div>
              <div className={`flex justify-between items-center pb-2 border-b ${isDark ? "border-white/10" : "border-gray-100"}`}>
                <span className={isDark ? "text-gray-400" : "text-gray-500"}>Pengalaman</span>
                <span className={`font-extrabold capitalize ${isDark ? "text-white" : "text-gray-900"}`}>{preferences.experienceLevel}</span>
              </div>
              <div className={`flex justify-between items-center pb-2 border-b ${isDark ? "border-white/10" : "border-gray-100"}`}>
                <span className={isDark ? "text-gray-400" : "text-gray-500"}>Jadwal & Durasi</span>
                <span className={`font-extrabold ${isDark ? "text-white" : "text-gray-900"}`}>
                  {preferences.daysPerWeek} Hari / Minggu Â· {preferences.sessionDurationMinutes} Menit
                </span>
              </div>
              <div className={`flex justify-between items-center pb-2 border-b ${isDark ? "border-white/10" : "border-gray-100"}`}>
                <span className={isDark ? "text-gray-400" : "text-gray-500"}>Fokus Otot</span>
                <span className={`font-extrabold ${isDark ? "text-white" : "text-gray-900"}`}>
                  {preferences.priorityMuscles.join(", ") || "Seimbang"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className={isDark ? "text-gray-400" : "text-gray-500"}>Batasan / Cedera</span>
                <span className={`font-extrabold ${isDark ? "text-white" : "text-gray-900"}`}>
                  {preferences.constraints.hasConstraints
                    ? preferences.constraints.injuredAreas?.join(", ")
                    : "Tidak ada batasan"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Footer CTA */}
        <div className="flex items-center gap-3 pt-2">
          {manualStep < 5 ? (
            <button
              onClick={() => setManualStep((s) => s + 1)}
              className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md shadow-blue-900/30 transition-all flex items-center justify-center gap-2"
            >
              <span>Lanjutkan</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => handleCompileRecommendations(preferences, "manual")}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-black text-xs shadow-lg shadow-blue-900/30 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              <span>Susun Rekomendasi Program</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // RENDER VIEW 4: AI CONVERSATIONAL WIZARD
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (viewStep === "ai_wizard") {
    const examplePrompts = [
      "Saya ingin membangun massa otot dada dan bahu. Masih pemula, bisa 3x seminggu @ 1 jam, lebih suka mesin.",
      "Saya ingin meningkatkan kekuatan tubuh. Sudah biasa gym 1 tahun, punya waktu 4 hari per minggu 60 menit.",
      "Saya ingin mulai gym dari nol untuk kurangi perut buncit. Waktu 3 hari per minggu durasi 45 menit.",
      "Saya ingin meningkatkan kebugaran dan stamina dengan waktu terbatas 2 hari per minggu @ 45 menit.",
    ];

    const handleRunAiAnalysis = () => {
      if (!aiPromptText.trim()) {
        toast.error("Silakan tulis deskripsi kebutuhan latihan Anda.");
        return;
      }

      setIsAiAnalyzing(true);
      setTimeout(() => {
        const extracted = extractPreferencesFromFreeText(aiPromptText);
        setPreferences(extracted.preferences);
        setClarificationQuestions(extracted.missingQuestions);
        setAiExtractionSummary(extracted.rawSummary);
        setIsAiAnalyzing(false);

        if (extracted.missingQuestions.length === 0) {
          toast.success("AI berhasil mengekstrak parameter lengkap!");
        } else {
          toast.info("AI membutuhkan sedikit klarifikasi tambahan untuk hasil optimal.");
        }
      }, 700);
    };

    return (
      <div className="w-full max-w-2xl mx-auto space-y-6 pb-20 px-2 sm:px-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setViewStep("landing")}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
              isDark ? "border-white/10 text-gray-300" : "border-gray-200 text-gray-700"
            }`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Kembali</span>
          </button>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/30">
            SynFit AI Planner
          </span>
        </div>

        {/* Headline */}
        <div className="space-y-1">
          <h2 className={`text-xl sm:text-2xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>
            Tell us your fitness goals
          </h2>
          <p className={`text-xs leading-relaxed ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Ceritakan target, pengalaman, waktu, dan preferensi latihanmu. SynFit AI akan mengekstrak kebutuhan dan menyusun pilihan program yang tervalidasi.
          </p>
        </div>

        {/* Freeform Textarea */}
        <div className="space-y-2">
          <div
            className={`p-4 rounded-3xl border transition-all ${
              isDark ? "bg-[#141822] border-white/10 focus-within:border-purple-500" : "bg-white border-gray-300 focus-within:border-purple-600 shadow-sm"
            }`}
          >
            <textarea
              rows={4}
              value={aiPromptText}
              onChange={(e) => setAiPromptText(e.target.value)}
              placeholder="Contoh: Saya ingin membentuk otot dada dan bahu. Saya masih pemula, bisa latihan tiga kali seminggu selama satu jam, dan lebih suka menggunakan mesin gym daripada barbell."
              className={`w-full bg-transparent outline-none resize-none text-xs sm:text-sm leading-relaxed ${
                isDark ? "text-white placeholder:text-gray-500" : "text-gray-900 placeholder:text-gray-400"
              }`}
            />
          </div>

          {/* Quick example prompt chips */}
          <div className="space-y-1.5 pt-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Contoh yang dapat dipilih:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {examplePrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setAiPromptText(p)}
                  className={`text-[11px] px-2.5 py-1.5 rounded-xl border text-left transition-all ${
                    isDark
                      ? "bg-white/5 border-white/10 hover:bg-white/10 text-gray-300"
                      : "bg-gray-100 border-gray-200 hover:bg-gray-200 text-gray-700"
                  }`}
                >
                  {p.slice(0, 48)}...
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Analyze Button */}
        {!aiExtractionSummary && (
          <button
            onClick={handleRunAiAnalysis}
            disabled={isAiAnalyzing}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:opacity-95 text-white font-black text-xs shadow-lg shadow-purple-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isAiAnalyzing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Menganalisis Kebutuhan Latihan...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Analisis Kebutuhan</span>
              </>
            )}
          </button>
        )}

        {/* Extraction Preview & Clarification Questions */}
        {aiExtractionSummary && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 pt-2"
          >
            <div
              className={`p-4 rounded-2xl border ${
                isDark ? "bg-[#141822] border-purple-500/30" : "bg-purple-50/70 border-purple-200 shadow-sm"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className={`text-xs font-black uppercase tracking-wider ${isDark ? "text-purple-400" : "text-purple-700"}`}>
                  Hasil Ekstraksi AI
                </span>
              </div>
              <p className={`text-xs font-bold ${isDark ? "text-white" : "text-purple-950"}`}>{aiExtractionSummary}</p>
            </div>

            {/* Clarification Questions if missing critical fields */}
            {clarificationQuestions.length > 0 && (
              <div className="space-y-3">
                <span className={`text-xs font-black uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  Pertanyaan Tambahan untuk Akurasi Program:
                </span>
                {clarificationQuestions.map((q) => (
                  <div
                    key={q.id}
                    className={`p-4 rounded-2xl border space-y-2.5 ${
                      isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
                    }`}
                  >
                    <p className={`text-xs font-extrabold ${isDark ? "text-white" : "text-gray-900"}`}>{q.question}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {q.options.map((opt, oIdx) => {
                        const isChosen = clarificationAnswers[q.id] === opt.value;
                        return (
                          <button
                            key={oIdx}
                            onClick={() => {
                              setClarificationAnswers((prev) => ({ ...prev, [q.id]: opt.value }));
                              setPreferences((prev) => ({ ...prev, [q.id]: opt.value }));
                            }}
                            className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                              isChosen
                                ? "border-purple-500 bg-purple-600 text-white shadow-sm"
                                : isDark
                                ? "border-white/10 bg-white/5 text-gray-300 hover:border-white/20"
                                : "border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => handleCompileRecommendations(preferences, "ai")}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:opacity-95 text-white font-black text-xs shadow-lg shadow-purple-900/30 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              <span>Susun Rekomendasi Program AI</span>
            </button>
          </motion.div>
        )}
      </div>
    );
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // RENDER VIEW 5: RECOMMENDATIONS (2-3 GENUINE OPTIONS)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (viewStep === "recommendations") {
    return (
      <div className="w-full max-w-5xl mx-auto space-y-6 pb-20 px-2 sm:px-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setViewStep(programSource === "ai" ? "ai_wizard" : "manual_wizard")}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
              isDark ? "border-white/10 text-gray-300" : "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Edit Preferensi</span>
          </button>
          <span className={`text-xs font-black ${isDark ? "text-blue-400" : "text-blue-600"}`}>
            {recommendations.length} Rekomendasi Program Tersedia
          </span>
        </div>

        <div>
          <h2 className={`text-xl sm:text-2xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>
            Pilih Rekomendasi Program Anda
          </h2>
          <p className={`text-xs mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Program di bawah ini disusun khusus berdasarkan parameter profil Anda dan telah lolos validasi katalog gerakan SynFit.
          </p>
        </div>

        {/* 2-3 Recommendation Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recommendations.map((opt) => {
            const isSelected = selectedOption?.id === opt.id;
            return (
              <motion.div
                key={opt.id}
                whileHover={{ y: -3 }}
                onClick={() => setSelectedOption(opt)}
                className={`p-5 rounded-3xl border cursor-pointer flex flex-col justify-between transition-all relative ${
                  isSelected
                    ? isDark
                      ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-950/20 ring-1 ring-blue-500"
                      : "border-blue-500 bg-blue-50/70 shadow-md ring-1 ring-blue-500"
                    : isDark
                    ? "bg-[#141822] border-white/10 hover:border-white/20"
                    : "bg-white border-gray-200 hover:border-gray-300 shadow-sm"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700 font-bold"
                    }`}>
                      {opt.tagline}
                    </span>
                    {isSelected && <CheckCircle2 className={`h-4 w-4 shrink-0 ${isDark ? "text-blue-400" : "text-blue-600"}`} />}
                  </div>

                  <div>
                    <h3 className={`text-base font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                      {opt.name}
                    </h3>
                    <p className={`text-[11px] mt-1 leading-relaxed ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      {opt.description}
                    </p>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5 pt-1 text-[10px]">
                    <span className={`px-2 py-0.5 rounded-md font-bold ${isDark ? "bg-white/5 border border-white/10 text-gray-300" : "bg-gray-100 border border-gray-200 text-gray-700"}`}>
                      {opt.daysPerWeek} Hari / Mgg
                    </span>
                    <span className={`px-2 py-0.5 rounded-md font-bold ${isDark ? "bg-white/5 border border-white/10 text-gray-300" : "bg-gray-100 border border-gray-200 text-gray-700"}`}>
                      ~{opt.estimatedDurationMinutes} Mnt
                    </span>
                    <span className={`px-2 py-0.5 rounded-md font-bold ${isDark ? "bg-white/5 border border-white/10 text-amber-400" : "bg-amber-50 border border-amber-200 text-amber-800"}`}>
                      {opt.difficulty}
                    </span>
                  </div>

                  {/* Pros & Trade-offs */}
                  <div className="space-y-1.5 pt-2 text-[11px]">
                    <p className={`font-extrabold ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>Keunggulan:</p>
                    {opt.pros.map((p, pIdx) => (
                      <p key={pIdx} className={`flex items-start gap-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                        <Check className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{p}</span>
                      </p>
                    ))}

                    <p className={`font-extrabold pt-1 ${isDark ? "text-amber-400" : "text-amber-700"}`}>Kompromi:</p>
                    {opt.tradeOffs.map((t, tIdx) => (
                      <p key={tIdx} className={`flex items-start gap-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                        <Info className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                        <span>{t}</span>
                      </p>
                    ))}
                  </div>
                </div>

                <div className="pt-5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditor(opt);
                    }}
                    className={`w-full py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-md shadow-blue-900/30 hover:bg-blue-500"
                        : isDark
                        ? "bg-white/10 text-gray-300 hover:bg-white/15"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <span>Pilih & Sesuaikan</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // RENDER VIEW 6: PROGRAM EDITOR & PREVIEW
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (viewStep === "editor" && customizingProgram) {
    const handleRemoveExercise = (sessIdx: number, exIdx: number) => {
      setCustomizingProgram((prev) => {
        if (!prev) return null;
        const copy = JSON.parse(JSON.stringify(prev)) as WorkoutProgram;
        copy.sessions[sessIdx].exercises.splice(exIdx, 1);
        return copy;
      });
      toast.info("Latihan dihapus dari sesi.");
    };

    const handleSwapExercise = (
      sessIdx: number,
      exIdx: number,
      newExerciseId: string
    ) => {
      const newDef = getExerciseById(newExerciseId);
      if (!newDef) return;

      setCustomizingProgram((prev) => {
        if (!prev) return null;
        const copy = JSON.parse(JSON.stringify(prev)) as WorkoutProgram;
        const oldEx = copy.sessions[sessIdx].exercises[exIdx];
        copy.sessions[sessIdx].exercises[exIdx] = {
          ...oldEx,
          exerciseId: newDef.id,
          name: newDef.name,
          primaryMuscle: newDef.primaryMuscle,
          equipmentId: newDef.equipmentId,
          equipmentName: newDef.equipmentName,
          hasAiCoach: newDef.hasAiCoach,
          aiCoachType: newDef.aiCoachType,
        };
        return copy;
      });
      setSwapModalSessionIndex(null);
      setSwapModalExerciseIndex(null);
      toast.success(`Gerakan diganti menjadi ${newDef.name}`);
    };

    return (
      <div className="w-full max-w-4xl mx-auto space-y-6 pb-24 px-2 sm:px-4">
        {/* Editor Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            onClick={() => setViewStep("recommendations")}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 self-start ${
              isDark ? "border-white/10 text-gray-300" : "border-gray-200 text-gray-700"
            }`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Kembali ke Opsi</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSaveProgram("draft")}
              disabled={isSaving}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                isDark ? "border-white/15 text-gray-300 hover:bg-white/10" : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              Simpan Draft
            </button>
            <button
              onClick={() => {
                setIsEditingActiveStartDate(false);
                setSelectedStartDate(formatLocalDate(new Date()));
                setShowStartDateModal(true);
              }}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/30 flex items-center gap-1.5"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Pilih Tanggal Mulai & Aktifkan</span>
            </button>
          </div>
        </div>

        {/* Program Title and Description (Editable) */}
        <div
          className={`p-5 rounded-3xl border space-y-2 ${
            isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
          }`}
        >
          <input
            type="text"
            value={customizingProgram.name}
            onChange={(e) =>
              setCustomizingProgram((p) => (p ? { ...p, name: e.target.value } : null))
            }
            className={`text-lg sm:text-xl font-black w-full bg-transparent outline-none border-b border-transparent focus:border-blue-500 pb-1 ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          />
          <p className="text-xs text-gray-400">
            Anda dapat menyesuaikan gerakan, set, repetisi, atau mengganti gerakan dengan alternatif yang relevan di bawah ini.
          </p>
        </div>

        {/* Sessions & Exercises List */}
        <div className="space-y-4">
          {customizingProgram.sessions.map((sess, sIdx) => (
            <div
              key={sess.sessionId}
              className={`p-4 sm:p-5 rounded-3xl border space-y-3.5 ${
                isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className={`text-sm font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                    {sess.dayName}
                  </h4>
                  <p className="text-[11px] text-gray-400">{sess.focus}</p>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                  {sess.exercises.length} Latihan
                </span>
              </div>

              {/* Exercises Rows */}
              <div className="space-y-2">
                {sess.exercises.map((ex, eIdx) => (
                  <div
                    key={ex.exerciseId + eIdx}
                    className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                      isDark ? "bg-[#090B10] border-white/5" : "bg-gray-50 border-gray-100"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs">{ex.name}</span>
                        {ex.hasAiCoach && (
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            AI Coach
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400">
                        Target: {ex.primaryMuscle} Â· Alat: {ex.equipmentName}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {/* Sets & Reps Inputs */}
                      <div className="flex items-center gap-1 text-xs">
                        <input
                          type="number"
                          min={1}
                          max={6}
                          value={ex.targetSets}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            setCustomizingProgram((prev) => {
                              if (!prev) return null;
                              const c = JSON.parse(JSON.stringify(prev));
                              c.sessions[sIdx].exercises[eIdx].targetSets = val;
                              return c;
                            });
                          }}
                          className={`w-10 p-1 text-center font-bold rounded-lg border text-xs outline-none ${
                            isDark ? "bg-white/10 border-white/10 text-white" : "bg-white border-gray-300 text-gray-900"
                          }`}
                        />
                        <span className="text-gray-400 text-[10px]">set x</span>
                        <input
                          type="text"
                          value={ex.targetReps}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomizingProgram((prev) => {
                              if (!prev) return null;
                              const c = JSON.parse(JSON.stringify(prev));
                              c.sessions[sIdx].exercises[eIdx].targetReps = val;
                              return c;
                            });
                          }}
                          className={`w-20 p-1 text-center font-bold rounded-lg border text-xs outline-none ${
                            isDark ? "bg-white/10 border-white/10 text-white" : "bg-white border-gray-300 text-gray-900"
                          }`}
                        />
                      </div>

                      {/* Swap Button */}
                      <button
                        onClick={() => {
                          setSwapModalSessionIndex(sIdx);
                          setSwapModalExerciseIndex(eIdx);
                        }}
                        className={`p-1.5 rounded-lg border text-gray-400 hover:text-blue-400 ${
                          isDark ? "border-white/10 hover:bg-white/10" : "border-gray-200 hover:bg-gray-100"
                        }`}
                        title="Ganti Latihan"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleRemoveExercise(sIdx, eIdx)}
                        className={`p-1.5 rounded-lg border text-gray-400 hover:text-red-400 ${
                          isDark ? "border-white/10 hover:bg-white/10" : "border-gray-200 hover:bg-gray-100"
                        }`}
                        title="Hapus Gerakan"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Modal: Swap Exercise with Valid Alternatives */}
        <AnimatePresence>
          {swapModalSessionIndex !== null && swapModalExerciseIndex !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[120] flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className={`p-5 rounded-3xl border w-full max-w-md max-h-[80vh] overflow-y-auto space-y-3.5 shadow-2xl relative ${
                  isDark ? "bg-[#141822] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
                }`}
              >
                <div className={`flex items-center justify-between pb-2 border-b ${isDark ? "border-white/10" : "border-gray-200"}`}>
                  <h3 className="text-sm font-black">Pilih Gerakan Pengganti</h3>
                  <button
                    onClick={() => {
                      setSwapModalSessionIndex(null);
                      setSwapModalExerciseIndex(null);
                    }}
                    className={`p-1 rounded-full ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  {WORKOUT_EXERCISE_CATALOG.map((item) => (
                    <div
                      key={item.id}
                      onClick={() =>
                        handleSwapExercise(
                          swapModalSessionIndex,
                          swapModalExerciseIndex,
                          item.id
                        )
                      }
                      className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                        isDark ? "bg-white/5 border-white/10 hover:border-blue-500" : "bg-gray-50 border-gray-200 hover:border-blue-400"
                      }`}
                    >
                      <div>
                        <p className="font-extrabold text-xs">{item.name}</p>
                        <p className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                          {item.primaryMuscle} Â· {item.equipmentName}
                        </p>
                      </div>
                      {item.hasAiCoach && (
                        <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-amber-500/20 text-amber-500 border border-amber-500/30">
                          AI Coach
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Modal: Tentukan Tanggal Mulai saat Aktivasi dari Editor */}
        <AnimatePresence>
          {showStartDateModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[150] flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
                  isDark ? "bg-[#141822] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
                }`}
              >
                <div className={`flex items-center justify-between pb-2 border-b ${isDark ? "border-white/10" : "border-gray-200"}`}>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    <h3 className="text-base font-black">Tentukan Tanggal Mulai Program</h3>
                  </div>
                  <button
                    onClick={() => setShowStartDateModal(false)}
                    className={`p-1 rounded-full ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <p className={`leading-relaxed ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    Pilih tanggal kapan Anda ingin mulai menjalani program ini. Kalender latihan mingguan, tanggal setiap sesi, dan hari istirahat akan otomatis dihitung.
                  </p>

                  <div className="space-y-1">
                    <label className={`text-[10px] font-bold uppercase ${isDark ? "text-gray-400" : "text-gray-700"}`}>Tanggal Mulai:</label>
                    <input
                      type="date"
                      value={selectedStartDate}
                      onChange={(e) => setSelectedStartDate(e.target.value)}
                      className={`w-full p-3 rounded-2xl border text-sm font-bold outline-none ${
                        isDark ? "bg-[#0A0D14] border-white/10 text-white" : "bg-gray-50 border-gray-300 text-gray-900"
                      }`}
                    />
                  </div>

                  {selectedStartDate && (
                    <div className={`p-3 rounded-2xl border space-y-1 text-[11px] ${
                      isDark ? "border-blue-500/20 bg-blue-500/10 text-blue-300" : "border-blue-200 bg-blue-50 text-blue-900"
                    }`}>
                      <p>
                        <strong>Tanggal Mulai:</strong> {formatDisplayDate(selectedStartDate)}
                      </p>
                      <p>
                        <strong>Estimasi Selesai (8 Minggu):</strong>{" "}
                        {formatDisplayDate(formatLocalDate(addDays(new Date(selectedStartDate), 8 * 7 - 1)))}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowStartDateModal(false)}
                    className={`flex-1 py-2.5 rounded-xl border text-xs font-bold ${
                      isDark ? "border-white/10 text-gray-300" : "border-gray-200 text-gray-700"
                    }`}
                  >
                    Batal
                  </button>
                  <button
                    onClick={async () => {
                      if (!selectedStartDate) {
                        toast.error("Pilih tanggal mulai yang valid.");
                        return;
                      }
                      setShowStartDateModal(false);
                      await handleSaveProgram("active");
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md shadow-blue-900/30"
                  >
                    Konfirmasi & Aktifkan
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return null;
}
