import {
  WorkoutProgram,
  ProgramSession,
  ProgramPreferences,
  ProgramValidationResult,
  ProgramRecommendationOption,
} from "@/types/workoutProgram";
import { WORKOUT_EXERCISE_CATALOG, getExerciseById } from "@/data/workoutExerciseCatalog";
import { EQUIPMENT_TUTORIALS } from "@/data/equipmentTutorials";

/**
 * Validates a program session list against user constraints and exercise catalogs.
 */
export function validateProgramStructure(
  sessions: ProgramSession[],
  preferences: ProgramPreferences
): ProgramValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validate Schedule vs Availability
  if (sessions.length !== preferences.daysPerWeek) {
    errors.push(
      `Jumlah sesi latihan (${sessions.length} hari) tidak cocok dengan ketersediaan Anda (${preferences.daysPerWeek} hari per minggu).`
    );
  }

  if (sessions.length === 0) {
    errors.push("Program harus memiliki minimal satu sesi latihan aktif.");
    return { isValid: false, errors, warnings };
  }

  // 2. Validate Movement References against Catalog
  for (const session of sessions) {
    if (!session.exercises || session.exercises.length === 0) {
      errors.push(`Sesi "${session.dayName}" tidak memiliki daftar gerakan latihan.`);
      continue;
    }

    if (session.exercises.length > 8) {
      warnings.push(
        `Sesi "${session.dayName}" memiliki ${session.exercises.length} latihan (sangat padat). Disarankan maksimal 5-7 latihan agar fokus.`
      );
    }

    let calculatedEstimatedMinutes = 0;

    for (const ex of session.exercises) {
      const catalogItem = getExerciseById(ex.exerciseId);
      if (!catalogItem) {
        errors.push(
          `Gerakan dengan ID "${ex.exerciseId}" tidak terdaftar dalam katalog resmi SynFit.`
        );
        continue;
      }

      // Check equipment tutorial reference
      const tutorialExists = EQUIPMENT_TUTORIALS.some(
        (t) => t.id === ex.equipmentId || t.id === catalogItem.equipmentId
      );
      if (!tutorialExists) {
        warnings.push(
          `Panduan alat "${ex.equipmentName}" (ID: ${ex.equipmentId}) tidak ditemukan di pustaka tutorial.`
        );
      }

      // Estimate time: sets * (1.2 min per set + restSeconds)
      const restMin = (ex.restSeconds || 60) / 60;
      calculatedEstimatedMinutes += ex.targetSets * (1.2 + restMin);

      // Check experience level compliance
      if (
        preferences.experienceLevel === "pemula" &&
        catalogItem.difficulty === "Lanjutan"
      ) {
        warnings.push(
          `Latihan "${catalogItem.name}" bertaraf Lanjutan. Pastikan didampingi instruktur atau ganti dengan variasi mesin.`
        );
      }

      // Check user injury constraints
      if (
        preferences.constraints?.hasConstraints &&
        preferences.constraints.injuredAreas &&
        preferences.constraints.injuredAreas.length > 0
      ) {
        for (const injury of preferences.constraints.injuredAreas) {
          const lowerInjury = injury.toLowerCase();
          if (
            catalogItem.contraindications.some((c) =>
              c.toLowerCase().includes(lowerInjury)
            )
          ) {
            warnings.push(
              `Perhatian: "${catalogItem.name}" melibatkan area ${injury}. Lakukan dengan beban ringan atau modifikasi jika terasa nyeri.`
            );
          }
        }
      }

      // Check AI Coach validity
      if (ex.hasAiCoach) {
        const genuineAi = ["squat", "push_up", "bicep_curl"].includes(
          ex.exerciseId
        );
        if (!genuineAi) {
          // Reset false claim
          ex.hasAiCoach = false;
          delete ex.aiCoachType;
        }
      }
    }

    // 3. Validate Session Duration Feasibility
    const targetDuration = preferences.sessionDurationMinutes || 60;
    const diff = Math.abs(calculatedEstimatedMinutes - targetDuration);
    if (diff > 35) {
      warnings.push(
        `Perkiraan durasi sesi "${session.dayName}" (~${Math.round(
          calculatedEstimatedMinutes
        )} menit) agak berbeda dari target durasi Anda (${targetDuration} menit).`
      );
    }
  }

  // 4. Validate Muscle Recovery & Balance
  // Check if consecutive sessions over-train the exact same primary muscle
  for (let i = 0; i < sessions.length - 1; i++) {
    const s1 = sessions[i];
    const s2 = sessions[i + 1];

    const s1Muscles = new Set(s1.exercises.map((e) => e.primaryMuscle));
    const s2Muscles = new Set(s2.exercises.map((e) => e.primaryMuscle));

    const commonMuscles = [...s1Muscles].filter(
      (m) => s2Muscles.has(m) && m !== "Core" && m !== "Kardio"
    );

    // If full body every day for 4+ days, flag warning
    if (commonMuscles.length >= 3 && preferences.daysPerWeek >= 4) {
      warnings.push(
        `Sesi ${s1.dayNumber} dan Sesi ${s2.dayNumber} melatih otot yang sama (${commonMuscles.join(
          ", "
        )}). Berikan jeda istirahat 48 jam untuk pemulihan optimal.`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a program recommendation option
 */
export function validateRecommendationOption(
  option: ProgramRecommendationOption,
  preferences: ProgramPreferences
): boolean {
  const result = validateProgramStructure(option.sessions, preferences);
  return result.isValid;
}
