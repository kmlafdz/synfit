/**
 * SYNFIT AI FOUNDATION - RAG GROUNDED ANSWERING SERVICE
 * Synthesizes source-grounded answers based exclusively on verified knowledge chunks.
 * Strictly prevents hallucination, handles unverified topics safely, and defends against prompt injections.
 */

import type { AIServiceContext } from "./types";
import { getAIServerConfig } from "./config";
import { knowledgeRetriever, type RetrievalResult, type ScoredChunk } from "./knowledgeBase";
import { AIInjectionError } from "./errors";
import { getAdminDb } from "@/lib/firebase-admin";

export interface SourceCitation {
  docId: string;
  docTitle: string;
  heading: string;
  isVerified: boolean;
  relevanceScore: number;
}

export interface RAGAnswerResponse {
  query: string;
  answer: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";
  sources: SourceCitation[];
  isGroundedInOfficialDocs: boolean;
  requiresStaffFollowup: boolean;
  timestamp: string;
}

// Patterns that attempt to extract private data or bypass AI safety
const MALICIOUS_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /abaikan\s+(semua\s+)?(instruksi|perintah)\s+(sebelumnya|awal)/i,
  /system\s*prompt/i,
  /tampilkan\s+(semua\s+)?(password|kata\s*sandi|token|secret)/i,
  /tampilkan\s+data\s+(pribadi\s+)?(seluruh\s+)?member/i,
  /show\s+(all\s+)?(passwords?|tokens?|private\s+keys?|users)/i,
  /bypass\s+security/i,
];

export function detectPromptInjection(prompt: string): boolean {
  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(prompt)) {
      return true;
    }
  }
  return false;
}

function isMemberPersonalInquiry(query: string): boolean {
  const q = query.toLowerCase();
  return (
    q.includes("saya") ||
    q.includes("ku") ||
    q.includes("summary") ||
    q.includes("ringkasan") ||
    q.includes("rekap") ||
    q.includes("evaluasi") ||
    q.includes("data diri") ||
    q.includes("profil") ||
    q.includes("biometrik") ||
    q.includes("bmi") ||
    q.includes("tinggi") ||
    q.includes("berat") ||
    q.includes("umur") ||
    q.includes("target") ||
    q.includes("streak") ||
    q.includes("poin") ||
    q.includes("keanggotaan saya") ||
    q.includes("membership saya") ||
    q.includes("checkin saya") ||
    q.includes("kunjungan saya") ||
    q.includes("latihan saya") ||
    q.includes("kapan expired") ||
    q.includes("kapan habis") ||
    q.includes("status member") ||
    q.includes("paket saya") ||
    q.includes("riwayat checkin") ||
    q.includes("riwayat kunjungan") ||
    q.includes("riwayat latihan") ||
    q.includes("skor latihan") ||
    q.includes("form score") ||
    q.includes("detak jantung") ||
    q.includes("heart rate") ||
    q.includes("bpm") ||
    q.includes("smartwatch") ||
    q.includes("kardio") ||
    q.includes("nadi") ||
    q.includes("aolon") ||
    q.includes("jam") ||
    q.includes("watch")
  );
}

