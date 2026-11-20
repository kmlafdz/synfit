"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Search,
  Dumbbell,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ListOrdered,
  X,
  Sparkles,
  Zap,
  ChevronRight,
  Filter,
} from "lucide-react";
import {
  EQUIPMENT_TUTORIALS,
  EQUIPMENT_CATEGORIES,
  EquipmentTutorial,
} from "@/data/equipmentTutorials";
import { EquipmentIllustration } from "@/components/EquipmentIllustration";

interface MemberTutorialsHubProps {
  onBack: () => void;
  isDark: boolean;
  language: "id" | "en";
  initialTutorialId?: string;
  onNavigateToProgram?: () => void;
}

type MuscleFilter = "all" | "upper" | "arms" | "core" | "lower";

export function MemberTutorialsHub({
  onBack,
  isDark,
  language,
  initialTutorialId,
  onNavigateToProgram,
}: MemberTutorialsHubProps) {
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Semua");
  const [muscleFilter, setMuscleFilter] = useState<MuscleFilter>("all");
  const [selectedTutorial, setSelectedTutorial] = useState<EquipmentTutorial | null>(null);

  useEffect(() => {
    setMounted(true);
    if (initialTutorialId) {
      const match = EQUIPMENT_TUTORIALS.find((t) => t.id === initialTutorialId);
      if (match) {
        setSelectedTutorial(match);
      }
    }
  }, [initialTutorialId]);

  // Prevent background scroll when bottom sheet is open
  useEffect(() => {
    if (selectedTutorial) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedTutorial]);

  // Filter tutorials by category, muscle group, and search query
  const filteredTutorials = useMemo(() => {
    return EQUIPMENT_TUTORIALS.filter((item) => {
      // 1. Category filter
      const matchesCategory =
        selectedCategory === "Semua" || item.category === selectedCategory;

      // 2. Muscle Group filter from the 4 cards
      let matchesMuscle = true;
      if (muscleFilter === "upper") {
        matchesMuscle =
          item.primaryMuscles.some((m) =>
            ["Dada", "Bahu", "Punggung", "Chest", "Shoulder", "Back", "Lats"].some((k) =>
              m.toLowerCase().includes(k.toLowerCase())
            )
          ) || item.category === "Mesin Tubuh Atas";
      } else if (muscleFilter === "arms") {
        matchesMuscle = item.primaryMuscles.some((m) =>
          ["Lengan", "Bicep", "Tricep", "Arm"].some((k) =>
            m.toLowerCase().includes(k.toLowerCase())
          )
        );
      } else if (muscleFilter === "core") {
        matchesMuscle =
          item.primaryMuscles.some((m) =>
            ["Perut", "Pinggang", "Core", "Abdominal"].some((k) =>
              m.toLowerCase().includes(k.toLowerCase())
            )
          ) || item.category === "Core & Punggung";
      } else if (muscleFilter === "lower") {
        matchesMuscle =
          item.primaryMuscles.some((m) =>
            ["Kaki", "Paha", "Betis", "Bokong", "Leg", "Calf", "Glute", "Hamstring", "Quad"].some((k) =>
              m.toLowerCase().includes(k.toLowerCase())
            )
          ) || item.category === "Mesin Tubuh Bawah";
      }

      // 3. Search query filter
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.primaryMuscles.some((m) => m.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q);

      return matchesCategory && matchesMuscle && matchesSearch;
    });
  }, [selectedCategory, muscleFilter, searchQuery]);

  return (
    <div className={`w-full pb-28 md:pb-16 text-left transition-colors duration-300 ${isDark ? "bg-[#090B10]" : "bg-[#F8F9FA]"}`}>
      {/* 1. TOP HERO BANNER WITH FLOATING WHITE BACK BUTTON */}
      <div className="relative w-full overflow-hidden bg-black aspect-[16/9] sm:aspect-[2.2/1] md:aspect-[2.6/1] max-h-[380px] shadow-lg">
        <img
          src="/banner_tutor.png"
          alt="Tutorial Pelajari Setiap Alat di Gym"
          className="w-full h-full object-cover object-center"
        />

        {/* Ambient Gradient Shade for Bottom Edge */}
        <div
          className={`absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t pointer-events-none ${
            isDark ? "from-[#090B10] to-transparent" : "from-[#F8F9FA] to-transparent"
          }`}
        />

        {/* Floating White Back Button on Top-Left */}
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={onBack}
            aria-label="Kembali"
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white/95 text-gray-900 hover:bg-white flex items-center justify-center shadow-xl active:scale-90 transition-all border border-black/10"
          >
            <ArrowLeft className="h-5 w-5 text-gray-900 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-5 space-y-7">
        {/* 2. SECTION: KENALI ALAT UNTUK LATIHAN (HORIZONTAL CAROUSEL) */}
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <h2 className={`text-base sm:text-lg font-black tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                Kenali Alat untuk Latihan
              </h2>
              <p className={`text-xs mt-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                Pastikan kamu paham cara memakai dan mengatur alat
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedCategory("Semua");
                setMuscleFilter("all");
                setSearchQuery("");
                const el = document.getElementById("catalog-grid");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-xs sm:text-sm font-bold text-cyan-600 dark:text-cyan-400 hover:underline transition-colors shrink-0"
            >
              Lihat Semua
            </button>
          </div>

          {/* Horizontal Scrolling Carousel of Gym Machines */}
          <div className="flex items-start gap-3.5 overflow-x-auto no-scrollbar pb-2 pt-1 -mx-4 px-4 sm:-mx-0 sm:px-0">
            {EQUIPMENT_TUTORIALS.map((tutorial) => (
              <button
                key={tutorial.id}
                onClick={() => setSelectedTutorial(tutorial)}
                className="flex flex-col items-center shrink-0 group active:scale-95 transition-all text-center focus:outline-none"
              >
                <div
                  className={`w-24 h-24 sm:w-28 sm:h-28 rounded-2xl p-2.5 flex items-center justify-center border transition-all ${
                    isDark
                      ? "bg-[#141824] border-white/10 group-hover:border-cyan-500/50 group-hover:bg-[#181E2E]"
                      : "bg-white border-gray-100 shadow-xs group-hover:border-cyan-300 group-hover:shadow-md"
                  }`}
                >
                  <EquipmentIllustration
                    iconType={tutorial.iconType}
                    name={tutorial.name}
                    isDark={isDark}
                    className="w-full h-full object-contain"
                  />
                </div>
                <span
                  className={`text-xs font-bold leading-tight line-clamp-2 max-w-[100px] mt-2 text-center transition-colors ${
                    isDark ? "text-gray-300 group-hover:text-white" : "text-gray-800 group-hover:text-cyan-700"
                  }`}
                >
                  {tutorial.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. SECTION: PELAJARI EXERCISE DENGAN ALAT (2X2 MUSCLE CARDS) */}
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <h2 className={`text-base sm:text-lg font-black tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                Pelajari Exercise dengan Alat
              </h2>
              <p className={`text-xs mt-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                Pilih area otot yang ingin kamu latih
              </p>
            </div>
            <button
              onClick={() => {
                setMuscleFilter("all");
                const el = document.getElementById("catalog-grid");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-xs sm:text-sm font-bold text-cyan-600 dark:text-cyan-400 hover:underline transition-colors shrink-0"
            >
              Lihat Semua
            </button>
          </div>

          {/* 2-Column Grid of 4 Muscle Group Cards */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {/* Card 1: Upper Body */}
            <div
              onClick={() => {
                setMuscleFilter(muscleFilter === "upper" ? "all" : "upper");
                const el = document.getElementById("catalog-grid");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 h-28 sm:h-36 relative overflow-hidden flex flex-col justify-between cursor-pointer active:scale-98 transition-all shadow-md group ${
                muscleFilter === "upper"
                  ? "ring-2 ring-cyan-400 brightness-110 shadow-cyan-900/40"
                  : "hover:brightness-105"
              }`}
              style={{
                background: isDark
                  ? "linear-gradient(135deg, #2d4855 0%, #1e323b 100%)"
                  : "linear-gradient(135deg, #3d606f 0%, #2f4b57 100%)",
              }}
            >
              <div className="z-10 text-left max-w-[65%]">
                <h3 className="text-sm sm:text-base md:text-lg font-black text-white tracking-tight leading-tight">
                  Upper Body
                </h3>
                <p className="text-[10px] sm:text-xs text-white/80 font-medium leading-tight mt-1">
                  Dada • Bahu • Punggung
                </p>
              </div>

              {/* Vector Graphic Cutout */}
              <div className="absolute right-1 bottom-0 w-24 sm:w-32 h-24 sm:h-32 pointer-events-none opacity-85 group-hover:scale-105 transition-transform flex items-end justify-end">
                <svg viewBox="0 0 100 100" className="w-full h-full fill-white/80">
                  <path d="M50 15 C45 15 42 19 42 24 C42 29 45 33 50 33 C55 33 58 29 58 24 C58 19 55 15 50 15 Z" />
                  <path d="M30 42 C30 38 35 36 43 36 L57 36 C65 36 70 38 70 42 L76 60 C77 64 74 67 70 67 C67 67 65 65 64 61 L60 48 L58 85 C58 89 55 92 51 92 L49 92 C45 92 42 89 42 85 L40 48 L36 61 C35 65 33 67 30 67 C26 67 23 64 24 60 Z" opacity="0.9" />
                  <circle cx="82" cy="38" r="8" fill="#67e8f9" opacity="0.5" />
                  <circle cx="18" cy="38" r="8" fill="#67e8f9" opacity="0.5" />
                </svg>
              </div>
            </div>

            {/* Card 2: Arms */}
            <div
              onClick={() => {
                setMuscleFilter(muscleFilter === "arms" ? "all" : "arms");
                const el = document.getElementById("catalog-grid");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 h-28 sm:h-36 relative overflow-hidden flex flex-col justify-between cursor-pointer active:scale-98 transition-all shadow-md group ${
                muscleFilter === "arms"
                  ? "ring-2 ring-amber-400 brightness-110 shadow-amber-900/40"
                  : "hover:brightness-105"
              }`}
              style={{
                background: isDark
                  ? "linear-gradient(135deg, #6b3e30 0%, #4a291f 100%)"
                  : "linear-gradient(135deg, #87513f 0%, #6d4032 100%)",
              }}
            >
              <div className="z-10 text-left max-w-[65%]">
                <h3 className="text-sm sm:text-base md:text-lg font-black text-white tracking-tight leading-tight">
                  Arms
                </h3>
                <p className="text-[10px] sm:text-xs text-white/80 font-medium leading-tight mt-1">
                  Bicep • Tricep • Lengan bawah
                </p>
              </div>

              {/* Vector Graphic Cutout */}
              <div className="absolute right-1 bottom-0 w-24 sm:w-32 h-24 sm:h-32 pointer-events-none opacity-85 group-hover:scale-105 transition-transform flex items-end justify-end">
                <svg viewBox="0 0 100 100" className="w-full h-full fill-white/80">
                  <path d="M60 20 C56 20 52 23 52 28 C52 33 56 36 60 36 C64 36 68 33 68 28 C68 23 64 20 60 20 Z" />
                  <path d="M40 45 C45 35 55 35 62 40 L70 48 C74 52 72 58 66 60 L58 55 L55 75 C54 82 45 82 44 75 L45 52 L38 58 C34 61 28 58 30 53 Z" opacity="0.9" />
                  <rect x="68" y="45" width="20" height="8" rx="3" fill="#fbbf24" opacity="0.8" />
                  <rect x="74" y="38" width="8" height="22" rx="3" fill="#f59e0b" opacity="0.7" />
                </svg>
              </div>
            </div>

            {/* Card 3: Core */}
            <div
              onClick={() => {
                setMuscleFilter(muscleFilter === "core" ? "all" : "core");
                const el = document.getElementById("catalog-grid");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 h-28 sm:h-36 relative overflow-hidden flex flex-col justify-between cursor-pointer active:scale-98 transition-all shadow-md group ${
                muscleFilter === "core"
                  ? "ring-2 ring-pink-400 brightness-110 shadow-pink-900/40"
                  : "hover:brightness-105"
              }`}
              style={{
                background: isDark
                  ? "linear-gradient(135deg, #66324b 0%, #462033 100%)"
                  : "linear-gradient(135deg, #804360 0%, #68364e 100%)",
              }}
            >
              <div className="z-10 text-left max-w-[65%]">
                <h3 className="text-sm sm:text-base md:text-lg font-black text-white tracking-tight leading-tight">
                  Core
                </h3>
                <p className="text-[10px] sm:text-xs text-white/80 font-medium leading-tight mt-1">
                  Perut • Pinggang
                </p>
              </div>

              {/* Vector Graphic Cutout */}
              <div className="absolute right-0 bottom-0 w-24 sm:w-32 h-24 sm:h-32 pointer-events-none opacity-85 group-hover:scale-105 transition-transform flex items-end justify-end">
                <svg viewBox="0 0 100 100" className="w-full h-full fill-white/80">
                  <path d="M42 22 C38 22 35 25 35 29 C35 33 38 36 42 36 C46 36 49 33 49 29 C49 25 46 22 42 22 Z" />
                  <path d="M30 40 C35 36 45 36 50 40 L60 52 C64 56 62 62 57 63 L45 56 L42 75 C41 82 32 82 31 75 L35 50 L25 54 C21 56 16 52 18 47 Z" opacity="0.9" />
                  <circle cx="72" cy="72" r="18" fill="#f472b6" opacity="0.6" />
                </svg>
              </div>
            </div>

            {/* Card 4: Lower Body */}
            <div
              onClick={() => {
                setMuscleFilter(muscleFilter === "lower" ? "all" : "lower");
                const el = document.getElementById("catalog-grid");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 h-28 sm:h-36 relative overflow-hidden flex flex-col justify-between cursor-pointer active:scale-98 transition-all shadow-md group ${
                muscleFilter === "lower"
                  ? "ring-2 ring-lime-400 brightness-110 shadow-lime-900/40"
                  : "hover:brightness-105"
              }`}
              style={{
                background: isDark
                  ? "linear-gradient(135deg, #535f2f 0%, #394220 100%)"
                  : "linear-gradient(135deg, #6c7c44 0%, #576435 100%)",
              }}
            >
              <div className="z-10 text-left max-w-[65%]">
                <h3 className="text-sm sm:text-base md:text-lg font-black text-white tracking-tight leading-tight">
                  Lower Body
                </h3>
                <p className="text-[10px] sm:text-xs text-white/80 font-medium leading-tight mt-1">
                  Paha • Betis • Bokong
                </p>
              </div>

              {/* Vector Graphic Cutout */}
              <div className="absolute right-0 bottom-0 w-24 sm:w-32 h-24 sm:h-32 pointer-events-none opacity-85 group-hover:scale-105 transition-transform flex items-end justify-end">
                <svg viewBox="0 0 100 100" className="w-full h-full fill-white/80">
                  <path d="M50 16 C46 16 43 19 43 23 C43 27 46 30 50 30 C54 30 57 27 57 23 C57 19 54 16 50 16 Z" />
                  <path d="M38 35 L62 35 C66 35 68 39 67 43 L63 55 L72 75 C75 80 70 85 65 83 L55 65 L45 65 L35 83 C30 85 25 80 28 75 L37 55 L33 43 C32 39 34 35 38 35 Z" opacity="0.9" />
                  <circle cx="50" cy="88" r="8" fill="#a3e635" opacity="0.6" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* 4. SECTION: CATALOG SEARCH & EQUIPMENT GRID */}
        <div id="catalog-grid" className="pt-2 space-y-4">
          {/* Active Filter Indicator Banner */}
          {(muscleFilter !== "all" || selectedCategory !== "Semua" || searchQuery) && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-bold text-cyan-400">
                  Filter Aktif: {muscleFilter === "upper" ? "Upper Body" : muscleFilter === "arms" ? "Arms" : muscleFilter === "core" ? "Core" : muscleFilter === "lower" ? "Lower Body" : selectedCategory !== "Semua" ? selectedCategory : "Pencarian"}
                </span>
                <span className="text-gray-400">({filteredTutorials.length} Alat Ditemukan)</span>
              </div>
              <button
                onClick={() => {
                  setMuscleFilter("all");
                  setSelectedCategory("Semua");
                  setSearchQuery("");
                }}
                className="text-xs font-black text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded-lg hover:bg-cyan-500/10 transition-colors"
              >
                ✕ Reset
              </button>
            </div>
          )}

          {/* Search Input Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari alat, otot yang dilatih (Chest, Leg, Back...), atau kategori..."
              className={`w-full pl-11 pr-4 py-3 rounded-2xl border text-xs sm:text-sm font-medium transition-all outline-none ${
                isDark
                  ? "bg-[#141822] border-white/10 text-white placeholder-gray-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  : "bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20"
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-white px-2 py-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* 2-Column Equipment Grid */}
          {filteredTutorials.length === 0 ? (
            <div
              className={`py-12 px-4 rounded-3xl border text-center space-y-3 ${
                isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200"
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
                <Dumbbell className="h-6 w-6" />
              </div>
              <h4 className="text-base font-black">Tidak Ada Alat Ditemukan</h4>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Coba gunakan kata kunci lain atau reset filter untuk melihat 30 alat gym SynFit.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory("Semua");
                  setMuscleFilter("all");
                  setSearchQuery("");
                }}
                className="px-4 py-2 rounded-xl text-xs font-black bg-cyan-600 text-white hover:bg-cyan-500 transition-all shadow-md active:scale-95"
              >
                Reset Semua Filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {filteredTutorials.map((tutorial) => (
                <div
                  key={tutorial.id}
                  onClick={() => setSelectedTutorial(tutorial)}
                  className={`group rounded-3xl border overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer active:scale-98 ${
                    isDark
                      ? "bg-[#141822] border-white/10 hover:border-cyan-500/40 text-white"
                      : "bg-white border-gray-200 hover:border-cyan-300 text-gray-900 shadow-sm"
                  }`}
                >
                  {/* Card Illustration Banner */}
                  <div className="relative w-full h-32 sm:h-36 bg-black/5 overflow-hidden">
                    <EquipmentIllustration
                      iconType={tutorial.iconType}
                      name={tutorial.name}
                      isDark={isDark}
                      className="w-full h-full object-contain p-2"
                    />

                    {/* Category & Difficulty Badges */}
                    <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1">
                      <span
                        className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border backdrop-blur-md ${
                          tutorial.difficulty === "Pemula"
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : tutorial.difficulty === "Menengah"
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                            : "bg-purple-500/20 text-purple-400 border-purple-500/30"
                        }`}
                      >
                        {tutorial.difficulty}
                      </span>
                    </div>
                  </div>

                  {/* Card Info Body */}
                  <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between space-y-2.5 text-left">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-cyan-500 block truncate">
                        {tutorial.category}
                      </span>
                      <h4 className="text-xs sm:text-sm font-black tracking-tight line-clamp-1 group-hover:text-cyan-500 transition-colors mt-0.5">
                        {tutorial.name}
                      </h4>
                      <p className={`text-[10px] sm:text-[11px] line-clamp-2 mt-1 leading-relaxed ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                        {tutorial.summary}
                      </p>
                    </div>

                    {/* Muscle Tags */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {tutorial.primaryMuscles.slice(0, 2).map((m) => (
                        <span
                          key={m}
                          className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                            isDark
                              ? "bg-white/5 border-white/5 text-gray-300"
                              : "bg-gray-100 border-gray-200 text-gray-700"
                          }`}
                        >
                          {m}
                        </span>
                      ))}
                      {tutorial.primaryMuscles.length > 2 && (
                        <span className="text-[8px] text-gray-400 font-bold self-center">
                          +{tutorial.primaryMuscles.length - 2}
                        </span>
                      )}
                    </div>

                    {/* Card Action Footer */}
                    <div
                      className={`pt-2.5 border-t flex items-center justify-between text-[11px] font-black ${
                        isDark ? "border-white/5 text-cyan-400" : "border-gray-100 text-cyan-600"
                      }`}
                    >
                      <span>Lihat Panduan</span>
                      <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. DETAIL BOTTOM SHEET (Mounted to document.body via Portal to guarantee bottom docking) */}
      {mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {selectedTutorial && (
              <div className="fixed inset-0 z-[99999] flex items-end justify-center pointer-events-auto">
                {/* Backdrop Dimmer */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  onClick={() => setSelectedTutorial(null)}
                  className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99998]"
                />

                {/* Bottom Sheet Drawer */}
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
                  drag="y"
                  dragConstraints={{ top: 0 }}
                  dragElastic={0.12}
                  onDragEnd={(e, { offset, velocity }) => {
                    if (offset.y > 100 || velocity.y > 450) {
                      setSelectedTutorial(null);
                    }
                  }}
                  className={`relative z-[99999] w-full max-w-2xl max-h-[88vh] rounded-t-[32px] sm:rounded-t-[36px] border-t border-x border-white/10 overflow-hidden flex flex-col shadow-[0_-16px_50px_rgba(0,0,0,0.8)] ${
                    isDark ? "bg-[#141822] text-white" : "bg-white text-gray-900 border-gray-200"
                  }`}
                >
                  {/* Drag Handle Bar */}
                  <div className="w-full flex justify-center pt-2.5 pb-1.5 shrink-0 cursor-grab active:cursor-grabbing">
                    <div className={`w-12 h-1.5 rounded-full ${isDark ? "bg-white/20" : "bg-gray-300"}`} />
                  </div>

                  {/* Modal Top Header with Illustration */}
                  <div className="relative w-full h-44 sm:h-52 bg-black/10 shrink-0">
                    <EquipmentIllustration
                      iconType={selectedTutorial.iconType}
                      name={selectedTutorial.name}
                      isDark={isDark}
                      className="w-full h-full"
                    />

                    {/* Close Button */}
                    <button
                      onClick={() => setSelectedTutorial(null)}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white hover:bg-black/80 flex items-center justify-center backdrop-blur-md border border-white/10 transition-all z-20"
                    >
                      <X className="h-4 w-4" />
                    </button>

                    {/* Category & Difficulty Badges */}
                    <div className="absolute bottom-3 left-3 flex items-center gap-2 z-10">
                      <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-black/70 text-white border border-white/10 backdrop-blur-md">
                        {selectedTutorial.category}
                      </span>
                      <span
                        className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border backdrop-blur-md ${
                          selectedTutorial.difficulty === "Pemula"
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : selectedTutorial.difficulty === "Menengah"
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                            : "bg-purple-500/20 text-purple-400 border-purple-500/30"
                        }`}
                      >
                        Tingkat: {selectedTutorial.difficulty}
                      </span>
                    </div>
                  </div>

                  {/* Modal Scrollable Body */}
                  <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar text-left">
                    {/* Title and Summary */}
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black tracking-tight">{selectedTutorial.name}</h2>
                      <p className={`text-xs sm:text-sm mt-1 leading-relaxed ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                        {selectedTutorial.summary}
                      </p>
                    </div>

                    {/* Otot Utama (Primary Muscles) */}
                    <div className={`p-3.5 rounded-2xl border ${isDark ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-200"}`}>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-2">
                        Otot Utama yang Dilatih
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {selectedTutorial.primaryMuscles.map((muscle) => (
                          <span
                            key={muscle}
                            className={`text-xs font-bold px-3 py-1 rounded-xl border flex items-center gap-1.5 ${
                              isDark
                                ? "bg-white/5 border-white/10 text-white"
                                : "bg-white border-gray-200 text-gray-800 shadow-xs"
                            }`}
                          >
                            <Dumbbell className="h-3.5 w-3.5 text-cyan-500" />
                            <span>{muscle}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 1. Pengaturan Awal (Preparation) */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                        <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider">
                          Pengaturan Awal &amp; Penyesuaian
                        </h4>
                      </div>
                      <div className="space-y-1.5 pl-6">
                        {selectedTutorial.preparation.map((setup, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs leading-relaxed">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span className={isDark ? "text-gray-300" : "text-gray-700"}>{setup}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 2. Cara Menggunakan (Steps) */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <ListOrdered className="h-4 w-4 text-cyan-400 shrink-0" />
                        <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider">Cara Menggunakan</h4>
                      </div>
                      <div className="space-y-1.5 pl-6">
                        {selectedTutorial.steps.map((step, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs leading-relaxed">
                            <span className={`font-mono font-bold shrink-0 ${isDark ? "text-cyan-400" : "text-cyan-600"}`}>
                              {idx + 1}.
                            </span>
                            <span className={isDark ? "text-gray-300" : "text-gray-700"}>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 3. Kesalahan Umum (Common Mistakes) */}
                    <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 space-y-1.5">
                      <div className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase tracking-wider">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>Kesalahan Umum yang Harus Dihindari</span>
                      </div>
                      <ul className="space-y-1 text-xs text-red-400/90 pl-6 list-disc">
                        {selectedTutorial.commonMistakes.map((mistake, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {mistake}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* 4. Tips Keamanan (Safety Tips) */}
                    <div className={`p-3.5 rounded-2xl border space-y-1.5 ${
                      isDark ? "bg-amber-500/10 border-amber-500/20" : "bg-amber-50 border-amber-200"
                    }`}>
                      <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-wider">
                        <Sparkles className="h-4 w-4 shrink-0" />
                        <span>Tips Keamanan &amp; Efisiensi</span>
                      </div>
                      <ul className={`space-y-1 text-xs pl-6 list-disc ${
                        isDark ? "text-amber-300/90" : "text-amber-800"
                      }`}>
                        {selectedTutorial.safetyTips.map((tip, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className={`p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${
                    isDark ? "bg-[#11141C] border-white/10" : "bg-gray-50 border-gray-200"
                  }`}>
                    <div className="text-left w-full sm:w-auto">
                      <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">
                        Kategori Latihan
                      </span>
                      <span className="text-xs font-bold">{selectedTutorial.category} · {selectedTutorial.difficulty}</span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => setSelectedTutorial(null)}
                        className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                          isDark ? "border-white/10 hover:bg-white/5 text-gray-300" : "border-gray-200 hover:bg-white text-gray-700"
                        }`}
                      >
                        Tutup
                      </button>
                      {onNavigateToProgram && (
                        <button
                          onClick={() => {
                            setSelectedTutorial(null);
                            onNavigateToProgram();
                          }}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:brightness-110 shadow-cyan-900/30"
                        >
                          <Zap className="h-4 w-4" />
                          <span>Buat Program Latihan</span>
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
