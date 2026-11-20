/**
 * SYNFIT AI FOUNDATION - TYPE DEFINITIONS
 * Defines strict contracts for upcoming AI modules without adding external dependencies.
 */

export type AIModuleType =
  | "assistant"
  | "knowledge_base"
  | "exercise_form"
  | "workout_planner"
  | "progress_analyzer"
  | "business_insight"
  | "churn_prediction"
  | "maintenance_assistant";

export type AIUserRole = "OWNER" | "DEVELOPER" | "ADMIN" | "MEMBER";

export interface AIMemberContextData {
  name?: string;
  code?: string;
  status?: string;
  validUntil?: string;
  packageType?: string;
  visitsThisMonth?: number;
  lastCheckin?: string;
  workoutsCompleted?: number;
  avgFormScore?: number;
}

export interface AIServiceContext {
  userId: string;
  role: AIUserRole;
  memberId?: string;
  requestId: string;
  timestamp: string;
  authenticated?: boolean;
  memberData?: AIMemberContextData;
}

// 1. AI Assistant Contracts
export interface AIAssistantMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface AIAssistantRequest {
  context: AIServiceContext;
  prompt: string;
  conversationHistory?: AIAssistantMessage[];
  intent?: "faq" | "schedule" | "membership" | "general";
}

export interface AIAssistantResponse {
  requestId: string;
  content: string;
  suggestedActions?: Array<{ label: string; action: string; payload?: unknown }>;
  sources?: string[];
}

// 2. Knowledge Base & RAG Contracts
export interface KnowledgeDocument {
  id: string;
  title: string;
  category: "facility" | "rules" | "pricing" | "exercise_standard" | "faq";
  content: string;
  verifiedBy: string;
  updatedAt: string;
  version: string;
}

export interface KnowledgeRetrievalQuery {
  query: string;
  category?: string;
  topK?: number;
}

export interface KnowledgeRetrievalResult {
  documents: Array<{
    document: KnowledgeDocument;
    relevanceScore: number;
  }>;
}

// 3. AI Exercise Form Telemetry Contracts (Extending client-side MediaPipe analysis)
export interface ExerciseFormTelemetryInput {
  memberId: string;
  exercise: "squat" | "push_up" | "bicep_curl";
  totalReps: number;
  validReps: number;
  formScore: number;
  repBreakdowns: Array<{
    repNumber: number;
    score: number;
    durationMs: number;
    warnings: string[];
    jointAngles: Record<string, number>;
  }>;
}

export interface ExerciseFormInsightResponse {
  overallFormRating: "Excellent" | "Good" | "Needs Improvement" | "Poor";
  biomechanicalFindings: string[];
  injuryRiskAssessment: "Low" | "Medium" | "High";
  recommendedCorrectionDrills: string[];
}

// 4. AI Workout Plan Generator Contracts
export interface WorkoutPlanRequest {
  context: AIServiceContext;
  memberProfile: {
    age?: number;
    gender?: "male" | "female";
    heightCm?: number;
    weightKg?: number;
    fitnessGoal: "hypertrophy" | "fat_loss" | "strength" | "general_health";
    experienceLevel: "beginner" | "intermediate" | "advanced";
    daysPerWeek: number;
    medicalNotes?: string;
  };
}

export interface WorkoutExerciseItem {
  name: string;
  targetMuscle: string;
  sets: number;
  reps: string;
  restSeconds: number;
  tempo?: string;
  notes?: string;
  availableEquipmentId?: string;
}

export interface WorkoutDayPlan {
  dayName: string;
  focus: string;
  exercises: WorkoutExerciseItem[];
}

export interface WorkoutPlanResponse {
  planId: string;
  generatedAt: string;
  memberId: string;
  weeklySchedule: WorkoutDayPlan[];
  deterministicBmr?: number;
  deterministicTdee?: number;
  guidelines: string[];
}

// 5. AI Progress Analyzer Contracts
export interface MemberProgressMetrics {
  memberId: string;
  attendanceCount30d: number;
  workoutSessionCount30d: number;
  averageFormScore30d: number;
  initialWeightKg?: number;
  currentWeightKg?: number;
  recordedPeriodDays: number;
}

export interface ProgressAnalysisResponse {
  consistencyScore: number; // 0-100 deterministic
  adherenceRate: number; // percentage deterministic
  keyStrengths: string[];
  areasForImprovement: string[];
  milestoneFeedback: string;
}

// 6. AI Business Insight Contracts (Admin / Owner Only)
export interface BusinessMetricsSnapshot {
  periodMonth: string; // YYYY-MM
  totalRevenue: number;
  newMemberCount: number;
  activeMemberCount: number;
  expiredMemberCount: number;
  totalCheckins: number;
  equipmentUnderMaintenanceCount: number;
}

export interface BusinessInsightResponse {
  periodMonth: string;
  executiveSummary: string;
  revenueTrendObservation: string;
  utilizationInsight: string;
  recommendedStaffActions: string[];
}

// 7. AI Churn Prediction Contracts
export interface ChurnPredictionInput {
  memberId: string;
  daysUntilExpiry: number;
  attendanceLast30d: number;
  attendancePrevious30d: number;
  daysSinceLastVisit: number;
  hasRenewedBefore: boolean;
  membershipPlan: string;
}

export interface ChurnPredictionResult {
  memberId: string;
  churnRiskScore: number; // 0.0 - 1.0 deterministic + model
  riskLevel: "Low" | "Medium" | "High";
  riskIndicators: string[];
  recommendedRetentionAction: string;
}

// 8. AI Maintenance Assistant Contracts (Equipment SPK Augmentation)
export interface EquipmentMaintenanceInput {
  equipmentId: string;
  name: string;
  category: string;
  condition: string;
  sawScore: number; // Deterministic Simple Additive Weighting score
  sawPriorityRank: number;
  criteriaRatings: {
    kerusakan: number;
    pemakaian: number;
    umur: number;
    biaya: number;
    risiko: number;
  };
  evaluatorNotes?: string;
}

export interface EquipmentMaintenanceRecommendation {
  equipmentId: string;
  urgency: "Immediate" | "Scheduled" | "Monitor";
  prescribedAction: string;
  estimatedLaborWindow: string;
  spkAlignmentExplanation: string;
}
