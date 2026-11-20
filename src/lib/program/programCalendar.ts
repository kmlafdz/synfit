/**
 * Program Calendar & Schedule Utilities
 * Handles timezone-safe local date calculations for workout programs.
 */

import { WorkoutProgram, ProgramSession } from "@/types/workoutProgram";

/**
 * Returns a date string formatted as YYYY-MM-DD in the user's local timezone.
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string into a Date object at local midnight (00:00:00).
 */
export function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split("-").map(Number);
  if (parts.length === 3) {
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  }
  return new Date();
}

/**
 * Adds N days to a local Date.
 */
export function addDays(date: Date, days: number): Date {
  const res = new Date(date);
  res.setDate(res.getDate() + days);
  return res;
}

/**
 * Formats a local date string for display (e.g. "Senin, 27 Okt 2026")
 */
export function formatDisplayDate(dateStr: string, language: "id" | "en" = "id"): string {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString(language === "id" ? "id-ID" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export interface ProgramDaySchedule {
  dateStr: string; // YYYY-MM-DD
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  dayNameShort: string; // "Sen", "Sel", etc.
  dayNumberInWeek: number; // 1 to 7
  session: ProgramSession | null; // null if rest day
  isRestDay: boolean;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  status: "completed" | "next_workout" | "scheduled" | "rest" | "missed";
  actualDate?: string;
}

export interface ProgramWeekCalendar {
  weekNumber: number; // 1 to totalWeeks
  startDateStr: string;
  endDateStr: string;
  days: ProgramDaySchedule[];
  totalSessionsInWeek: number;
  completedSessionsInWeek: number;
  isCurrentWeek: boolean;
  allWeeklySessionsCompleted: boolean;
}

/**
 * Computes the full schedule and active week for a given program.
 */
export function computeProgramSchedule(
  program: WorkoutProgram,
  viewWeekOverride?: number
): {
  currentWeek: number;
  activeWeekData: ProgramWeekCalendar;
  totalWeeks: number;
  startDateStr: string;
  endDateStr: string;
  daysRemaining: number;
  nextScheduledDay: ProgramDaySchedule | null;
} {
  const todayStr = formatLocalDate(new Date());
  const todayDate = parseLocalDate(todayStr);

  const startDateStr = program.startDate || todayStr;
  const startDate = parseLocalDate(startDateStr);
  const totalWeeks = program.totalWeeks || 8;

  // End date is (totalWeeks * 7 - 1) days after start date
  const totalDays = totalWeeks * 7;
  const endDate = addDays(startDate, totalDays - 1);
  const endDateStr = program.endDate || formatLocalDate(endDate);

  // Calculate which week is current based on todayDate vs startDate
  const diffTime = todayDate.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  let calculatedCurrentWeek = Math.floor(diffDays / 7) + 1;
  if (calculatedCurrentWeek < 1) calculatedCurrentWeek = 1;
  if (calculatedCurrentWeek > totalWeeks) calculatedCurrentWeek = totalWeeks;

  const currentWeek = calculatedCurrentWeek;
  const targetWeek = viewWeekOverride || currentWeek;

  // Days remaining in the entire program
  const remainingTime = endDate.getTime() - todayDate.getTime();
  const daysRemaining = Math.max(0, Math.ceil(remainingTime / (1000 * 60 * 60 * 24)));

  // Generate calendar days for the targetWeek (7-day block)
  const weekStartOffsetDays = (targetWeek - 1) * 7;
  const weekStartDate = addDays(startDate, weekStartOffsetDays);

  const completedSessionHistory = program.sessionHistory || [];
  const completedIds = new Set(program.completedSessionIds || []);

  const days: ProgramDaySchedule[] = [];
  const sessions = program.sessions || [];
  const daysPerWeek = sessions.length;

  // Map session dayNumbers (1..daysPerWeek) across the 7-day week
  // Default even distribution: e.g. 3 days: Mon (0), Wed (2), Fri (4)
  const getSessionForDayIndex = (dayIndex0to6: number): ProgramSession | null => {
    if (daysPerWeek === 1) {
      return dayIndex0to6 === 0 ? sessions[0] : null;
    }
    if (daysPerWeek === 2) {
      return dayIndex0to6 === 0 ? sessions[0] : dayIndex0to6 === 3 ? sessions[1] : null;
    }
    if (daysPerWeek === 3) {
      return dayIndex0to6 === 0 ? sessions[0] : dayIndex0to6 === 2 ? sessions[1] : dayIndex0to6 === 4 ? sessions[2] : null;
    }
    if (daysPerWeek === 4) {
      return dayIndex0to6 === 0 ? sessions[0] : dayIndex0to6 === 1 ? sessions[1] : dayIndex0to6 === 3 ? sessions[2] : dayIndex0to6 === 4 ? sessions[3] : null;
    }
    if (daysPerWeek === 5) {
      return dayIndex0to6 < 5 ? sessions[dayIndex0to6] : null;
    }
    if (daysPerWeek === 6) {
      return dayIndex0to6 < 6 ? sessions[dayIndex0to6] : null;
    }
    return sessions[dayIndex0to6] || null;
  };

  let totalSessionsInWeek = 0;
  let completedSessionsInWeek = 0;
  let nextScheduledDay: ProgramDaySchedule | null = null;

  const dayNamesId = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  for (let i = 0; i < 7; i++) {
    const curDate = addDays(weekStartDate, i);
    const dateStr = formatLocalDate(curDate);
    const dayOfWeek = curDate.getDay();
    const session = getSessionForDayIndex(i);
    const isRestDay = !session;

    if (session) {
      totalSessionsInWeek++;
    }

    const isToday = dateStr === todayStr;
    const isPast = curDate.getTime() < todayDate.getTime();
    const isFuture = curDate.getTime() > todayDate.getTime();

    // Check if this session is recorded as completed
    let isCompleted = false;
    let actualDate: string | undefined = undefined;

    if (session) {
      // 1. Check in sessionHistory
      const hist = completedSessionHistory.find(
        (h) => (h.scheduledDate === dateStr || h.sessionId === session.sessionId) && h.status === "completed"
      );
      if (hist) {
        isCompleted = true;
        actualDate = hist.actualDate;
      } else if (completedIds.has(session.sessionId) && (isPast || isToday)) {
        isCompleted = true;
      }
    }

    if (isCompleted) {
      completedSessionsInWeek++;
    }

    let status: "completed" | "next_workout" | "scheduled" | "rest" | "missed" = "rest";
    if (isRestDay) {
      status = "rest";
    } else if (isCompleted) {
      status = "completed";
    } else if (isToday) {
      status = "next_workout";
    } else if (isPast) {
      status = "missed";
    } else {
      status = "scheduled";
    }

    const dayObj: ProgramDaySchedule = {
      dateStr,
      dayOfWeek,
      dayNameShort: dayNamesId[dayOfWeek],
      dayNumberInWeek: i + 1,
      session,
      isRestDay,
      isToday,
      isPast,
      isFuture,
      status,
      actualDate,
    };

    days.push(dayObj);
  }

  // Find the closest next workout (today or nearest future)
  for (const d of days) {
    if (!d.isRestDay && d.status !== "completed") {
      if (!nextScheduledDay || d.status === "next_workout") {
        nextScheduledDay = d;
        if (d.status === "next_workout") break;
      }
    }
  }

  // Check if all sessions for the week are completed
  const allWeeklySessionsCompleted =
    totalSessionsInWeek > 0 && completedSessionsInWeek >= totalSessionsInWeek;

  const activeWeekData: ProgramWeekCalendar = {
    weekNumber: targetWeek,
    startDateStr: formatLocalDate(weekStartDate),
    endDateStr: formatLocalDate(addDays(weekStartDate, 6)),
    days,
    totalSessionsInWeek,
    completedSessionsInWeek,
    isCurrentWeek: targetWeek === currentWeek,
    allWeeklySessionsCompleted,
  };

  return {
    currentWeek,
    activeWeekData,
    totalWeeks,
    startDateStr,
    endDateStr,
    daysRemaining,
    nextScheduledDay,
  };
}