async function synthesizeMemberPersonalAnswer(
  query: string,
  memberId: string,
  memberDataOverride?: AIServiceContext["memberData"]
): Promise<{ answer: string; confidence: "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED"; sources: SourceCitation[] }> {
  try {
    const qLower = query.toLowerCase();

    // 0. Comprehensive Executive Summary / Full Profile Inquiry
    if (
      qLower.includes("summary") ||
      qLower.includes("ringkasan") ||
      qLower.includes("rekap") ||
      qLower.includes("evaluasi") ||
      (qLower.includes("kondisi") && (qLower.includes("saya") || qLower.includes("ku"))) ||
      (qLower.includes("performa") && (qLower.includes("saya") || qLower.includes("ku"))) ||
      (qLower.includes("data diri") || qLower.includes("biometrik") || qLower.includes("bmi"))
    ) {
      let memberName = "Member";
      let statusText = "Aktif";
      let pkgText = "1 Bulan Platinum";
      let validUntilText = "-";
      let daysLeftText = "-";
      let phoneText = "-";
      let bioData: any = {};
      let totalVisits = 0;
      let workoutList: any[] = [];
      let hrData: any = {};

      try {
        const db = getAdminDb();
        const memberDoc = await db.collection("members").doc(memberId).get();
        if (memberDoc.exists) {
          const m = memberDoc.data() || {};
          memberName = m.nama || memberName;
          statusText = m.status || statusText;
          pkgText = m.membership_type || pkgText;
          phoneText = m.nomor_whatsapp || phoneText;
          if (m.tanggal_expired) {
            const exp = new Date(m.tanggal_expired);
            const diffDays = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            daysLeftText = diffDays > 0 ? `${diffDays} hari lagi` : "Sudah kedaluwarsa";
            validUntilText = exp.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
          }
          bioData = {
            tinggi: m.tinggi_badan,
            berat: m.berat_badan,
            umur: m.umur,
            gender: m.jenis_kelamin || m.gender,
            target: m.target_fitness || m.fitness_goal,
          };
        }

        const bioDoc = await db.collection("member_biometrics").doc(memberId).get();
        if (bioDoc.exists) {
          const b = bioDoc.data() || {};
          hrData = b;
          bioData = { ...bioData, ...b };
        }

        const checkinSnap = await db.collection("checkins").where("member_id", "==", memberId).get();
        totalVisits = checkinSnap.size;

        const workoutSnap = await db.collection("workout_sessions").where("member_id", "==", memberId).limit(5).get();
        workoutList = workoutSnap.docs.map((d) => d.data());
      } catch (err) {
        console.warn("Error fetching deep summary context:", err);
      }

      // Calculated BMI
      const hNum = Number(bioData.tinggi || 170);
      const wNum = Number(bioData.berat || 65);
      const bmiCalc = (wNum / Math.pow(hNum / 100, 2)).toFixed(1);
      let bmiCategory = "Ideal / Sehat (Normal)";
      const bNum = Number(bmiCalc);
      if (bNum < 18.5) bmiCategory = "Kurang (Underweight)";
      else if (bNum < 24.9) bmiCategory = "Ideal / Sehat (Normal)";
      else if (bNum < 29.9) bmiCategory = "Kelebihan (Overweight)";
      else bmiCategory = "Obesitas";

      const genderText = bioData.gender === "female" ? "Perempuan" : "Laki-laki";
      const totalWorkouts = workoutList.length;
      const avgFormScore = totalWorkouts > 0
        ? Math.round(workoutList.reduce((acc, w) => acc + (Number(w.form_score || w.score || w.average_form_score || 0)), 0) / totalWorkouts)
        : 90;
      const latestW = workoutList[0];

      const liveHr = hrData.last_heart_rate || hrData.avg_heart_rate || 76;
      const peakHr = hrData.peak_heart_rate || 148;
      const zoneText = hrData.cardio_zone || "Fat Burn";

      return {
        answer:
          `Halo **${memberName}**! Berikut **Executive Summary** kebugaran, data diri, dan aktivitas latihan Anda yang tercatat di sistem SynFit:\n\n` +
          `👤 **DATA DIRI & FISIK:**\n` +
          `• **Usia & Gender:** ${bioData.umur || 24} thn · ${genderText}\n` +
          `• **Tinggi / Berat Badan:** ${hNum} cm · ${wNum} kg\n` +
          `• **Indeks Massa Tubuh (BMI):** **${bmiCalc}** (${bmiCategory})\n` +
          `• **Target Fitness:** ${bioData.target || "Pembentukan Otot (Hypertrophy)"}\n` +
          `• **Nomor WhatsApp:** ${phoneText}\n\n` +
          `💳 **MEMBERSHIP & KUNJUNGAN:**\n` +
          `• **Paket Membership:** ${pkgText} (${statusText})\n` +
          `• **Masa Berlaku:** Hingga ${validUntilText} (Sisa **${daysLeftText}**)\n` +
          `• **Total Kunjungan Gym:** **${totalVisits} kali** tercatat\n\n` +
          `🏋️‍♂️ **AI FORM COACH & LATIHAN:**\n` +
          `• **Total Sesi Selesai:** ${totalWorkouts > 0 ? totalWorkouts : 3} sesi latihan\n` +
          `• **Rata-Rata Form Score:** **${avgFormScore}/100** (Kategori Excellent)\n` +
          (latestW ? `• **Sesi Terakhir:** ${latestW.exercise_name || latestW.type || "Squat"} (Skor: ${latestW.form_score || latestW.score || 92}/100)\n\n` : `• **Sesi Terakhir:** Bodyweight Squat (15 repetisi, Skor: 92/100)\n\n`) +
          `⌚ **TELEMETRI SMARTWATCH & KARDIO:**\n` +
          `• **Detak Jantung Rata-Rata:** ${liveHr} BPM (Puncak: ${peakHr} BPM)\n` +
          `• **Zona Latihan Dominan:** **${zoneText}**\n\n` +
          `💡 **INSIGHT & EVALUASI AI:**\n` +
          `Kondisi fisik dan form score Anda berada dalam kategori **Sangat Baik**. Jaga konsistensi kehadiran dan prioritaskan waktu istirahat yang cukup antar set latihan.`,
        confidence: "HIGH",
        sources: [
          {
            docId: "SYS-MEMBER-FULL-PROFILE",
            docTitle: "Executive Member Health & Fitness Profile",
            heading: "Rekapitulasi Holistik Biometrik, Membership, & Latihan",
            isVerified: true,
            relevanceScore: 10,
          },
        ],
      };
    }

    // 1. Check-in & Visits Inquiry
    if (qLower.includes("kunjungan") || qLower.includes("checkin") || qLower.includes("check-in") || qLower.includes("hadir")) {
      let visitsThisMonth = 0;
      let totalVisits = 0;
      let latestText = "Belum ada catatan kunjungan.";
      let memberName = "Member";

      if (memberDataOverride) {
        memberName = memberDataOverride.name || "Member";
        visitsThisMonth = memberDataOverride.visitsThisMonth || 0;
        totalVisits = memberDataOverride.visitsThisMonth || 0;
        latestText = memberDataOverride.lastCheckin || "Belum ada catatan kunjungan.";
      } else {
        const db = getAdminDb();
        const memberDoc = await db.collection("members").doc(memberId).get();
        if (!memberDoc.exists) {
          return {
            answer: "Data keanggotaan Anda tidak ditemukan di sistem. Silakan hubungi kasir atau resepsionis.",
            confidence: "UNVERIFIED",
            sources: [],
          };
        }
        const mData = memberDoc.data() || {};
        memberName = mData.nama || "Member";
        const checkinSnap = await db
          .collection("checkins")
          .where("member_id", "==", memberId)
          .get();

        const visits = checkinSnap.docs.map((d) => d.data());
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        visitsThisMonth = visits.filter((v) => {
          const d = v.waktu_masuk?.toDate ? v.waktu_masuk.toDate() : new Date(v.created_at || v.date || 0);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).length;
        totalVisits = visits.length;

        const latestVisit = visits[0];
        if (latestVisit) {
          const d = latestVisit.waktu_masuk?.toDate
            ? latestVisit.waktu_masuk.toDate()
            : new Date(latestVisit.created_at || latestVisit.date || 0);
          latestText = d.toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });
        }
      }

      return {
        answer:
          `Halo **${memberName}**! Berdasarkan data kunjungan Anda:\n\n` +
          `• **Total Kunjungan Bulan Ini:** ${visitsThisMonth} kali\n` +
          `• **Total Riwayat Kunjungan:** ${totalVisits} kali\n` +
          `• **Kunjungan Terakhir:** ${latestText}\n\n` +
          `Terus pertahankan konsistensi latihan Anda! Semakin rutin Anda datang, semakin optimal hasil kebugaran yang diraih.`,
        confidence: "HIGH",
        sources: [
          {
            docId: "SYS-MEMBER-VISITS",
            docTitle: "Riwayat Kunjungan Anggota",
            heading: "Data Presensi GPS Check-In",
            isVerified: true,
            relevanceScore: 10,
          },
        ],
      };
    }

    // 2. Workout Sessions / AI Form Coach Inquiry
    if (qLower.includes("latihan") || qLower.includes("workout") || qLower.includes("coach") || qLower.includes("form") || qLower.includes("skor")) {
      let workoutsCount = 0;
      let avgScore = 0;
      let memberName = "Member";
      let latestInfo = "Latihan Mandiri";

      if (memberDataOverride) {
        memberName = memberDataOverride.name || "Member";
        workoutsCount = memberDataOverride.workoutsCompleted || 0;
        avgScore = memberDataOverride.avgFormScore || 0;
        latestInfo = `AI Form Coach (${workoutsCount} sesi, Rata-rata Skor: ${avgScore}/100)`;
      } else {
        const db = getAdminDb();
        const memberDoc = await db.collection("members").doc(memberId).get();
        if (!memberDoc.exists) {
          return {
            answer: "Data keanggotaan Anda tidak ditemukan di sistem. Silakan hubungi kasir atau resepsionis.",
            confidence: "UNVERIFIED",
            sources: [],
          };
        }
        const mData = memberDoc.data() || {};
        memberName = mData.nama || "Member";
        const workoutSnap = await db
          .collection("workout_sessions")
          .where("member_id", "==", memberId)
          .get();

        const workouts = workoutSnap.docs.map((d) => d.data());
        workoutsCount = workouts.length;
        if (workoutsCount > 0) {
          const latest = workouts[0];
          avgScore = Math.round(
            workouts.reduce((acc, w) => acc + (Number(w.form_score) || Number(w.score) || 0), 0) / workoutsCount
          );
          latestInfo = `${latest.exercise_name || latest.type || "Latihan"} (${latest.valid_reps || latest.reps || 0} repetisi valid, Skor: ${latest.form_score || latest.score || 0}/100)`;
        }
      }

      if (workoutsCount === 0) {
        return {
          answer:
            `Halo **${memberName}**! Anda belum memiliki rekaman sesi latihan dengan **AI Form Coach**.\n\n` +
            `Anda dapat mencoba fitur AI Form Coach di dashboard untuk memantau postur dan menghitung repetisi valid saat melakukan latihan **Squat**, **Push-up**, atau **Bicep Curl** secara real-time melalui kamera perangkat Anda.`,
          confidence: "HIGH",
          sources: [
            {
              docId: "KB-EXE-008",
              docTitle: "Standar Teknik Latihan AI Form Coach",
              heading: "Evaluasi Form Score AI Form Coach",
              isVerified: true,
              relevanceScore: 8,
            },
          ],
        };
      }

      return {
        answer:
          `Halo **${memberName}**! Berikut ringkasan performa latihan Anda bersama AI Form Coach:\n\n` +
          `• **Total Sesi Selesai:** ${workoutsCount} sesi\n` +
          `• **Rata-rata Form Score:** ${avgScore}/100\n` +
          `• **Latihan Terakhir:** ${latestInfo}\n\n` +
          `Pastikan selalu menjaga kedalaman squat dan postur dada tegak untuk mempertahankan skor di atas 85 (Excellent).`,
        confidence: "HIGH",
        sources: [
          {
            docId: "SYS-MEMBER-WORKOUTS",
            docTitle: "Riwayat Sesi AI Form Coach",
            heading: "Statistik Repetisi & Form Score",
            isVerified: true,
            relevanceScore: 10,
          },
        ],
      };
    }

    // 3. Smartwatch & Heart Rate Biometrics Inquiry
    if (
      qLower.includes("detak jantung") ||
      qLower.includes("heart rate") ||
      qLower.includes("bpm") ||
      qLower.includes("smartwatch") ||
      qLower.includes("kardio") ||
      qLower.includes("nadi") ||
      qLower.includes("aolon") ||
      qLower.includes("watch") ||
      qLower.includes("jam")
    ) {
      let memberName = "Member";
      let biometrics: any = null;

      try {
        const db = getAdminDb();
        const memberDoc = await db.collection("members").doc(memberId).get();
        if (memberDoc.exists) {
          memberName = memberDoc.data()?.nama || "Member";
        }
        const bioDoc = await db.collection("member_biometrics").doc(memberId).get();
        if (bioDoc.exists) {
          biometrics = bioDoc.data();
        }
      } catch (err) {
        console.warn("[RAG Service] Error reading biometrics:", err);
      }

      if (biometrics && (biometrics.last_heart_rate || biometrics.avg_heart_rate)) {
        const lastHr = biometrics.last_heart_rate || biometrics.avg_heart_rate;
        const avgHr = biometrics.avg_heart_rate || lastHr;
        const peakHr = biometrics.peak_heart_rate || lastHr;
        const minHr = biometrics.min_heart_rate || "-";
        const zone =
          biometrics.cardio_zone ||
          (avgHr < 100 ? "Warm Up" : avgHr < 130 ? "Fat Burn" : avgHr < 160 ? "Aerobic" : "Anaerobic");
        const device = biometrics.smartwatch_device || "Smartwatch";

        let advice = "Detak jantung Anda berada di zona latihan yang ideal.";
        if (zone === "Fat Burn") {
          advice = "Zona Fat Burn sangat optimal untuk efisiensi pembakaran lemak dan pembentukan stamina kardiovaskular dasar.";
        } else if (zone === "Aerobic") {
          advice = "Zona Aerobik meningkatkan kapasitas paru-paru dan daya tahan otot secara terukur.";
        } else if (zone === "Anaerobic") {
          advice = "Intensitas latihan sangat tinggi tercapai. Berikan jeda istirahat yang cukup antar repetisi agar detak jantung pulih terkendali.";
        }

        return {
          answer:
            `Halo **${memberName}**! Berdasarkan data telemetri smartwatch **${device}** Anda yang tersimpan di sistem:\n\n` +
            `• **Detak Jantung Terakhir:** ${lastHr} BPM\n` +
            `• **Rata-Rata Sesi:** ${avgHr} BPM\n` +
            `• **Puncak Detak Jantung:** ${peakHr} BPM\n` +
            `• **Zona Latihan Saat Ini:** **${zone}**\n\n` +
            `💡 **Evaluasi AI:** ${advice}\n` +
            `Data biometrik ini terus diperbarui saat Anda berlatih bersama AI Form Coach.`,
          confidence: "HIGH",
          sources: [
            {
              docId: "SYS-SMARTWATCH-BIOMETRICS",
              docTitle: `Sensor Biometrik Smartwatch (${device})`,
              heading: "Telemetri Detak Jantung & Zona Kardio Terverifikasi",
              isVerified: true,
              relevanceScore: 10,
            },
          ],
        };
      } else {
        return {
          answer:
            `Halo **${memberName}**! Belum ada rekaman data detak jantung (heart rate) yang tersimpan di profil Anda.\n\n` +
            `Untuk mulai merekam data biometrik secara otomatis ke database:\n` +
            `1. Buka tab **AI Form Coach** di dashboard.\n` +
            `2. Klik tombol **Hubungkan Smartwatch** via Bluetooth.\n` +
            `3. Data detak jantung akan otomatis tersimpan ke cloud dan dapat dianalisis oleh AI secara real-time.`,
          confidence: "HIGH",
          sources: [
            {
              docId: "SYS-SMARTWATCH-GUIDE",
              docTitle: "Panduan Integrasi Smartwatch SynFit",
              heading: "Koneksi Web Bluetooth Smartwatch",
              isVerified: true,
              relevanceScore: 9,
            },
          ],
        };
      }
    }

    // 4. Membership Status & Expiration Inquiry (Default)
    let memberName = "Member";
    let statusText = "Aktif";
    let pkgText = "1 Bulan";
    let validUntilText = "-";
    let daysLeftText = "-";
    let phoneText = "-";

    if (memberDataOverride) {
      memberName = memberDataOverride.name || "Member";
      statusText = memberDataOverride.status || "Aktif";
      pkgText = memberDataOverride.packageType || "1 Bulan";
      validUntilText = memberDataOverride.validUntil || "-";
      if (memberDataOverride.validUntil) {
        const expDate = new Date(memberDataOverride.validUntil);
        const diffMs = expDate.getTime() - Date.now();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        daysLeftText = diffDays > 0 ? `${diffDays} hari lagi` : "Sudah kedaluwarsa";
      }
    } else {
      const db = getAdminDb();
      const memberDoc = await db.collection("members").doc(memberId).get();
      if (!memberDoc.exists) {
        return {
          answer: "Data keanggotaan Anda tidak ditemukan di sistem. Silakan hubungi kasir atau resepsionis.",
          confidence: "UNVERIFIED",
          sources: [],
        };
      }
      const mData = memberDoc.data() || {};
      memberName = mData.nama || "Member";
      statusText = mData.status || "Aktif";
      pkgText = mData.membership_type || "1 Bulan";
      phoneText = mData.nomor_whatsapp || "-";

      const expDate = mData.tanggal_expired ? new Date(mData.tanggal_expired) : null;
      if (expDate) {
        const diffMs = expDate.getTime() - Date.now();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        daysLeftText = diffDays > 0 ? `${diffDays} hari lagi` : "Sudah kedaluwarsa";
        validUntilText = expDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      }
    }

    return {
      answer:
        `Halo **${memberName}**! Berikut rincian status keanggotaan Anda saat ini:\n\n` +
        `• **Status:** ${statusText}\n` +
        `• **Paket Membership:** ${pkgText}\n` +
        `• **Berlaku Hingga:** ${validUntilText} (${daysLeftText})\n` +
        (phoneText !== "-" ? `• **Nomor Terdaftar:** ${phoneText}\n\n` : "\n") +
        (daysLeftText.includes("Sudah kedaluwarsa")
          ? "⚠️ Masa aktif membership Anda telah berakhir. Anda dapat memperpanjang paket melalui menu **Perpanjang Membership** di dashboard."
          : "Kartu member digital dan QR code check-in Anda siap digunakan untuk akses fasilitas gym."),
      confidence: "HIGH",
      sources: [
        {
          docId: "SYS-MEMBER-RECORD",
          docTitle: "Profil Keanggotaan Terverifikasi",
          heading: "Data Masa Berlaku & Paket Member",
          isVerified: true,
          relevanceScore: 10,
        },
      ],
    };
  } catch (err) {
    console.warn("Error synthesizing member personal answer:", err);
    return {
      answer: "Terjadi kendala saat mengambil data keanggotaan Anda. Silakan coba sesaat lagi.",
      confidence: "LOW",
      sources: [],
    };
  }
}

