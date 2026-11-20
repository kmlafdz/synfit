/**
 * SYNFIT AI FOUNDATION - SERVER-SIDE DATA ACCESS LAYER (DAL)
 * Provides strictly scoped, sanitized, and minimized data access for AI features.
 * AI models NEVER access Firestore directly. All queries are authenticated,
 * isolated, stripped of unnecessary PII, and calculate metrics deterministically.
 */

import { getAdminDb } from "../firebase-admin";
import { AIServiceContext } from "./types";
import { assertMemberOwnership, assertRole } from "./sessionGuard";
import { AIServiceError } from "./errors";

export interface SanitizedMemberProfile {
  memberId: string;
  name: string;
  membershipType: string;
  status: string;
  gender?: "male" | "female";
  age?: number;
  heightCm?: number;
  weightKg?: number;
  fitnessGoal?: string;
}

export interface DeterministicAttendanceMetrics {
  memberId: string;
  lookbackDays: number;
  totalVisits: number;
  averageDurationMinutes: number;
  lastVisitDate: string | null;
}

export interface SanitizedWorkoutHistoryItem {
  id: string;
  exercise: string;
  totalReps: number;
  validReps: number;
  formScore: number;
  date: string;
}

export interface DeterministicBusinessMetrics {
  periodMonth: string;
  totalRevenue: number;
  cashRevenue: number;
  qrisRevenue: number;
  transactionCount: number;
  activeMemberCount: number;
  expiredMemberCount: number;
  totalCheckinsInPeriod: number;
  equipmentUnderMaintenanceCount: number;
}

export interface SanitizedEquipmentContext {
  equipmentId: string;
  name: string;
  category: string;
  condition: string;
  sawScore?: number;
  criteriaRatings: {
    kerusakan: number;
    pemakaian: number;
    umur: number;
    biaya: number;
    risiko: number;
  };
}

/**
 * Retrieves a sanitized member profile for AI context.
 * Strips phone numbers, home addresses, password references, QR tokens, and payment images.
 */
export async function getMemberAIProfile(
  context: AIServiceContext,
  targetMemberId: string
): Promise<SanitizedMemberProfile> {
  // 1. Authorization: caller must own the memberId or be staff
  assertMemberOwnership(context, targetMemberId);

  const db = getAdminDb();
  const docRef = db.collection("members").doc(targetMemberId);
  const snap = await docRef.get();

  if (!snap.exists) {
    throw new AIServiceError(`Member with ID '${targetMemberId}' not found`, "AI_DATA_MISSING", 404);
  }

  const data = snap.data() || {};

  return {
    memberId: snap.id,
    name: data.nama || "Member",
    membershipType: data.paket_membership || data.tipe_membership || "Standard",
    status: data.status || "active",
    gender: data.gender || data.jenis_kelamin || undefined,
    age: data.umur ? Number(data.umur) : undefined,
    heightCm: data.tinggi_badan ? Number(data.tinggi_badan) : undefined,
    weightKg: data.berat_badan ? Number(data.berat_badan) : undefined,
    fitnessGoal: data.fitness_goal || data.tujuan_fitness || "general_health",
  };
}

/**
 * Calculates deterministic attendance metrics for a member.
 */
export async function getMemberAttendanceMetrics(
  context: AIServiceContext,
  targetMemberId: string,
  daysLookback = 30
): Promise<DeterministicAttendanceMetrics> {
  assertMemberOwnership(context, targetMemberId);

  const db = getAdminDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysLookback);

  // Query checkins collection scoped strictly to this member
  const snap = await db
    .collection("checkins")
    .where("member_id", "==", targetMemberId)
    .get();

  let totalVisits = 0;
  let totalDurationMinutes = 0;
  let durationSamples = 0;
  let lastVisitDate: string | null = null;

  for (const doc of snap.docs) {
    const d = doc.data();
    const checkinTime = d.checkin_time?.toDate ? d.checkin_time.toDate() : new Date(d.checkin_time || d.created_at || 0);

    if (checkinTime >= cutoffDate) {
      totalVisits++;

      if (d.duration && typeof d.duration === "number") {
        totalDurationMinutes += d.duration;
        durationSamples++;
      }

      if (!lastVisitDate || checkinTime.toISOString() > lastVisitDate) {
        lastVisitDate = checkinTime.toISOString();
      }
    }
  }

  const averageDuration = durationSamples > 0 ? Math.round(totalDurationMinutes / durationSamples) : 0;

  return {
    memberId: targetMemberId,
    lookbackDays: daysLookback,
    totalVisits,
    averageDurationMinutes: averageDuration,
    lastVisitDate,
  };
}

/**
 * Retrieves sanitized workout history for a member.
 */
