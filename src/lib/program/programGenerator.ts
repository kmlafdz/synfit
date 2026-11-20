import {
  ProgramPreferences,
  ProgramRecommendationOption,
  ProgramSession,
  ProgramExercise,
} from "@/types/workoutProgram";
import {
  WORKOUT_EXERCISE_CATALOG,
  getExerciseById,
  ExerciseDefinition,
} from "@/data/workoutExerciseCatalog";
import { validateProgramStructure } from "./programValidator";

function mapCatalogToProgramExercise(
  ex: ExerciseDefinition,
  order: number,
  overrideSets?: number,
  overrideReps?: string
): ProgramExercise {
  return {
    exerciseId: ex.id,
    name: ex.name,
    primaryMuscle: ex.primaryMuscle,
    equipmentId: ex.equipmentId,
    equipmentName: ex.equipmentName,
    tutorialId: ex.equipmentId,
    hasAiCoach: ex.hasAiCoach,
    aiCoachType: ex.aiCoachType,
    targetSets: overrideSets || ex.defaultSets,
    targetReps: overrideReps || ex.defaultReps,
    restSeconds: ex.defaultRestSeconds,
    order,
    notes: ex.description,
  };
}

export function generateProgramRecommendations(
  prefs: ProgramPreferences
): ProgramRecommendationOption[] {
  const days = prefs.daysPerWeek || 3;
  const isBeginner = prefs.experienceLevel === "pemula";
  const duration = prefs.sessionDurationMinutes || 60;

  const options: ProgramRecommendationOption[] = [];

  // ─────────────────────────────────────────────────────────────
  // OPTION 1: BALANCED HYPERTROPHY & FOUNDATION
  // ─────────────────────────────────────────────────────────────
  const option1Sessions: ProgramSession[] = [];

  if (days <= 3) {
    // Full Body or Push/Pull/Legs
    const f1 = [
      getExerciseById("squat")!,
      getExerciseById("chest_press_machine")!,
      getExerciseById("lat_pulldown")!,
      getExerciseById("bicep_curl")!,
      getExerciseById("ab_crunch_machine")!,
    ].filter(Boolean);

    const f2 = [
      getExerciseById("leg_press")!,
      getExerciseById("push_up")!,
      getExerciseById("seated_cable_row")!,
      getExerciseById("shoulder_press_machine")!,
      getExerciseById("triceps_pushdown")!,
    ].filter(Boolean);

    const f3 = [
      getExerciseById("leg_extension")!,
      getExerciseById("leg_curl")!,
      getExerciseById("pec_deck_fly")!,
      getExerciseById("lat_pulldown")!,
      getExerciseById("back_extension_bench")!,
    ].filter(Boolean);

    option1Sessions.push({
      sessionId: "s1-d1",
      dayNumber: 1,
      dayName: "Hari 1 - Full Body Foundation",
      focus: "Paha, Dada, Punggung & Lengan",
      estimatedDurationMinutes: duration,
      exercises: f1.map((e, idx) => mapCatalogToProgramExercise(e, idx + 1)),
    });

    option1Sessions.push({
      sessionId: "s1-d2",
      dayNumber: 2,
      dayName: "Hari 2 - Upper & Core Focus",
      focus: "Dada, Punggung Tengah, Bahu & Tricep",
      estimatedDurationMinutes: duration,
      exercises: f2.map((e, idx) => mapCatalogToProgramExercise(e, idx + 1)),
    });

    if (days >= 3) {
      option1Sessions.push({
        sessionId: "s1-d3",
        dayNumber: 3,
        dayName: "Hari 3 - Posterior & Shape",
        focus: "Kaki, Sayap Punggung & Otot Inti",
        estimatedDurationMinutes: duration,
        exercises: f3.map((e, idx) => mapCatalogToProgramExercise(e, idx + 1)),
      });
    }
  } else if (days === 4) {
    // Upper / Lower Split 4-Day
    option1Sessions.push({
      sessionId: "s1-u1",
      dayNumber: 1,
      dayName: "Hari 1 - Upper Body Push & Pull",
      focus: "Dada, Punggung & Lengan",
      estimatedDurationMinutes: duration,
      exercises: [
        getExerciseById("chest_press_machine")!,
        getExerciseById("lat_pulldown")!,
        getExerciseById("push_up")!,
        getExerciseById("bicep_curl")!,
        getExerciseById("triceps_pushdown")!,
      ]
        .filter(Boolean)
        .map((e, idx) => mapCatalogToProgramExercise(e, idx + 1)),
    });
    option1Sessions.push({
      sessionId: "s1-l1",
      dayNumber: 2,
      dayName: "Hari 2 - Lower Body & Core",
      focus: "Paha Depan, Belakang & Perut",
      estimatedDurationMinutes: duration,
      exercises: [
        getExerciseById("squat")!,
        getExerciseById("leg_press")!,
        getExerciseById("leg_curl")!,
        getExerciseById("calf_raise_machine")!,
        getExerciseById("ab_crunch_machine")!,
      ]
        .filter(Boolean)
        .map((e, idx) => mapCatalogToProgramExercise(e, idx + 1)),
    });
    option1Sessions.push({
      sessionId: "s1-u2",
      dayNumber: 3,
      dayName: "Hari 3 - Upper Body Hypertrophy",
      focus: "Bahu, Sayap Punggung & Isolasi Dada",
      estimatedDurationMinutes: duration,
      exercises: [
        getExerciseById("pec_deck_fly")!,
        getExerciseById("seated_cable_row")!,
        getExerciseById("shoulder_press_machine")!,
        getExerciseById("dumbbell_lateral_raise")!,
        getExerciseById("preacher_curl")!,
      ]
        .filter(Boolean)
        .map((e, idx) => mapCatalogToProgramExercise(e, idx + 1)),
    });
    option1Sessions.push({
      sessionId: "s1-l2",
      dayNumber: 4,
      dayName: "Hari 4 - Lower Body & Posterior Chain",
      focus: "Glutes, Hamstrings & Postur Tulang Belakang",
      estimatedDurationMinutes: duration,
      exercises: [
        getExerciseById("leg_extension")!,
        getExerciseById("leg_curl")!,
        getExerciseById("smith_machine_squat")!,
        getExerciseById("back_extension_bench")!,
        getExerciseById("ab_crunch_machine")!,
      ]
        .filter(Boolean)
        .map((e, idx) => mapCatalogToProgramExercise(e, idx + 1)),
    });
  } else {
    // 5-6 Days Split
    const splits = [
      { name: "Hari 1 - Push A (Dada & Bahu)", ex: ["chest_press_machine", "pec_deck_fly", "shoulder_press_machine", "triceps_pushdown"] },
      { name: "Hari 2 - Pull A (Punggung & Bicep)", ex: ["lat_pulldown", "seated_cable_row", "reverse_fly_machine", "bicep_curl"] },
      { name: "Hari 3 - Legs A (Quadriceps & Betis)", ex: ["squat", "leg_press", "leg_extension", "calf_raise_machine"] },
      { name: "Hari 4 - Upper Body Sculpt", ex: ["push_up", "lat_pulldown", "dumbbell_lateral_raise", "preacher_curl"] },
      { name: "Hari 5 - Lower & Core Density", ex: ["leg_curl", "smith_machine_squat", "ab_crunch_machine", "back_extension_bench"] },
      { name: "Hari 6 - Conditioning & Arms", ex: ["bicep_curl", "triceps_pushdown", "ab_crunch_machine", "treadmill_incline"] },
    ];
    for (let i = 0; i < days; i++) {
      const sp = splits[i % splits.length];
      option1Sessions.push({
        sessionId: `s1-d${i + 1}`,
        dayNumber: i + 1,
        dayName: sp.name,
        focus: "Fokus Progresif Volume & Definisi",
        estimatedDurationMinutes: duration,
        exercises: sp.ex
          .map((id) => getExerciseById(id)!)
          .filter(Boolean)
          .map((e, idx) => mapCatalogToProgramExercise(e, idx + 1)),
      });
    }
  }

  options.push({
    id: "opt-hypertrophy-classic",
    name: "SynFit Hypertrophy Foundation",
    tagline: "Stabilitas Mesin & Bentuk Otot Simetris",
    description:
      "Dirancang untuk memaksimalkan pembentukan otot dengan jalur mesin gym aman serta aktivasi gerakan terarah AI.",
    reasonForRecommendation:
      "Sangat cocok untuk target Anda karena mengombinasikan isolasi otot terarah dan risiko cedera sendi yang minimal.",
    primaryGoal: "Membangun Massa Otot & Bentuk Tubuh",
    difficulty: isBeginner ? "Pemula" : "Menengah",
    daysPerWeek: days,
    estimatedDurationMinutes: duration,
    muscleFocus: ["Dada", "Punggung", "Kaki", "Lengan"],
    equipmentNeeded: ["Mesin Gym", "Dumbbell", "Kabel"],
    pros: [
      "Jalur beban mesin stabil sangat ramah persendian",
      "Termasuk gerakan yang dapat dievaluasi langsung oleh AI Form Coach",
      "Volume optimal untuk pembesaran otot tanpa overtraining",
    ],
    tradeOffs: [
      "Memerlukan akses ke mesin gym terpandu SynFit",
      "Fokus pada pembentukan otot dibanding performa lari maraton",
    ],
    sessions: option1Sessions,
  });

  // ─────────────────────────────────────────────────────────────
  // OPTION 2: FUNCTIONAL STRENGTH & POSTURE
  // ─────────────────────────────────────────────────────────────
  const option2Sessions: ProgramSession[] = [];
  for (let i = 0; i < days; i++) {
    const dayEx =
      i === 0
        ? ["squat", "chest_press_machine", "lat_pulldown", "back_extension_bench"]
        : i === 1
        ? ["leg_press", "push_up", "seated_cable_row", "ab_crunch_machine"]
        : i === 2
        ? ["smith_machine_squat", "pec_deck_fly", "bicep_curl", "calf_raise_machine"]
        : i === 3
        ? ["lat_pulldown", "shoulder_press_machine", "triceps_pushdown", "back_extension_bench"]
        : ["squat", "push_up", "seated_cable_row", "ab_crunch_machine"];

    option2Sessions.push({
      sessionId: `s2-d${i + 1}`,
      dayNumber: i + 1,
      dayName: `Hari ${i + 1} - Functional Strength & Core`,
      focus: "Penguatan Postur & Kestabilan Tubuh",
      estimatedDurationMinutes: duration,
      exercises: dayEx
        .map((id) => getExerciseById(id)!)
        .filter(Boolean)
        .map((e, idx) => mapCatalogToProgramExercise(e, idx + 1, 4, "8-10 reps")),
    });
  }

  options.push({
    id: "opt-strength-posture",
    name: "SynFit Functional Strength",
    tagline: "Kekuatan Kompon & Postur Tegap",
    description:
      "Fokus pada penguatan rantai otot inti, punggung, dan kaki untuk ketahanan fisik harian dan peningkatan kekuatan nyata.",
    reasonForRecommendation:
      "Memberikan dasar kekuatan yang solid dan memperbaiki postur tubuh dengan repetisi beban terukur.",
    primaryGoal: "Meningkatkan Kekuatan & Stabilitas",
    difficulty: "Menengah",
    daysPerWeek: days,
    estimatedDurationMinutes: duration,
    muscleFocus: ["Punggung", "Kaki", "Core", "Dada"],
    equipmentNeeded: ["Free Weights", "Mesin Tubuh", "Bodyweight"],
    pros: [
      "Meningkatkan kekuatan tulang belakang dan sendi penopang",
      "Membakar kalori pasif lebih tinggi pasca-latihan",
      "Kompatibel dengan evaluasi postur AI Coach",
    ],
    tradeOffs: [
      "Istirahat antar set sedikit lebih panjang (75-90 detik)",
      "Membutuhkan fokus teknik pernapasan dan kontraksi inti",
    ],
    sessions: option2Sessions,
  });

  // ─────────────────────────────────────────────────────────────
  // OPTION 3: TIME-EFFICIENT CONDITIONING & FAT LOSS
  // ─────────────────────────────────────────────────────────────
  const option3Sessions: ProgramSession[] = [];
  for (let i = 0; i < days; i++) {
    const dayEx =
      i === 0
        ? ["squat", "push_up", "lat_pulldown", "treadmill_incline"]
        : i === 1
        ? ["leg_press", "chest_press_machine", "seated_cable_row", "stationary_bike"]
        : i === 2
        ? ["leg_curl", "pec_deck_fly", "ab_crunch_machine", "rowing_machine"]
        : i === 3
        ? ["squat", "push_up", "bicep_curl", "treadmill_incline"]
        : ["leg_extension", "seated_cable_row", "triceps_pushdown", "stationary_bike"];

    option3Sessions.push({
      sessionId: `s3-d${i + 1}`,
      dayNumber: i + 1,
      dayName: `Hari ${i + 1} - Lean Burn & Conditioning`,
      focus: "Ketahanan Otot & Pembakaran Kalori Kardio",
      estimatedDurationMinutes: duration,
      exercises: dayEx
        .map((id) => getExerciseById(id)!)
        .filter(Boolean)
        .map((e, idx) => mapCatalogToProgramExercise(e, idx + 1, 3, "12-15 reps")),
    });
  }

  options.push({
    id: "opt-lean-burn",
    name: "SynFit Lean Burn & Endurance",
    tagline: "Definisi Otot & Kapasitas Kardio",
    description:
      "Kombinasi latihan kekuatan intensitas sedang dengan penutup kardio terstruktur untuk efisiensi pembakaran lemak.",
    reasonForRecommendation:
      "Cocok untuk Anda yang menginginkan tubuh lebih ramping, bertenaga, dan detak jantung yang sehat.",
    primaryGoal: "Mengurangi Lemak Tubuh & Stamina",
    difficulty: "Pemula",
    daysPerWeek: days,
    estimatedDurationMinutes: duration,
    muscleFocus: ["Seluruh Tubuh", "Kardio", "Core"],
    equipmentNeeded: ["Mesin Gym", "Kardio (Treadmill/Bike)", "Bodyweight"],
    pros: [
      "Mengoptimalkan kesehatan kardiovaskular dan stamina harian",
      "Durasi ringkas dan padat tanpa waktu terbuang",
      "Kombinasi AI pose tracking dan zona denyut jantung",
    ],
    tradeOffs: [
      "Fokus pada daya tahan dan penurunan lemak, bukan hipertrofi binaraga ekstrem",
    ],
    sessions: option3Sessions,
  });

  // Run validation on all options to ensure 100% compliance
  return options.map((opt) => {
    validateProgramStructure(opt.sessions, prefs);
    return opt;
  });
}