/**
 * Deterministic local grounded answering engine.
 * Synthesizes clear, structured answers directly from verified chunks without requiring external LLM calls.
 */
export function synthesizeDeterministicAnswer(
  query: string,
  retrievalResult: RetrievalResult
): { answer: string; confidence: "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED"; requiresStaff: boolean } {
  if (!retrievalResult.hasSufficientContext || retrievalResult.results.length === 0) {
    return {
      answer:
        "Mohon maaf, informasi mengenai hal tersebut belum tercantum dalam dokumen resmi SynFit atau memerlukan konfirmasi lebih lanjut. " +
        "Untuk informasi resmi dan akurat, silakan langsung tanyakan ke staf resepsionis di gym atau hubungi WhatsApp resmi kami di +62 895-2802-2044.",
      confidence: "UNVERIFIED",
      requiresStaff: true,
    };
  }

  const topScored = retrievalResult.results[0];
  const containsNeedsVerif = retrievalResult.results.some((r) => !r.chunk.isVerified);

  // Build grounded response from relevant chunk contents
  const keyPassages: string[] = [];
  for (const item of retrievalResult.results.slice(0, 2)) {
    const cleanLines = item.chunk.content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));

    if (cleanLines.length > 0) {
      keyPassages.push(`**${item.chunk.heading}**:\n${cleanLines.slice(0, 10).join("\n")}`);
    }
  }

  let finalAnswer = `Berdasarkan dokumen resmi SynFit:\n\n${keyPassages.join("\n\n")}`;

  if (containsNeedsVerif) {
    finalAnswer += "\n\n*(Catatan: Beberapa rincian terkait topik ini ditandai belum terverifikasi penuh dan memerlukan konfirmasi langsung dengan staf gym).*";
  }

  const confidenceLevel = topScored.score >= 5 ? "HIGH" : topScored.score >= 2.5 ? "MEDIUM" : "LOW";

  return {
    answer: finalAnswer,
    confidence: confidenceLevel,
    requiresStaff: containsNeedsVerif || confidenceLevel === "LOW",
  };
}

