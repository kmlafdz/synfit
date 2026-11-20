"use client";

import { useEffect, useState } from "react";
import { messaging } from "@/lib/firebase";
import { getToken, onMessage } from "firebase/messaging";
import { Capacitor } from "@capacitor/core";

/** FCM error codes that are expected when the user hasn't granted permissions. */
const SILENT_FCM_ERRORS = new Set([
  "messaging/permission-blocked",
  "messaging/permission-default",
]);

export function useFcm() {
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  useEffect(() => {
    if (!messaging) return;

    const setupFcm = async () => {
      // Skip silently if notifications are not supported or already blocked.
      if (
        typeof window === "undefined" ||
        !("Notification" in window) ||
        Notification.permission === "denied"
      ) {
        return;
      }

      try {
        // Only request token if on web or supported environment
        if (!Capacitor.isNativePlatform() && messaging) {
          const token = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          });

          if (token) {
            setFcmToken(token);
            console.log("FCM Token:", token);
          }
        }
      } catch (error: unknown) {
        // Silently ignore expected permission errors — these are not bugs.
        const code =
          error instanceof Error
            ? (error as Error & { code?: string }).code
            : undefined;
        const message =
          error instanceof Error ? error.message : String(error);

        const isPermissionError =
          (code && SILENT_FCM_ERRORS.has(code)) ||
          SILENT_FCM_ERRORS.has(message) ||
          message.toLowerCase().includes("permission");

        if (!isPermissionError) {
          console.error("FCM Setup Error:", error);
        }
      }
    };

    setupFcm();

    // Listen for foreground messages
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = onMessage(messaging, (payload) => {
        console.log("Foreground Message:", payload);
        // Trigger a local notification here if needed
      });
    } catch {
      // onMessage may throw if messaging isn't fully initialized
    }

    return () => unsubscribe?.();
  }, []);

  return { fcmToken };
}
