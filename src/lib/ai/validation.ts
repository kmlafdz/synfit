/**
 * SYNFIT AI FOUNDATION - INPUT VALIDATION & ERROR SANITIZATION
 * Strict Zod validation schemas and error response sanitizer.
 * Guarantees no sensitive server internals or stack traces leak to the client.
 */

import { z } from "zod";
import { AIServiceError, AIValidationError } from "./errors";

// 1. Base Prompt Validation
export const aiPromptSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(2, "Prompt must contain at least 2 characters")
    .max(1000, "Prompt cannot exceed 1000 characters")
    .refine((val) => !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(val), {
      message: "Prompt contains invalid control characters",
    }),
  intent: z.enum(["faq", "schedule", "membership", "general"]).optional(),
});

// 2. Workout Plan Generator Input Schema
export const workoutPlanRequestSchema = z.object({
  targetMemberId: z.string().min(1, "targetMemberId is required"),
  age: z.number().int().min(12).max(100).optional(),
  gender: z.enum(["male", "female"]).optional(),
  heightCm: z.number().min(80).max(250).optional(),
  weightKg: z.number().min(30).max(300).optional(),
  fitnessGoal: z.enum(["hypertrophy", "fat_loss", "strength", "general_health"]),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
  daysPerWeek: z.number().int().min(1).max(7),
  medicalNotes: z.string().max(500, "Medical notes cannot exceed 500 characters").optional(),
});

// 3. Exercise Form Telemetry Schema
export const exerciseTelemetrySchema = z.object({
  targetMemberId: z.string().min(1, "targetMemberId is required"),
  exercise: z.enum(["squat", "push_up", "bicep_curl"]),
  totalReps: z.number().int().min(1).max(500),
  validReps: z.number().int().min(0).max(500),
  formScore: z.number().min(0).max(100),
  repBreakdowns: z
    .array(
      z.object({
        repNumber: z.number().int().min(1),
        score: z.number().min(0).max(100),
        durationMs: z.number().nonnegative(),
        warnings: z.array(z.string().max(200)),
        jointAngles: z.record(z.string(), z.number()),
      })
    )
    .max(100),
});

// 4. Business Metrics Query Schema
export const businessInsightQuerySchema = z.object({
  periodMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "periodMonth must follow 'YYYY-MM' format (e.g., 2026-10)"),
});

// 5. Equipment SPK Context Query Schema
export const equipmentMaintenanceQuerySchema = z.object({
  equipmentId: z.string().min(1, "equipmentId is required"),
});

// 6. Workout Session Storage Payload Schema
export const workoutExerciseItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  completed_sets: z.number().int().min(0).max(200),
  total_reps: z.number().int().min(0).max(5000),
  average_form_score: z.number().min(0).max(100),
});

export const workoutSessionPayloadSchema = z.object({
  member_id: z.string().optional(),
  member_name: z.string().trim().max(100).optional(),
  duration_minutes: z.number().int().min(0, "Duration cannot be negative").max(1440, "Duration cannot exceed 24 hours"),
  exercise_count: z.number().int().min(0, "Exercise count cannot be negative").max(50),
  completed_sets: z.number().int().min(0, "Completed sets cannot be negative").max(200),
  incomplete_sets: z.number().int().min(0, "Incomplete sets cannot be negative").max(200),
  total_reps: z.number().int().min(0, "Total reps cannot be negative").max(5000, "Total reps cannot exceed 5000"),
  average_form_score: z.number().min(0).max(100, "Form score must be between 0 and 100"),
  overall_feedback: z.string().trim().max(500).optional(),
  exercises: z.array(workoutExerciseItemSchema).max(50).default([]),
  // Smartwatch Heart Rate Telemetry
  avg_heart_rate: z.number().min(0).max(300).nullable().optional(),
  max_heart_rate: z.number().min(0).max(300).nullable().optional(),
  min_heart_rate: z.number().min(0).max(300).nullable().optional(),
  calories_burned: z.number().min(0).max(10000).nullable().optional(),
  device_name: z.string().trim().max(100).nullable().optional(),
  heart_rate_zone: z.string().trim().max(50).nullable().optional(),
  heart_rate_samples: z
    .array(
      z.object({
        time: z.string().max(30),
        bpm: z.number().min(0).max(300),
        contactDetected: z.boolean().optional(),
      })
    )
    .max(100)
    .optional(),
});

/**
 * Validates any payload against a Zod schema, throwing a typed AIValidationError if invalid.
 */
export function validatePayload<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errorDetails = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
    throw new AIValidationError(`Validation failed: ${errorDetails}`);
  }
  return result.data;
}

/**
 * Sanitizes any caught error into a safe, client-facing JSON structure.
 * Suppresses stack traces, database credentials, internal file paths, and environment leaks.
 */
export function sanitizeErrorResponse(error: unknown): {
  success: false;
  error: string;
  code: string;
  statusCode: number;
} {
  if (error instanceof AIServiceError) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
    };
  }

  // Handle generic / unexpected server error without leaking internals
  const rawMessage = error instanceof Error ? error.message : "Internal server error";
  
  // Mask sensitive keywords
  const isSensitive = /key|token|credential|firestore|password|secret|database|auth/i.test(rawMessage);
  const safeMessage = isSensitive
    ? "A secure internal error occurred. Please contact the administrator."
    : rawMessage;

  return {
    success: false,
    error: safeMessage,
    code: "AI_PROVIDER_ERROR",
    statusCode: 500,
  };
}