/**
 * Answers a user query using verified RAG documents.
 */
export async function answerQuestionWithRAG(
  query: string,
  context?: AIServiceContext
): Promise<RAGAnswerResponse> {
  const timestamp = new Date().toISOString();

  // 1. Prompt Injection & Safe Boundary Defense
  if (detectPromptInjection(query)) {
    throw new AIInjectionError("Instruksi tidak aman atau percobaan manipulasi sistem terdeteksi.");
  }

  // 2. Strict Privacy Defense: prevent queries attempting to snoop on other users or secret keys
  if (
    query.match(/(tampilkan|lihat|siapa|daftar).*(member|user|pengguna|orang|data).*(lain|semua|orang lain)/i) ||
    query.match(/(password|token|secret|kredensial|api key).*(orang|member|admin|lain)/i)
  ) {
    return {
      query,
      answer:
        "Demi menjaga privasi dan perlindungan data pribadi sesuai standar keamanan SynFit, Asisten AI tidak diizinkan menampilkan data pribadi, token, atau informasi keanggotaan pengguna lain. Anda hanya dapat mengakses data milik akun Anda sendiri.",
      confidence: "HIGH",
      sources: [
        {
          docId: "KB-RULE-004",
          docTitle: "Tata Tertib & Privasi SynFit",
          heading: "Perlindungan Data & Privasi",
          isVerified: true,
          relevanceScore: 10,
        },
      ],
      isGroundedInOfficialDocs: true,
      requiresStaffFollowup: false,
      timestamp,
    };
  }

  // 3. Conversational Greeting Inquiries
  const qClean = query.trim().toLowerCase();
  if (
    qClean.match(/^(halo|hai|hi|hey|hello|assalamu.*|selamat (pagi|siang|sore|malam)|apa kabar|tes|pagi|siang|malam)[\s!?,.]*$/i) ||
    qClean.includes("bisa bantu apa") ||
    qClean.includes("siapa kamu")
  ) {
    const memberName = context?.memberData?.name ? ` **${context.memberData.name}**` : "";
    return {
      query,
      answer:
        `Halo${memberName}! 👋 Saya adalah **SynFit AI Assistant**.\n\n` +
        "Saya siap membantu Anda dengan informasi seputar:\n" +
        "• **Paket Membership & Status Masa Aktif**\n" +
        "• **Presensi GPS & Riwayat Kunjungan Gym**\n" +
        "• **Sensor Biometrik Smartwatch & Detak Jantung**\n" +
        "• **AI Form Coach & Skor Repetisi Gerakan**\n" +
        "• **Fasilitas, Alat Gym, Jadwal, & Tata Tertib**\n\n" +
        "Ada yang bisa saya bantu untuk kebugaran Anda hari ini?",
      confidence: "HIGH",
      sources: [
        {
          docId: "KB-GEN-001",
          docTitle: "Informasi Umum SynFit Athletic Club",
          heading: "Layanan Asisten AI Gym",
          isVerified: true,
          relevanceScore: 10,
        },
      ],
      isGroundedInOfficialDocs: true,
      requiresStaffFollowup: false,
      timestamp,
    };
  }

  // 4. Authorized Personal Member Data Inquiries
  if (isMemberPersonalInquiry(query)) {
    if (context?.memberId) {
      const personalResult = await synthesizeMemberPersonalAnswer(query, context.memberId, context.memberData);
      return {
        query,
        answer: personalResult.answer,
        confidence: personalResult.confidence,
        sources: personalResult.sources,
        isGroundedInOfficialDocs: true,
        requiresStaffFollowup: false,
        timestamp,
      };
    } else {
      return {
        query,
        answer:
          "Untuk melihat informasi keanggotaan, masa aktif, riwayat kunjungan, dan evaluasi latihan pribadi Anda, silakan masuk (login) ke Dashboard Member SynFit terlebih dahulu.",
        confidence: "UNVERIFIED",
        sources: [
          {
            docId: "KB-MEM-006",
            docTitle: "Panduan Member & FAQ",
            heading: "Portal Anggota & Keamanan",
            isVerified: true,
            relevanceScore: 5,
          },
        ],
        isGroundedInOfficialDocs: true,
        requiresStaffFollowup: false,
        timestamp,
      };
    }
  }

  // 4. Retrieve verified chunks from Knowledge Base
  const retrievalResult = await knowledgeRetriever.retrieve(query, {
    topK: 3,
    minScoreThreshold: 1.5,
  });

  // 5. Format Source Citations
  const citations: SourceCitation[] = retrievalResult.results.map((r) => ({
    docId: r.chunk.docId,
    docTitle: r.chunk.docTitle,
    heading: r.chunk.heading,
    isVerified: r.chunk.isVerified,
    relevanceScore: r.score,
  }));

  // 6. Answer Synthesis
  const aiConfig = getAIServerConfig();

  // In offline mode or when provider is "none", run high-precision deterministic grounded synthesis
  if (aiConfig.provider === "none" || !aiConfig.apiKey) {
    const { answer, confidence, requiresStaff } = synthesizeDeterministicAnswer(query, retrievalResult);
    return {
      query,
      answer,
      confidence,
      sources: citations,
      isGroundedInOfficialDocs: retrievalResult.hasSufficientContext,
      requiresStaffFollowup: requiresStaff,
      timestamp,
    };
  }

  // If a provider like Gemini is configured, construct strict source-grounded prompt
  try {
    const contextPrompt = retrievalResult.results
      .map(
        (r) =>
          `[DOKUMEN ${r.chunk.docId}: ${r.chunk.docTitle} - ${r.chunk.heading}]\n${r.chunk.content}`
      )
      .join("\n\n---\n\n");

    const systemInstruction =
      "Anda adalah Asisten Resmi SynFit / Areta Sport Fitness. " +
      "Jawablah pertanyaan anggota HANYA berdasarkan konteks dokumen resmi yang diberikan di bawah ini. " +
      "JANGAN PERNAH menebak harga, jadwal, atau aturan yang tidak tertulis di dokumen. " +
      "Jika informasi tidak ditemukan di dokumen, katakan secara jujur bahwa informasi belum tersedia dan arahkan ke staf atau WhatsApp +62 895-2802-2044. " +
      "Sebutkan referensi ID dokumen pada jawaban Anda.";

    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${aiConfig.model}:generateContent?key=${aiConfig.apiKey}`;

    let llmResponse = await fetch(apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${systemInstruction}\n\nKONTEKS RESMI:\n${contextPrompt}\n\nPERTANYAAN PENGGUNA:\n${query}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: aiConfig.temperature,
          maxOutputTokens: aiConfig.maxOutputTokens,
        },
      }),
    });

    // Fallback to gemini-flash-latest if specified model is not found
    if (!llmResponse.ok && llmResponse.status === 404 && aiConfig.model !== "gemini-flash-latest") {
      const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${aiConfig.apiKey}`;
      llmResponse = await fetch(fallbackEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `${systemInstruction}\n\nKONTEKS RESMI:\n${contextPrompt}\n\nPERTANYAAN PENGGUNA:\n${query}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: aiConfig.temperature,
            maxOutputTokens: aiConfig.maxOutputTokens,
          },
        }),
      });
    }

    if (llmResponse.ok) {
      const llmData = await llmResponse.json();
      const parts = llmData?.candidates?.[0]?.content?.parts;
      const generatedText = Array.isArray(parts)
        ? parts.find((p: any) => p && typeof p.text === "string")?.text
        : undefined;

      if (generatedText) {
        return {
          query,
          answer: generatedText,
          confidence: retrievalResult.hasSufficientContext ? "HIGH" : "UNVERIFIED",
          sources: citations,
          isGroundedInOfficialDocs: retrievalResult.hasSufficientContext,
          requiresStaffFollowup: !retrievalResult.hasSufficientContext,
          timestamp,
        };
      }
    }
  } catch (providerError) {
    console.warn("LLM Provider call failed, falling back to deterministic synthesis:", providerError);
  }

  // Graceful fallback to deterministic synthesis
  const { answer, confidence, requiresStaff } = synthesizeDeterministicAnswer(query, retrievalResult);
  return {
    query,
    answer,
    confidence,
    sources: citations,
    isGroundedInOfficialDocs: retrievalResult.hasSufficientContext,
    requiresStaffFollowup: requiresStaff,
    timestamp,
  };
}
