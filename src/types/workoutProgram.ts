export type ProgramSource = "manual" | "ai";
export type ProgramStatus = "draft" | "active" | "completed" | "archived";

export interface ProgramExercise {
  exerciseId: string;
  name: string;
  primaryMuscle: string;
  equipmentId: string; // References ID from EQUIPMENT_TUTORIALS
  equipmentName: string;
  tutorialId: string; // Valid ID in equipmentTutorials
  hasAiCoach: boolean;
  aiCoachType?: "squat" | "push_up" | "bicep_curl";
  targetSets: number;
  targetReps: string; // e.g., "8-12 reps", "12 reps", "30-45 detik"
  restSeconds: number; // e.g. 60, 90
  order: number;
  notes?: string;
}

export interface ProgramSession {
  sessionId: string;
  dayNumber: number; // 1 to 7
  dayName: string; // e.g. "Sesi 1 - Dada & Triceps"
  focus: string; // e.g. "Push Strength & Chest Growth"
  estimatedDurationMinutes: number;
  exercises: ProgramExercise[];
}

export interface ProgramPreferences {
  goal: "hypertrophy" | "strength" | "fat_loss" | "endurance" | "habit" | "other";
  goalCustom?: string;
  experienceLevel: "pemula" | "menengah" | "lanjutan";
  daysPerWeek: number; // 2, 3, 4, 5, 6
  sessionDurationMinutes: number; // 30, 45, 60, 90
  preferredTime?: "pagi" | "siang" | "sore" | "malam";
  facility: "full_gym" | "limited_gym" | "home" | "hybrid";
  equipmentAvailable: string[];
  preferredModality: "machines" | "freeweights" | "bodyweight" | "combined";
  priorityMuscles: string[];
  avoidMuscles: string[];
  splitPreference: "full_body" | "upper_lower" | "push_pull_legs" | "auto";
  constraints: {
    hasConstraints: boolean;
    avoidExercises?: string[];
    injuredAreas?: string[];
    notes?: string;
  };
}

export interface ProgramRecommendationOption {
  id: string;
  name: string;
  tagline: string;
  description: string;
  reasonForRecommendation: string;
  primaryGoal: string;
  difficulty: "Pemula" | "Menengah" | "Lanjutan";
  daysPerWeek: number;
  estimatedDurationMinutes: number;
  muscleFocus: string[];
  equipmentNeeded: string[];
  pros: string[];
  tradeOffs: string[];
  sessions: ProgramSession[];
}

export interface ScheduledSessionHistory {
  sessionId: string;
  scheduledDate: string; // YYYY-MM-DD
  actualDate?: string; // YYYY-MM-DD
  actualCompletedAt?: string; // ISO
  workoutSessionDocId?: string; // Reference to workout_sessions collection doc
  status: "completed" | "skipped";
}

export interface WorkoutProgram {
  id: string;
  memberId: string;
  name: string;
  description: string;
  source: ProgramSource;
  status: ProgramStatus;
  preferences: ProgramPreferences;
  sessions: ProgramSession[];
  currentWeek: number;
  totalWeeks: number;
  startDate?: string; // YYYY-MM-DD local
  endDate?: string; // YYYY-MM-DD local
  completedSessionIds: string[]; // actual recorded session IDs from tracker
  sessionHistory?: ScheduledSessionHistory[];
  version: number;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
  history?: Array<{
    timestamp: string;
    action: string;
    details?: string;
  }>;
}

export interface ProgramValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
