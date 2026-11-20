"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    snap: {
      pay: (
        token: string,
        callbacks?: {
          onSuccess?: (result: any) => void;
          onPending?: (result: any) => void;
          onError?: (result: any) => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

export function useMidtransSnap() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const isProduction = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true";
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "";

    const snapScriptUrl = isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";

    // Check if script already exists
    const existingScript = document.querySelector(`script[src="${snapScriptUrl}"]`);
    if (existingScript) {
      setIsLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = snapScriptUrl;
    script.setAttribute("data-client-key", clientKey);
    script.async = true;

    script.onload = () => {
      setIsLoaded(true);
    };

    script.onerror = () => {
      console.error("Gagal memuat script Midtrans Snap");
    };

    document.body.appendChild(script);

    return () => {
      // Keep script in document to prevent multiple reloads
    };
  }, []);

  const openSnap = (
    token: string,
    callbacks?: {
      onSuccess?: (result: any) => void;
      onPending?: (result: any) => void;
      onError?: (result: any) => void;
      onClose?: () => void;
    }
  ) => {
    if (typeof window !== "undefined" && window.snap) {
      window.snap.pay(token, callbacks);
    } else {
      console.warn("Midtrans Snap belum siap atau gagal dimuat.");
    }
  };

  return { isLoaded, openSnap };
}