export async function getMemberWorkoutHistory(
  context: AIServiceContext,
  targetMemberId: string,
  limitCount = 10
): Promise<SanitizedWorkoutHistoryItem[]> {
  assertMemberOwnership(context, targetMemberId);

  const db = getAdminDb();
  const snap = await db
    .collection("workout_sessions")
    .where("member_id", "==", targetMemberId)
    .limit(limitCount)
    .get();

  return snap.docs.map((doc) => {
    const d = doc.data();
    const createdAt = d.created_at?.toDate
      ? d.created_at.toDate().toISOString()
      : typeof d.created_at === "string"
      ? d.created_at
      : new Date().toISOString();

    return {
      id: doc.id,
      exercise: d.exercise || "unknown",
      totalReps: Number(d.total_reps || d.totalReps || 0),
      validReps: Number(d.valid_reps || d.validReps || 0),
      formScore: Number(d.form_score || d.formScore || 0),
      date: createdAt,
    };
  });
}

/**
 * Computes deterministic business metrics for administrative analysis.
 * Strictly forbidden for MEMBER role.
 */
export async function getBusinessMetricsSnapshot(
  context: AIServiceContext,
  periodMonth: string // "YYYY-MM"
): Promise<DeterministicBusinessMetrics> {
  assertRole(context, ["OWNER", "DEVELOPER", "ADMIN"]);

  const db = getAdminDb();

  // 1. Transactions Aggregation
  const transSnap = await db.collection("transactions").get();
  let totalRevenue = 0;
  let cashRevenue = 0;
  let qrisRevenue = 0;
  let transactionCount = 0;

  for (const doc of transSnap.docs) {
    const data = doc.data();
    const dateStr = data.date || data.tanggal || "";
    // Filter matching month format "YYYY-MM"
    if (typeof dateStr === "string" && dateStr.startsWith(periodMonth)) {
      const amount = Number(data.amount || data.total || data.nominal || 0);
      totalRevenue += amount;
      transactionCount++;

      const method = (data.method || data.metode || "").toUpperCase();
      if (method === "CASH" || method === "TUNAI") {
        cashRevenue += amount;
      } else if (method === "QRIS") {
        qrisRevenue += amount;
      }
    }
  }

  // 2. Members Count
  const membersSnap = await db.collection("members").get();
  let activeMemberCount = 0;
  let expiredMemberCount = 0;

  const now = new Date();
  for (const doc of membersSnap.docs) {
    const data = doc.data();
    const expiry = data.tanggal_berakhir ? new Date(data.tanggal_berakhir) : null;
    const isExpired = expiry ? expiry < now : data.status === "expired";

    if (isExpired) {
      expiredMemberCount++;
    } else {
      activeMemberCount++;
    }
  }

  // 3. Checkins Count
  const checkinsSnap = await db.collection("checkins").get();
  let totalCheckinsInPeriod = 0;

  for (const doc of checkinsSnap.docs) {
    const data = doc.data();
    const timeStr = data.checkin_time?.toDate
      ? data.checkin_time.toDate().toISOString()
      : typeof data.checkin_time === "string"
      ? data.checkin_time
      : "";

    if (timeStr.startsWith(periodMonth)) {
      totalCheckinsInPeriod++;
    }
  }

  // 4. Equipment Under Maintenance Count
  const equipSnap = await db.collection("equipment").get();
  let equipmentUnderMaintenanceCount = 0;

  for (const doc of equipSnap.docs) {
    const data = doc.data();
    const condition = (data.condition || data.kondisi || "").toLowerCase();
    if (condition.includes("rusak") || condition.includes("maintenance") || condition.includes("perbaikan")) {
      equipmentUnderMaintenanceCount++;
    }
  }

  return {
    periodMonth,
    totalRevenue,
    cashRevenue,
    qrisRevenue,
    transactionCount,
    activeMemberCount,
    expiredMemberCount,
    totalCheckinsInPeriod,
    equipmentUnderMaintenanceCount,
  };
}

/**
 * Retrieves sanitized equipment data and SAW criteria ratings for maintenance analysis.
 */
export async function getEquipmentMaintenanceContext(
  context: AIServiceContext,
  equipmentId: string
): Promise<SanitizedEquipmentContext> {
  assertRole(context, ["OWNER", "DEVELOPER", "ADMIN"]);

  const db = getAdminDb();
  const snap = await db.collection("equipment").doc(equipmentId).get();

  if (!snap.exists) {
    throw new AIServiceError(`Equipment '${equipmentId}' not found`, "AI_DATA_MISSING", 404);
  }

  const d = snap.data() || {};

  return {
    equipmentId: snap.id,
    name: d.name || d.nama || "Equipment",
    category: d.category || d.kategori || "General",
    condition: d.condition || d.kondisi || "Good",
    sawScore: d.sawScore ? Number(d.sawScore) : undefined,
    criteriaRatings: {
      kerusakan: Number(d.kerusakan || d.c1 || 1),
      pemakaian: Number(d.pemakaian || d.c2 || 1),
      umur: Number(d.umur || d.c3 || 1),
      biaya: Number(d.biaya || d.c4 || 1),
      risiko: Number(d.risiko || d.c5 || 1),
    },
  };
}
