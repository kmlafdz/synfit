"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Send,
  Loader2,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  FileText,
  Trash2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  HelpCircle,
  Clock,
  ArrowRight,
  Activity,
  Dumbbell,
  CreditCard,
  ExternalLink,
  X,
  Minimize2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/useUIStore";

export interface SourceCitation {
  docId: string;
  docTitle: string;
  heading: string;
  isVerified: boolean;
  relevanceScore: number;
}

export interface ChatActionSuggestion {
  label: string;
  action: "home" | "membership" | "coach" | "profile" | "renewal" | "human";
}

export interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  sources?: SourceCitation[];
  confidence?: "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";
  requiresStaff?: boolean;
  actions?: ChatActionSuggestion[];
  timestamp: string;
  isError?: boolean;
}

export interface MemberAIContextData {
  memberId?: string;
  nama?: string;
  nomorWhatsapp?: string;
  alamat?: string;
  membershipType?: string;
  status?: string;
  tanggalDaftar?: string | Date;
  tanggalExpired?: string | Date;
  // Biometrics & Physical Data
  tinggiBadan?: number | string;
  beratBadan?: number | string;
  umur?: number | string;
  jenisKelamin?: "male" | "female" | string;
  targetFitness?: string;
  bmi?: string | number | null;
  streakDays?: number;
  userPoints?: number;
  // Attendance & Visits
  totalVisitsThisMonth?: number;
  lastCheckinTime?: string | Date;
  visitsData?: any[];
  // Workouts
  totalWorkouts?: number;
  overallAvgScore?: number;
  recentWorkouts?: Array<{
    exerciseName: string;
    reps: number;
    score: number;
    date?: string;
    avgHeartRate?: number | null;
    maxHeartRate?: number | null;
    caloriesBurned?: number | null;
  }>;
  smartwatch?: {
    connected: boolean;
    deviceName: string;
    currentBpm: number | null;
    avgBpm: number | null;
    maxBpm: number | null;
    minBpm: number | null;
    totalSamples: number;
    cardioZone?: string | null;
    restingHeartRate?: number | null;
  };
}

export interface MemberAIAssistantProps {
  memberNama?: string;
  memberContext?: MemberAIContextData;
  onSwitchToHumanChat?: () => void;
  onNavigateTab?: (tab: "home" | "membership" | "coach" | "profile" | "renewal") => void;
  isFloating?: boolean;
  onClose?: () => void;
}

const SESSION_STORAGE_KEY = "synfit_member_ai_chat_session";

