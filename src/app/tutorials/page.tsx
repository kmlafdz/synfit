"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "@/lib/navigation";
import { motion } from "framer-motion";
import { useUIStore } from "@/store/useUIStore";
import { useLanguage } from "@/store/useLanguageStore";
import { MemberTutorialsHub } from "@/components/tutorials/MemberTutorialsHub";

function TutorialsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTutorialId = searchParams.get("id") || undefined;
  const { memberTheme } = useUIStore();
  const isDark = memberTheme === "dark";
  const { language } = useLanguage();
  const [isExiting, setIsExiting] = useState(false);

  const handleBack = () => {
    setIsExiting(true);
    setTimeout(() => {
      router.push("/member/dashboard");
    }, 440);
  };

  return (
    <div className={`min-h-screen overflow-hidden ${isDark ? "bg-[#090B10]" : "bg-[#F3F4F6]"}`}>
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: isExiting ? "100%" : 0 }}
        transition={{ duration: 0.46, ease: [0.32, 0.72, 0, 1] }}
        className={`min-h-screen flex flex-col font-sans shadow-[-16px_0_40px_rgba(0,0,0,0.5)] ${
          isDark ? "bg-[#090B10] text-[#DFE2EE]" : "bg-[#F3F4F6] text-gray-900"
        }`}
        style={{
          willChange: "transform",
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
        }}
      >
        <MemberTutorialsHub
          onBack={handleBack}
          isDark={isDark}
          language={language}
          initialTutorialId={initialTutorialId}
          onNavigateToProgram={() => router.push("/member/dashboard")}
        />
      </motion.div>
    </div>
  );
}

export default function TutorialsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#090B10]" />}>
      <TutorialsContent />
    </Suspense>
  );
}
