"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Play,
  Pause,
  Square,
  CheckCircle2,
  Clock,
  ChevronRight,
  ChevronLeft,
  X,
  Loader2,
  Heart,
  Flame,
  Zap,
  ArrowLeft,
  RotateCcw,
  SkipForward,
  Award,
  AlertTriangle,
  Info,
  ExternalLink,
  Sliders,
  Check,
  Maximize2,
  Minimize2,
  BookOpen,
} from "lucide-react";
import { ProgramSession, ProgramExercise } from "@/types/workoutProgram";
import { Member } from "@/types";
import { useHeartRateBle } from "@/lib/bluetooth/useHeartRateBle";
import { useHeartRateStore } from "@/store/useHeartRateStore";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import {
  ExerciseType,
  EXERCISE_METADATA,
  ExerciseAnalyzerEngine,
  LiveAnalysisFrame,
  WorkoutSetResult,
  WorkoutExerciseSummary,
} from "@/lib/exerciseAnalyzer";
import { EQUIPMENT_TUTORIALS, EquipmentTutorial } from "@/data/equipmentTutorials";
import { formatLocalDate } from "@/lib/program/programCalendar";
import { toast } from "sonner";
import { useRouter } from "@/lib/navigation";

interface IntegratedWorkoutSessionModalProps {
  member: Member;
  sessionObj: any; // ProgramSession
  programId: string;
  programName: string;
  scheduledDate: string; // YYYY-MM-DD
  isDark: boolean;
  language?: "id" | "en";
  initialExerciseIndex?: number;
  initialMode?: "manual" | "camera";
  onClose: () => void;
  onFinishSession: (result: {
    sessionId: string;
    scheduledDate: string;
    actualDate: string;
    workoutSessionDocId?: string;
  }) => void;
  onOpenTutorial?: (tutorialId: string) => void;
}

export interface SetRecord {
  setNumber: number;
  targetReps: string;
  actualReps: number;
  weightKg?: number;
  durationSeconds: number;
  restSeconds: number;
  formScore?: number;
  isCompleted: boolean;
}

export interface CompletedExerciseRecord {
  exerciseId: string;
  name: string;
  sets: SetRecord[];
  isCompleted: boolean;
  isSkipped: boolean;
}

// MediaPipe skeleton connections
const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
  [24, 26], [26, 28],
];

