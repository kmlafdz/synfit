import { ProgramPreferences } from "@/types/workoutProgram";

export interface ExtractedAIResult {
  preferences: ProgramPreferences;
  knownFields: {
    goal: boolean;
    daysPerWeek: boolean;
    duration: boolean;
    experienceLevel: boolean;
    priorityMuscles: boolean;
    facilityOrModality: boolean;
    constraints: boolean;
  };
  missingQuestions: ClarificationQuestion[];
  confidenceScore: number; // 0 to 1
  rawSummary: string;
}

export interface ClarificationQuestion {
  id: "daysPerWeek" | "experienceLevel" | "sessionDurationMinutes" | "priorityMuscles";
  question: string;
  options: Array<{
    label: string;
    value: any;
  }>;
}

/**
 * Parses free text description into structured gym program preferences.
 * Identifies known details and extracts only unanswered questions.
 */
export function extractPreferencesFromFreeText(input: string): ExtractedAIResult {
  const text = input.toLowerCase();

  const known = {
    goal: false,
    daysPerWeek: false,
    duration: false,
    experienceLevel: false,
    priorityMuscles: false,
    facilityOrModality: false,
    constraints: false,
  };

  // 1. Goal Extraction
  let goal: ProgramPreferences["goal"] = "hypertrophy";
  let goalCustom = "";
  if (
    text.includes("massa otot") ||
    text.includes("bentuk otot") ||
    text.includes("hipertrofi") ||
    text.includes("badan lebih berisi") ||
    text.includes("otot dada") ||
    text.includes("otot bahu") ||
    text.includes("otot punggung")
  ) {
    goal = "hypertrophy";
    known.goal = true;
  } else if (
    text.includes("kekuatan") ||
    text.includes("kuat") ||
    text.includes("strength") ||
    text.includes("angkat berat")
  ) {
    goal = "strength";
    known.goal = true;
  } else if (
    text.includes("lemak") ||
    text.includes("turun berat") ||
    text.includes("kurus") ||
    text.includes("fat loss") ||
    text.includes("perut buncit")
  ) {
    goal = "fat_loss";
    known.goal = true;
  } else if (
    text.includes("stamina") ||
    text.includes("kebugaran") ||
    text.includes("endurance") ||
    text.includes("tidak mudah lelah")
  ) {
    goal = "endurance";
    known.goal = true;
  } else if (
    text.includes("mulai dari nol") ||
    text.includes("kebiasaan") ||
    text.includes("rutin") ||
    text.includes("pemula banget")
  ) {
    goal = "habit";
    known.goal = true;
  }

  // 2. Days Per Week Extraction
  let daysPerWeek = 3;
  const dayMatch = text.match(/([2-6])\s*(kali|x|hari)/) || text.match(/(dua|tiga|empat|lima|enam)\s*(kali|x|hari)/);
  if (dayMatch) {
    known.daysPerWeek = true;
    const val = dayMatch[1];
    if (val === "2" || val === "dua") daysPerWeek = 2;
    else if (val === "3" || val === "tiga") daysPerWeek = 3;
    else if (val === "4" || val === "empat") daysPerWeek = 4;
    else if (val === "5" || val === "lima") daysPerWeek = 5;
    else if (val === "6" || val === "enam") daysPerWeek = 6;
  } else if (text.includes("seminggu 3") || text.includes("3 hari")) {
    daysPerWeek = 3;
    known.daysPerWeek = true;
  }

  // 3. Duration Extraction
  let sessionDurationMinutes = 60;
  if (text.includes("30 menit") || text.includes("setengah jam")) {
    sessionDurationMinutes = 30;
    known.duration = true;
  } else if (text.includes("45 menit") || text.includes("45 mnt")) {
    sessionDurationMinutes = 45;
    known.duration = true;
  } else if (text.includes("1 jam") || text.includes("60 menit") || text.includes("satu jam")) {
    sessionDurationMinutes = 60;
    known.duration = true;
  } else if (text.includes("90 menit") || text.includes("1.5 jam") || text.includes("1,5 jam")) {
    sessionDurationMinutes = 90;
    known.duration = true;
  }

  // 4. Experience Level
  let experienceLevel: ProgramPreferences["experienceLevel"] = "pemula";
  if (
    text.includes("pemula") ||
    text.includes("baru mulai") ||
    text.includes("belum pernah") ||
    text.includes("dari nol") ||
    text.includes("awal")
  ) {
    experienceLevel = "pemula";
    known.experienceLevel = true;
  } else if (text.includes("menengah") || text.includes("sudah sering") || text.includes("intermediate")) {
    experienceLevel = "menengah";
    known.experienceLevel = true;
  } else if (text.includes("lanjutan") || text.includes("advanced") || text.includes("bertahun-tahun")) {
    experienceLevel = "lanjutan";
    known.experienceLevel = true;
  }

  // 5. Priority Muscles
  const priorityMuscles: string[] = [];
  if (text.includes("dada") || text.includes("chest")) priorityMuscles.push("Dada");
  if (text.includes("bahu") || text.includes("shoulder")) priorityMuscles.push("Bahu");
  if (text.includes("punggung") || text.includes("back") || text.includes("sayap")) priorityMuscles.push("Punggung");
  if (text.includes("kaki") || text.includes("leg") || text.includes("paha")) priorityMuscles.push("Kaki");
  if (text.includes("lengan") || text.includes("bicep") || text.includes("tricep") || text.includes("arm")) priorityMuscles.push("Lengan");
  if (text.includes("perut") || text.includes("abs") || text.includes("sixpack") || text.includes("core")) priorityMuscles.push("Core");

  if (priorityMuscles.length > 0) {
    known.priorityMuscles = true;
  }

  // 6. Modality / Facilities
  let preferredModality: ProgramPreferences["preferredModality"] = "combined";
  if (text.includes("mesin") && !text.includes("barbell")) {
    preferredModality = "machines";
    known.facilityOrModality = true;
  } else if (text.includes("beban bebas") || text.includes("dumbbell") || text.includes("barbell")) {
    preferredModality = "freeweights";
    known.facilityOrModality = true;
  } else if (text.includes("bodyweight") || text.includes("beban tubuh") || text.includes("kalistenik")) {
    preferredModality = "bodyweight";
    known.facilityOrModality = true;
  }

  // 7. Constraints & Injuries
  const injuredAreas: string[] = [];
  if (text.includes("cedera bahu") || text.includes("sakit bahu")) injuredAreas.push("bahu");
  if (text.includes("cedera lutut") || text.includes("sakit lutut")) injuredAreas.push("lutut");
  if (text.includes("sakit pinggang") || text.includes("nyeri pinggang") || text.includes("hnp")) injuredAreas.push("pinggang");
  if (text.includes("siku") || text.includes("pergelangan")) injuredAreas.push("pergelangan_tangan");

  const hasConstraints = injuredAreas.length > 0 || text.includes("hindari") || text.includes("batasi");
  if (hasConstraints) {
    known.constraints = true;
  }

  // Build tailored clarification questions for missing critical fields only
  const missingQuestions: ClarificationQuestion[] = [];

  if (!known.daysPerWeek) {
    missingQuestions.push({
      id: "daysPerWeek",
      question: "Berapa hari dalam seminggu yang bisa Anda sediakan untuk latihan?",
      options: [
        { label: "2 Hari / Minggu", value: 2 },
        { label: "3 Hari / Minggu (Rekomendasi)", value: 3 },
        { label: "4 Hari / Minggu", value: 4 },
        { label: "5 Hari / Minggu", value: 5 },
      ],
    });
  }

  if (!known.experienceLevel) {
    missingQuestions.push({
      id: "experienceLevel",
      question: "Bagaimana riwayat dan tingkat pengalaman gym Anda saat ini?",
      options: [
        { label: "Pemula (0 - 6 bulan latihan)", value: "pemula" },
        { label: "Menengah (6 - 24 bulan konsisten)", value: "menengah" },
        { label: "Lanjutan (2+ tahun berpengalaman)", value: "lanjutan" },
      ],
    });
  }

  if (!known.duration) {
    missingQuestions.push({
      id: "sessionDurationMinutes",
      question: "Berapa lama perkiraan durasi waktu yang Anda miliki per sesi latihan?",
      options: [
        { label: "45 Menit (Efisien)", value: 45 },
        { label: "60 Menit (Standar Optimal)", value: 60 },
        { label: "90 Menit (Intensif & Volume Tinggi)", value: 90 },
      ],
    });
  }

  const confidenceScore =
    Object.values(known).filter(Boolean).length / Object.keys(known).length;

  const preferences: ProgramPreferences = {
    goal,
    goalCustom,
    experienceLevel,
    daysPerWeek,
    sessionDurationMinutes,
    facility: "full_gym",
    equipmentAvailable: ["Semua"],
    preferredModality,
    priorityMuscles: priorityMuscles.length > 0 ? priorityMuscles : ["Dada", "Punggung", "Kaki"],
    avoidMuscles: [],
    splitPreference: "auto",
    constraints: {
      hasConstraints,
      injuredAreas,
      notes: hasConstraints ? "Riwayat batasan terdeteksi dari deskripsi latihan." : "",
    },
  };

  const rawSummary = `Target: ${goal.toUpperCase()} · ${daysPerWeek} Hari/Mgg · ${sessionDurationMinutes} Menit · Level: ${experienceLevel.toUpperCase()}${
    priorityMuscles.length > 0 ? ` · Fokus: ${priorityMuscles.join(", ")}` : ""
  }`;

  return {
    preferences,
    knownFields: known,
    missingQuestions,
    confidenceScore,
    rawSummary,
  };
}
