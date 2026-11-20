"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Play,
  Pause,
  Square,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Clock,
  Shield,
  Activity,
  Award,
  ChevronRight,
  X,
  Loader2,
  Check,
  Save,
  ArrowLeft,
  Heart,
  Flame,
  Bot,
  Sparkles,
  Calendar,
  Watch,
  Zap,
} from "lucide-react";
import { useHeartRateBle } from "@/lib/bluetooth/useHeartRateBle";
import { useHeartRateStore } from "@/store/useHeartRateStore";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { SmartwatchHeartRate } from "@/components/SmartwatchHeartRate";
import { useUIStore } from "@/store/useUIStore";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import {
  ExerciseType,
  EXERCISE_METADATA,
  ExerciseAnalyzerEngine,
  LiveAnalysisFrame,
  WorkoutSetResult,
  WorkoutExerciseSummary,
  WorkoutSessionSummary,
  PoseLandmarks,
  evaluatePreparationStatus
} from "@/lib/exerciseAnalyzer";
import { Button } from "@/components/ui/button";
import { Member } from "@/types";
import { toast } from "sonner";

export const EXERCISE_IMAGES: Record<ExerciseType, string> = {
  squat: "/squat.jpg",
  push_up: "/push_up.jpg",
  bicep_curl: "/bicep_curl.jpg",
};

type CoachStep =
  | "choose_exercise"
  | "preparation"
  | "workout"
  | "set_completed"
  | "summary";

interface AIFormCoachProps {
  member: Member;
  onBackToDashboard: () => void;
  onOpenHeartRateHistory?: () => void;
  language?: "id" | "en";
  isDark?: boolean;
}

// MediaPipe skeleton connections
const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], // shoulders
  [11, 13], // left arm
  [13, 15],
  [12, 14], // right arm
  [14, 16],
  [11, 23], // left torso
  [12, 24], // right torso
  [23, 24], // hips
  [23, 25], // left leg
  [25, 27],
  [24, 26], // right leg
  [26, 28],
];

