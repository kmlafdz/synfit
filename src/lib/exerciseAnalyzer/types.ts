export type ExerciseType = "squat" | "push_up" | "bicep_curl";

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type PoseLandmarks = NormalizedLandmark[];

export type SquatPhase = "STANDING" | "DESCENDING" | "BOTTOM" | "ASCENDING";
export type PushUpPhase = "UP" | "DOWN";
export type BicepCurlPhase = "EXTENDED" | "CURLING" | "CONTRACTED";

export type MovementPhase = SquatPhase | PushUpPhase | BicepCurlPhase | "READY";

export type FormCategory = "Excellent" | "Good" | "Needs Improvement" | "Poor";

export interface FormFeedback {
  id: string;
  message: string;
  type: "good" | "warning" | "info";
  timestamp: number;
}

export interface FormScoreBreakdown {
  posture: number;
  alignment: number;
  rangeOfMotion: number;
  tempo: number;
  consistency: number;
}

export interface PreparationStatus {
  cameraReady: boolean;
  poseDetected: boolean;
  fullBodyVisible: boolean;
  distanceStatus: "ideal" | "too_close" | "too_far" | "not_detected";
  guidanceMessage: string;
}

export interface LiveAnalysisFrame {
  exercise: ExerciseType;
  currentPhase: MovementPhase;
  completedReps: number;
  targetReps: number;
  currentFormScore: number;
  formCategory: FormCategory;
  primaryAngle: number;
  secondaryAngle?: number;
  feedbacks: FormFeedback[];
  isRepCompletedThisFrame: boolean;
  prepStatus: PreparationStatus;
}

export interface WorkoutSetResult {
  exercise: ExerciseType;
  setNumber: number;
  targetReps: number;
  completedReps: number;
  formScore: number;
  durationSeconds: number;
  status: "active" | "completed" | "incomplete" | "cancelled";
  feedbacks: string[];
  metrics: {
    rangeOfMotion: string;
    alignment: string;
    tempo: string;
  };
  summaryAdvice: string;
}

export interface WorkoutExerciseSummary {
  exercise: ExerciseType;
  name: string;
  completedSets: number;
  incompleteSets: number;
  totalReps: number;
  averageFormScore: number;
  sets: WorkoutSetResult[];
}

export interface WorkoutSessionSummary {
  id?: string;
  memberId: string;
  startedAt: Date;
  completedAt: Date;
  durationMinutes: number;
  exerciseCount: number;
  completedSets: number;
  incompleteSets: number;
  totalReps: number;
  averageFormScore: number;
  exercises: WorkoutExerciseSummary[];
  overallFeedback: string;
  avgHeartRate?: number | null;
  maxHeartRate?: number | null;
  minHeartRate?: number | null;
  caloriesBurned?: number | null;
  deviceName?: string | null;
  cardioZone?: string | null;
  heartRateSamples?: any[];
}