export function IntegratedWorkoutSessionModal({
  member,
  sessionObj,
  programId,
  programName,
  scheduledDate,
  isDark,
  language = "id",
  initialExerciseIndex = 0,
  initialMode,
  onClose,
  onFinishSession,
  onOpenTutorial,
}: IntegratedWorkoutSessionModalProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // 3-second Initial Countdown overlay
  const [initialCountdown, setInitialCountdown] = useState<number | null>(3);

  // Exercise index
  const exercises: ProgramExercise[] = sessionObj.exercises || [];
  const safeInitialIdx = Math.min(Math.max(0, initialExerciseIndex), Math.max(0, exercises.length - 1));
  const [currentExerciseIdx, setCurrentExerciseIdx] = useState<number>(safeInitialIdx);
  const currentExercise = exercises[currentExerciseIdx];

  // Mode: "manual" or "camera"
  const defaultMode = initialMode || (currentExercise?.hasAiCoach ? "camera" : "manual");
  const [executionMode, setExecutionMode] = useState<"manual" | "camera">(defaultMode);

  // Set index (1-indexed)
  const [currentSetIdx, setCurrentSetIdx] = useState<number>(1);
  const totalSetsForCurrent = currentExercise?.targetSets || 3;

  // Active workout state
  const [sessionStartedAt, setSessionStartedAt] = useState<number>(Date.now());
  const [sessionDurationSec, setSessionDurationSec] = useState<number>(0);
  const [isSessionPaused, setIsSessionPaused] = useState<boolean>(false);
  const [pausedAccumulatedSec, setPausedAccumulatedSec] = useState<number>(0);
  const [pauseTimestamp, setPauseTimestamp] = useState<number | null>(null);

  // Set Timer (timestamp based)
  const [setStartTimestamp, setSetStartTimestamp] = useState<number>(Date.now());
  const [setDurationSec, setSetDurationSec] = useState<number>(0);

  // Rest Timer (timestamp based)
  const [isResting, setIsResting] = useState<boolean>(false);
  const [restTargetSec, setRestTargetSec] = useState<number>(currentExercise?.restSeconds || 60);
  const [restRemainingSec, setRestRemainingSec] = useState<number>(0);
  const restEndTimestampRef = useRef<number | null>(null);

  // Manual inputs
  const defaultTargetRepsNum = parseInt(currentExercise?.targetReps?.replace(/\D/g, "") || "12") || 12;
  const [inputReps, setInputReps] = useState<number>(defaultTargetRepsNum);
  const [inputWeight, setInputWeight] = useState<string>("");

  // Completed exercises state
  const [exerciseRecords, setExerciseRecords] = useState<CompletedExerciseRecord[]>(() => {
    return exercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      name: ex.name,
      sets: [],
      isCompleted: false,
      isSkipped: false,
    }));
  });

  // Summary state
  const [isSessionEnded, setIsSessionEnded] = useState<boolean>(false);
  const [sessionNotes, setSessionNotes] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Confirmation modal when ending early
  const [showConfirmEndModal, setShowConfirmEndModal] = useState<boolean>(false);

  // In-session Tutorial Modal
  const [activeTutorialDetail, setActiveTutorialDetail] = useState<EquipmentTutorial | null>(null);

  // Wearable Smartwatch Heart Rate integration
  const { state: hrBleState } = useHeartRateBle();
  const hrStats = hrBleState.stats;
  const currentBpm = hrBleState.currentBpm;
  const isHeartRateAvailable = Boolean(currentBpm && currentBpm > 0 && hrBleState.status === "connected");

  // Live Camera states
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const analyzerEngineRef = useRef<ExerciseAnalyzerEngine | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isModelLoading, setIsModelLoading] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [liveCameraFrame, setLiveCameraFrame] = useState<LiveAnalysisFrame | null>(null);

  // Restore session from localStorage if interrupted
  useEffect(() => {
    const backupKey = `synfit_active_session_${member.id}_${sessionObj.sessionId}`;
    try {
      const cached = localStorage.getItem(backupKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.sessionStartedAt && Date.now() - parsed.sessionStartedAt < 8 * 3600 * 1000) {
          setSessionStartedAt(parsed.sessionStartedAt);
          setCurrentExerciseIdx(parsed.currentExerciseIdx || 0);
          setCurrentSetIdx(parsed.currentSetIdx || 1);
          setExerciseRecords(parsed.exerciseRecords || []);
          toast.info(language === "id" ? "Sesi latihan sebelumnya dipulihkan." : "Restored in-progress workout session.");
        }
      }
    } catch {}
  }, [member.id, sessionObj.sessionId, language]);

  // Save session backup to localStorage on every change
  useEffect(() => {
    if (isSessionEnded) {
      localStorage.removeItem(`synfit_active_session_${member.id}_${sessionObj.sessionId}`);
      return;
    }
    const backupKey = `synfit_active_session_${member.id}_${sessionObj.sessionId}`;
    try {
      localStorage.setItem(
        backupKey,
        JSON.stringify({
          sessionStartedAt,
          currentExerciseIdx,
          currentSetIdx,
          exerciseRecords,
        })
      );
    } catch {}
  }, [member.id, sessionObj.sessionId, sessionStartedAt, currentExerciseIdx, currentSetIdx, exerciseRecords, isSessionEnded]);

  // Session duration timer (timestamp-based)
  useEffect(() => {
    if (isSessionEnded) return;
    const interval = setInterval(() => {
      if (isSessionPaused) return;
      const now = Date.now();
      const totalElapsed = Math.floor((now - sessionStartedAt) / 1000) - pausedAccumulatedSec;
      setSessionDurationSec(Math.max(0, totalElapsed));

      // Update current set duration
      if (!isResting) {
        const setElapsed = Math.floor((now - setStartTimestamp) / 1000);
        setSetDurationSec(Math.max(0, setElapsed));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isSessionEnded, isSessionPaused, sessionStartedAt, pausedAccumulatedSec, isResting, setStartTimestamp]);

  // Rest timer countdown (timestamp-based)
  useEffect(() => {
    if (!isResting || !restEndTimestampRef.current) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const diffSec = Math.ceil((restEndTimestampRef.current! - now) / 1000);
      if (diffSec <= 0) {
        setRestRemainingSec(0);
        setIsResting(false);
        restEndTimestampRef.current = null;
        toast.success(language === "id" ? "Waktu istirahat selesai! Siap untuk set berikutnya." : "Rest over! Ready for next set.");
      } else {
        setRestRemainingSec(diffSec);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [isResting, language]);

  // Fullscreen trigger and event listener
  useEffect(() => {
    // Request fullscreen on start if supported
    const enterFullscreen = async () => {
      try {
        const elem = containerRef.current || document.documentElement;
        if (elem && !document.fullscreenElement && elem.requestFullscreen) {
          await elem.requestFullscreen();
          setIsFullscreen(true);
        }
      } catch (err) {
        // Fullscreen may be blocked or unpermitted on some mobile browsers; gracefully proceed
        console.warn("Fullscreen request notice:", err);
      }
    };

    enterFullscreen();

    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const elem = containerRef.current || document.documentElement;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
          setIsFullscreen(true);
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          setIsFullscreen(false);
        }
      }
    } catch (e) {
      console.warn("Toggle fullscreen notice:", e);
    }
  };

  // 3-second Initial Countdown Timer
  useEffect(() => {
    if (initialCountdown === null) return;
    if (initialCountdown <= 0) {
      setInitialCountdown(null);
      setSessionStartedAt(Date.now());
      setSetStartTimestamp(Date.now());
      setPausedAccumulatedSec(0);
      setPauseTimestamp(null);
      return;
    }

    const timer = setTimeout(() => {
      setInitialCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [initialCountdown]);

  // Automatic Pause when leaving the workout session tab or window minimizes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !isSessionPaused && !isSessionEnded && initialCountdown === null) {
        setIsSessionPaused(true);
        setPauseTimestamp(Date.now());
        toast.info(language === "id" ? "Sesi otomatis dijeda karena Anda berpindah layar." : "Session auto-paused as you switched screens.");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handleVisibilityChange);
    };
  }, [isSessionPaused, isSessionEnded, initialCountdown, language]);

  // Handle Pause / Resume
  const togglePause = () => {
    if (!isSessionPaused) {
      setIsSessionPaused(true);
      setPauseTimestamp(Date.now());
      toast.info(language === "id" ? "Sesi dijeda" : "Session paused");
    } else {
      if (pauseTimestamp) {
        const pausedDurationSec = Math.floor((Date.now() - pauseTimestamp) / 1000);
        setPausedAccumulatedSec((prev) => prev + pausedDurationSec);
      }
      setIsSessionPaused(false);
      setPauseTimestamp(null);
      toast.info(language === "id" ? "Sesi dilanjutkan" : "Session resumed");
    }
  };

  // Reset Session & Set Timers
  const handleResetTimer = () => {
    const now = Date.now();
    setSessionStartedAt(now);
    setSessionDurationSec(0);
    setSetStartTimestamp(now);
    setSetDurationSec(0);
    setPausedAccumulatedSec(0);
    setPauseTimestamp(null);
    if (isResting) {
      skipRest();
    }
    toast.info(language === "id" ? "Waktu sesi dan set telah di-reset ke 00:00" : "Timer has been reset to 00:00");
  };

  // Start Rest Countdown
  const startRestTimer = (seconds: number) => {
    setIsResting(true);
    setRestTargetSec(seconds);
    setRestRemainingSec(seconds);
    restEndTimestampRef.current = Date.now() + seconds * 1000;
  };

  // Skip or cancel rest
  const skipRest = () => {
    setIsResting(false);
    setRestRemainingSec(0);
    restEndTimestampRef.current = null;
  };

  // Switch Active Exercise from exercise list/pills
  const switchExercise = (newIdx: number, targetMode?: "manual" | "camera") => {
    if (newIdx < 0 || newIdx >= exercises.length || newIdx === currentExerciseIdx) return;
    stopCamera();
    setCurrentExerciseIdx(newIdx);
    const targetEx = exercises[newIdx];
    setCurrentSetIdx(1);
    const parsed = parseInt(targetEx?.targetReps?.replace(/\D/g, "") || "12") || 12;
    setInputReps(parsed);
    setSetStartTimestamp(Date.now());
    setSetDurationSec(0);
    skipRest();

    const modeToUse = targetMode || (targetEx?.hasAiCoach ? "camera" : "manual");
    setExecutionMode(modeToUse);
  };

  // -------------------------------------------------------------
  // LIVE CAMERA SETUP & TEARDOWN
  // -------------------------------------------------------------
  const startCamera = async () => {
    if (!currentExercise?.hasAiCoach || !currentExercise?.aiCoachType) {
      toast.error(
        language === "id"
          ? "Gerakan ini tidak mendukung deteksi kamera AI. Menggunakan mode manual."
          : "This exercise does not support AI camera tracking. Using manual mode."
      );
      setExecutionMode("manual");
      return;
    }

    try {
      setIsModelLoading(true);
      setCameraError(null);

      // Initialize MediaPipe PoseLandmarker with fallback
      if (!poseLandmarkerRef.current) {
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
          console.warn("Falling back to CPU for MediaPipe Pose Landmarker:", gpuErr);
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
        poseLandmarkerRef.current = landmarker;
      }

      // Initialize Analyzer
      analyzerEngineRef.current = new ExerciseAnalyzerEngine(
        currentExercise.aiCoachType as ExerciseType,
        defaultTargetRepsNum
      );

      // Start user media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsCameraActive(true);
      setExecutionMode("camera");
      runPoseDetectionLoop();
    } catch (err: any) {
      console.error("Camera start error:", err);
      setCameraError(err.message || "Gagal mengakses kamera.");
      toast.error(
        language === "id"
          ? "Kamera tidak dapat diakses. Anda dapat melanjutkan dengan Mode Manual."
          : "Camera unavailable. You can continue with Manual mode."
      );
      setExecutionMode("manual");
    } finally {
      setIsModelLoading(false);
    }
  };

  const stopCamera = () => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setLiveCameraFrame(null);
  };

  const runPoseDetectionLoop = () => {
    if (!videoRef.current || !canvasRef.current || !poseLandmarkerRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    let lastVideoTime = -1;

    const detect = () => {
      if (video.readyState >= 2 && poseLandmarkerRef.current) {
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

          if (video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;

            try {
              const results = poseLandmarkerRef.current.detectForVideo(video, now);
              if (results.landmarks && results.landmarks.length > 0) {
                const landmarks = results.landmarks[0];

                // 1. Draw skeleton lines
                ctx.lineWidth = 3.5;
                ctx.lineCap = "round";
                ctx.strokeStyle = "rgba(255, 90, 44, 0.85)";
                POSE_CONNECTIONS.forEach(([i, j]) => {
                  const p1 = landmarks[i];
                  const p2 = landmarks[j];
                  if (p1 && p2 && (p1.visibility ?? 1) > 0.35 && (p2.visibility ?? 1) > 0.35) {
                    ctx.beginPath();
                    ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
                    ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
                    ctx.stroke();
                  }
                });

                // 2. Draw landmark dots
                landmarks.forEach((p, idx) => {
                  if (idx >= 11 && idx <= 28 && (p.visibility ?? 1) > 0.35) {
                    const x = p.x * canvas.width;
                    const y = p.y * canvas.height;

                    ctx.beginPath();
                    ctx.arc(x, y, 6, 0, 2 * Math.PI);
                    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
                    ctx.fill();

                    ctx.beginPath();
                    ctx.arc(x, y, 3.5, 0, 2 * Math.PI);
                    ctx.fillStyle = "#FF5A2C";
                    ctx.fill();
                  }
                });

                // 3. Process frame in Engine
                if (analyzerEngineRef.current && !isSessionPaused) {
                  const frame = analyzerEngineRef.current.processFrame(landmarks as any, now, true);
                  setLiveCameraFrame(frame);
                  if (frame.completedReps > 0) {
                    setInputReps(frame.completedReps);
                  }
                }
              }
            } catch (detErr) {
              console.error("Frame detection error:", detErr);
            }
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(detect);
    };

    animFrameIdRef.current = requestAnimationFrame(detect);
  };

  // Stop camera when unmounting
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Update input reps when exercise changes
  useEffect(() => {
    if (currentExercise) {
      const parsed = parseInt(currentExercise.targetReps?.replace(/\D/g, "") || "12") || 12;
      setInputReps(parsed);
      setSetStartTimestamp(Date.now());
      setSetDurationSec(0);
      skipRest();
    }
  }, [currentExerciseIdx]);

  // Complete a Set (Manual or Camera)
  const handleCompleteSet = () => {
    const finalReps = inputReps;
    const finalWeight = inputWeight ? parseFloat(inputWeight) : undefined;
    const finalSetDuration = Math.max(1, setDurationSec);
    const formScore = liveCameraFrame?.currentFormScore || 90;

    const newRecord: SetRecord = {
      setNumber: currentSetIdx,
      targetReps: currentExercise?.targetReps || "12",
      actualReps: finalReps,
      weightKg: finalWeight,
      durationSeconds: finalSetDuration,
      restSeconds: currentExercise?.restSeconds || 60,
      formScore: executionMode === "camera" ? formScore : undefined,
      isCompleted: true,
    };

    setExerciseRecords((prev) => {
      const copy = [...prev];
      const exRec = copy[currentExerciseIdx];
      if (exRec) {
        exRec.sets.push(newRecord);
        if (currentSetIdx >= totalSetsForCurrent) {
          exRec.isCompleted = true;
        }
      }
      return copy;
    });

    toast.success(
      language === "id"
        ? `Set ${currentSetIdx} dari ${totalSetsForCurrent} selesai (${finalReps} reps)!`
        : `Set ${currentSetIdx} of ${totalSetsForCurrent} completed (${finalReps} reps)!`
    );

    // Reset set timer
    setSetStartTimestamp(Date.now());
    setSetDurationSec(0);

    // Check if next set or next exercise
    if (currentSetIdx < totalSetsForCurrent) {
      setCurrentSetIdx((prev) => prev + 1);
      // Trigger rest timer
      startRestTimer(currentExercise?.restSeconds || 60);
    } else {
      // Completed all sets for this exercise
      if (currentExerciseIdx < exercises.length - 1) {
        toast.info(language === "id" ? "Lanjut ke gerakan berikutnya!" : "Moving to next exercise!");
        setCurrentExerciseIdx((prev) => prev + 1);
        setCurrentSetIdx(1);
        startRestTimer(currentExercise?.restSeconds || 60);
      } else {
        // Last exercise completed!
        stopCamera();
        setIsSessionEnded(true);
      }
    }
  };

  // Skip Current Exercise
  const handleSkipExercise = () => {
    setExerciseRecords((prev) => {
      const copy = [...prev];
      if (copy[currentExerciseIdx]) {
        copy[currentExerciseIdx].isSkipped = true;
      }
      return copy;
    });

    toast.info(language === "id" ? `Gerakan ${currentExercise?.name} dilewati.` : `Skipped ${currentExercise?.name}.`);
    stopCamera();

    if (currentExerciseIdx < exercises.length - 1) {
      setCurrentExerciseIdx((prev) => prev + 1);
      setCurrentSetIdx(1);
      setSetStartTimestamp(Date.now());
      setSetDurationSec(0);
      skipRest();
    } else {
      setIsSessionEnded(true);
    }
  };

  // Calculate Metrics for Post-Workout Summary
  const compileSessionSummary = () => {
    const totalExercises = exercises.length;
    let completedExercisesCount = 0;
    let totalTargetSets = 0;
    let totalCompletedSets = 0;
    let totalActualReps = 0;
    let totalVolumeKg = 0;
    let hasVolumeData = false;

    exercises.forEach((ex, idx) => {
      totalTargetSets += ex.targetSets;
      const rec = exerciseRecords[idx];
      if (rec && rec.isCompleted) {
        completedExercisesCount++;
      }
      if (rec && rec.sets) {
        rec.sets.forEach((s) => {
          if (s.isCompleted) {
            totalCompletedSets++;
            totalActualReps += s.actualReps;
            if (s.weightKg && s.weightKg > 0) {
              totalVolumeKg += s.weightKg * s.actualReps;
              hasVolumeData = true;
            }
          }
        });
      }
    });

    const isFullCompleted = completedExercisesCount === totalExercises && totalCompletedSets >= totalTargetSets;
    const durationMinutes = Math.max(1, Math.round(sessionDurationSec / 60));

    // Calories calculation
    let caloriesBurned = Math.round(durationMinutes * 5);
    if (currentBpm && currentBpm > 0) {
      const bpmFactor = currentBpm > 130 ? 8.5 : currentBpm > 100 ? 6.5 : 4.5;
      caloriesBurned = Math.round(durationMinutes * bpmFactor);
    }

    return {
      totalExercises,
      completedExercisesCount,
      totalTargetSets,
      totalCompletedSets,
      totalActualReps,
      totalVolumeKg,
      hasVolumeData,
      isFullCompleted,
      durationMinutes,
      caloriesBurned,
      avgHeartRate: hrStats.avgBpm || (isHeartRateAvailable ? currentBpm : null),
      maxHeartRate: hrStats.maxBpm || null,
      deviceName: hrBleState.deviceName || (isHeartRateAvailable ? "Smartwatch" : null),
    };
  };

  // Final Save to Firestore & Tracker
  const handleSaveAndExit = async () => {
    setIsSaving(true);
    try {
      const summary = compileSessionSummary();
      const actualDateStr = formatLocalDate(new Date());

      const payload = {
        member_id: member.id,
        member_name: member.nama,
        program_id: programId,
        program_name: programName,
        session_id: sessionObj.sessionId,
        session_name: sessionObj.dayName,
        scheduled_date: scheduledDate,
        actual_date: actualDateStr,
        started_at: new Date(sessionStartedAt).toISOString(),
        completed_at: new Date().toISOString(),
        duration_minutes: summary.durationMinutes,
        total_reps: summary.totalActualReps,
        total_completed_sets: summary.totalCompletedSets,
        total_target_sets: summary.totalTargetSets,
        exercise_count: summary.completedExercisesCount,
        is_full_completed: summary.isFullCompleted,
        total_volume_kg: summary.hasVolumeData ? summary.totalVolumeKg : null,
        calories_burned: summary.caloriesBurned,
        avg_heart_rate: summary.avgHeartRate,
        max_heart_rate: summary.maxHeartRate,
        device_name: summary.deviceName,
        notes: sessionNotes.trim() || null,
        exercises: exerciseRecords.map((r) => ({
          exercise_id: r.exerciseId,
          name: r.name,
          is_completed: r.isCompleted,
          is_skipped: r.isSkipped,
          sets: r.sets,
        })),
      };

      // 1. Direct Firestore write to workout_sessions
      let savedDocId: string | undefined = undefined;
      try {
        const docRef = await addDoc(collection(db, "workout_sessions"), {
          ...payload,
          created_at: serverTimestamp(),
        });
        savedDocId = docRef.id;
      } catch (fErr) {
        console.warn("Direct firestore save warning:", fErr);
      }

      // 2. Offline / Local cache backup
      try {
        const key = `synfit_workout_sessions_${member.id}`;
        const existing = JSON.parse(localStorage.getItem(key) || "[]");
        existing.unshift({ ...payload, id: savedDocId || `local-${Date.now()}` });
        localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
      } catch {}

      // Clear in-progress session cache
      localStorage.removeItem(`synfit_active_session_${member.id}_${sessionObj.sessionId}`);

      setSavedSuccess(true);
      toast.success(
        language === "id"
          ? "Sesi latihan berhasil disimpan ke Program & Tracker!"
          : "Workout session saved to Program & Tracker!"
      );

      // Notify parent to update program progress
      onFinishSession({
        sessionId: sessionObj.sessionId,
        scheduledDate,
        actualDate: actualDateStr,
        workoutSessionDocId: savedDocId,
      });
    } catch (err: any) {
      console.error("Save session error:", err);
      toast.error(err.message || "Gagal menyimpan sesi.");
    } finally {
      setIsSaving(false);
    }
  };

  // Format timer helper mm:ss
  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // RENDER POST-WORKOUT SUMMARY VIEW
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (isSessionEnded) {
    const summary = compileSessionSummary();
    return (
      <div className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`w-full max-w-xl rounded-3xl border p-5 sm:p-6 space-y-5 shadow-2xl relative my-auto ${
            isDark ? "bg-[#10141F] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
          }`}
        >
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-2">
              <Award className="h-6 w-6" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight">
              {summary.isFullCompleted ? "Sesi Latihan Tuntas!" : "Sesi Latihan Selesai"}
            </h2>
            <p className="text-xs text-gray-400">
              {sessionObj.dayName} Â· {programName}
            </p>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className={`p-3 rounded-2xl border text-center ${isDark ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-100"}`}>
              <Clock className="h-4 w-4 text-blue-400 mx-auto mb-1" />
              <p className="text-[10px] text-gray-400 uppercase font-bold">Durasi</p>
              <p className="text-base font-black">{summary.durationMinutes} mnt</p>
            </div>
            <div className={`p-3 rounded-2xl border text-center ${isDark ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-100"}`}>
              <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
              <p className="text-[10px] text-gray-400 uppercase font-bold">Set Selesai</p>
              <p className="text-base font-black">{summary.totalCompletedSets} / {summary.totalTargetSets}</p>
            </div>
            <div className={`p-3 rounded-2xl border text-center ${isDark ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-100"}`}>
              <Zap className="h-4 w-4 text-amber-400 mx-auto mb-1" />
              <p className="text-[10px] text-gray-400 uppercase font-bold">Total Reps</p>
              <p className="text-base font-black">{summary.totalActualReps}</p>
            </div>
            <div className={`p-3 rounded-2xl border text-center ${isDark ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-100"}`}>
              <Flame className="h-4 w-4 text-orange-400 mx-auto mb-1" />
              <p className="text-[10px] text-gray-400 uppercase font-bold">Kalori</p>
              <p className="text-base font-black">~{summary.caloriesBurned} kkal</p>
            </div>
          </div>

          {/* Biometrics & Volume Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {summary.hasVolumeData && (
              <div className={`p-3 rounded-2xl border flex items-center justify-between ${isDark ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-100"}`}>
                <span className="text-gray-400 font-bold">Volume Beban:</span>
                <span className="font-black text-blue-400">{summary.totalVolumeKg.toLocaleString("id-ID")} kg</span>
              </div>
            )}
            {summary.avgHeartRate && (
              <div className={`p-3 rounded-2xl border flex items-center justify-between ${isDark ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-100"}`}>
                <span className="text-gray-400 font-bold flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />
                  <span>Rata-rata BPM:</span>
                </span>
                <span className="font-black text-rose-400">{summary.avgHeartRate} BPM</span>
              </div>
            )}
          </div>

          {/* Exercise Breakdown List */}
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Rincian Gerakan:</p>
            {exerciseRecords.map((rec, i) => (
              <div
                key={rec.exerciseId + i}
                className={`p-2 rounded-xl text-xs flex items-center justify-between border ${
                  isDark ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-100"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {rec.isCompleted ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : rec.isSkipped ? (
                    <SkipForward className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  )}
                  <span className="font-bold truncate">{rec.name}</span>
                </div>
                <span className="text-[10px] text-gray-400 shrink-0 font-mono">
                  {rec.sets.length} set dicatat
                </span>
              </div>
            ))}
          </div>

          {/* Optional Member Notes */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-gray-400">Catatan Latihan (Opsional):</label>
            <input
              type="text"
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="Contoh: Beban dumbbell terasa nyaman, squat form mantap"
              className={`w-full p-2.5 rounded-xl text-xs border outline-none ${
                isDark ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-300 text-gray-900"
              }`}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSaveAndExit}
              disabled={isSaving}
              className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Menyimpan ke Tracker...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Simpan & Selesai</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // RENDER WORKOUT SESSION (ACTIVE)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[140] bg-black/95 backdrop-blur-md flex flex-col justify-between overflow-hidden select-none"
    >
      {/* 3-Second Fullscreen Countdown Overlay */}
      <AnimatePresence>
        {initialCountdown !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
          >
            <motion.div
              key={initialCountdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.4, opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="space-y-4"
            >
              <span className="text-xs uppercase font-black tracking-[0.25em] text-[#FF5A2C] block">
                Bersiap Memulai Sesi
              </span>
              <div className="w-32 h-32 rounded-full border-4 border-blue-500/30 flex items-center justify-center mx-auto bg-blue-500/10 shadow-2xl shadow-blue-500/20">
                <span className="text-7xl font-black font-mono text-white">
                  {initialCountdown > 0 ? initialCountdown : "GO!"}
                </span>
              </div>
              <p className="text-sm font-bold text-gray-300 max-w-xs">
                {currentExercise?.name} Â· {totalSetsForCurrent} Set
              </p>
              <button
                onClick={() => setInitialCountdown(0)}
                className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 text-xs font-semibold"
              >
                Lewati Hitungan Mundur
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Navigation & Status Bar */}
      <div className="w-full max-w-4xl mx-auto p-3 sm:p-4 flex items-center justify-between shrink-0 gap-2 border-b border-white/5 bg-black/40">
        <button
          onClick={() => {
            // Auto pause session on exit trigger
            if (!isSessionPaused) {
              setIsSessionPaused(true);
              setPauseTimestamp(Date.now());
            }
            const hasProgress = exerciseRecords.some((r) => r.sets.length > 0);
            if (hasProgress) {
              setShowConfirmEndModal(true);
            } else {
              stopCamera();
              onClose();
            }
          }}
          className="px-3 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15 transition-all flex items-center gap-1.5 text-xs font-bold shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Keluar</span>
        </button>

        {/* Global Timers, Heart Rate Telemetry & Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Heart Rate Pill (Realtime Wearable or Manual Fallback Indicator) */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all ${
              isHeartRateAvailable
                ? "bg-rose-500/15 border-rose-500/30 text-rose-400 animate-pulse shadow-sm shadow-rose-950/20"
                : "bg-white/5 border-white/10 text-gray-400"
            }`}
            title={isHeartRateAvailable ? "Smartwatch BLE Terhubung" : "Smartwatch belum terhubung"}
          >
            <Heart className={`h-3.5 w-3.5 ${isHeartRateAvailable ? "fill-rose-500 text-rose-500" : "text-gray-400"}`} />
            <span>{isHeartRateAvailable ? `${currentBpm} BPM` : "-- BPM"}</span>
          </div>

          {/* Session Duration Timer Display */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-mono font-black border border-white/10">
            <Clock className="h-3.5 w-3.5 text-blue-400" />
            <span>{formatTime(sessionDurationSec)}</span>
          </div>

          {/* Prominent Reset Timer Button */}
          <button
            onClick={handleResetTimer}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all flex items-center gap-1 text-xs font-bold border border-white/5"
            title="Reset Timer ke 00:00"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden md:inline text-[11px]">Reset</span>
          </button>

          {/* Prominent Easy-to-Reach Pause / Resume Button */}
          <button
            onClick={togglePause}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 ${
              isSessionPaused
                ? "bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400/50 shadow-emerald-950/30"
                : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40"
            }`}
            title={isSessionPaused ? "Lanjutkan Latihan" : "Jeda Sesi Latihan"}
          >
            {isSessionPaused ? (
              <>
                <Play className="h-3.5 w-3.5 fill-current text-white" />
                <span>Lanjut</span>
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5 fill-current" />
                <span>Jeda</span>
              </>
            )}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all hidden sm:flex items-center justify-center border border-white/5"
            title={isFullscreen ? "Keluar Full Screen" : "Mode Full Screen"}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Execution Arena */}
      <div className="flex-1 w-full max-w-4xl mx-auto p-3 sm:p-4 flex flex-col justify-between overflow-y-auto">
        {/* Exercise Header & Progress */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-400">
              Gerakan {currentExerciseIdx + 1} dari {exercises.length}
            </span>

            {/* Mode Switcher */}
            {currentExercise?.hasAiCoach ? (
              <div className="flex p-0.5 rounded-xl bg-white/10 border border-white/10 text-[10px] font-bold self-start sm:self-auto">
                <button
                  onClick={() => {
                    stopCamera();
                    setExecutionMode("manual");
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    executionMode === "manual" ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Mode Input Manual
                </button>
                <button
                  onClick={() => {
                    if (!isCameraActive) startCamera();
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    executionMode === "camera" ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>Mode Live Camera</span>
                </button>
              </div>
            ) : (
              <span className="text-[10px] font-bold text-gray-400 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5">
                Mode Input Manual
              </span>
            )}
          </div>

          {/* Exercise Selector Strip (Easily switch between all exercises in current session) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
            {exercises.map((ex, idx) => {
              const rec = exerciseRecords[idx];
              const isCurrent = idx === currentExerciseIdx;
              const isCompleted = rec?.isCompleted;
              const isSkipped = rec?.isSkipped;

              return (
                <button
                  key={ex.exerciseId + idx}
                  onClick={() => switchExercise(idx)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                    isCurrent
                      ? "bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-900/30 ring-1 ring-blue-400"
                      : isCompleted
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25"
                      : isSkipped
                      ? "bg-gray-500/15 text-gray-400 border-gray-500/20"
                      : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                  }`}
                >
                  <span className="opacity-75">{idx + 1}.</span>
                  <span className="truncate max-w-[140px] sm:max-w-none">{ex.name}</span>
                  {isCompleted ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : ex.hasAiCoach ? (
                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      AI
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white">{currentExercise?.name}</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Target: <strong className="text-white">{currentExercise?.primaryMuscle}</strong> Â· Alat: {currentExercise?.equipmentName}
              </p>
            </div>

            {/* In-Session Tutorial Button & Direct Tutorial Navigation */}
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <button
                onClick={() => {
                  const tut = EQUIPMENT_TUTORIALS.find((t) => t.id === currentExercise?.equipmentId);
                  if (tut) {
                    setActiveTutorialDetail(tut);
                  } else if (onOpenTutorial) {
                    onOpenTutorial(currentExercise?.equipmentId || "");
                  } else {
                    toast.info("Panduan alat siap digunakan.");
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/10 flex items-center gap-1.5 shrink-0"
                title="Buka panduan cepat instruksi gerakan ini"
              >
                <Info className="h-3.5 w-3.5 text-blue-400" />
                <span>Instruksi Gerakan</span>
              </button>

              <button
                onClick={() => {
                  // Pause workout when navigating to tutorials page
                  if (!isSessionPaused) {
                    setIsSessionPaused(true);
                    setPauseTimestamp(Date.now());
                  }
                  router.push(`/tutorials?id=${currentExercise?.equipmentId || "dumbbell"}`);
                }}
                className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-bold border border-blue-500/30 flex items-center gap-1.5 shrink-0"
                title="Buka halaman katalog tutorial alat lengkap"
              >
                <BookOpen className="h-3.5 w-3.5 text-blue-400" />
                <span>Buka Tutorial Alat</span>
              </button>
            </div>
          </div>
        </div>

        {/* Center Display: Live Camera or Manual Cards */}
        <div className="my-auto py-4">
          {executionMode === "camera" && (isCameraActive || isModelLoading || cameraError) ? (
            <div className="relative w-full aspect-video sm:aspect-[4/3] max-w-lg mx-auto rounded-3xl overflow-hidden border border-blue-500/30 bg-black shadow-2xl flex items-center justify-center">
              {isModelLoading && (
                <div className="absolute inset-0 z-20 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-wider">Menyiapkan AI Vision...</p>
                    <p className="text-xs text-gray-400 mt-1">Mengaktifkan sensor kamera & deteksi pose AI MediaPipe</p>
                  </div>
                </div>
              )}

              {cameraError && (
                <div className="absolute inset-0 z-20 bg-black/90 p-6 flex flex-col items-center justify-center text-center space-y-4">
                  <AlertTriangle className="h-10 w-10 text-amber-400" />
                  <div>
                    <p className="text-sm font-black text-white">Gagal Mengakses Kamera</p>
                    <p className="text-xs text-gray-400 mt-1 max-w-xs">{cameraError}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startCamera()}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
                    >
                      Coba Lagi
                    </button>
                    <button
                      onClick={() => setExecutionMode("manual")}
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 font-bold text-xs"
                    >
                      Gunakan Input Manual
                    </button>
                  </div>
                </div>
              )}

              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none transform -scale-x-100"
              />

              {/* Live Overlay HUD */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
                <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-emerald-400 font-mono text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>AI Tracking Active</span>
                </span>
                <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white font-mono text-xs font-bold border border-white/10">
                  Form: {liveCameraFrame?.currentFormScore || 90}%
                </span>
              </div>

              {/* Rep Counter Center Bottom */}
              <div className="absolute bottom-4 inset-x-0 flex flex-col items-center justify-center pointer-events-none z-10">
                <div className="px-5 py-2 rounded-2xl bg-black/75 backdrop-blur-md border border-white/15 text-center">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Repetisi Terdeteksi</span>
                  <span className="text-3xl font-black text-white">{liveCameraFrame?.completedReps || inputReps}</span>
                </div>
              </div>
            </div>
          ) : (
            /* Manual Card Interface */
            <div className="max-w-md mx-auto w-full p-6 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md space-y-5 text-center shadow-xl">
              <div>
                <span className="text-xs uppercase font-extrabold text-gray-400 tracking-wider">
                  Set {currentSetIdx} dari {totalSetsForCurrent}
                </span>
                <p className="text-3xl font-black text-white mt-1">
                  Target: {currentExercise?.targetReps}
                </p>
                <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs text-gray-300 font-mono px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-blue-400" />
                    <span>Durasi Set: {formatTime(setDurationSec)}</span>
                  </span>

                  {/* Realtime Heart Rate in Manual Card */}
                  <span
                    className={`text-xs font-mono font-bold px-2.5 py-1 rounded-xl border flex items-center gap-1.5 transition-all ${
                      isHeartRateAvailable
                        ? "bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse"
                        : "bg-white/5 border-white/10 text-gray-400"
                    }`}
                  >
                    <Heart className={`h-3.5 w-3.5 ${isHeartRateAvailable ? "fill-rose-500 text-rose-500" : "text-gray-400"}`} />
                    <span>{isHeartRateAvailable ? `${currentBpm} BPM Realtime` : "Detak Jantung: --"}</span>
                  </span>
                </div>
              </div>

              {/* Inputs */}
              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Reps Aktual</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={inputReps}
                    onChange={(e) => setInputReps(parseInt(e.target.value) || 0)}
                    className="w-full p-3 rounded-2xl bg-black/40 border border-white/10 text-white font-black text-lg text-center outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Beban (Kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    placeholder="Opsional"
                    value={inputWeight}
                    onChange={(e) => setInputWeight(e.target.value)}
                    className="w-full p-3 rounded-2xl bg-black/40 border border-white/10 text-white font-black text-lg text-center outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Rest Timer Banner (Floating when active) */}
          {isResting && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 max-w-md mx-auto p-3.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-200 flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <Clock className="h-5 w-5 text-amber-400 animate-spin" />
                <div>
                  <p className="text-xs font-bold">Waktu Istirahat Antar Set</p>
                  <p className="text-lg font-mono font-black">{formatTime(restRemainingSec)}</p>
                </div>
              </div>
              <button
                onClick={skipRest}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/40"
              >
                Lewati Istirahat
              </button>
            </motion.div>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="space-y-2 pt-2 shrink-0">
          <div className="flex gap-2">
            <button
              onClick={handleSkipExercise}
              className="px-4 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-gray-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
            >
              <SkipForward className="h-4 w-4" />
              <span>Lewati</span>
            </button>

            <button
              onClick={handleCompleteSet}
              className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 active:scale-98 transition-all"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>
                Selesai Set {currentSetIdx} ({inputReps} Reps)
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal Before Ending Early */}
      <AnimatePresence>
        {showConfirmEndModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[160] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#121622] text-white p-6 space-y-4 shadow-2xl text-center"
            >
              <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto" />
              <div>
                <h3 className="text-base font-black uppercase">Akhiri Sesi Latihan?</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Masih ada gerakan yang belum selesai. Anda dapat menyimpan progres yang sudah dilakukan atau membatalkan.
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowConfirmEndModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-gray-300 hover:bg-white/10"
                >
                  Lanjut Latihan
                </button>
                <button
                  onClick={() => {
                    setShowConfirmEndModal(false);
                    stopCamera();
                    setIsSessionEnded(true);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-xs font-black text-white shadow-md shadow-orange-900/30"
                >
                  Akhiri & Simpan
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* In-Session Tutorial Popup */}
      <AnimatePresence>
        {activeTutorialDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[170] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#121622] text-white p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <h3 className="text-base font-black">{activeTutorialDetail.name}</h3>
                <button
                  onClick={() => setActiveTutorialDetail(null)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 text-xs leading-relaxed text-gray-300">
                <div>
                  <h4 className="font-extrabold text-blue-400 uppercase text-[10px] tracking-wider">Persiapan:</h4>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    {activeTutorialDetail.preparation.map((p, idx) => (
                      <li key={idx}>{p}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-extrabold text-emerald-400 uppercase text-[10px] tracking-wider">Langkah Pelaksanaan:</h4>
                  <ul className="list-decimal list-inside mt-1 space-y-1">
                    {activeTutorialDetail.steps.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-extrabold text-amber-400 uppercase text-[10px] tracking-wider">Kesalahan Umum:</h4>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    {activeTutorialDetail.commonMistakes.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <button
                onClick={() => setActiveTutorialDetail(null)}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs"
              >
                Kembali ke Sesi Latihan
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