export function AIFormCoach({
  member,
  onBackToDashboard,
  onOpenHeartRateHistory,
  language = "id",
  isDark: propIsDark,
}: AIFormCoachProps) {
  const storeTheme = useUIStore((s) => s.memberTheme);
  const isDark = propIsDark !== undefined ? propIsDark : storeTheme === "dark";

  // Smartwatch Heart Rate BLE integration (Part 6C)
  const {
    state: hrBleState,
    connect: connectSmartwatch,
    disconnect: disconnectSmartwatch,
    clearSession: clearHrSession,
  } = useHeartRateBle();

  // Navigation & Step state
  const [step, setStep] = useState<CoachStep>("choose_exercise");
  const [selectedExercise, setSelectedExercise] = useState<ExerciseType>("squat");
  const [targetReps, setTargetReps] = useState<number>(12);
  const [selectedBodyPart, setSelectedBodyPart] = useState<string>("all");
  const [workoutHistory, setWorkoutHistory] = useState<any[]>([]);

  // Camera & MediaPipe state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Workout run states
  const [isPaused, setIsPaused] = useState(false);
  const [currentSetNumber, setCurrentSetNumber] = useState(1);
  const [liveFrame, setLiveFrame] = useState<LiveAnalysisFrame | null>(null);
  const [lastCompletedSetResult, setLastCompletedSetResult] = useState<WorkoutSetResult | null>(null);

  // Session history storage
  const [sessionSets, setSessionSets] = useState<WorkoutSetResult[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);

  // Switch Exercise confirmation modal
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  const [pendingNextExercise, setPendingNextExercise] = useState<ExerciseType | null>(null);

  // Rest Timer states
  const [restSecondsLeft, setRestSecondsLeft] = useState<number>(60);
  const [isRestTimerActive, setIsRestTimerActive] = useState<boolean>(false);

  // Saving state
  const [isSavingWorkout, setIsSavingWorkout] = useState(false);
  const [isSavedSuccessfully, setIsSavedSuccessfully] = useState(false);

  // Exit confirmation modal during live camera session
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`synfit_workout_sessions_${member.id}`);
      if (raw) {
        setWorkoutHistory(JSON.parse(raw));
      }
    } catch (e) {}
  }, [member.id, isSavedSuccessfully]);

  // Reset scroll whenever entering or exiting a workout step
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    const containers = [
      document.getElementById("member-main-content"),
      document.querySelector("main"),
      document.querySelector(".overflow-y-auto"),
    ];
    containers.forEach((c) => {
      if (c) c.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
  }, [step]);

  const handleBackToAICoach = () => {
    stopCamera();
    setShowExitConfirmModal(false);
    setSessionSets([]);
    setLiveFrame(null);
    setLastCompletedSetResult(null);
    setCurrentSetNumber(1);
    setIsRestTimerActive(false);
    setIsSavedSuccessfully(false);
    setStep("choose_exercise");
  };

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const analyzerEngineRef = useRef<ExerciseAnalyzerEngine | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);

  // Initialize or re-create Analyzer Engine on exercise selection
  useEffect(() => {
    analyzerEngineRef.current = new ExerciseAnalyzerEngine(selectedExercise, targetReps);
  }, [selectedExercise, targetReps]);

  // Load MediaPipe Model once
  const initPoseLandmarker = async (): Promise<PoseLandmarker | null> => {
    if (landmarkerRef.current) return landmarkerRef.current;
    setIsModelLoading(true);
    setCameraError(null);

    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      let landmarker: PoseLandmarker;
      try {
        landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch (gpuErr) {
        // Fallback to CPU delegate if WebGL is unavailable or fails
        console.warn("Falling back to CPU for MediaPipe Pose Landmarker", gpuErr);
        landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      landmarkerRef.current = landmarker;
      return landmarker;
    } catch (err: any) {
      console.error("Failed to load Pose Landmarker model:", err);
      setCameraError(
        language === "id"
          ? "Gagal memuat model pendeteksi pose AI. Periksa koneksi internet Anda."
          : "Failed to load AI pose detection model. Check your internet connection."
      );
      return null;
    } finally {
      setIsModelLoading(false);
    }
  };

  // Start Camera
  const startCamera = async () => {
    setCameraError(null);

    // Ensure model is ready
    const landmarker = await initPoseLandmarker();
    if (!landmarker) return;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Browser MediaDevices API not supported");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false, // Strict requirement: no audio / mic
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsCameraActive(true);
        };
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      let errorMsg =
        language === "id"
          ? "Akses kamera ditolak. Berikan izin kamera depan pada browser Anda."
          : "Camera permission denied. Please allow camera access.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errorMsg =
          language === "id"
            ? "Akses kamera ditolak. Berikan izin kamera depan pada browser Anda."
            : "Camera permission denied. Please allow camera access.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errorMsg =
          language === "id"
            ? "Kamera depan tidak ditemukan pada perangkat Anda."
            : "Front camera not found on this device.";
      }
      setCameraError(errorMsg);
      setIsCameraActive(false);
    }
  };

  // Stop Camera cleanly
  const stopCamera = useCallback(() => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Intercept mobile hardware back button during live camera session
  useEffect(() => {
    if (step === "preparation" || step === "workout") {
      window.history.pushState({ synfit_modal: "camera_session" }, "");

      const handlePopState = () => {
        stopCamera();
        setShowExitConfirmModal(false);
        setStep("choose_exercise");
      };

      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    }
  }, [step, stopCamera]);

  // Rest Timer countdown effect
  useEffect(() => {
    let timer: any;
    if (isRestTimerActive && restSecondsLeft > 0) {
      timer = setInterval(() => {
        setRestSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (restSecondsLeft === 0) {
      setIsRestTimerActive(false);
    }
    return () => clearInterval(timer);
  }, [isRestTimerActive, restSecondsLeft]);

  // Main Detection & Live Analysis Loop via requestAnimationFrame
  useEffect(() => {
    if (!isCameraActive || isPaused || (step !== "workout" && step !== "preparation")) {
      return;
    }

    const renderLoop = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;
      const analyzer = analyzerEngineRef.current;

      if (video && video.readyState >= 2 && canvas && landmarker) {
        const videoWidth = video.videoWidth || 640;
        const videoHeight = video.videoHeight || 480;

        if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
          canvas.width = videoWidth;
          canvas.height = videoHeight;
        }

        const ctx = canvas.getContext("2d");
        const now = performance.now();

        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime;

            try {
              const detectionResult = landmarker.detectForVideo(video, now);
              const landmarks: PoseLandmarks | undefined = detectionResult.landmarks?.[0];

              if (landmarks && landmarks.length > 0) {
                // 1. Draw Skeleton Overlay
                drawPoseSkeleton(ctx, landmarks, canvas.width, canvas.height);

                // 2. Process Exercise Analyzer
                if (analyzer) {
                  const frameResult = analyzer.processFrame(landmarks, now, true);
                  setLiveFrame(frameResult);

                  // 3. Check if target reached in workout mode
                  if (
                    step === "workout" &&
                    frameResult.completedReps >= targetReps &&
                    targetReps > 0
                  ) {
                    // Set completed!
                    const setResult = analyzer.getSetResult("completed");
                    setResult.setNumber = currentSetNumber;
                    setSessionSets((prev) => [...prev, setResult]);
                    setLastCompletedSetResult(setResult);
                    setStep("set_completed");
                    setRestSecondsLeft(60);
                    setIsRestTimerActive(true);
                    return; // Stop animation frame for set
                  }
                }
              } else {
                if (analyzer) {
                  const prep = evaluatePreparationStatus(null, true);
                  setLiveFrame({
                    exercise: selectedExercise,
                    currentPhase: "READY",
                    completedReps: analyzer.getSetResult("active").completedReps,
                    targetReps,
                    currentFormScore: 85,
                    formCategory: "Good",
                    primaryAngle: 0,
                    feedbacks: [
                      {
                        id: "no_pose",
                        message: prep.guidanceMessage,
                        type: "info",
                        timestamp: now,
                      },
                    ],
                    isRepCompletedThisFrame: false,
                    prepStatus: prep,
                  });
                }
              }
            } catch (detErr) {
              console.error("Frame detection error:", detErr);
            }
          }
        }
      }

      animationFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animationFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [isCameraActive, isPaused, step, selectedExercise, targetReps, currentSetNumber]);

  // Draw Skeleton on Canvas
  const drawPoseSkeleton = (
    ctx: CanvasRenderingContext2D,
    landmarks: PoseLandmarks,
    width: number,
    height: number
  ) => {
    // Draw Bones / Connections
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255, 90, 44, 0.85)"; // SynFit Brand Orange

    POSE_CONNECTIONS.forEach(([startIdx, endIdx]) => {
      const p1 = landmarks[startIdx];
      const p2 = landmarks[endIdx];

      if (p1 && p2 && (p1.visibility ?? 1) > 0.35 && (p2.visibility ?? 1) > 0.35) {
        ctx.beginPath();
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
        ctx.stroke();
      }
    });

    // Draw Joint Dots
    landmarks.forEach((p, idx) => {
      // Key body landmarks only (shoulders to ankles)
      if (idx >= 11 && idx <= 28 && (p.visibility ?? 1) > 0.35) {
        const x = p.x * width;
        const y = p.y * height;

        // Outer glow
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.fill();

        // Inner core
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, 2 * Math.PI);
        ctx.fillStyle = "#FF5A2C";
        ctx.fill();
      }
    });
  };

  // ACTION HANDLERS
  const handleSelectExercise = (exercise: ExerciseType) => {
    setSelectedExercise(exercise);
    setTargetReps(EXERCISE_METADATA[exercise].targetRepsDefault);
    setCurrentSetNumber(1);
    analyzerEngineRef.current = new ExerciseAnalyzerEngine(
      exercise,
      EXERCISE_METADATA[exercise].targetRepsDefault
    );
    setStep("preparation");
  };

  const handleStartSet = () => {
    if (!sessionStartTime) {
      setSessionStartTime(Date.now());
    }
    analyzerEngineRef.current?.resetCurrentSet();
    setIsPaused(false);
    setIsRestTimerActive(false);
    setStep("workout");
  };

  const handleNextSet = () => {
    setCurrentSetNumber((prev) => prev + 1);
    analyzerEngineRef.current?.resetCurrentSet();
    setIsPaused(false);
    setIsRestTimerActive(false);
    setStep("workout");
  };

  const handlePromptSwitchExercise = (newExercise: ExerciseType) => {
    if (step === "workout") {
      setPendingNextExercise(newExercise);
      setSwitchModalOpen(true);
    } else {
      executeSwitchExercise(newExercise);
    }
  };

  const executeSwitchExercise = (newExercise: ExerciseType) => {
    // If there was an active unfinished set, save it as incomplete
    if (step === "workout" && analyzerEngineRef.current) {
      const incomplete = analyzerEngineRef.current.getSetResult("incomplete");
      incomplete.setNumber = currentSetNumber;
      setSessionSets((prev) => [...prev, incomplete]);
    }

    setSelectedExercise(newExercise);
    setTargetReps(EXERCISE_METADATA[newExercise].targetRepsDefault);
    setCurrentSetNumber(1);
    analyzerEngineRef.current?.switchExercise(
      newExercise,
      EXERCISE_METADATA[newExercise].targetRepsDefault
    );

    setSwitchModalOpen(false);
    setPendingNextExercise(null);
    setIsRestTimerActive(false);
    setStep("preparation");
  };

  const handleStopSetEarly = () => {
    if (analyzerEngineRef.current) {
      const incomplete = analyzerEngineRef.current.getSetResult("incomplete");
      incomplete.setNumber = currentSetNumber;
      setSessionSets((prev) => [...prev, incomplete]);
      setLastCompletedSetResult(incomplete);
      setStep("set_completed");
    }
  };

  const handleFinishWorkout = () => {
    // If currently in a set, close as incomplete
    if (step === "workout" && analyzerEngineRef.current) {
      const incomplete = analyzerEngineRef.current.getSetResult("incomplete");
      incomplete.setNumber = currentSetNumber;
      setSessionSets((prev) => [...prev, incomplete]);
    }

    stopCamera();
    setStep("summary");
  };

  // Compile Workout Session Summary
  const compileSummary = (): WorkoutSessionSummary => {
    const completedSets = sessionSets.filter((s) => s.status === "completed").length;
    const incompleteSets = sessionSets.filter((s) => s.status === "incomplete").length;
    const totalReps = sessionSets.reduce((acc, s) => acc + s.completedReps, 0);

    const validScores = sessionSets.filter((s) => s.completedReps > 0).map((s) => s.formScore);
    const avgScore = validScores.length
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
      : 85;

    const durationMinutes = sessionStartTime
      ? Math.max(1, Math.round((Date.now() - sessionStartTime) / (1000 * 60)))
      : 1;

    // Group by exercise
    const exerciseMap = new Map<ExerciseType, WorkoutSetResult[]>();
    sessionSets.forEach((s) => {
      const arr = exerciseMap.get(s.exercise) || [];
      arr.push(s);
      exerciseMap.set(s.exercise, arr);
    });

    const exercisesSummary: WorkoutExerciseSummary[] = [];
    exerciseMap.forEach((sets, ex) => {
      const exReps = sets.reduce((acc, s) => acc + s.completedReps, 0);
      const exScores = sets.map((s) => s.formScore);
      const exAvgScore = exScores.length
        ? Math.round(exScores.reduce((a, b) => a + b, 0) / exScores.length)
        : 85;
      exercisesSummary.push({
        exercise: ex,
        name: EXERCISE_METADATA[ex].name,
        completedSets: sets.filter((s) => s.status === "completed").length,
        incompleteSets: sets.filter((s) => s.status === "incomplete").length,
        totalReps: exReps,
        averageFormScore: exAvgScore,
        sets,
      });
    });

    let overallFeedback =
      "Analisis pose 2D menunjukkan konsistensi rentang gerak dan tempo yang baik. Pertahankan postur dan kendali gerakan.";
    if (avgScore >= 90) {
      overallFeedback =
        "Rentang gerak dan kontrol tempo sangat stabil dan konsisten sepanjang set latihan berdasarkan estimasi pose 2D.";
    } else if (avgScore < 75) {
      overallFeedback =
        "Sesi latihan selesai. Untuk hasil lebih optimal, jaga kedalaman gerakan dan kendalikan tempo repetisi secara teratur.";
    }

    // Biometrics calculation from smartwatch BLE stream
    const hrStats = hrBleState.stats;
    const avgBpm = hrStats.avgBpm;
    const maxBpm = hrStats.maxBpm;
    const minBpm = hrStats.minBpm;
    const deviceName = hrBleState.deviceName || "Smartwatch";

    // Estimated calories burned calculation (Katch-McArdle approximation based on duration and heart rate)
    let estimatedCalories = 0;
    if (avgBpm && durationMinutes > 0) {
      const bpmFactor = avgBpm > 130 ? 8.5 : avgBpm > 100 ? 6.5 : 4.5;
      estimatedCalories = Math.round(durationMinutes * bpmFactor);
    } else if (durationMinutes > 0) {
      estimatedCalories = Math.round(durationMinutes * 5);
    }

    const cardioZone = avgBpm
      ? avgBpm < 100
        ? "Warm Up"
        : avgBpm < 130
        ? "Fat Burn"
        : avgBpm < 160
        ? "Aerobic"
        : "Anaerobic"
      : null;

    return {
      memberId: member.id,
      startedAt: new Date(sessionStartTime || Date.now()),
      completedAt: new Date(),
      durationMinutes,
      exerciseCount: exercisesSummary.length,
      completedSets,
      incompleteSets,
      totalReps,
      averageFormScore: avgScore,
      exercises: exercisesSummary,
      overallFeedback,
      avgHeartRate: avgBpm,
      maxHeartRate: maxBpm,
      minHeartRate: minBpm,
      caloriesBurned: estimatedCalories,
      deviceName,
      cardioZone,
      heartRateSamples: hrBleState.samples,
    };
  };

  const handleSaveWorkoutToFirebase = async () => {
    setIsSavingWorkout(true);
    try {
      const summary = compileSummary();
      const payload = {
        member_id: member.id,
        member_name: member.nama,
        duration_minutes: summary.durationMinutes,
        exercise_count: summary.exerciseCount,
        completed_sets: summary.completedSets,
        incomplete_sets: summary.incompleteSets,
        total_reps: summary.totalReps,
        average_form_score: summary.averageFormScore,
        overall_feedback: summary.overallFeedback,
        exercises: summary.exercises.map((e) => ({
          name: e.name,
          completed_sets: e.completedSets,
          total_reps: e.totalReps,
          average_form_score: e.averageFormScore,
        })),
        avg_heart_rate: summary.avgHeartRate ?? null,
        max_heart_rate: summary.maxHeartRate ?? null,
        min_heart_rate: summary.minHeartRate ?? null,
        calories_burned: summary.caloriesBurned ?? null,
        device_name: summary.deviceName ?? null,
        heart_rate_zone: summary.cardioZone ?? null,
        heart_rate_samples:
          summary.heartRateSamples?.slice(-30).map((s: any) => ({
            time: s.time,
            bpm: s.bpm,
            contactDetected: s.contactDetected ?? true,
          })) ?? [],
      };

      // 1. Save locally in localStorage as immediate offline-safe backup
      try {
        const localKey = `synfit_workout_sessions_${member.id}`;
        const existing = JSON.parse(localStorage.getItem(localKey) || "[]");
        existing.unshift({ ...payload, created_at: new Date().toISOString() });
        localStorage.setItem(localKey, JSON.stringify(existing.slice(0, 50)));
      } catch (storageErr) {
        console.warn("Could not cache to localStorage:", storageErr);
      }

      // 2. Server-side API persistence
      const rawMember = typeof window !== "undefined" ? localStorage.getItem("memberSession") : null;
      const sessionObj = rawMember ? JSON.parse(rawMember) : null;
      const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (sessionObj?.token) {
        reqHeaders["Authorization"] = `Bearer ${sessionObj.token}`;
        reqHeaders["x-member-session-token"] = sessionObj.token;
      }

      let savedSuccessfully = false;
      try {
        const res = await fetch("/api/workout-sessions", {
          method: "POST",
          headers: reqHeaders,
          body: JSON.stringify(payload),
        });
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const resData = await res.json();
          if (res.ok && resData.success) {
            savedSuccessfully = true;
          }
        }
      } catch (e) {
        console.warn("[AI Form Coach] Server API save failed, attempting Firestore Client SDK fallback:", e);
      }

      // 3. Fallback: Direct Firestore Client SDK (ensures zero data loss on static hosting or temporary API hiccup)
      if (!savedSuccessfully) {
        try {
          await addDoc(collection(db, "workout_sessions"), {
            ...payload,
            created_at: serverTimestamp(),
          });
          savedSuccessfully = true;
        } catch (clientErr) {
          console.warn("[AI Form Coach] Direct Firestore save fallback failed:", clientErr);
        }
      }

      // 4. Immediately trigger real-time Biometrics sync to member_biometrics collection
      try {
        await useHeartRateStore.getState().syncToFirebase(member.id);
      } catch (syncErr) {
        console.warn("[AI Form Coach] Biometrics direct sync warning:", syncErr);
      }

      if (!savedSuccessfully) {
        throw new Error(
          language === "id"
            ? "Gagal menyimpan riwayat latihan ke cloud. Data telah diamankan di penyimpanan lokal perangkat."
            : "Failed to save workout history to cloud. Data preserved in local storage."
        );
      }

      setIsSavedSuccessfully(true);
      toast.success(
        language === "id"
          ? "Sesi latihan & data smartwatch berhasil disimpan ke cloud!"
          : "AI Form Coach workout & smartwatch session saved to cloud!"
      );
    } catch (err: any) {
      console.error("Error saving workout session:", err);
      toast.error(
        err.message ||
        (language === "id"
          ? "Gagal menyimpan riwayat latihan ke server. Pastikan login aktif."
          : "Failed to save workout history to server. Ensure active login.")
      );
    } finally {
      setIsSavingWorkout(false);
    }
  };

  // RENDER STEP 1: CHOOSE EXERCISE
  if (step === "choose_exercise") {
    // Calculate AI Summary statistics from available workout history and member biometrics
    const totalSessions = workoutHistory.length;
    const totalDurationMinutes = workoutHistory.reduce((acc: number, s: any) => acc + (s.duration_minutes || 0), 0);
    const totalRepsDone = workoutHistory.reduce((acc: number, s: any) => acc + (s.total_reps || 0), 0);
    const avgFormScore = totalSessions > 0
      ? Math.round(workoutHistory.reduce((acc: number, s: any) => acc + (s.average_form_score || 0), 0) / totalSessions)
      : null;
    const memberBmi = (member.tinggi_badan && member.berat_badan && member.tinggi_badan > 0)
      ? (member.berat_badan / Math.pow(member.tinggi_badan / 100, 2)).toFixed(1)
      : null;
    const memberBmiNum = memberBmi ? parseFloat(memberBmi) : null;
    let bmiCategory = language === "id" ? "Normal" : "Normal Weight";
    let bmiBadgeColor = "text-teal-400 bg-teal-500/10 border-teal-500/20";
    if (memberBmiNum) {
      if (memberBmiNum < 18.5) {
        bmiCategory = language === "id" ? "Underweight" : "Underweight";
        bmiBadgeColor = "text-blue-400 bg-blue-500/10 border-blue-500/20";
      } else if (memberBmiNum < 25) {
        bmiCategory = language === "id" ? "Ideal" : "Normal";
        bmiBadgeColor = "text-teal-400 bg-teal-500/10 border-teal-500/20";
      } else if (memberBmiNum < 30) {
        bmiCategory = language === "id" ? "Overweight" : "Overweight";
        bmiBadgeColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
      } else {
        bmiCategory = language === "id" ? "Obesitas" : "Obese";
        bmiBadgeColor = "text-red-400 bg-red-500/10 border-red-500/20";
      }
    }

    const scoreTier = !avgFormScore
      ? {
          label: language === "id" ? "Kalibrasi Awal" : "Initial Calibration",
          color: "text-amber-400",
          sub: language === "id" ? "Menunggu Sesi Pertama" : "Awaiting First Session",
        }
      : avgFormScore >= 85
      ? {
          label: language === "id" ? "Teknik Unggul (Elite)" : "Elite Technique",
          color: "text-emerald-400",
          sub: language === "id" ? "Biomekanik Optimal" : "Optimal Biomechanics",
        }
      : avgFormScore >= 70
      ? {
          label: language === "id" ? "Teknik Solid" : "Solid Form",
          color: "text-[#FF8533]",
          sub: language === "id" ? "Konsisten & Terkontrol" : "Consistent & Controlled",
        }
      : {
          label: language === "id" ? "Perlu Penyesuaian" : "Needs Adjustments",
          color: "text-amber-400",
          sub: language === "id" ? "Fokus Rentang Gerak" : "Focus on ROM Depth",
        };

    // Body parts for horizontal scrolling filter
    const BODY_PARTS = [
      { id: "all", labelId: "Semua", labelEn: "All" },
      { id: "legs", labelId: "Kaki & Glutes", labelEn: "Legs & Glutes" },
      { id: "chest", labelId: "Dada & Tricep", labelEn: "Chest & Triceps" },
      { id: "arms", labelId: "Lengan (Biceps)", labelEn: "Arms (Biceps)" },
      { id: "core", labelId: "Inti & Punggung", labelEn: "Core & Back" },
    ];

    const exerciseCategories: Record<ExerciseType, string> = {
      squat: "legs",
      push_up: "chest",
      bicep_curl: "arms",
    };

    const exerciseCheckpoints: Record<ExerciseType, string[]> = {
      squat: [
        language === "id" ? "Kedalaman paha sejajar lutut 90°" : "90° knee and thigh depth",
        language === "id" ? "Punggung tegak & dada tegap" : "Upright torso & proud chest",
      ],
      push_up: [
        language === "id" ? "Siku menekuk ~90° saat turun" : "~90° elbow bend at bottom",
        language === "id" ? "Garis tubuh & core lurus terkunci" : "Straight bodyline with engaged core",
      ],
      bicep_curl: [
        language === "id" ? "Tekukan penuh lengan ke dada" : "Full upward forearm contraction",
        language === "id" ? "Posisi siku terkunci di samping" : "Elbows stabilized at ribs",
      ],
    };

    const filteredExercises = (["squat", "push_up", "bicep_curl"] as ExerciseType[]).filter((ex) => {
      if (selectedBodyPart === "all") return true;
      return exerciseCategories[ex] === selectedBodyPart;
    });

    const aiInsightText = totalSessions > 0
      ? (language === "id"
          ? `Berdasarkan analisis ${totalSessions} sesi latihan Anda, akurasi gerakan rata-rata berada di skor ${avgFormScore}/100 dengan total ${totalRepsDone} repetisi (${totalDurationMinutes} menit latihan). ${member.tinggi_badan ? `Dengan postur tinggi ${member.tinggi_badan} cm, jaga rentang gerak (ROM) penuh dan tempo konstan.` : "Pertahankan tempo repetisi stabil dan jaga keseimbangan tubuh."} Evaluasi biomekanik menunjukkan kontrol postur yang konsisten.`
          : `Based on your ${totalSessions} analyzed sessions, average form score is ${avgFormScore}/100 with ${totalRepsDone} total reps (${totalDurationMinutes} mins total). ${member.tinggi_badan ? `With height ${member.tinggi_badan} cm, prioritize full range of motion.` : "Maintain consistent tempo and core posture."} Biomechanical evaluation indicates consistent posture control.`)
      : (language === "id"
          ? `Selamat datang ${member.nama}! Sistem AI Vision siap mendeteksi postur tubuh Anda secara real-time langsung melalui kamera. ${memberBmi ? `Data fisik Anda (BMI: ${memberBmi} • ${bmiCategory}) sudah terintegrasi untuk kalibrasi postur.` : "Anda dapat mengisi tinggi & berat badan di tab Profil untuk analisa fisik personal."} Pilih latihan di bawah untuk memulai sesi pertama!`
          : `Welcome ${member.nama}! The AI Vision system is ready to evaluate your form in real-time. ${memberBmi ? `Your biometrics (BMI: ${memberBmi} • ${bmiCategory}) are linked for posture tuning.` : "You can configure your height & weight in the Profile tab."} Choose an exercise below to start!`);

    return (
      <div className="w-full space-y-7 text-left py-1">
        {/* Top Back Navigation to Last Opened View */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToDashboard}
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all active:scale-95 shadow-xs ${
              isDark
                ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm"
            }`}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali</span>
          </button>
        </div>

        {/* ── 1. TITLE DAN SUB TITLE (Sederhana, tanpa card) ── */}
        <div className="space-y-2.5 text-left pt-1">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold ${
              isDark
                ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                : "bg-blue-50 text-blue-700 border-blue-200"
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span>SynFit AI Form Coach</span>
          </div>

          <h1
            className={`text-2xl sm:text-3xl font-black uppercase tracking-tight heading-font leading-tight ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            {language === "id" ? (
              <>
                Latihan Lebih{" "}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 bg-clip-text text-transparent">
                  Cerdas
                </span>
                . Bergerak Lebih{" "}
                <span className="bg-gradient-to-r from-[#FF6B00] via-orange-500 to-amber-500 bg-clip-text text-transparent">
                  Baik
                </span>
                .
              </>
            ) : (
              <>
                Train{" "}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 bg-clip-text text-transparent">
                  Smarter
                </span>
                . Move{" "}
                <span className="bg-gradient-to-r from-[#FF6B00] via-orange-500 to-amber-500 bg-clip-text text-transparent">
                  Better
                </span>
                .
              </>
            )}
          </h1>

          <p
            className={`text-xs sm:text-sm font-medium leading-relaxed max-w-2xl ${
              isDark ? "text-slate-300" : "text-slate-600"
            }`}
          >
            {language === "id"
              ? "Analisis postur tubuh 2D real-time, hitungan repetisi otomatis, dan pemantauan detak jantung terpadu langsung melalui kamera perangkat Anda."
              : "Real-time 2D posture tracking, automated rep counting, and integrated biometric heart rate monitoring on-device."}
          </p>

          {/* Quick Indicators */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold shadow-xs flex items-center gap-1.5 ${
                isDark
                  ? "bg-[#101935] border-blue-500/30 text-blue-200"
                  : "bg-blue-50/90 border-2 border-blue-200 text-blue-900"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#3B82F6] animate-pulse" />
              <span>{filteredExercises.length} {language === "id" ? "Latihan Live Siap" : "Live Exercises Ready"}</span>
            </span>
            <span
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold shadow-xs flex items-center gap-1.5 ${
                isDark
                  ? "bg-[#0c1f19] border-emerald-500/30 text-emerald-300"
                  : "bg-emerald-50/90 border-2 border-emerald-200 text-emerald-900"
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              <span>{language === "id" ? "100% Kamera Privat (Lokal)" : "100% On-Device Private"}</span>
            </span>
            {totalSessions > 0 && (
              <span
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold shadow-xs flex items-center gap-1.5 ${
                  isDark
                    ? "bg-[#271507] border-orange-500/35 text-orange-300"
                    : "bg-orange-50/90 border-2 border-orange-200 text-orange-900"
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span>{totalSessions} {language === "id" ? "Sesi Selesai" : "Sessions Recorded"}</span>
              </span>
            )}
          </div>
        </div>

        {/* ── 2. PERANGKAT TERHUBUNG ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-lg border flex items-center justify-center ${
                  isDark
                    ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                    : "bg-blue-100 text-blue-600 border-blue-200"
                }`}
              >
                <Watch className="w-4 h-4" />
              </div>
              <div>
                <h2
                  className={`text-base sm:text-lg font-black uppercase tracking-tight heading-font ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {language === "id" ? "Perangkat Terhubung" : "Connected Devices"}
                </h2>
                <p
                  className={`text-[11px] font-medium ${
                    isDark ? "text-blue-300/80" : "text-slate-600"
                  }`}
                >
                  {language === "id"
                    ? "Status koneksi smartwatch & sensor biometrik latihan"
                    : "Live smartwatch connection & biometric sensors"}
                </p>
              </div>
            </div>
          </div>

          <SmartwatchHeartRate
            bleState={hrBleState}
            onConnect={connectSmartwatch}
            onDisconnect={disconnectSmartwatch}
            onClearSession={clearHrSession}
            onOpenHistory={onOpenHeartRateHistory}
            language={language}
            isDark={isDark}
          />
        </div>

        {/* ── 3. RINGKASAN LATIHAN OLEH AI ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-lg border flex items-center justify-center ${
                  isDark
                    ? "bg-orange-500/20 text-[#FF6B00] border-orange-500/30"
                    : "bg-orange-100 text-[#FF6B00] border-orange-200"
                }`}
              >
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h2
                  className={`text-base sm:text-lg font-black uppercase tracking-tight heading-font ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {language === "id" ? "Ringkasan Latihan oleh AI" : "AI Workout Summary"}
                </h2>
                <p
                  className={`text-[11px] font-medium ${
                    isDark ? "text-orange-300/80" : "text-slate-600"
                  }`}
                >
                  {language === "id"
                    ? "Durasi latihan, detak jantung, repetisi, dan riwayat sesi Anda"
                    : "Duration, heart rate, repetitions, and workout session history"}
                </p>
              </div>
            </div>
          </div>

          {/* 4 Key Metric Cards (Vibrant Blue & Orange Theme) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Card 1: Durasi Latihan (Blue Card) */}
            <div
              className={`p-4 rounded-3xl transition-all space-y-1 text-left shadow-sm ${
                isDark
                  ? "bg-gradient-to-br from-[#101935] via-[#0D142C] to-[#090D1E] border border-blue-500/30 text-white shadow-blue-950/40"
                  : "bg-gradient-to-br from-blue-50/90 via-indigo-50/40 to-white border-2 border-blue-200 text-slate-900 shadow-blue-500/5"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-black uppercase tracking-wider ${
                    isDark ? "text-blue-400" : "text-blue-700"
                  }`}
                >
                  {language === "id" ? "DURASI LATIHAN" : "TOTAL DURATION"}
                </span>
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                    isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span
                  className={`text-2xl sm:text-3xl font-black font-mono ${
                    isDark ? "text-white" : "text-blue-950"
                  }`}
                >
                  {totalDurationMinutes}
                </span>
                <span
                  className={`text-xs font-bold ${
                    isDark ? "text-blue-300/70" : "text-blue-600/70"
                  }`}
                >
                  min
                </span>
              </div>
              <span
                className={`text-[10px] font-medium block truncate ${
                  isDark ? "text-blue-300/80" : "text-blue-700/80"
                }`}
              >
                {totalSessions > 0
                  ? `${totalSessions} ${language === "id" ? "sesi tersimpan" : "saved sessions"}`
                  : language === "id" ? "Belum ada sesi" : "No sessions yet"}
              </span>
            </div>

            {/* Card 2: Detak Jantung (Orange Card) */}
            <div
              className={`p-4 rounded-3xl transition-all space-y-1 text-left shadow-sm ${
                isDark
                  ? "bg-gradient-to-br from-[#2D1606] via-[#200F04] to-[#140902] border border-orange-500/35 text-white shadow-orange-950/40"
                  : "bg-gradient-to-br from-orange-50/90 via-amber-50/40 to-white border-2 border-orange-200 text-slate-900 shadow-orange-500/5"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-black uppercase tracking-wider ${
                    isDark ? "text-orange-400" : "text-orange-700"
                  }`}
                >
                  {language === "id" ? "DETAK JANTUNG" : "HEART RATE"}
                </span>
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                    isDark ? "bg-orange-500/20 text-[#FF6B00]" : "bg-orange-100 text-[#FF6B00]"
                  }`}
                >
                  <Heart className="w-3.5 h-3.5 fill-[#FF6B00]" />
                </div>
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl sm:text-3xl font-black font-mono text-[#FF5A2C]">
                  {hrBleState.status === "connected" && hrBleState.currentBpm
                    ? hrBleState.currentBpm
                    : hrBleState.stats.avgBpm
                    ? hrBleState.stats.avgBpm
                    : hrBleState.lastValidBpm
                    ? hrBleState.lastValidBpm
                    : "--"}
                </span>
                <span
                  className={`text-xs font-bold ${
                    isDark ? "text-orange-300/70" : "text-orange-600/70"
                  }`}
                >
                  BPM
                </span>
              </div>
              <span
                className={`text-[10px] font-medium block truncate ${
                  isDark ? "text-orange-300/80" : "text-orange-700/80"
                }`}
              >
                {hrBleState.status === "connected"
                  ? (hrBleState.deviceName ? `${hrBleState.deviceName} (Live)` : (language === "id" ? "Live smartwatch sync" : "Live smartwatch sync"))
                  : hrBleState.stats.avgBpm
                  ? (language === "id" ? "Rata-rata sesi" : "Session average")
                  : (hrBleState.deviceName || (language === "id" ? "Smartwatch BLE" : "BLE Smartwatch"))}
              </span>
            </div>

            {/* Card 3: Total Repetisi (Orange Card) */}
            <div
              className={`p-4 rounded-3xl transition-all space-y-1 text-left shadow-sm ${
                isDark
                  ? "bg-gradient-to-br from-[#2D1606] via-[#200F04] to-[#140902] border border-orange-500/35 text-white shadow-orange-950/40"
                  : "bg-gradient-to-br from-orange-50/90 via-amber-50/40 to-white border-2 border-orange-200 text-slate-900 shadow-orange-500/5"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-black uppercase tracking-wider ${
                    isDark ? "text-orange-400" : "text-orange-700"
                  }`}
                >
                  {language === "id" ? "TOTAL REPETISI" : "TOTAL REPS"}
                </span>
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                    isDark ? "bg-orange-500/20 text-[#FF6B00]" : "bg-orange-100 text-[#FF6B00]"
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl sm:text-3xl font-black font-mono text-[#FF8533]">
                  {totalRepsDone}
                </span>
                <span
                  className={`text-xs font-bold ${
                    isDark ? "text-orange-300/70" : "text-orange-600/70"
                  }`}
                >
                  reps
                </span>
              </div>
              <span
                className={`text-[10px] font-medium block truncate ${
                  isDark ? "text-orange-300/80" : "text-orange-700/80"
                }`}
              >
                {language === "id"
                  ? `~${Math.round(totalRepsDone * 0.4 + totalDurationMinutes * 5)} kkal estimasi`
                  : `~${Math.round(totalRepsDone * 0.4 + totalDurationMinutes * 5)} kcal est.`}
              </span>
            </div>

            {/* Card 4: Rata-rata Form Score (Electric Blue / Indigo Card) */}
            <div
              className={`p-4 rounded-3xl transition-all space-y-1 text-left shadow-sm ${
                isDark
                  ? "bg-gradient-to-br from-[#121A38] via-[#0E152F] to-[#0A0E21] border border-blue-500/30 text-white shadow-blue-950/40"
                  : "bg-gradient-to-br from-blue-50/90 via-indigo-50/40 to-white border-2 border-blue-200 text-slate-900 shadow-blue-500/5"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-black uppercase tracking-wider ${
                    isDark ? "text-blue-400" : "text-blue-700"
                  }`}
                >
                  {language === "id" ? "RATA-RATA FORM" : "AVG FORM SCORE"}
                </span>
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                    isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600"
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span
                  className={`text-2xl sm:text-3xl font-black font-mono ${
                    isDark ? "text-blue-200" : "text-blue-900"
                  }`}
                >
                  {avgFormScore ? `${avgFormScore}` : "--"}
                </span>
                <span
                  className={`text-xs font-bold ${
                    isDark ? "text-blue-400/70" : "text-blue-600/70"
                  }`}
                >
                  / 100
                </span>
              </div>
              <span className={`text-[10px] font-bold block truncate ${scoreTier.color}`}>
                {scoreTier.label}
              </span>
            </div>
          </div>

          {/* Riwayat Latihan Terkini (Themed Blue/Orange Card) */}
          <div
            className={`p-4 sm:p-5 rounded-3xl transition-all space-y-3 text-left shadow-sm ${
              isDark
                ? "bg-gradient-to-br from-[#101935] via-[#0D142C] to-[#090D1E] border border-blue-500/30 text-white"
                : "bg-gradient-to-br from-blue-50/60 via-white to-blue-50/40 border-2 border-blue-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-black uppercase tracking-wider ${
                  isDark ? "text-blue-400" : "text-blue-800"
                }`}
              >
                {language === "id" ? "Riwayat Latihan Terkini" : "Recent Workout Sessions"}
              </span>
              <span
                className={`text-[10px] font-bold ${
                  isDark ? "text-blue-300/70" : "text-blue-800/70"
                }`}
              >
                {workoutHistory.length} {language === "id" ? "riwayat tercatat" : "sessions recorded"}
              </span>
            </div>

            {workoutHistory.length > 0 ? (
              <div className="space-y-2">
                {workoutHistory.slice(0, 3).map((s, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                      isDark
                        ? "bg-[#141F42] border border-blue-500/20 text-white"
                        : "bg-white border-2 border-blue-100 text-slate-900 shadow-xs"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isDark
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            : "bg-blue-100 text-blue-600 border border-blue-200"
                        }`}
                      >
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <p
                          className={`text-xs font-bold ${
                            isDark ? "text-white" : "text-slate-900"
                          }`}
                        >
                          {s.exercises?.map((e: any) => e.name).join(", ") || (language === "id" ? "Sesi Latihan" : "Workout Session")}
                        </p>
                        <p
                          className={`text-[10px] ${
                            isDark ? "text-blue-200/70" : "text-slate-500"
                          }`}
                        >
                          {s.created_at ? new Date(s.created_at).toLocaleDateString(language === "id" ? "id-ID" : "en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : (language === "id" ? "Sesi tersimpan" : "Recorded session")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto text-right">
                      <div>
                        <span
                          className={`text-[9px] block font-bold ${
                            isDark ? "text-blue-300/70" : "text-slate-500"
                          }`}
                        >
                          REPS & DURASI
                        </span>
                        <span
                          className={`text-xs font-mono font-bold ${
                            isDark ? "text-white" : "text-slate-900"
                          }`}
                        >
                          {s.total_reps || 0} reps • {s.duration_minutes || 1} min
                        </span>
                      </div>
                      <div
                        className={`px-2.5 py-1 rounded-xl text-xs font-mono font-black border ${
                          isDark
                            ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                            : "bg-blue-100 text-blue-700 border-blue-200"
                        }`}
                      >
                        {s.average_form_score || 85} Score
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className={`p-6 rounded-2xl text-center space-y-1 transition-colors ${
                  isDark
                    ? "bg-[#121A35]/50 border-2 border-dashed border-blue-500/30 text-blue-200"
                    : "bg-blue-50/60 border-2 border-dashed border-blue-200 text-slate-600"
                }`}
              >
                <p
                  className={`text-xs font-bold ${
                    isDark ? "text-blue-200" : "text-slate-800"
                  }`}
                >
                  {language === "id" ? "Belum ada riwayat sesi latihan" : "No workout history recorded yet"}
                </p>
                <p
                  className={`text-[11px] max-w-sm mx-auto ${
                    isDark ? "text-blue-300/70" : "text-slate-600"
                  }`}
                >
                  {language === "id"
                    ? "Mulai set latihan pertama Anda pada menu Latihan Live AI di bawah untuk menganalisis postur dan menyimpan data performa."
                    : "Start your first workout set below to analyze form and record performance."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── 4. LATIHAN LIVE AI ── */}
        <div id="workout-selection-section" className="space-y-4 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-lg border flex items-center justify-center ${
                  isDark
                    ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                    : "bg-blue-100 text-blue-600 border-blue-200"
                }`}
              >
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <h2
                  className={`text-base sm:text-lg font-black uppercase tracking-tight heading-font ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {language === "id" ? "Latihan Live AI" : "Live AI Workouts"}
                </h2>
                <p
                  className={`text-[11px] font-medium ${
                    isDark ? "text-blue-300/80" : "text-slate-600"
                  }`}
                >
                  {language === "id"
                    ? "Pilih latihan dan aktifkan kamera untuk evaluasi postur real-time"
                    : "Choose an exercise and start live camera computer vision feedback"}
                </p>
              </div>
            </div>
            <span
              className={`text-[10px] font-black uppercase ${
                isDark ? "text-blue-300/70" : "text-blue-800/70"
              }`}
            >
              {filteredExercises.length} {language === "id" ? "Latihan Tersedia" : "Exercises Available"}
            </span>
          </div>

          {/* Muscle Group Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar -mx-1 px-1">
            {BODY_PARTS.map((bp) => {
              const isSelected = selectedBodyPart === bp.id;
              return (
                <button
                  key={bp.id}
                  onClick={() => setSelectedBodyPart(bp.id)}
                  className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all shrink-0 active:scale-95 ${
                    isSelected
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25"
                      : isDark
                      ? "bg-[#101935] hover:bg-[#152042] text-blue-100 border border-blue-500/30"
                      : "bg-white hover:bg-blue-50 text-slate-700 border-2 border-blue-100 hover:border-blue-300 shadow-xs"
                  }`}
                >
                  {language === "id" ? bp.labelId : bp.labelEn}
                </button>
              );
            })}
          </div>

          {/* Exercise Cards Grid */}
          {filteredExercises.length === 0 ? (
            <div
              className={`p-8 rounded-3xl text-center space-y-3 shadow-sm transition-colors ${
                isDark
                  ? "bg-[#101935] border border-blue-500/30 text-white"
                  : "bg-white border-2 border-blue-200 text-slate-900"
              }`}
            >
              <h4
                className={`text-sm font-black uppercase ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {language === "id" ? "Latihan Sedang Dikembangkan" : "Exercise In Development"}
              </h4>
              <p
                className={`text-xs max-w-sm mx-auto ${
                  isDark ? "text-blue-200/70" : "text-slate-600"
                }`}
              >
                {language === "id"
                  ? "Modul latihan untuk bagian tubuh ini akan segera tersedia. Silakan pilih kategori lain."
                  : "Exercises for this muscle group are coming soon. Please select another category."}
              </p>
              <button
                onClick={() => setSelectedBodyPart("all")}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-sm"
              >
                {language === "id" ? "Lihat Semua Latihan" : "View All Exercises"}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredExercises.map((ex) => {
                const meta = EXERCISE_METADATA[ex];
                const checkpoints = exerciseCheckpoints[ex];

                return (
                  <motion.div
                    key={ex}
                    whileHover={{ y: -3 }}
                    onClick={() => handleSelectExercise(ex)}
                    className={`rounded-3xl flex flex-col justify-between cursor-pointer group transition-all relative overflow-hidden text-left ${
                      isDark
                        ? "bg-gradient-to-b from-[#101935] via-[#0D142C] to-[#090D1E] border border-blue-500/30 hover:border-blue-400 text-white shadow-xl hover:shadow-blue-900/30"
                        : "bg-gradient-to-b from-white via-white to-blue-50/40 border-2 border-blue-200 hover:border-blue-400 text-slate-900 shadow-md shadow-blue-500/5 hover:shadow-lg"
                    }`}
                  >
                    {/* Exercise Photorealistic Banner */}
                    <div className="relative w-full aspect-[16/10] overflow-hidden bg-gray-100 dark:bg-[#0d1017]">
                      <img
                        src={EXERCISE_IMAGES[ex]}
                        alt={meta.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                      <div className="absolute top-2.5 right-2.5">
                        <span className="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-black/65 backdrop-blur-md border border-white/20 text-white">
                          {meta.targetRepsDefault} Reps
                        </span>
                      </div>
                      <div className="absolute bottom-2.5 left-3">
                        <span className="text-[9px] font-black text-white uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#FF6B00] to-orange-500 backdrop-blur-md border border-orange-400/30 flex items-center gap-1 shadow-md shadow-orange-500/30">
                          <Flame className="w-2.5 h-2.5 text-white" />
                          <span>{meta.primaryMuscle}</span>
                        </span>
                      </div>
                    </div>

                    {/* Card Content (Blue / Orange accented theme) */}
                    <div className="p-4 pt-3 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-2">
                        <h4
                          className={`text-base font-black uppercase heading-font tracking-tight transition-colors ${
                            isDark
                              ? "text-white group-hover:text-blue-300"
                              : "text-slate-900 group-hover:text-blue-600"
                          }`}
                        >
                          {meta.name}
                        </h4>

                        <p
                          className={`text-xs font-medium leading-relaxed line-clamp-2 ${
                            isDark ? "text-slate-300" : "text-slate-600"
                          }`}
                        >
                          {meta.description}
                        </p>

                        {/* AI Vision Checkpoints */}
                        <div
                          className={`pt-2 border-t space-y-1 ${
                            isDark ? "border-blue-500/20" : "border-blue-100"
                          }`}
                        >
                          <span
                            className={`text-[9px] font-black uppercase tracking-wider block ${
                              isDark ? "text-blue-400" : "text-blue-700"
                            }`}
                          >
                            {language === "id" ? "Fokus Deteksi AI:" : "AI Checkpoints:"}
                          </span>
                          {checkpoints.map((cp, idx) => (
                            <div
                              key={idx}
                              className={`flex items-center gap-1.5 text-[10px] font-medium ${
                                isDark ? "text-blue-200" : "text-slate-700"
                              }`}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                              <span className="truncate">{cp}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Card Footer Button */}
                      <div
                        className={`pt-3 border-t flex items-center justify-between ${
                          isDark ? "border-blue-500/20" : "border-blue-100"
                        }`}
                      >
                        <span
                          className={`text-[10px] font-bold uppercase ${
                            isDark ? "text-blue-300/80" : "text-slate-500"
                          }`}
                        >
                          {language === "id" ? "Mode Real-Time" : "Real-Time Mode"}
                        </span>
                        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-500/25">
                          <Play className="h-3 w-3 fill-current" />
                          <span>{language === "id" ? "Mulai Live" : "Start Live"}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 5. SARAN DARI AI ASSISTANT ── */}
        <div className="space-y-3 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-lg border flex items-center justify-center ${
                  isDark
                    ? "bg-gradient-to-br from-blue-500/20 to-orange-500/20 text-[#FF6B00] border-orange-500/30"
                    : "bg-gradient-to-br from-blue-100 to-orange-100 text-[#FF6B00] border-orange-200"
                }`}
              >
                <Sparkles className="w-4 h-4 text-[#FF6B00]" />
              </div>
              <div>
                <h2
                  className={`text-base sm:text-lg font-black uppercase tracking-tight heading-font ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {language === "id" ? "Saran dari AI Assistant" : "AI Assistant Recommendations"}
                </h2>
                <p
                  className={`text-[11px] font-medium ${
                    isDark ? "text-blue-300/80" : "text-slate-600"
                  }`}
                >
                  {language === "id"
                    ? "Rekomendasi personal berbasis biomekanik, profil fisik, dan performa Anda"
                    : "Personalized guidance based on your biometrics, profile, and performance"}
                </p>
              </div>
            </div>
          </div>

          <div
            className={`p-5 sm:p-6 rounded-3xl relative overflow-hidden space-y-4 shadow-md transition-all ${
              isDark
                ? "bg-gradient-to-br from-[#101935] via-[#0E152F] to-[#1F140A] border border-blue-500/35 text-white shadow-blue-950/40"
                : "bg-gradient-to-br from-blue-50/95 via-indigo-50/50 to-orange-50/40 border-2 border-blue-200 text-slate-900 shadow-blue-500/5"
            }`}
          >
            {/* Subtle Background Glow */}
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />

            {/* Coach Header & Biometrics Pills */}
            <div
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 ${
                isDark ? "border-blue-500/20" : "border-blue-100"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/25">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    className={`text-sm font-black uppercase tracking-tight ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    SynFit AI Personal Coach
                  </h3>
                  <p
                    className={`text-[11px] font-medium ${
                      isDark ? "text-blue-300" : "text-blue-700"
                    }`}
                  >
                    {language === "id" ? "Sistem Analisis Postur & Adaptasi Latihan" : "Posture & Training Load Analysis"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {memberBmi && (
                  <span
                    className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                      isDark
                        ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                        : "bg-orange-100 text-orange-700 border-orange-300"
                    }`}
                  >
                    BMI: {memberBmi} • {bmiCategory}
                  </span>
                )}
                {member.tinggi_badan && (
                  <span
                    className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                      isDark
                        ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                        : "bg-blue-100 text-blue-700 border-blue-300"
                    }`}
                  >
                    {member.tinggi_badan} cm
                  </span>
                )}
              </div>
            </div>

            {/* AI Personalized Coaching Advice */}
            <div className="space-y-3">
              <div
                className={`p-4 rounded-2xl text-xs font-medium leading-relaxed ${
                  isDark
                    ? "bg-[#121A38]/90 border border-blue-500/30 text-blue-100"
                    : "bg-white/95 border-2 border-blue-200/80 text-slate-800 shadow-xs"
                }`}
              >
                <p className="leading-relaxed">
                  {aiInsightText}
                </p>
              </div>

              {/* 3 Specific Actionable Recommendations (Blue & Orange Theme) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* ROM (Blue Card) */}
                <div
                  className={`p-3.5 rounded-2xl space-y-1 transition-colors ${
                    isDark
                      ? "bg-[#131D3E] border border-blue-500/30 text-white"
                      : "bg-blue-50/90 border-2 border-blue-200 text-slate-900"
                  }`}
                >
                  <div
                    className={`flex items-center gap-1.5 text-xs font-bold ${
                      isDark ? "text-blue-300" : "text-blue-700"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{language === "id" ? "Konsistensi ROM" : "ROM Consistency"}</span>
                  </div>
                  <p
                    className={`text-[11px] leading-snug ${
                      isDark ? "text-blue-200/80" : "text-slate-600"
                    }`}
                  >
                    {language === "id"
                      ? "Pastikan tekukan 90° tercapai di setiap repetisi untuk stimulasi otot maksimal."
                      : "Ensure full 90° range of motion on each repetition for optimal muscle activation."}
                  </p>
                </div>

                {/* Tempo (Orange Card) */}
                <div
                  className={`p-3.5 rounded-2xl space-y-1 transition-colors ${
                    isDark
                      ? "bg-[#281406] border border-orange-500/35 text-white"
                      : "bg-orange-50/90 border-2 border-orange-200 text-slate-900"
                  }`}
                >
                  <div
                    className={`flex items-center gap-1.5 text-xs font-bold ${
                      isDark ? "text-orange-300" : "text-orange-700"
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 shrink-0" />
                    <span>{language === "id" ? "Tempo Terkontrol" : "Controlled Tempo"}</span>
                  </div>
                  <p
                    className={`text-[11px] leading-snug ${
                      isDark ? "text-orange-200/80" : "text-slate-600"
                    }`}
                  >
                    {language === "id"
                      ? "2 detik fase turun (eksentrik) dan 1 detik fase naik (konsentrik) tanpa mengayun."
                      : "2s eccentric lowering, 1s concentric contraction without swinging."}
                  </p>
                </div>

                {/* Target Cardio Zone (Orange Card) */}
                <div
                  className={`p-3.5 rounded-2xl space-y-1 transition-colors ${
                    isDark
                      ? "bg-[#281406] border border-orange-500/35 text-white"
                      : "bg-orange-50/90 border-2 border-orange-200 text-slate-900"
                  }`}
                >
                  <div
                    className={`flex items-center gap-1.5 text-xs font-bold ${
                      isDark ? "text-[#FF8533]" : "text-[#FF6B00]"
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5 shrink-0" />
                    <span>{language === "id" ? "Zona Kardio Target" : "Target Cardio Zone"}</span>
                  </div>
                  <p
                    className={`text-[11px] leading-snug ${
                      isDark ? "text-orange-200/80" : "text-slate-600"
                    }`}
                  >
                    {language === "id"
                      ? "Pertahankan denyut di Zona 2 - 3 (60-80% HR Max) untuk pembakaran lemak optimal."
                      : "Maintain heart rate in Zone 2 - 3 (60-80% HR Max) for endurance & fat burn."}
                  </p>
                </div>
              </div>
            </div>

            {/* Privacy Assurance & Consultation Link */}
            <div
              className={`pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t text-xs ${
                isDark ? "border-blue-500/20" : "border-blue-100"
              }`}
            >
              <div
                className={`flex items-center gap-2 text-[11px] ${
                  isDark ? "text-blue-300/80" : "text-slate-600"
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{language === "id" ? "Model AI berjalan lokal tanpa upload video" : "On-device AI without video upload"}</span>
              </div>

              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("synfit-open-chat"));
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-[#FF6B00] hover:opacity-95 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-blue-500/25 transition-all active:scale-95"
              >
                <span>{language === "id" ? "Konsultasi AI Coach" : "Consult AI Coach"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // RENDER STEPS 2 & 3: Preparation + Workout share a persistent camera viewport (PART 5)
  if (step === "preparation" || step === "workout") {
    const meta = EXERCISE_METADATA[selectedExercise];
    const prep = liveFrame?.prepStatus;
    const isWorkout = step === "workout";
    const score = liveFrame?.currentFormScore ?? 85;
    const reps = liveFrame?.completedReps ?? 0;
    const category = liveFrame?.formCategory ?? "Good";

    return (
      <div className="w-full text-left py-1 max-w-5xl mx-auto space-y-4">
        {/* ── Responsive Camera Viewport with Up-Layer Floating Controls ── */}
        <div className="relative w-full h-[78vh] min-h-[520px] max-h-[840px] aspect-[9/16] sm:aspect-[3/4] md:aspect-[16/9] md:h-[580px] rounded-3xl overflow-hidden bg-black/95 border border-white/10 shadow-2xl flex items-center justify-center mx-auto select-none">
          {/* Persistent video & canvas elements */}
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none transform -scale-x-100"
          />

          {/* ── TOP UP-LAYER: Controls ── */}
          {!isWorkout ? (
            /* Preparation Top Bar */
            <div className="absolute top-3 inset-x-3 sm:top-4 sm:inset-x-4 flex items-center justify-between z-20 pointer-events-auto">
              <button
                onClick={() => {
                  stopCamera();
                  setStep("choose_exercise");
                }}
                className="px-3.5 py-2 rounded-xl bg-black/70 hover:bg-black/90 backdrop-blur-md border border-white/20 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-xl"
                title={language === "id" ? "Kembali ke AI Coach" : "Back to AI Coach"}
              >
                <ArrowLeft className="h-4 w-4 text-[#6C63FF]" />
                <span>{language === "id" ? "Kembali" : "Back"}</span>
              </button>
              <div className="flex items-center gap-2">
                <SmartwatchHeartRate
                  bleState={hrBleState}
                  onConnect={connectSmartwatch}
                  onDisconnect={disconnectSmartwatch}
                  compact={true}
                  language={language}
                />
                <div className="px-3.5 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/15 text-right shadow-lg">
                  <span className="text-[9px] font-black text-[#D7FF38] uppercase tracking-widest block leading-tight">
                    STEP 2 • SETUP
                  </span>
                  <span className="text-xs font-black text-white uppercase heading-font leading-tight">
                    {meta.name}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Workout Top Bar */
            <div className="absolute top-3 inset-x-3 sm:top-4 sm:inset-x-4 flex items-center justify-between z-20 pointer-events-auto">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowExitConfirmModal(true)}
                  className="h-9 px-3 rounded-xl bg-black/70 hover:bg-black/90 backdrop-blur-md border border-white/20 text-white text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all shadow-xl"
                  title={language === "id" ? "Kembali ke AI Coach" : "Back to AI Coach"}
                >
                  <ArrowLeft className="h-4 w-4 text-[#6C63FF]" />
                  <span>{language === "id" ? "Kembali" : "Back"}</span>
                </button>
                <span className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-black/60 backdrop-blur-md border border-white/15 text-white flex items-center gap-1.5 shadow-lg">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="hidden sm:inline">LIVE COACH</span>
                  <span>SET {currentSetNumber}</span>
                </span>
                <span className="hidden md:inline-flex px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-black/60 backdrop-blur-md border border-[#FF6B00]/30 text-[#FF8533] shadow-lg flex items-center gap-1">
                  <Flame className="w-3 h-3 text-[#FF6B00]" />
                  <span>{liveFrame?.currentPhase || "READY"}</span>
                </span>
                <SmartwatchHeartRate
                  bleState={hrBleState}
                  onConnect={connectSmartwatch}
                  onDisconnect={disconnectSmartwatch}
                  compact={true}
                  language={language}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className="h-9 px-3 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/15 text-white text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all shadow-lg"
                >
                  {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                  <span>{isPaused ? (language === "id" ? "Lanjut" : "Resume") : "Jeda"}</span>
                </button>
                <button
                  onClick={handleStopSetEarly}
                  className="h-9 px-3 rounded-xl bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white backdrop-blur-md border border-red-500/30 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all shadow-lg"
                >
                  <Square className="h-3.5 w-3.5" />
                  <span>{language === "id" ? "Akhiri" : "End"}</span>
                </button>
                <button
                  onClick={() => setSwitchModalOpen(true)}
                  className="h-9 px-3 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/15 text-gray-300 hover:text-white text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all shadow-lg"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{language === "id" ? "Ganti" : "Switch"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Preparation: Distance & Positioning Guidance Banner */}
          {!isWorkout && isCameraActive && prep && (
            <div
              className={`absolute top-16 inset-x-4 sm:max-w-md sm:mx-auto p-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider backdrop-blur-md flex items-center justify-center gap-2 shadow-lg transition-colors z-20 ${
                prep.distanceStatus === "ideal" && prep.poseDetected
                  ? "bg-emerald-500/25 border border-emerald-500/40 text-emerald-300"
                  : "bg-amber-500/25 border border-amber-500/40 text-amber-300"
              }`}
            >
              <Activity className="h-3.5 w-3.5 shrink-0" />
              <span>{prep.guidanceMessage}</span>
            </div>
          )}

          {/* Inactive overlay — shown when camera is off */}
          {!isCameraActive && !isWorkout && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4 bg-[#101322]/85 backdrop-blur-md z-30">
              <div className="w-16 h-16 rounded-3xl bg-[#6C63FF]/20 border border-[#6C63FF]/30 flex items-center justify-center text-white">
                <Camera className="h-8 w-8 text-[#6C63FF]" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-black text-white uppercase heading-font">
                  {language === "id" ? "Kamera Belum Aktif" : "Camera Inactive"}
                </h4>
                <p className="text-xs text-gray-300 max-w-xs leading-relaxed">
                  {language === "id"
                    ? "Tekan tombol Mulai Kamera untuk mengaktifkan pendeteksi pose AI."
                    : "Click Start Camera to activate the pose detection engine."}
                </p>
              </div>
              <Button
                onClick={startCamera}
                disabled={isModelLoading}
                className="h-12 px-6 bg-[#6C63FF] hover:bg-[#584feb] text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-lg shadow-[#6C63FF]/25 active:scale-95"
              >
                {isModelLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {language === "id" ? "Memuat Model AI..." : "Loading AI Model..."}
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 mr-2" />
                    {language === "id" ? "Mulai Kamera" : "Start Camera"}
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Workout: Pause overlay */}
          {isWorkout && isPaused && (
            <div className="absolute inset-0 bg-[#101322]/90 backdrop-blur-md flex flex-col items-center justify-center space-y-3 z-30">
              <Pause className="h-10 w-10 text-[#6C63FF]" />
              <h4 className="text-xl font-black text-white uppercase heading-font">
                {language === "id" ? "Latihan Dijeda" : "Workout Paused"}
              </h4>
              <Button
                onClick={() => setIsPaused(false)}
                className="h-11 px-6 bg-[#6C63FF] hover:bg-[#584feb] text-white font-black uppercase text-xs tracking-widest rounded-xl"
              >
                {language === "id" ? "Lanjutkan Latihan" : "Resume Workout"}
              </Button>
            </div>
          )}

          {/* ── BOTTOM UP-LAYER (Floating Controls over Camera Preview) ── */}
          {!isWorkout ? (
            /* Preparation Floating Up-Layer */
            <div className="absolute bottom-3 inset-x-3 sm:bottom-4 sm:inset-x-4 max-w-lg mx-auto z-20 backdrop-blur-xl bg-[#101322]/85 border border-white/15 p-4 rounded-3xl shadow-2xl space-y-3 pointer-events-auto">
              {/* Setup checklist chips */}
              <div className="grid grid-cols-3 gap-2">
                <div
                  className={`p-2 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                    isCameraActive
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                      : "bg-white/5 border-white/10 text-gray-400"
                  }`}
                >
                  <Check className="h-3.5 w-3.5 mb-0.5" />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Kamera Depan</span>
                </div>
                <div
                  className={`p-2 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                    prep?.poseDetected
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                      : "bg-white/5 border-white/10 text-gray-400"
                  }`}
                >
                  <Check className="h-3.5 w-3.5 mb-0.5" />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Pose Terdeteksi</span>
                </div>
                <div
                  className={`p-2 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                    prep?.fullBodyVisible
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                      : "bg-white/5 border-white/10 text-gray-400"
                  }`}
                >
                  <Check className="h-3.5 w-3.5 mb-0.5" />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Tubuh Lengkap</span>
                </div>
              </div>

              {/* Target Reps Selector */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-300">
                  <span>{language === "id" ? "TARGET REPETISI:" : "TARGET REPS:"}</span>
                  <span className="text-[#D7FF38] font-mono font-bold">{targetReps} REPS</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[8, 10, 12, 15].map((count) => (
                    <button
                      key={count}
                      onClick={() => setTargetReps(count)}
                      className={`h-9 rounded-xl text-xs font-black transition-all ${
                        targetReps === count
                          ? "bg-[#6C63FF] text-white shadow-md shadow-[#6C63FF]/30 scale-[1.02]"
                          : "bg-white/10 hover:bg-white/20 text-gray-300"
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preparation Tip */}
              <p className="text-[11px] text-gray-300 italic text-center px-1 leading-snug line-clamp-2">
                &ldquo;{meta.preparationTips}&rdquo;
              </p>

              {/* Start Set Button */}
              <Button
                onClick={handleStartSet}
                disabled={!isCameraActive || !prep?.poseDetected}
                className="w-full h-12 bg-[#D7FF38] hover:bg-[#cbf52b] text-[#101322] font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl shadow-[#D7FF38]/20 active:scale-95 disabled:opacity-40"
              >
                <Play className="h-4 w-4 mr-2" />
                {language === "id" ? "MULAI SET LATIHAN" : "START SET"}
              </Button>
            </div>
          ) : (
            /* Workout Floating Up-Layer: Reps, Form Score, Feedback Stream & Finish */
            <div className="absolute bottom-3 inset-x-3 sm:bottom-4 sm:inset-x-4 max-w-lg mx-auto z-20 backdrop-blur-xl bg-[#101322]/85 border border-white/15 p-4 rounded-3xl shadow-2xl space-y-3 pointer-events-auto">
              <div className="grid grid-cols-2 gap-3">
                {/* Reps Counter */}
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">REPETISI</span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-3xl font-black text-[#D7FF38] font-mono leading-none">
                        {String(reps).padStart(2, "0")}
                      </span>
                      <span className="text-xs font-bold text-gray-400">/ {String(targetReps).padStart(2, "0")}</span>
                    </div>
                  </div>
                  <div className="h-9 w-9 rounded-xl bg-[#FF6B00]/20 border border-[#FF6B00]/30 flex items-center justify-center text-[#FF6B00]">
                    <Flame className="h-5 w-5" />
                  </div>
                </div>

                {/* Form Score */}
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">FORM SCORE</span>
                    <span
                      className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        score >= 90
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : score >= 75
                          ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                          : score >= 60
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : "bg-red-500/20 text-red-300 border-red-500/30"
                      }`}
                    >
                      {category}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-white font-mono leading-none">{score}</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">/ 100</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#6C63FF] to-[#D7FF38] transition-all duration-300"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Live Smartwatch Heart Rate in Bottom HUD if connected */}
              {hrBleState.status === "connected" && hrBleState.currentBpm && (
                <div className="px-3.5 py-2 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-between shadow-inner">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-red-500 fill-red-500 animate-pulse" />
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-wider">
                      DETAK JANTUNG ({hrBleState.deviceName || "SMARTWATCH"})
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-base font-black font-mono text-white">
                      {hrBleState.currentBpm}
                    </span>
                    <span className="text-[9px] font-bold text-gray-400">BPM</span>
                  </div>
                </div>
              )}

              {/* Real-time Feedback Stream */}
              <div className="min-h-[38px] flex items-center">
                {liveFrame?.feedbacks && liveFrame.feedbacks.length > 0 ? (
                  <div className="w-full flex flex-col gap-1.5 max-h-20 overflow-y-auto custom-scrollbar">
                    {liveFrame.feedbacks.slice(-2).map((f, i) => (
                      <div
                        key={`${f.id}-${i}`}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                          f.type === "good"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : f.type === "warning"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-white/10 text-gray-200 border border-white/15"
                        }`}
                      >
                        {f.type === "good" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                        )}
                        <span className="truncate">{f.message}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="w-full text-[11px] text-gray-400 italic text-center py-1">
                    {language === "id"
                      ? "Lakukan gerakan untuk analisis pose real-time..."
                      : "Perform movement for analysis..."}
                  </p>
                )}
              </div>

              {/* Finish Workout Button */}
              <button
                onClick={handleFinishWorkout}
                className="w-full h-10 bg-white/10 hover:bg-white/20 text-white text-[11px] font-black uppercase tracking-wider rounded-xl border border-white/15 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <span>{language === "id" ? "Selesaikan Latihan" : "Finish Workout"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Camera error notification */}
        {cameraError && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs font-bold text-red-400 flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{cameraError}</span>
          </div>
        )}

        {/* ── Change Exercise Modal (workout step) ── */}
        <AnimatePresence>
          {switchModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="p-6 w-full max-w-md text-left space-y-5 relative border border-gray-200 dark:border-white/10 rounded-3xl bg-white dark:bg-[#1C2034] shadow-2xl"
              >
                <div className="space-y-1.5">
                  <h3 className="text-xl font-black text-foreground uppercase heading-font">
                    {language === "id" ? "Ganti Latihan?" : "Switch Exercise?"}
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                    {language === "id"
                      ? "Set saat ini belum selesai. Set akan otomatis disimpan sebagai 'Incomplete' dan Anda dapat memilih latihan baru tanpa mengulang kamera."
                      : "Current set is incomplete. It will be saved as 'Incomplete' and camera stays active."}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(["squat", "push_up", "bicep_curl"] as ExerciseType[]).map((ex) => (
                    <button
                      key={ex}
                      disabled={ex === selectedExercise}
                      onClick={() => executeSwitchExercise(ex)}
                      className={`relative h-20 rounded-2xl overflow-hidden flex flex-col items-center justify-end pb-2 text-xs font-black uppercase border transition-all group ${
                        ex === selectedExercise
                          ? "opacity-35 border-border pointer-events-none"
                          : "border-gray-200 dark:border-white/10 hover:border-[#6C63FF] text-foreground"
                      }`}
                    >
                      <img
                        src={EXERCISE_IMAGES[ex]}
                        alt={EXERCISE_METADATA[ex].name}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
                      <span className="relative z-10 text-[11px] font-bold text-white drop-shadow">
                        {EXERCISE_METADATA[ex].name}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => {
                      setSwitchModalOpen(false);
                      setPendingNextExercise(null);
                    }}
                    className="flex-1 h-11 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 text-foreground rounded-xl text-xs font-bold uppercase tracking-wider"
                  >
                    {language === "id" ? "Lanjutkan Set Ini" : "Continue Current Set"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Exit Confirmation Modal */}
          {showExitConfirmModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/75 backdrop-blur-md z-[110] flex items-center justify-center p-4 pointer-events-auto"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="p-6 sm:p-7 w-full max-w-sm text-left space-y-5 relative border border-gray-200 dark:border-white/15 rounded-3xl bg-white dark:bg-[#141822] shadow-2xl"
              >
                <div className="space-y-1.5">
                  <h3 className="text-lg font-black text-foreground uppercase heading-font">
                    {language === "id" ? "Kembali ke AI Coach?" : "Exit Workout Session?"}
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                    {language === "id"
                      ? "Sesi kamera saat ini akan dihentikan dan Anda akan kembali ke menu pemilihan latihan."
                      : "The current camera session will stop and you will return to exercise selection."}
                  </p>
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setShowExitConfirmModal(false)}
                    className="flex-1 h-11 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 text-foreground rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    {language === "id" ? "Lanjutkan" : "Continue"}
                  </button>
                  <button
                    onClick={() => {
                      setShowExitConfirmModal(false);
                      stopCamera();
                      setStep("choose_exercise");
                    }}
                    className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all"
                  >
                    {language === "id" ? "Ya, Keluar" : "Exit"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // RENDER STEP 4: SET COMPLETED SCREEN (PART 6)
  if (step === "set_completed") {
    const meta = EXERCISE_METADATA[selectedExercise];
    const res = lastCompletedSetResult;

    return (
      <div className="w-full space-y-6 text-left py-2 max-w-2xl mx-auto">
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#141822] border border-gray-200 dark:border-white/10 space-y-6 text-center relative overflow-hidden shadow-xl">
          {/* Header Icon & Title */}
          <div className="space-y-2">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <span className="text-[10px] font-black text-[#6C63FF] uppercase tracking-widest">
                SET {res?.setNumber || currentSetNumber} {res?.status === "completed" ? "COMPLETED" : "RECORDED"}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-foreground uppercase heading-font tracking-tight mt-0.5">
                {meta.name} Result
              </h2>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#0d1017] border border-gray-100 dark:border-white/5">
              <span className="text-[9px] font-bold text-gray-500 uppercase">REPS</span>
              <p className="text-xl font-black text-foreground heading-font mt-0.5 font-mono">
                {res?.completedReps} / {res?.targetReps}
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#0d1017] border border-gray-100 dark:border-white/5">
              <span className="text-[9px] font-bold text-gray-500 uppercase">FORM SCORE</span>
              <p className="text-xl font-black text-[#6C63FF] heading-font mt-0.5 font-mono">
                {res?.formScore} / 100
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#0d1017] border border-gray-100 dark:border-white/5">
              <span className="text-[9px] font-bold text-gray-500 uppercase">ROM</span>
              <p className="text-xl font-black text-foreground heading-font mt-0.5">
                {res?.metrics.rangeOfMotion || "Good"}
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#0d1017] border border-gray-100 dark:border-white/5">
              <span className="text-[9px] font-bold text-gray-500 uppercase">ALIGNMENT</span>
              <p className="text-xl font-black text-foreground heading-font mt-0.5">
                {res?.metrics.alignment || "Good"}
              </p>
            </div>
          </div>

          {/* AI Coach Summary Feedback Quote */}
          {res?.summaryAdvice && (
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#0d1017] border border-gray-100 dark:border-white/5 text-left relative">
              <span className="text-[9px] font-black text-[#6C63FF] uppercase tracking-widest block mb-1">
                AI FORM COACH FEEDBACK
              </span>
              <p className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed italic">
                "{res.summaryAdvice}"
              </p>
            </div>
          )}

          {/* Rest Timer Widget */}
          <div className="p-4 rounded-2xl bg-[#FF6B00]/5 border border-[#FF6B00]/20 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-3 text-left">
              <Clock className="h-5 w-5 text-[#FF6B00]" />
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-[#FF6B00]">
                  REST TIMER
                </span>
                <p className="text-lg font-black text-foreground font-mono">
                  {Math.floor(restSecondsLeft / 60)
                    .toString()
                    .padStart(2, "0")}
                  :
                  {(restSecondsLeft % 60).toString().padStart(2, "0")}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setRestSecondsLeft((prev) => prev + 30)}
                className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 text-foreground text-[10px] font-bold uppercase tracking-wider"
              >
                +30s
              </button>
              <button
                onClick={() => setIsRestTimerActive(false)}
                className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 text-foreground text-[10px] font-bold uppercase tracking-wider"
              >
                Skip Rest
              </button>
            </div>
          </div>

          {/* Actions: Next Set / Change Exercise / Finish */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Button
              onClick={handleNextSet}
              className="flex-1 h-12 bg-[#D7FF38] hover:bg-[#cbf52b] text-[#101322] font-black uppercase text-xs tracking-widest rounded-2xl shadow-md active:scale-95"
            >
              <Play className="h-4 w-4 mr-2" />
              {language === "id" ? `Mulai Set ${currentSetNumber + 1}` : `Start Set ${currentSetNumber + 1}`}
            </Button>

            <button
              onClick={handleBackToAICoach}
              className="flex-1 h-12 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 text-foreground text-xs font-black uppercase tracking-widest rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {language === "id" ? "Kembali ke AI Coach" : "Back to AI Coach"}
            </button>

            <button
              onClick={handleFinishWorkout}
              className="sm:w-32 h-12 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground text-xs font-black uppercase tracking-widest rounded-2xl transition-all active:scale-95 flex items-center justify-center"
            >
              {language === "id" ? "Selesai" : "Finish"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // RENDER STEP 5: WORKOUT SUMMARY (PART 6)
  if (step === "summary") {
    const summary = compileSummary();

    return (
      <div className="w-full space-y-6 text-left py-2 max-w-3xl mx-auto">
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#141822] border border-gray-200 dark:border-white/10 space-y-6 relative overflow-hidden shadow-xl">
          {/* Header */}
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#6C63FF]/10 text-[#6C63FF] rounded-full text-[9px] font-black uppercase tracking-widest">
              <Award className="h-3.5 w-3.5" />
              <span>SESI LATIHAN SELESAI</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground uppercase heading-font tracking-tight">
              Workout Summary
            </h2>
            <p className="text-xs text-muted-foreground font-medium">
              {language === "id"
                ? `Ringkasan performa dan Form Score latihan Anda (${summary.durationMinutes} menit latihan).`
                : `Performance recap and Form Score analysis (${summary.durationMinutes} min session).`}
            </p>
          </div>

          {/* Overall Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#0d1017] border border-gray-100 dark:border-white/5 space-y-1">
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                TOTAL DURATION
              </span>
              <p className="text-xl font-black text-foreground heading-font font-mono">
                {summary.durationMinutes} min
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#0d1017] border border-gray-100 dark:border-white/5 space-y-1">
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                TOTAL REPS
              </span>
              <p className="text-xl font-black text-[#D7FF38] heading-font font-mono">
                {summary.totalReps}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#0d1017] border border-gray-100 dark:border-white/5 space-y-1">
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                COMPLETED SETS
              </span>
              <p className="text-xl font-black text-foreground heading-font font-mono">
                {summary.completedSets} / {summary.completedSets + summary.incompleteSets}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#0d1017] border border-gray-100 dark:border-white/5 space-y-1">
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                AVG FORM SCORE
              </span>
              <p className="text-xl font-black text-[#6C63FF] heading-font font-mono">
                {summary.averageFormScore}
              </p>
            </div>
          </div>

          {/* Smartwatch Biometric Recap (if heart rate data collected) */}
          {hrBleState.stats.totalSamples > 0 && (
            <div className="p-5 rounded-2xl bg-gray-50 dark:bg-[#0d1017] border border-gray-200 dark:border-white/10 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/5 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500">
                    <Heart className="h-4 w-4 fill-red-500" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
                      {language === "id" ? "BIOMETRIK KARDIO SESI" : "SESSION CARDIO BIOMETRICS"}
                    </h4>
                    <span className="text-[9px] text-gray-400 font-medium">
                      {hrBleState.deviceName || "Smartwatch"} · BLE
                    </span>
                  </div>
                </div>
                <span className="text-[9px] font-mono font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {hrBleState.stats.totalSamples} {language === "id" ? "Sampel Valid" : "Valid Samples"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-white dark:bg-[#141822] border border-gray-100 dark:border-white/5 space-y-0.5">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
                    AVG BPM
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-amber-500 dark:text-amber-400 font-mono">
                      {hrBleState.stats.avgBpm ?? "--"}
                    </span>
                    <span className="text-[9px] text-gray-400 font-bold">BPM</span>
                  </div>
                  <span className="text-[8px] text-gray-400 block truncate">Rata-Rata Sesi</span>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-[#141822] border border-gray-100 dark:border-white/5 space-y-0.5">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
                    PEAK BPM
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-[#FF6B00] dark:text-[#FF8533] font-mono">
                      {hrBleState.stats.maxBpm ?? "--"}
                    </span>
                    <span className="text-[9px] text-gray-400 font-bold">BPM</span>
                  </div>
                  <span className="text-[8px] text-gray-400 block truncate">Detak Puncak</span>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-[#141822] border border-gray-100 dark:border-white/5 space-y-0.5">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
                    MIN BPM
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-blue-500 dark:text-blue-400 font-mono">
                      {hrBleState.stats.minBpm ?? "--"}
                    </span>
                    <span className="text-[9px] text-gray-400 font-bold">BPM</span>
                  </div>
                  <span className="text-[8px] text-gray-400 block truncate">Detak Terendah</span>
                </div>
              </div>
            </div>
          )}

          {/* Breakdown per Exercise */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              EXERCISE PERFORMANCE
            </h4>
            <div className="space-y-2.5">
              {summary.exercises.length > 0 ? (
                summary.exercises.map((ex) => (
                  <div
                    key={ex.exercise}
                    className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#101322] border border-gray-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                  >
                    <div>
                      <h5 className="text-sm font-black text-foreground uppercase heading-font">
                        {ex.name}
                      </h5>
                      <p className="text-[10px] text-gray-500 uppercase font-bold mt-0.5">
                        {ex.completedSets} Sets Selesai • {ex.totalReps} Total Repetisi
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] font-bold text-gray-400 uppercase">
                        FORM SCORE
                      </span>
                      <p className="text-base font-black text-[#6C63FF] heading-font font-mono">
                        {ex.averageFormScore} / 100
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500 italic">
                  {language === "id" ? "Tidak ada set yang terselesaikan." : "No sets completed."}
                </p>
              )}
            </div>
          </div>

          {/* Overall AI Feedback Quote */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-[#FF6B00]/10 via-[#6C63FF]/5 to-transparent border border-[#FF6B00]/25 space-y-2 text-left relative overflow-hidden">
            <span className="text-[10px] font-black text-[#FF6B00] uppercase tracking-widest block">
              {language === "id" ? "EVALUASI AKHIR AI COACH" : "AI COACH WORKOUT EVALUATION"}
            </span>
            <p className="text-xs text-foreground font-medium leading-relaxed italic">
              "{summary.overallFeedback}"
            </p>
            <div className="flex items-center gap-2 pt-2 border-t border-[#6C63FF]/10 text-[10px] text-gray-400">
              <Shield className="h-3.5 w-3.5 text-[#6C63FF] shrink-0" />
              <span>
                {language === "id"
                  ? "Analisis berbasis estimasi pose 2D MediaPipe. Bukan merupakan diagnosis medis atau jaminan bebas cedera."
                  : "Analysis based on MediaPipe 2D pose estimation. Not a medical evaluation or guarantee of injury prevention."}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-gray-100 dark:border-white/5">
            <Button
              onClick={handleSaveWorkoutToFirebase}
              disabled={isSavingWorkout || isSavedSuccessfully}
              className="flex-1 h-12 bg-[#6C63FF] hover:bg-[#584feb] text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-md active:scale-95"
            >
              {isSavingWorkout ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : isSavedSuccessfully ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isSavedSuccessfully
                ? (language === "id" ? "Tersimpan di Cloud" : "Saved to Cloud")
                : (language === "id" ? "Simpan Hasil Workout" : "Save Workout")}
            </Button>

            <button
              onClick={handleBackToAICoach}
              className="flex-1 h-12 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 text-foreground text-xs font-black uppercase tracking-widest rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              {language === "id" ? "Kembali ke AI Coach" : "Back to AI Coach"}
            </button>
          </div>

          <div className="text-center pt-1">
            <button
              onClick={onBackToDashboard}
              className="text-xs font-bold text-muted-foreground hover:text-foreground underline uppercase tracking-wider transition-colors"
            >
              {language === "id" ? "Atau Kembali ke Beranda" : "Or Back to Home Dashboard"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

