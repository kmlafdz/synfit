"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  Calendar,
  Sparkles,
  ArrowLeft,
  Clock,
  MapPin,
  CheckCircle2,
  Share2,
  Tag,
  Dumbbell,
  Shield,
  Coffee,
  Flame,
  Award,
} from "lucide-react";
import { Member } from "@/types";
import { toast } from "sonner";

interface SynHubTabProps {
  member: Member | null;
  isDark: boolean;
  language?: "id" | "en";
  onBackToHome: () => void;
  onOpenReferral?: () => void;
  onOpenLocationModal?: () => void;
}

export function SynHubTab({
  member,
  isDark,
  language = "id",
  onBackToHome,
  onOpenReferral,
  onOpenLocationModal,
}: SynHubTabProps) {
  const [copiedCode, setCopiedCode] = useState(false);

  const referralCode = member?.nomor_whatsapp
    ? `SYNFIT-${member.nomor_whatsapp.slice(-4)}`
    : "SYNFIT-VIP";

  const handleShareReferral = () => {
    navigator.clipboard.writeText(
      `Yuk gabung gym di SynFit bareng aku pakai kode referral ${referralCode} dan dapatkan diskon 20% membership! https://synfitgym.web.app/`
    );
    setCopiedCode(true);
    toast.success("Tautan referral berhasil disalin ke clipboard!");
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const gymFacilities = [
    {
      title: "Free Weights & Olympic Racks",
      desc: "Barbell olympic, power rack, dumbbell set hingga 50kg, dan bench press datar/incline.",
      icon: Dumbbell,
      tag: "Zona Utama",
    },
    {
      title: "Selectorized Pin-Loaded Machines",
      desc: "Mesin biomekanik terpandu (chest press, lat pulldown, leg press) aman untuk semua level.",
      icon: Shield,
      tag: "Mesin Gym",
    },
    {
      title: "Cardio & Conditioning Theater",
      desc: "Commercial treadmill dengan incline, stationary spin bike, dan rowing machines.",
      icon: Flame,
      tag: "Kardio",
    },
    {
      title: "Locker Room & Luxury Shower",
      desc: "Locker kunci elektronik, air panas bertekanan, dan hair dryer siap pakai.",
      icon: Building2,
      tag: "Fasilitas",
    },
    {
      title: "Nutrition & Protein Shake Bar",
      desc: "Whey protein shake dingin, BCAA recovery drink, dan snack sehat sebelum/sesudah latihan.",
      icon: Coffee,
      tag: "Refreshment",
    },
  ];

  const classSchedules = [
    {
      name: "Functional Strength Circuit",
      time: "18:00 - 19:00",
      trainer: "Coach Andi",
      slots: "Sisa 2 Slot",
      intensity: "Tinggi",
    },
    {
      name: "HIIT Fat-Burn Accelerator",
      time: "19:15 - 20:00",
      trainer: "Coach Rika",
      slots: "Sisa 4 Slot",
      intensity: "Maksimal",
    },
    {
      name: "Mobility & Core Alignment",
      time: "20:15 - 21:00",
      trainer: "Coach Dimas",
      slots: "Tersedia",
      intensity: "Sedang",
    },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-24 px-2 sm:px-4">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToHome}
          className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all active:scale-95 ${
            isDark
              ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
              : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm"
          }`}
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/15 text-orange-400 border border-orange-500/30">
            SynFit Community Hub
          </span>
        </div>
      </div>

      {/* Headline */}
      <div className="space-y-1">
        <h1 className={`text-xl sm:text-2xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>
          SynHub — Pusat Komunitas & Fasilitas
        </h1>
        <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          Temukan info fasilitas gym, jadwal kelas bersama instruktur, program referral, dan event eksklusif SynFit.
        </p>
      </div>

      {/* ── REFERRAL CARD (AJAK TEMAN HEMAT 20%) ── */}
      <div
        className={`p-5 sm:p-6 rounded-3xl border relative overflow-hidden transition-all ${
          isDark
            ? "bg-gradient-to-br from-[#1c142b] via-[#141822] to-[#101424] border-purple-500/30 text-white shadow-xl shadow-purple-950/20"
            : "bg-gradient-to-br from-purple-50 via-white to-indigo-50/50 border-purple-200 text-gray-900 shadow-md"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Sparkles className="h-3 w-3" /> Program Referral SynFit
            </span>
            <h2 className="text-lg sm:text-xl font-black">
              Ajak Temanmu, Dapatkan Diskon 20%
            </h2>
            <p className={`text-xs max-w-lg leading-relaxed ${isDark ? "text-gray-300" : "text-gray-600"}`}>
              Bagikan kode referral unikmu kepada teman atau keluarga. Setiap kali mereka bergabung, kamu dan temanmu langsung mendapatkan potongan 20% membership berikutnya!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
            <div className="px-4 py-2.5 rounded-2xl bg-white/10 border border-white/20 font-mono font-black text-xs text-yellow-400">
              {referralCode}
            </div>
            <button
              onClick={handleShareReferral}
              className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-black text-xs shadow-md shadow-purple-900/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>{copiedCode ? "Disalin!" : "Bagikan Kode"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── JADWAL KELAS HARI INI ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            <h3 className={`text-sm font-extrabold uppercase tracking-wider ${isDark ? "text-white" : "text-gray-900"}`}>
              Jadwal Kelas Gym Hari Ini
            </h3>
          </div>
          <span className="text-[10px] text-gray-400 font-bold">
            SynFit Studio Lantai 2
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {classSchedules.map((cls, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 transition-all ${
                isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                    {cls.intensity}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">{cls.time}</span>
                </div>
                <h4 className={`text-xs font-black pt-1 ${isDark ? "text-white" : "text-gray-900"}`}>
                  {cls.name}
                </h4>
                <p className="text-[10px] text-gray-400">Instruktur: {cls.trainer}</p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px]">
                <span className="font-extrabold text-emerald-400">{cls.slots}</span>
                <button
                  onClick={() => toast.success(`Pendaftaran ${cls.name} berhasil dikonfirmasi!`)}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-extrabold"
                >
                  Ikuti
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FASILITAS ZONA LATIHAN SYNFIT ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-orange-500" />
          <h3 className={`text-sm font-extrabold uppercase tracking-wider ${isDark ? "text-white" : "text-gray-900"}`}>
            Fasilitas & Zona Latihan
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {gymFacilities.map((fac, idx) => {
            const Icon = fac.icon;
            return (
              <div
                key={idx}
                className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
                  isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-[#FF5A2C] flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <h4 className={`text-xs font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                      {fac.title}
                    </h4>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    {fac.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
