"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Award,
  Calendar,
  CheckCircle2,
  X,
  Phone,
  MessageCircle,
  Clock,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { SYN_TRAINERS, Trainer } from "@/data/trainers";

interface TrainersSectionProps {
  isDark: boolean;
  language: "id" | "en";
  onConsultTrainer?: (trainer: Trainer) => void;
}

export function TrainersSection({
  isDark,
  language,
  onConsultTrainer,
}: TrainersSectionProps) {
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [mounted, setMounted] = useState(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const hasDragged = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCardTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      hasDragged.current = false;
    }
  };

  const handleCardTouchMove = (e: React.TouchEvent) => {
    if (touchStartPos.current && e.touches.length === 1) {
      const diffX = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
      const diffY = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
      if (diffX > 8 || diffY > 8) {
        hasDragged.current = true;
      }
    }
  };

  const handleCardTouchEnd = () => {
    touchStartPos.current = null;
  };

  const openTrainerSafe = (trainer: Trainer) => {
    if (!hasDragged.current) {
      setSelectedTrainer(trainer);
    }
  };
  const [filterGender, setFilterGender] = useState<"all" | "female" | "male">("all");

  const filteredTrainers = SYN_TRAINERS.filter((t) => {
    if (filterGender === "all") return true;
    return t.gender === filterGender;
  });

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleBooking = (trainer: Trainer) => {
    if (onConsultTrainer) {
      onConsultTrainer(trainer);
    } else {
      const message = encodeURIComponent(
        `Halo Admin SynFit, saya tertarik untuk booking sesi Personal Trainer bersama Coach ${trainer.name} (${formatRupiah(trainer.pricePerSession)}/sesi). Mohon informasi ketersediaan jadwalnya.`
      );
      window.open(`https://wa.me/6281234567890?text=${message}`, "_blank");
    }
  };

  return (
    <div
      data-no-swipe="true"
      className="space-y-3 pt-2"
    >
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className={`text-sm font-black ${isDark ? "text-white" : "text-gray-900"}`}>
              {language === "id" ? "Personal Trainer Profesional" : "Professional Personal Trainers"}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-orange-500/15 text-orange-400 border border-orange-500/30">
              5 Certified Coaches
            </span>
          </div>
          <p className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            {language === "id"
              ? "Pilih pelatih pribadi berlisensi internasional sesuai target kebugaran Anda"
              : "Choose licensed personal trainers tailored to your fitness transformation"}
          </p>
        </div>

        {/* Filter Pills */}
        <div
          data-no-swipe="true"
          className="flex items-center gap-1.5 self-start sm:self-auto p-0.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold"
        >
          <button
            onClick={() => setFilterGender("all")}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              filterGender === "all"
                ? "bg-blue-600 text-white shadow"
                : isDark
                ? "text-gray-400 hover:text-white"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {language === "id" ? "Semua" : "All"} (5)
          </button>
          <button
            onClick={() => setFilterGender("female")}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              filterGender === "female"
                ? "bg-rose-600 text-white shadow"
                : isDark
                ? "text-gray-400 hover:text-white"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {language === "id" ? "Wanita" : "Female"} (2)
          </button>
          <button
            onClick={() => setFilterGender("male")}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              filterGender === "male"
                ? "bg-blue-600 text-white shadow"
                : isDark
                ? "text-gray-400 hover:text-white"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {language === "id" ? "Pria" : "Male"} (3)
          </button>
        </div>
      </div>

      {/* Horizontal Trainer Cards Slider */}
      <div
        data-no-swipe="true"
        className="flex gap-3.5 overflow-x-auto no-scrollbar pb-2 pt-1 -mx-4 px-4 sm:mx-0 sm:px-0"
      >
        {filteredTrainers.map((trainer) => (
          <div
            key={trainer.id}
            onTouchStart={handleCardTouchStart}
            onTouchMove={handleCardTouchMove}
            onTouchEnd={handleCardTouchEnd}
            onClick={() => openTrainerSafe(trainer)}
            className="group relative shrink-0 w-60 sm:w-64 rounded-2xl overflow-hidden shadow-lg border border-white/10 cursor-pointer transition-all duration-300 hover:border-orange-500/50 hover:shadow-orange-950/20 active:scale-[0.99] flex flex-col bg-[#121622]"
          >
            {/* Trainer Image & Badges */}
            <div className="relative h-56 w-full overflow-hidden bg-black">
              <img
                src={trainer.image}
                alt={trainer.name}
                className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#121622] via-transparent to-black/30" />

              {/* Rating Chip */}
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-yellow-400 text-[10px] font-bold">
                <Star className="h-3 w-3 fill-yellow-400" />
                <span>{trainer.rating.toFixed(1)}</span>
                <span className="text-gray-400 font-normal">({trainer.reviewCount})</span>
              </div>

              {/* Gender / Experience Chip */}
              <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white text-[10px] font-bold">
                {trainer.experienceYears} Thn Pengalaman
              </div>

              {/* Bottom Overlay Price Tag on Image */}
              <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between z-10">
                <div>
                  <h4 className="text-base font-black text-white leading-tight flex items-center gap-1.5">
                    <span>{trainer.name}</span>
                    <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  </h4>
                  <p className="text-[10px] text-gray-300 line-clamp-1 mt-0.5">{trainer.title}</p>
                </div>
              </div>
            </div>

            {/* Bottom Card Content */}
            <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
              {/* Specialization Tags */}
              <div className="flex flex-wrap gap-1">
                {trainer.specialization.slice(0, 3).map((spec, sIdx) => (
                  <span
                    key={sIdx}
                    className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-300"
                  >
                    {spec}
                  </span>
                ))}
              </div>

              {/* Price & CTA */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-gray-400 uppercase font-bold block">Tarif Mulai</span>
                  <p className="text-xs font-black text-orange-400">
                    {formatRupiah(trainer.pricePerSession)}
                    <span className="text-[9px] font-normal text-gray-400"> /sesi</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openTrainerSafe(trainer);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-md shadow-orange-950/30 transition-all active:scale-95"
                >
                  <span>Profil</span>
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Trainer Detail Modal - Rendered via createPortal directly into document.body to prevent parent transform/overflow jerking */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {selectedTrainer && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
                onClick={() => setSelectedTrainer(null)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden my-auto ${
                isDark ? "bg-[#101420] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
              }`}
            >
              {/* Modal Banner Image */}
              <div className="relative h-60 sm:h-72 w-full bg-black overflow-hidden">
                <img
                  src={selectedTrainer.image}
                  alt={selectedTrainer.name}
                  className="w-full h-full object-cover object-top"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#101420] via-black/30 to-black/50" />

                {/* Close Button */}
                <button
                  onClick={() => setSelectedTrainer(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Floating Trainer Hero Info */}
                <div className="absolute bottom-3 left-4 right-4 text-white">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-orange-600 text-white shadow">
                      {selectedTrainer.gender === "female" ? "Female Coach" : "Male Coach"}
                    </span>
                    <div className="flex items-center gap-1 text-yellow-400 text-xs font-black">
                      <Star className="h-3.5 w-3.5 fill-yellow-400" />
                      <span>{selectedTrainer.rating.toFixed(1)}</span>
                      <span className="text-gray-300 font-normal">({selectedTrainer.reviewCount} ulasan)</span>
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-white flex items-center gap-2">
                    <span>Coach {selectedTrainer.name}</span>
                    <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  </h3>
                  <p className="text-xs text-gray-300 mt-0.5 font-medium">{selectedTrainer.title}</p>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Bio */}
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-orange-400 mb-1">
                    Tentang Pelatih
                  </h4>
                  <p className="text-xs leading-relaxed text-gray-300">{selectedTrainer.bio}</p>
                </div>

                {/* Specialization */}
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-blue-400 mb-1.5">
                    Spesialisasi & Fokus Latihan
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTrainer.specialization.map((spec, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300"
                      >
                        ✓ {spec}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Certifications */}
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-emerald-400 mb-1.5">
                    Sertifikasi & Lisensi
                  </h4>
                  <div className="space-y-1">
                    {selectedTrainer.certifications.map((cert, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-gray-300">
                        <Award className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>{cert}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Schedule info */}
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-gray-300">
                    <Clock className="h-4 w-4 text-orange-400" />
                    <span>Jadwal Tersedia:</span>
                  </div>
                  <strong className="text-white font-mono">{selectedTrainer.scheduleAvailable}</strong>
                </div>

                {/* Pricing Table / Packages */}
                <div className="space-y-2 pt-1">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-yellow-400">
                    Paket Sesi & Biaya Latihan
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Per Sesi */}
                    <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center space-y-1">
                      <span className="text-[9px] font-bold text-gray-400 uppercase">Single Session</span>
                      <p className="text-sm font-black text-orange-400">
                        {formatRupiah(selectedTrainer.pricePerSession)}
                      </p>
                      <span className="text-[9px] text-gray-400 block">1 Sesi (60 Menit)</span>
                    </div>

                    {/* 5 Sesi */}
                    {selectedTrainer.packagePrice5Sessions && (
                      <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center space-y-1">
                        <span className="text-[9px] font-bold text-gray-400 uppercase">Paket 5 Sesi</span>
                        <p className="text-sm font-black text-blue-400">
                          {formatRupiah(selectedTrainer.packagePrice5Sessions)}
                        </p>
                        <span className="text-[9px] text-emerald-400 font-bold block">Hemat 8%</span>
                      </div>
                    )}

                    {/* 10 Sesi */}
                    {selectedTrainer.packagePrice10Sessions && (
                      <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-600/20 to-amber-600/20 border border-orange-500/30 text-center space-y-1">
                        <span className="text-[9px] font-black text-orange-300 uppercase">Paket 10 Sesi</span>
                        <p className="text-sm font-black text-orange-300">
                          {formatRupiah(selectedTrainer.packagePrice10Sessions)}
                        </p>
                        <span className="text-[9px] text-yellow-400 font-black block">Best Value (Hemat 15%)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 sm:p-5 border-t border-white/10 bg-black/40 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedTrainer(null)}
                  className="px-4 py-3 rounded-2xl border border-white/10 text-xs font-bold text-gray-300 hover:bg-white/5"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => handleBooking(selectedTrainer)}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-orange-600 to-[#FF5A2C] hover:from-orange-500 hover:to-[#FF5A2C] text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-950/40 flex items-center justify-center gap-2 active:scale-98 transition-all"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Konsultasi & Booking Jadwal</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </div>
  );
}