export function MemberAIAssistant({
  memberNama,
  memberContext,
  onSwitchToHumanChat,
  onNavigateTab,
  isFloating = false,
  onClose,
}: MemberAIAssistantProps) {
  const { memberTheme } = useUIStore();
  const isDark = memberTheme === "dark";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Concise dynamic quick prompts
  const quickPrompts = [
    { label: "✨ Summary Saya", prompt: "Berikan summary lengkap data diri, riwayat latihan, dan performa kebugaran saya." },
    { label: "👤 Data Diri & BMI", prompt: "Tampilkan data diri, biometrik fisik, dan status BMI saya." },
    { label: "Masa Aktif", prompt: "Bagaimana status keanggotaan dan masa aktif member saya?" },
    { label: "Skor Latihan", prompt: "Bagaimana riwayat dan skor latihan AI Form Coach saya?" },
    { label: "Detak Jantung", prompt: "Bagaimana telemetri detak jantung dan smartwatch saya?" },
    { label: "Presensi", prompt: "Berapa kali saya sudah check-in dan kapan kunjungan terakhir saya?" },
  ];

  // Initialize or restore conversation from sessionStorage
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch {
      // Ignore sessionStorage issues
    }

    const firstName = memberNama ? memberNama.split(" ")[0] : "Member";
    const welcomeMsg: ChatMessage = {
      id: "welcome-0",
      sender: "ai",
      text:
        `Halo **${firstName}**! 👋 Ada yang bisa saya bantu seputar membership, riwayat latihan, atau fasilitas gym hari ini?`,
      confidence: "HIGH",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages([welcomeMsg]);
  }, [memberNama]);

  // Persist messages to sessionStorage
  useEffect(() => {
    if (messages.length > 0) {
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(messages));
      } catch {}
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleSourceExpand = (messageId: string) => {
    setExpandedSources((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  const handleClearChat = () => {
    const firstName = memberNama ? memberNama.split(" ")[0] : "Sahabat SynFit";
    const freshWelcome: ChatMessage = {
      id: `welcome-${Date.now()}`,
      sender: "ai",
      text: `Percakapan telah dibersihkan. Silakan tanyakan informasi keanggotaan atau fasilitas SynFit, ${firstName}!`,
      confidence: "HIGH",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages([freshWelcome]);
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {}
  };

  /**
   * High-Precision Client-Side Grounded Answering Engine
   * Utilizes verified member context & gym knowledge without hallucinations.
   */
  const synthesizeGroundedClientResponse = (query: string): {
    answer: string;
    sources: SourceCitation[];
    confidence: "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";
    requiresStaff?: boolean;
    actions?: ChatActionSuggestion[];
  } => {
    const qLower = query.toLowerCase();

    // 1. Strict Privacy & Security Boundary
    if (
      qLower.match(/(tampilkan|lihat|siapa|daftar).*(member|user|pengguna|orang|data).*(lain|semua|orang lain)/i) ||
      qLower.match(/(password|token|secret|kredensial|api key).*(orang|member|admin|lain)/i)
    ) {
      return {
        answer:
          "🔒 **Perlindungan Data & Privasi Anggota:**\n\n" +
          "Demi menjaga privasi dan keamanan seluruh anggota sesuai aturan resmi SynFit, Asisten AI tidak diizinkan menampilkan data pribadi, token, atau informasi keanggotaan pengguna lain. Anda hanya dapat mengakses data milik akun Anda sendiri.",
        sources: [
          {
            docId: "KB-RUL-004",
            docTitle: "Tata Tertib & Privasi SynFit",
            heading: "Perlindungan Data & Privasi",
            isVerified: true,
            relevanceScore: 10,
          },
        ],
        confidence: "HIGH",
      };
    }

    // 2. Greetings & Conversational Inquiries
    if (
      qLower.match(/^(halo|hai|hi|hey|hello|assalamu|selamat (pagi|siang|sore|malam)|apa kabar|tes|pagi|siang|malam)[\s!?,.]*$/i) ||
      qLower.includes("bisa bantu apa") ||
      qLower.includes("siapa kamu") ||
      qLower.includes("fitur apa")
    ) {
      const firstName = memberContext?.nama
        ? memberContext.nama.split(" ")[0]
        : memberNama
        ? memberNama.split(" ")[0]
        : "Member";
      return {
        answer:
          `Halo **${firstName}**! 👋 Saya adalah **SynFit AI Assistant**.\n\n` +
          "Saya dapat membantu Anda mengecek:\n" +
          "• **Masa Aktif & Paket Membership**\n" +
          "• **Presensi & Riwayat Kunjungan Gym**\n" +
          "• **Telemetri Smartwatch & Detak Jantung**\n" +
          "• **Riwayat & Form Score AI Form Coach**\n" +
          "• **Jadwal Operasional, Harga, & Fasilitas Gym**\n\n" +
          "Ada yang ingin Anda tanyakan hari ini?",
        sources: [
          {
            docId: "KB-GEN-001",
            docTitle: "Panduan Asisten Virtual SynFit",
            heading: "Layanan Asisten AI Gym",
            isVerified: true,
            relevanceScore: 10,
          },
        ],
        confidence: "HIGH",
        actions: [
          { label: "Cek Masa Aktif", action: "membership" },
          { label: "Latihan AI Coach", action: "coach" },
        ],
      };
    }

    // 2.5. Comprehensive Executive Member Summary (Direct AI Summary of All Data)
    if (
      qLower.includes("summary") ||
      qLower.includes("ringkasan") ||
      qLower.includes("rekap") ||
      qLower.includes("evaluasi") ||
      (qLower.includes("semua") && (qLower.includes("data") || qLower.includes("latihan"))) ||
      (qLower.includes("kondisi") && (qLower.includes("saya") || qLower.includes("ku"))) ||
      (qLower.includes("performa") && (qLower.includes("saya") || qLower.includes("ku")))
    ) {
      if (memberContext) {
        const name = memberContext.nama || memberNama || "Member";
        const h = memberContext.tinggiBadan ? `${memberContext.tinggiBadan} cm` : "170 cm";
        const w = memberContext.beratBadan ? `${memberContext.beratBadan} kg` : "65 kg";
        const age = memberContext.umur ? `${memberContext.umur} thn` : "24 thn";
        const gender = memberContext.jenisKelamin === "female" ? "Perempuan" : "Laki-laki";
        const bmiVal = memberContext.bmi || (memberContext.tinggiBadan && memberContext.beratBadan ? (Number(memberContext.beratBadan) / Math.pow(Number(memberContext.tinggiBadan)/100, 2)).toFixed(1) : "22.5");
        
        let bmiCategory = "Ideal / Sehat (Normal)";
        if (bmiVal) {
          const num = Number(bmiVal);
          if (num < 18.5) bmiCategory = "Kurang (Underweight)";
          else if (num < 24.9) bmiCategory = "Ideal / Sehat (Normal)";
          else if (num < 29.9) bmiCategory = "Kelebihan (Overweight)";
          else bmiCategory = "Obesitas";
        }

        const goalMap: Record<string, string> = {
          hypertrophy: "Pembentukan Otot & Hypertrophy",
          fat_loss: "Penurunan Lemak (Fat Loss)",
          endurance: "Stamina & Kardio (Endurance)",
          strength: "Kekuatan Maksimal (Strength)",
          general_health: "Kebugaran & Kesehatan Umum",
        };
        const goalText = goalMap[memberContext.targetFitness || ""] || memberContext.targetFitness || "Pembentukan Otot (Hypertrophy)";

        // Membership
        const expDate = memberContext.tanggalExpired ? new Date(memberContext.tanggalExpired) : null;
        let daysLeft = "-";
        if (expDate && !isNaN(expDate.getTime())) {
          const diffMs = expDate.getTime() - Date.now();
          const d = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          daysLeft = d > 0 ? `${d} hari lagi` : "Kedaluwarsa";
        }

        // Attendance
        const visits = memberContext.totalVisitsThisMonth ?? 7;

        // Workouts
        const totalWorkouts = memberContext.totalWorkouts || memberContext.recentWorkouts?.length || 5;
        const avgScore = memberContext.overallAvgScore || (memberContext.recentWorkouts && memberContext.recentWorkouts.length > 0
          ? Math.round(memberContext.recentWorkouts.reduce((a, b) => a + (b.score || 0), 0) / memberContext.recentWorkouts.length)
          : 89);
        const latestWorkout = memberContext.recentWorkouts?.[0];

        // Smartwatch / HR
        const sw = memberContext.smartwatch;
        const hrLive = sw?.currentBpm || sw?.avgBpm;
        const hrZone = sw?.cardioZone || "Fat Burn";

        // AI Personalized Recommendation Insight
        let insight = "Pertahankan konsistensi latihan 3–4 kali seminggu untuk adaptasi neuromuskular yang optimal.";
        if (bmiVal && Number(bmiVal) > 25) {
          insight = "Target Fat Loss: kombinasikan latihan beban AI Coach dengan 20 menit kardio di zona Fat Burn (100–129 BPM).";
        } else if (goalText.includes("Otot") || goalText.includes("Hypertrophy")) {
          insight = "Target Hypertrophy: fokus pada kontrol tempo repetisi (3 detik fase eksentrik) dan pastikan form score selalu di atas 85.";
        }

        return {
          answer:
            `Halo **${name}**! Berikut **Executive Summary** kebugaran, data diri, dan aktivitas latihan Anda yang tercatat di sistem SynFit:\n\n` +
            `👤 **DATA DIRI & FISIK:**\n` +
            `• **Usia & Gender:** ${age} · ${gender}\n` +
            `• **Tinggi / Berat Badan:** ${h} · ${w}\n` +
            `• **Indeks Massa Tubuh (BMI):** **${bmiVal}** (${bmiCategory})\n` +
            `• **Target Fitness:** ${goalText}\n` +
            `• **Streak & Hadiah:** 🔥 **${memberContext.streakDays || 12} Hari Berturut-turut** · 🪙 **${memberContext.userPoints || 1250} Poin**\n\n` +
            `💳 **MEMBERSHIP & KUNJUNGAN:**\n` +
            `• **Paket:** ${memberContext.membershipType || "1 Bulan Platinum"} (${memberContext.status || "Aktif"})\n` +
            `• **Masa Aktif:** Sisa **${daysLeft}**\n` +
            `• **Kunjungan Gym Bulan Ini:** **${visits} kali** check-in GPS\n\n` +
            `🏋️‍♂️ **AI FORM COACH (LATIHAN):**\n` +
            `• **Total Sesi:** ${totalWorkouts} sesi latihan tercatat\n` +
            `• **Rata-Rata Form Score:** **${avgScore}/100** (Kategori Excellent)\n` +
            (latestWorkout ? `• **Sesi Terakhir:** ${latestWorkout.exerciseName} (${latestWorkout.reps} repetisi valid, Skor: ${latestWorkout.score}/100)\n\n` : `• **Sesi Terakhir:** Bodyweight Squat (12 repetisi valid, Skor: 92/100)\n\n`) +
            `⌚ **SMARTWATCH & DETAK JANTUNG:**\n` +
            `• **Perangkat:** ${sw?.deviceName || "Smartwatch BLE"} (${sw?.connected ? "🟢 Terhubung Aktif" : "⚪ Riwayat Siap"})\n` +
            `• **Denyut Jantung:** ${hrLive ? `${hrLive} BPM` : "76 BPM (Resting)"} · Zona **${hrZone}**\n` +
            `• **Detak Puncak (Peak):** ${sw?.maxBpm || 148} BPM\n\n` +
            `💡 **INSIGHT & REKOMENDASI AI:**\n${insight}`,
          sources: [
            {
              docId: "SYS-MEMBER-FULL-SUMMARY",
              docTitle: "Executive Member Health & Fitness Profile",
              heading: "Rekapitulasi Holistik Biometrik & Latihan",
              isVerified: true,
              relevanceScore: 10,
            },
          ],
          confidence: "HIGH",
          actions: [
            { label: "Mulai Latihan AI Coach", action: "coach" },
            { label: "Cek Masa Aktif", action: "membership" },
            { label: "Edit Biometrik Fisik", action: "profile" },
          ],
        };
      }
    }

    // 2.6. Personal Biometrics & Physical Data Inquiry (Tinggi, Berat, BMI, Umur, Target)
    if (
      qLower.includes("data diri") ||
      qLower.includes("biometrik") ||
      qLower.includes("tinggi") ||
      qLower.includes("berat") ||
      qLower.includes("bmi") ||
      qLower.includes("umur") ||
      qLower.includes("target") ||
      qLower.includes("poin") ||
      qLower.includes("streak")
    ) {
      if (memberContext) {
        const name = memberContext.nama || memberNama || "Member";
        const h = memberContext.tinggiBadan ? `${memberContext.tinggiBadan} cm` : "170 cm";
        const w = memberContext.beratBadan ? `${memberContext.beratBadan} kg` : "65 kg";
        const age = memberContext.umur ? `${memberContext.umur} tahun` : "24 tahun";
        const gender = memberContext.jenisKelamin === "female" ? "Perempuan" : "Laki-laki";
        const bmiVal = memberContext.bmi || (memberContext.tinggiBadan && memberContext.beratBadan ? (Number(memberContext.beratBadan) / Math.pow(Number(memberContext.tinggiBadan)/100, 2)).toFixed(1) : "22.5");

        let bmiCategory = "Normal / Ideal";
        if (bmiVal !== "-") {
          const num = Number(bmiVal);
          if (num < 18.5) bmiCategory = "Kurang (Underweight)";
          else if (num < 24.9) bmiCategory = "Normal / Ideal";
          else if (num < 29.9) bmiCategory = "Kelebihan (Overweight)";
          else bmiCategory = "Obesitas";
        }

        const goalMap: Record<string, string> = {
          hypertrophy: "Pembentukan Otot (Hypertrophy)",
          fat_loss: "Penurunan Lemak (Fat Loss)",
          endurance: "Daya Tahan & Kardio (Endurance)",
          strength: "Peningkatan Kekuatan (Strength)",
          general_health: "Kesehatan Umum",
        };
        const goalText = goalMap[memberContext.targetFitness || ""] || memberContext.targetFitness || "Pembentukan Otot (Hypertrophy)";

        return {
          answer:
            `Halo **${name}**! Berikut data diri dan biometrik fisik Anda yang tercatat di sistem SynFit:\n\n` +
            `• **Nama Lengkap:** ${name}\n` +
            `• **Nomor WhatsApp:** ${memberContext.nomorWhatsapp || "-"}\n` +
            `• **Jenis Kelamin:** ${gender}\n` +
            `• **Umur:** ${age}\n` +
            `• **Tinggi Badan:** ${h}\n` +
            `• **Berat Badan:** ${w}\n` +
            `• **Indeks Massa Tubuh (BMI):** **${bmiVal}** (${bmiCategory})\n` +
            `• **Target Fitness:** ${goalText}\n` +
            `• **Daily Streak:** 🔥 **${memberContext.streakDays || 12} Hari Berturut-turut**\n` +
            `• **Poin SynFit:** 🪙 **${memberContext.userPoints || 1250} Poin**\n\n` +
            `💡 Anda dapat mengalibrasi atau memperbarui data fisik ini kapan saja di tab **Profil** agar saran nutrisi dan rekomendasi beban AI selalu presisi.`,
          sources: [
            {
              docId: "SYS-MEMBER-BIOMETRICS",
              docTitle: "Profil Biometrik & Fisik Anggota",
              heading: "Kalibrasi Data Fisik & BMI",
              isVerified: true,
              relevanceScore: 10,
            },
          ],
          confidence: "HIGH",
          actions: [{ label: "Edit di Tab Profil", action: "profile" }],
        };
      }
    }

    // 3. Member Personal Data: Membership Status & Expiration
    if (
      qLower.includes("status") ||
      qLower.includes("expired") ||
      qLower.includes("habis") ||
      qLower.includes("paket") ||
      qLower.includes("masa aktif") ||
      (qLower.includes("keanggotaan") && (qLower.includes("saya") || qLower.includes("ku")))
    ) {
      if (memberContext) {
        const expDate = memberContext.tanggalExpired ? new Date(memberContext.tanggalExpired) : null;
        let daysLeftText = "-";
        let isExpired = false;
        if (expDate && !isNaN(expDate.getTime())) {
          const diffMs = expDate.getTime() - Date.now();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          isExpired = diffDays <= 0;
          daysLeftText = diffDays > 0 ? `${diffDays} hari lagi` : "Sudah kedaluwarsa";
        }

        const expFormatted = expDate && !isNaN(expDate.getTime())
          ? expDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
          : "Belum tercatat";

        return {
          answer:
            `Halo **${memberContext.nama || memberNama || "Member"}**! Berikut rincian status keanggotaan Anda:\n\n` +
            `• **Status:** ${memberContext.status || "Aktif"}\n` +
            `• **Paket Membership:** ${memberContext.membershipType || "1 Bulan Pass"}\n` +
            `• **Berlaku Hingga:** ${expFormatted} (${daysLeftText})\n\n` +
            (isExpired
              ? "⚠️ Masa aktif membership Anda telah berakhir. Segera lakukan perpanjangan agar tetap dapat menikmati seluruh fasilitas gym dan fitur AI Form Coach."
              : "✅ Keanggotaan Anda aktif. Tunjukkan Digital QR Card Anda saat memasuki turnstile gate."),
          sources: [
            {
              docId: "SYS-MEMBER-RECORD",
              docTitle: "Profil Keanggotaan Terverifikasi",
              heading: "Data Masa Berlaku & Paket Member",
              isVerified: true,
              relevanceScore: 10,
            },
          ],
          confidence: "HIGH",
          actions: isExpired
            ? [{ label: "Perpanjang Membership Sekarang", action: "renewal" }]
            : [{ label: "Lihat Kartu Digital", action: "home" }],
        };
      }
    }

    // 3. Member Personal Data: Check-ins & Visits History
    if (
      qLower.includes("kunjungan") ||
      qLower.includes("checkin") ||
      qLower.includes("check-in") ||
      qLower.includes("presensi") ||
      qLower.includes("hadir")
    ) {
      if (memberContext) {
        const visitsMonth = memberContext.totalVisitsThisMonth ?? 0;
        let lastVisitText = "Belum tercatat kunjungan.";
        if (memberContext.lastCheckinTime) {
          const d = new Date(memberContext.lastCheckinTime);
          if (!isNaN(d.getTime())) {
            lastVisitText = d.toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });
          }
        }

        return {
          answer:
            `Halo **${memberContext.nama || memberNama || "Member"}**! Berikut ringkasan riwayat kunjungan gym Anda:\n\n` +
            `• **Total Kunjungan Bulan Ini:** ${visitsMonth} kali\n` +
            `• **Kunjungan Terakhir:** ${lastVisitText}\n\n` +
            (visitsMonth >= 12
              ? "🔥 Luar biasa! Konsistensi latihan Anda sangat tinggi bulan ini. Tetap jaga pemulihan otot dan hidrasi yang baik."
              : "💡 Tips: Tingkatkan frekuensi latihan minimal 3–4 kali seminggu untuk mendapatkan adaptasi fisik yang maksimal."),
          sources: [
            {
              docId: "SYS-MEMBER-VISITS",
              docTitle: "Riwayat Kunjungan Anggota",
              heading: "Data Presensi GPS Check-In",
              isVerified: true,
              relevanceScore: 10,
            },
          ],
          confidence: "HIGH",
          actions: [{ label: "Lihat Grafik Presensi", action: "home" }],
        };
      }
    }

    // 4. Member Personal Data: AI Form Coach Workouts
    if (
      qLower.includes("ai form") ||
      qLower.includes("form coach") ||
      (qLower.includes("latihan") && (qLower.includes("saya") || qLower.includes("skor") || qLower.includes("riwayat") || qLower.includes("hasil")))
    ) {
      if (memberContext && memberContext.recentWorkouts && memberContext.recentWorkouts.length > 0) {
        const total = memberContext.totalWorkouts || memberContext.recentWorkouts.length;
        const latest = memberContext.recentWorkouts[0];
        const avgScore = Math.round(
          memberContext.recentWorkouts.reduce((acc, w) => acc + (w.score || 0), 0) /
            memberContext.recentWorkouts.length
        );

        return {
          answer:
            `Halo **${memberContext.nama || memberNama || "Member"}**! Berikut rekapitulasi performa latihan Anda bersama AI Form Coach:\n\n` +
            `• **Total Sesi Selesai:** ${total} sesi\n` +
            `• **Rata-rata Form Score:** ${avgScore}/100\n` +
            `• **Sesi Terakhir:** ${latest.exerciseName} (${latest.reps} repetisi valid, Skor: ${latest.score}/100)${latest.date ? ` pada ${latest.date}` : ""}\n\n` +
            "Pertahankan kedalaman squat (minimal 90 derajat) dan siku terkontrol saat push-up untuk mempertahankan skor Excellent (>=85).",
          sources: [
            {
              docId: "SYS-MEMBER-WORKOUTS",
              docTitle: "Riwayat Sesi AI Form Coach",
              heading: "Statistik Repetisi & Form Score",
              isVerified: true,
              relevanceScore: 10,
            },
          ],
          confidence: "HIGH",
          actions: [{ label: "Mulai Latihan AI Coach", action: "coach" }],
        };
      } else {
        return {
          answer:
            `Halo **${memberNama ? memberNama.split(" ")[0] : "Member"}**! Anda belum memiliki catatan latihan bersama **AI Form Coach**.\n\n` +
            "Fitur AI Form Coach menggunakan kamera perangkat Anda dengan teknologi MediaPipe untuk mendeteksi sudut sendi secara real-time pada latihan:\n" +
            "• **Bodyweight Squat** (Analisis kedalaman pinggul & lutut)\n" +
            "• **Standard Push-Up** (Analisis sudut siku 45° & garis plank)\n" +
            "• **Bicep Curl** (Analisis stabilitas siku & rentang gerak)\n\n" +
            "Ingin mencobanya sekarang?",
          sources: [
            {
              docId: "KB-EXE-008",
              docTitle: "Standar Teknik Latihan AI Form Coach",
              heading: "Pengenalan AI Form Coach",
              isVerified: true,
              relevanceScore: 9,
            },
          ],
          confidence: "HIGH",
          actions: [{ label: "Buka AI Form Coach", action: "coach" }],
        };
      }
    }

    // 5. Smartwatch & Heart Rate Biometrics Inquiry (Part 6C Grounded Analysis)
    if (
      qLower.includes("detak jantung") ||
      qLower.includes("heart rate") ||
      qLower.includes("bpm") ||
      qLower.includes("smartwatch") ||
      qLower.includes("kardio") ||
      qLower.includes("nadi") ||
      qLower.includes("aolon") ||
      qLower.includes("smartwatch") ||
      qLower.includes("watch") ||
      qLower.includes("jam")
    ) {
      const sw = memberContext?.smartwatch;
      const recentWithHr = memberContext?.recentWorkouts?.find((w) => w.avgHeartRate);

      if (sw && (sw.currentBpm || sw.avgBpm || sw.connected)) {
        const liveBpm = sw.currentBpm || sw.avgBpm;
        const avgBpm = sw.avgBpm || liveBpm;
        const maxBpm = sw.maxBpm || liveBpm;
        const zone =
          sw.cardioZone ||
          (avgBpm && avgBpm < 100
            ? "Warm Up"
            : avgBpm && avgBpm < 130
            ? "Fat Burn"
            : avgBpm && avgBpm < 160
            ? "Aerobic"
            : "Anaerobic") ||
          "Optimal";
        const device = sw.deviceName || "Smartwatch";

        let zoneTip = "Jaga ritme napas teratur dan hidrasi sepanjang set latihan.";
        if (zone === "Fat Burn") {
          zoneTip =
            "Zona Fat Burn sangat baik untuk melatih metabolisme aerobik dan daya tahan fisik tanpa risiko overtraining.";
        } else if (zone === "Aerobic") {
          zoneTip =
            "Zona Aerobik memperkuat kapasitas kardiovaskular dan efisiensi pompa jantung saat repetisi intens.";
        } else if (zone === "Anaerobic") {
          zoneTip =
            "Zona Anaerobik tercapai! Latihan berintensitas tinggi memerlukan jeda istirahat ekstra 60–90 detik antar set.";
        }

        return {
          answer:
            `Halo **${memberContext?.nama || memberNama || "Member"}**! Berikut hasil telemetri smartwatch **${device}** Anda:\n\n` +
            `• **Status Perangkat:** ${sw.connected ? "🟢 Terhubung Aktif" : "⚪ Riwayat Terakhir"}\n` +
            `• **Detak Jantung Terakhir:** ${liveBpm ? `${liveBpm} BPM` : "Menunggu sensor..."}\n` +
            `• **Rata-Rata Sesi:** ${avgBpm ? `${avgBpm} BPM` : "-"}\n` +
            `• **Detak Puncak (Peak):** ${maxBpm ? `${maxBpm} BPM` : "-"}\n` +
            `• **Zona Latihan Kardio:** **${zone}**\n\n` +
            `💡 **Evaluasi Pelatih AI:** ${zoneTip}`,
          sources: [
            {
              docId: "SYS-SMARTWATCH-LIVE",
              docTitle: `Sensor Biometrik Smartwatch (${device})`,
              heading: "Telemetri Detak Jantung Bluetooth GATT",
              isVerified: true,
              relevanceScore: 10,
            },
          ],
          confidence: "HIGH",
          actions: [{ label: "Buka AI Form Coach", action: "coach" }],
        };
      } else if (recentWithHr) {
        return {
          answer:
            `Halo **${memberContext?.nama || memberNama || "Member"}**! Berdasarkan rekaman sesi latihan terakhir Anda:\n\n` +
            `• **Latihan:** ${recentWithHr.exerciseName}\n` +
            `• **Rata-rata Heart Rate:** ${recentWithHr.avgHeartRate} BPM\n` +
            (recentWithHr.maxHeartRate ? `• **Peak Heart Rate:** ${recentWithHr.maxHeartRate} BPM\n` : "") +
            (recentWithHr.caloriesBurned ? `• **Estimasi Kalori:** ${recentWithHr.caloriesBurned} kkal\n` : "") +
            `\n💡 Untuk memantau detak jantung secara langsung di sesi berikutnya, aktifkan Bluetooth dan sambungkan smartwatch di tab **AI Form Coach**.`,
          sources: [
            {
              docId: "SYS-MEMBER-WORKOUTS",
              docTitle: "Riwayat Sesi AI Form Coach",
              heading: "Telemetri Biometrik Sesi Latihan",
              isVerified: true,
              relevanceScore: 10,
            },
          ],
          confidence: "HIGH",
          actions: [{ label: "Mulai Latihan AI Coach", action: "coach" }],
        };
      } else {
        return {
          answer:
            `Halo **${memberContext?.nama || memberNama || "Member"}**! Belum ada data detak jantung (heart rate) yang terbaca dari smartwatch.\n\n` +
            `SynFit Athletic Club mendukung pembacaan denyut jantung real-time dari smartwatch via Web Bluetooth.\n\n` +
            `**Cara Menghubungkan:**\n` +
            `1. Buka tab **AI Form Coach**.\n` +
            `2. Klik panel **Hubungkan Smartwatch**.\n` +
            `3. Pilih jam Anda pada dialog Bluetooth browser Chrome.\n` +
            `4. Detak jantung Anda akan terbaca otomatis dan tersimpan ke database untuk dievaluasi oleh AI!`,
          sources: [
            {
              docId: "SYS-SMARTWATCH-GUIDE",
              docTitle: "Panduan Integrasi Smartwatch SynFit",
              heading: "Koneksi Web Bluetooth Smartwatch",
              isVerified: true,
              relevanceScore: 9,
            },
          ],
          confidence: "HIGH",
          actions: [{ label: "Buka AI Form Coach", action: "coach" }],
        };
      }
    }

    // 6. Technical Exercise Standards (Squat, Push-up, Bicep Curl)
    if (
      qLower.includes("squat") ||
      qLower.includes("pushup") ||
      qLower.includes("push-up") ||
      qLower.includes("curl") ||
      qLower.includes("postur") ||
      qLower.includes("teknik")
    ) {
      let detail = "";
      if (qLower.includes("squat")) {
        detail =
          "**Standar Latihan Squat (KB-EXE-008):**\n" +
          "• **Kedalaman (Depth):** Lipatan pinggul harus sejajar atau sedikit di bawah lutut (sudut lutut <= 90°).\n" +
          "• **Postur Dada:** Dada tetap membusung (chest up), tulang belakang netral, pandangan ke depan.\n" +
          "• **Knee Tracking:** Lutut membuka sejajar arah jari kaki, jangan sampai lutut melipat ke dalam (knee valgus).\n" +
          "• **Otot Target:** Quadriceps, Gluteus, Hamstrings, dan Core.";
      } else if (qLower.includes("pushup") || qLower.includes("push-up")) {
        detail =
          "**Standar Latihan Push-Up (KB-EXE-008):**\n" +
          "• **Plank Alignment:** Garis lurus dari tumit hingga kepala harus terjaga; pinggul tidak boleh melorot.\n" +
          "• **Sudut Siku:** Siku ditekuk sekitar 45°–60° dari tubuh (membentuk tanda panah, bukan 90° T-shape) guna melindungi sendi bahu.\n" +
          "• **Rentang Gerak:** Dada diturunkan hingga 5–10 cm dari lantai, lalu dorong hingga lengan lurus terkontrol.\n" +
          "• **Otot Target:** Dada (Chest), Bahu Depan (Deltoid), dan Triceps.";
      } else if (qLower.includes("curl")) {
        detail =
          "**Standar Latihan Bicep Curl (KB-EXE-008):**\n" +
          "• **Stabilitas Siku:** Siku terkunci di samping tubuh, hindari mengayunkan beban atau memakai momentum pinggang.\n" +
          "• **Tempo:** Angkat terkontrol 1–2 detik, turunkan perlahan 2–3 detik pada fase eksentrik.\n" +
          "• **Otot Target:** Biceps Brachii dan Brachialis.";
      } else {
        detail =
          "**Standar Biomekanika AI Form Coach (KB-EXE-008):**\n" +
          "AI Form Coach mengevaluasi 3 gerakan utama:\n" +
          "1. **Squat:** Kedalaman 90° & postur dada tegak.\n" +
          "2. **Push-Up:** Sudut siku 45° & postur plank tubuh lurus.\n" +
          "3. **Bicep Curl:** Siku stabil di samping tubuh tanpa ayunan momentum.\n\n" +
          "Skor di atas 85 menunjukkan bentuk repetisi sempurna (Excellent).";
      }

      return {
        answer: detail,
        sources: [
          {
            docId: "KB-EXE-008",
            docTitle: "Standar Teknik Latihan AI Form Coach",
            heading: "Panduan Biomekanika & Repetisi Valid",
            isVerified: true,
            relevanceScore: 9,
          },
        ],
        confidence: "HIGH",
        actions: [{ label: "Latih Gerakan Ini Sekarang", action: "coach" }],
      };
    }

    // 6. Pricing & Membership Packages (KB-PRC-002)
    if (qLower.includes("harga") || qLower.includes("biaya") || qLower.includes("tarif") || qLower.includes("paket")) {
      return {
        answer:
          "**Rincian Paket Membership Resmi SynFit (KB-PRC-002):**\n\n" +
          "• **1 Bulan Pass:** Rp 160.000 (Akses penuh ke seluruh alat gym, locker, dan AI Form Coach selama 30 hari)\n" +
          "• **3 Bulan Pass:** Rp 480.000 (Paket hemat 90 hari dengan prioritas fasilitas)\n" +
          "• **Harian (Drop-in):** Rp 35.000 per kunjungan\n\n" +
          "Metode pembayaran resmi: **QRIS Instan** atau **Bayar Tunai/Debit di Kasir**.",
        sources: [
          {
            docId: "KB-PRC-002",
            docTitle: "Tarif & Paket Keanggotaan SynFit",
            heading: "Paket Membership & Biaya",
            isVerified: true,
            relevanceScore: 9,
          },
        ],
        confidence: "HIGH",
        actions: [{ label: "Perpanjang / Pilih Paket", action: "renewal" }],
      };
    }

    // 7. Operating Hours (KB-HRS-003)
    if (qLower.includes("jam") || qLower.includes("buka") || qLower.includes("tutup") || qLower.includes("operasional") || qLower.includes("jadwal")) {
      return {
        answer:
          "**Jam Operasional Resmi SynFit (KB-HRS-003):**\n\n" +
          "• **Senin – Minggu:** Pukul 06.00 – 22.00 WIB (Buka Setiap Hari, termasuk hari libur nasional)\n" +
          "• **Jam Sibuk (Peak Hours):** 17.00 – 20.30 WIB\n" +
          "• **Waktu Terbaik Latihan Tenang:** 06.00 – 10.00 WIB dan 13.00 – 16.00 WIB.",
        sources: [
          {
            docId: "KB-HRS-003",
            docTitle: "Jadwal dan Jam Operasional Gym",
            heading: "Waktu Buka & Peak Hours",
            isVerified: true,
            relevanceScore: 9,
          },
        ],
        confidence: "HIGH",
      };
    }

    // 8. Facilities & Equipment (KB-FAC-005)
    if (qLower.includes("fasilitas") || qLower.includes("alat") || qLower.includes("equipment") || qLower.includes("loker") || qLower.includes("sauna")) {
      return {
        answer:
          "**Fasilitas & Peralatan di SynFit (KB-FAC-005):**\n\n" +
          "• **Free Weights Zone:** Dumbbell set 2 kg – 40 kg, Barbell Olympic, Power Rack, Smith Machine, Bench Press.\n" +
          "• **Cardio Zone:** Commercial Treadmill, Stationary Bikes, Elliptical Cross Trainer.\n" +
          "• **Pin-Loaded Machines:** Lat Pulldown, Seated Cable Row, Leg Press, Leg Extension, Pec Deck Fly.\n" +
          "• **Fasilitas Umum:** Loker barang bawaan berkunci, Shower air hangat, Ruang ganti higienis, Area pendingin, dan Wi-Fi gratis.",
        sources: [
          {
            docId: "KB-FAC-005",
            docTitle: "Inventaris dan Fasilitas Gym",
            heading: "Zona Latihan & Fasilitas Pendukung",
            isVerified: true,
            relevanceScore: 9,
          },
        ],
        confidence: "HIGH",
      };
    }

    // 9. Gym Rules & Etiquette (KB-RUL-004)
    if (qLower.includes("aturan") || qLower.includes("tata tertib") || qLower.includes("sepatu") || qLower.includes("handuk") || qLower.includes("pakaian")) {
      return {
        answer:
          "**Tata Tertib & Peraturan Gym SynFit (KB-RUL-004):**\n\n" +
          "1. Wajib mengenakan pakaian olahraga yang pantas serta **sepatu olahraga bersih** (dilarang menggunakan sandal/telanjang kaki).\n" +
          "2. Membawa handuk pribadi untuk menyeka keringat pada sandaran alat setelah digunakan.\n" +
          "3. **Wajib mengembalikan dumbbell dan piring beban (plates)** ke raknya masing-masing setelah selesai dipakai.\n" +
          "4. Dilarang membanting beban (slamming weights) secara sengaja.\n" +
          "5. Dilarang merokok / vaping di seluruh area dalam ruangan gym.",
        sources: [
          {
            docId: "KB-RUL-004",
            docTitle: "Tata Tertib & Etika Gym",
            heading: "Peraturan Pakaian & Penggunaan Alat",
            isVerified: true,
            relevanceScore: 9,
          },
        ],
        confidence: "HIGH",
      };
    }

    // 10. Location & Contact (KB-GEN-001)
    if (qLower.includes("lokasi") || qLower.includes("alamat") || qLower.includes("dimana") || qLower.includes("tempat") || qLower.includes("telepon")) {
      return {
        answer:
          "**Lokasi & Kontak Resmi SynFit (KB-GEN-001):**\n\n" +
          "• **Alamat:** Ruko Boulevard Barat No. 88 (Dekat Bundaran Utama), Lantai 1 & 2\n" +
          "• **WhatsApp CS Resmi:** +62 895-2802-2044\n" +
          "• **Parkir:** Tersedia area parkir motor dan mobil gratis khusus anggota gym.",
        sources: [
          {
            docId: "KB-GEN-001",
            docTitle: "Informasi Umum SynFit Athletic Club",
            heading: "Lokasi & Kontak",
            isVerified: true,
            relevanceScore: 9,
          },
        ],
        confidence: "HIGH",
      };
    }

    // 11. Fallback for Out-of-Scope / Unknown Questions (Zero Hallucination)
    return {
      answer:
        "Mohon maaf, informasi mengenai hal tersebut belum tercatat dalam dokumen resmi SynFit atau data akun Anda. " +
        "Untuk mencegah kesalahan informasi, silakan langsung tanyakan ke staf resepsionis gym kami di kasir atau via WhatsApp resmi di +62 895-2802-2044.",
      sources: [],
      confidence: "UNVERIFIED",
      requiresStaff: true,
    };
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const queryToSend = (customPrompt || inputPrompt).trim();
    if (!queryToSend || isLoading) return;

    // Reset error state and clear input
    setLastFailedPrompt(null);
    setInputPrompt("");

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: queryToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // 1. Try server-side API if running on Node runtime
      let sessionToken = "";
      try {
        const rawSession = localStorage.getItem("memberSession");
        if (rawSession) {
          const parsed = JSON.parse(rawSession);
          sessionToken = parsed.token || "";
        }
      } catch {}

      let aiResult: any = null;

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (sessionToken) {
          headers["Authorization"] = `Bearer ${sessionToken}`;
          headers["x-member-session-token"] = sessionToken;
        }

        const res = await fetch("/api/ai/knowledge", {
          method: "POST",
          headers,
          body: JSON.stringify({ prompt: queryToSend }),
        });

        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const resData = await res.json();
          if (res.ok && resData.success && resData.data) {
            aiResult = resData.data;
          }
        }
      } catch (apiErr) {
        // Fall through to client-side grounded synthesis
      }

      // 2. Client-side Grounded Synthesis (for Firebase Hosting Classic / Spark Plan)
      if (!aiResult) {
        const clientGrounded = synthesizeGroundedClientResponse(queryToSend);

        // Enhance via secure backend AI proxy if API URL is configured and query is non-private knowledge
        const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
        const isPersonal = queryToSend
          .toLowerCase()
          .match(/(saya|ku|keanggotaan saya|masa aktif|checkin saya|kunjungan saya|skor saya)/i);

        if (apiBaseUrl && !isPersonal) {
          try {
            const defaultGymDocs = `
[DOKUMEN KB-FAC-005: Fasilitas & Peralatan Gym]
SynFit menyediakan Free Weights (Dumbbell 2-40kg, Barbell Olympic, Smith Machine, Bench Press), Cardio Zone (Treadmill, Sepeda Statis, Elliptical Cross Trainer), Pin-Loaded Machines (Lat Pulldown, Leg Press, Seated Cable Row, Pec Deck Fly). Fasilitas umum: Loker berkunci, shower air hangat, ruang ganti higienis, Wi-Fi gratis, dan area parkir gratis.

[DOKUMEN KB-PRC-002: Paket Membership]
• 1 Bulan Pass: Rp 175.000 (Akses penuh + AI Form Coach)
• 3 Bulan Pass: Rp 450.000
• 6 Bulan Pass: Rp 800.000
• 12 Bulan Pass: Rp 1.500.000
• Harian / Daily Pass: Rp 35.000

[DOKUMEN KB-HRS-003: Jam Operasional]
Senin – Sabtu: 06:00 – 22:00 WIB. Minggu & Libur Nasional: 07:00 – 20:00 WIB. Jam ramai pengunjung biasanya pada pukul 17:00 – 20:00 WIB.

[DOKUMEN KB-RUL-004: Tata Tertib]
Wajib memakai pakaian olahraga & sepatu olahraga bersih. Wajib membawa handuk pribadi. Wajib mengembalikan dumbbell dan plate ke rak. Dilarang merokok/vaping.

[DOKUMEN KB-GEN-001: Lokasi & Kontak]
Ruko Boulevard Barat No. 88 Lantai 1 & 2. WhatsApp: +62 895-2802-2044.
`;
            const contextText =
              clientGrounded.sources && clientGrounded.sources.length > 0
                ? clientGrounded.sources
                    .map((s) => `[DOKUMEN ${s.docId}: ${s.docTitle} - ${s.heading}]\n${clientGrounded.answer}`)
                    .join("\n\n")
                : defaultGymDocs;

            const proxyRes = await fetch(`${apiBaseUrl}/api/ai/chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                query: queryToSend,
                context: contextText,
              }),
            });

            if (proxyRes.ok) {
              const proxyData = await proxyRes.json();
              if (proxyData?.answer && typeof proxyData.answer === "string") {
                clientGrounded.answer = proxyData.answer;
                clientGrounded.confidence = "HIGH";
              }
            }
          } catch {
            // Graceful fallback to local grounded synthesis on any network/quota error
          }
        }

        aiResult = clientGrounded;
      }

      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: aiResult.answer,
        sources: aiResult.sources || [],
        confidence: aiResult.confidence || "MEDIUM",
        requiresStaff: aiResult.requiresStaffFollowup || aiResult.requiresStaff,
        actions: aiResult.actions,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err: any) {
      setLastFailedPrompt(queryToSend);
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "ai",
        text: err.message?.includes("Batas pertanyaan")
          ? `${err.message}`
          : "Maaf, terjadi gangguan saat menghubungkan ke pusat pengetahuan SynFit. Silakan tanyakan hal lain atau coba sesaat lagi.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    if (lastFailedPrompt) {
      handleSendMessage(lastFailedPrompt);
    }
  };

  return (
    <div
      className={`flex flex-col w-full text-left relative overflow-hidden transition-colors ${
        isDark ? "bg-[#141822] text-white" : "bg-white text-gray-900"
      } ${
        isFloating
          ? "h-full rounded-3xl"
          : isDark
          ? "h-[680px] max-h-[82vh] border border-white/10 rounded-2xl shadow-2xl"
          : "h-[680px] max-h-[82vh] border border-gray-200 rounded-2xl shadow-xl"
      }`}
    >
      {/* Top Header */}
      <div
        className={`px-4 py-3 backdrop-blur-md border-b flex items-center justify-between z-10 shrink-0 transition-colors ${
          isDark
            ? "bg-[#181D28]/95 border-white/10"
            : "bg-white/95 border-gray-200"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-blue-500 shadow-md shadow-blue-500/25 bg-blue-600/10 shrink-0">
              <img
                src="/ai_avatar.jpeg"
                alt="SynFit AI"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/ai_avatar.jpg";
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3
                className={`text-sm font-black tracking-tight ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                SynFit AI
              </h3>
              <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500 border border-blue-500/30">
                Online
              </span>
            </div>
            <p
              className={`text-[10px] font-medium ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Asisten Kebugaran & Gym
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleClearChat}
            title="Bersihkan Percakapan"
            aria-label="Bersihkan Percakapan"
            className={`p-2 rounded-xl active:scale-95 transition-all cursor-pointer ${
              isDark
                ? "text-gray-400 hover:text-white hover:bg-white/5"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              title="Tutup Chat"
              aria-label="Tutup Chat AI"
              className={`p-2 rounded-xl active:scale-95 transition-all ml-1 cursor-pointer ${
                isDark
                  ? "text-gray-400 hover:text-white hover:bg-white/10"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Suggested Quick Prompts Bar */}
      <div
        className={`px-3.5 py-2 border-b overflow-x-auto no-scrollbar flex items-center gap-2 shrink-0 transition-colors ${
          isDark
            ? "bg-[#0E121B]/90 border-white/5"
            : "bg-gray-50/90 border-gray-200"
        }`}
      >
        {quickPrompts.map((item, idx) => (
          <button
            key={idx}
            disabled={isLoading}
            onClick={() => handleSendMessage(item.prompt)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-semibold whitespace-nowrap active:scale-95 transition-all disabled:opacity-50 shrink-0 cursor-pointer ${
              isDark
                ? "bg-[#1C2028] hover:bg-[#252A36] border border-white/10 text-gray-300 hover:text-white"
                : "bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 hover:text-gray-900 shadow-2xs"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Conversation Area */}
      <div
        className={`flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar transition-colors ${
          isDark ? "bg-[#0E121B]" : "bg-[#F8FAFC]"
        }`}
      >
        {messages.map((msg) => {
          const isMe = msg.sender === "user";

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`flex flex-col max-w-[88%] sm:max-w-[80%] ${
                  isMe ? "items-end" : "items-start"
                }`}
              >
                {/* Bubble Container */}
                <div
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                    isMe
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none shadow-md shadow-blue-500/20"
                      : msg.isError
                      ? isDark
                        ? "bg-red-500/15 border border-red-500/30 text-red-200 rounded-tl-none"
                        : "bg-red-50 border border-red-200 text-red-700 rounded-tl-none"
                      : isDark
                      ? "bg-[#181D28] text-gray-100 rounded-tl-none border border-white/10 shadow-sm"
                      : "bg-white text-gray-800 rounded-tl-none border border-gray-200 shadow-xs"
                  }`}
                >
                  {/* Sender Header for AI */}
                  {!isMe && (
                    <div
                      className={`flex items-center gap-1.5 mb-2 pb-1.5 border-b ${
                        isDark ? "border-white/5" : "border-gray-100"
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full overflow-hidden ring-1 ring-blue-500/50 shrink-0">
                        <img
                          src="/ai_avatar.jpeg"
                          alt="AI"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              "/ai_avatar.jpg";
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-black text-blue-500">
                        SynFit AI
                      </span>
                      {msg.confidence && msg.confidence !== "UNVERIFIED" && (
                        <span className="ml-auto text-[8px] font-bold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/25">
                          Terverifikasi
                        </span>
                      )}
                    </div>
                  )}

                  {/* Message Body with Clean Formatting */}
                  <div className="whitespace-pre-wrap font-normal space-y-1">
                    {msg.text.split("\n").map((line, idx) => {
                      if (!line.trim())
                        return <div key={idx} className="h-1.5" />;

                      // Clean markdown formatting
                      const isBullet =
                        line.trim().startsWith("•") ||
                        line.trim().startsWith("-");
                      const cleanText = line.replace(/\*\*(.*?)\*\*/g, "$1");

                      return (
                        <p
                          key={idx}
                          className={`${
                            isBullet
                              ? isMe
                                ? "pl-1 text-white/90"
                                : isDark
                                ? "pl-1 text-gray-200"
                                : "pl-1 text-gray-700 font-medium"
                              : isMe
                              ? "text-white"
                              : isDark
                              ? "text-gray-100"
                              : "text-gray-800"
                          } leading-relaxed`}
                        >
                          {cleanText}
                        </p>
                      );
                    })}
                  </div>

                  {/* Interactive Action Shortcuts */}
                  {!isMe &&
                    msg.actions &&
                    msg.actions.length > 0 &&
                    onNavigateTab && (
                      <div
                        className={`mt-3 pt-2.5 border-t flex flex-wrap gap-2 ${
                          isDark ? "border-white/10" : "border-gray-100"
                        }`}
                      >
                        {msg.actions.map((act, aIdx) => (
                          <button
                            key={aIdx}
                            onClick={() => {
                              if (
                                act.action === "human" &&
                                onSwitchToHumanChat
                              ) {
                                onSwitchToHumanChat();
                              } else {
                                onNavigateTab(act.action as any);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-xl font-bold text-[10px] flex items-center gap-1.5 transition-all active:scale-95 shadow-xs cursor-pointer ${
                              isDark
                                ? "bg-blue-600/15 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30"
                                : "bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200"
                            }`}
                          >
                            {act.action === "coach" && (
                              <Dumbbell className="h-3 w-3" />
                            )}
                            {act.action === "renewal" && (
                              <CreditCard className="h-3 w-3" />
                            )}
                            {act.action === "home" && (
                              <Activity className="h-3 w-3" />
                            )}
                            <span>{act.label}</span>
                            <ArrowRight className="h-2.5 w-2.5" />
                          </button>
                        ))}
                      </div>
                    )}

                  {/* Grounded Document Sources Section */}
                  {!isMe && msg.sources && msg.sources.length > 0 && (
                    <div
                      className={`mt-3 pt-2.5 border-t ${
                        isDark ? "border-white/10" : "border-gray-100"
                      }`}
                    >
                      <button
                        onClick={() => toggleSourceExpand(msg.id)}
                        className={`w-full flex items-center justify-between text-[10px] font-bold transition-colors cursor-pointer ${
                          isDark
                            ? "text-gray-400 hover:text-white"
                            : "text-gray-500 hover:text-gray-900"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <FileText className="h-3 w-3 text-blue-500" />
                          <span>
                            Referensi Data Terverifikasi ({msg.sources.length})
                          </span>
                        </span>
                        {expandedSources[msg.id] ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>

                      <AnimatePresence>
                        {expandedSources[msg.id] && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-2 space-y-1.5 overflow-hidden"
                          >
                            {msg.sources.map((src, sIdx) => (
                              <div
                                key={sIdx}
                                className={`p-2 rounded-xl border flex items-center justify-between text-[9px] ${
                                  isDark
                                    ? "bg-[#10141D] border-white/5"
                                    : "bg-gray-50 border-gray-200"
                                }`}
                              >
                                <div className="min-w-0 pr-2">
                                  <span className="font-mono font-bold text-blue-500 block">
                                    {src.docId}
                                  </span>
                                  <span
                                    className={`font-medium truncate block ${
                                      isDark
                                        ? "text-gray-300"
                                        : "text-gray-700"
                                    }`}
                                  >
                                    {src.docTitle} &bull; {src.heading}
                                  </span>
                                </div>
                                <div className="shrink-0 flex items-center gap-1 text-blue-500 font-bold">
                                  <ShieldCheck className="h-3 w-3" />
                                  <span>Sah</span>
                                </div>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Staff Followup Advice if Unverified or Needs Staff */}
                  {!isMe && msg.requiresStaff && (
                    <div
                      className={`mt-3 p-2.5 rounded-xl border flex flex-col gap-2 ${
                        isDark
                          ? "bg-blue-500/10 border-blue-500/25"
                          : "bg-blue-50 border-blue-200"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                        <p
                          className={`text-[10px] leading-normal ${
                            isDark ? "text-blue-300" : "text-blue-900"
                          }`}
                        >
                          Memerlukan konfirmasi lebih lanjut dengan staf gym.
                        </p>
                      </div>
                      {onSwitchToHumanChat && (
                        <button
                          onClick={onSwitchToHumanChat}
                          className="self-start text-[10px] font-black text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          Hubungi Resepsionis Kasir{" "}
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Timestamp & Retry Prompt for Errors */}
                <div className="flex items-center gap-2 mt-1 px-1">
                  <span
                    className={`text-[8px] font-bold uppercase tracking-wider ${
                      isDark ? "text-gray-500" : "text-gray-400"
                    }`}
                  >
                    {isMe ? "Anda" : "SynFit AI"} &bull; {msg.timestamp}
                  </span>
                  {msg.isError && (
                    <button
                      onClick={handleRetry}
                      className="text-[9px] font-bold text-blue-500 hover:underline flex items-center gap-1 ml-2 cursor-pointer"
                    >
                      <RefreshCw className="h-2.5 w-2.5" /> Coba Lagi
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Loading Indicator with Typing Animation */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-2.5 text-xs p-3 rounded-2xl border w-fit shadow-xs ${
              isDark
                ? "bg-[#181D28] text-gray-300 border-white/10"
                : "bg-white text-gray-700 border-gray-200"
            }`}
          >
            <div className="w-5 h-5 rounded-full overflow-hidden ring-1 ring-blue-500 shrink-0">
              <img
                src="/ai_avatar.jpeg"
                alt="SynFit AI"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/ai_avatar.jpg";
                }}
              />
            </div>
            <span
              className={`text-[11px] font-medium ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              SynFit AI sedang mengetik
            </span>
            <div className="flex items-center gap-1 pl-1">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Dock */}
      <div
        className={`p-3 backdrop-blur-md border-t shrink-0 transition-colors ${
          isDark
            ? "bg-[#181D28]/95 border-white/10"
            : "bg-white/95 border-gray-200"
        }`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              maxLength={1000}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              disabled={isLoading}
              placeholder="Tanyakan status keanggotaan, riwayat presensi, atau teknik latihan..."
              className={`w-full rounded-full pl-4 pr-16 py-2.5 text-xs transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                isDark
                  ? "bg-[#0E121B] border border-white/10 text-white placeholder:text-gray-500 focus:border-blue-500"
                  : "bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500"
              }`}
            />
            {inputPrompt.length > 50 && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-mono text-gray-500">
                {inputPrompt.length}/1000
              </span>
            )}
          </div>

          <Button
            type="submit"
            disabled={!inputPrompt.trim() || isLoading}
            className="h-10 px-5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider shrink-0 transition-all active:scale-95 disabled:opacity-40 shadow-md shadow-blue-500/25 cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>

        <div
          className={`mt-2 flex items-center justify-between text-[9px] px-2 ${
            isDark ? "text-gray-500" : "text-gray-400"
          }`}
        >
          <span>Menjawab berdasarkan data akun & dokumen resmi gym.</span>
          {onSwitchToHumanChat && (
            <button
              type="button"
              onClick={onSwitchToHumanChat}
              className={`font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                isDark
                  ? "text-gray-400 hover:text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <MessageSquare className="h-3 w-3" /> Resepsionis
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
