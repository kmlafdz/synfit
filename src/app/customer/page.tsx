"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, Download, Contact2, ArrowLeft, RefreshCw, MessageSquare } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { Member } from "@/types";
import { DigitalCard } from "@/components/DigitalCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import html2canvas from "html2canvas";
import { useLanguage } from "@/store/useLanguageStore";
import { useUIStore } from "@/store/useUIStore";
import { translations } from "@/lib/translations";
import Link from "@/lib/navigation";

export default function CustomerLookupPage() {
  const { language, setLanguage } = useLanguage();
  const { memberTheme } = useUIStore();
  const isDark = memberTheme === "dark";
  const t = translations[language];

  const [searchVal, setSearchVal] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchVal.trim()) return;
    setIsSearching(true);
    setErrorMsg("");
    setMember(null);

    try {
      let foundMember = false;
      const res = await fetch("/api/customer/lookup-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchVal }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (res.ok && data.success && data.member) {
          setMember(data.member as Member);
          foundMember = true;
        } else if (data.error) {
          setErrorMsg(data.error);
          return;
        }
      }

      // Client-side fallback for static Firebase Hosting
      if (!foundMember) {
        const cleanQuery = searchVal.replace(/\D/g, "");
        const allMemSnap = await getDocs(collection(db, "members"));
        const matched = allMemSnap.docs.find((d) => {
          const m = d.data();
          const phone = (m.nomor_whatsapp || "").replace(/\D/g, "");
          const name = (m.nama || "").toLowerCase();
          const qLower = searchVal.toLowerCase();
          return (cleanQuery && phone.includes(cleanQuery)) || name.includes(qLower);
        });

        if (matched) {
          setMember({ id: matched.id, ...matched.data() } as Member);
        } else {
          setErrorMsg(
            language === "id"
              ? "Member tidak ditemukan. Pastikan nama lengkap atau nomor WhatsApp sudah benar."
              : "Member not found. Please verify the name or WhatsApp number."
          );
        }
      }
    } catch (e) {
      console.error("Lookup error:", e);
      setErrorMsg(language === "id" ? "Terjadi kesalahan koneksi." : "A connection error occurred.");
    } finally {
      setIsSearching(false);
    }
  };

  const getDynamicStatus = (expDate: string | Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expDate);
    exp.setHours(0, 0, 0, 0);
    const diffTime = exp.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return "Expired";
    } else if (diffDays <= 3) {
      return language === "id" ? "Hampir Expired" : "Almost Expired";
    } else {
      return language === "id" ? "Aktif" : "Active";
    }
  };

  const formatDate = (dateString: string | Date) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  };

  const handleDownload = async () => {
    const el = document.getElementById("digital-card-export");
    if (!el || !member) return;
    const canvas = await html2canvas(el, { scale: 3, backgroundColor: null });
    const data = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `SynFit_Card_${member.nama}.png`;
    link.href = data;
    link.click();
  };

  return (
    <div className="min-h-screen bg-[#050505] text-foreground flex flex-col relative overflow-hidden">
      {/* Background Ornaments */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-orange-600/10 rounded-full blur-[120px] -translate-y-1/3 translate-x-1/3 z-0" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-red-600/5 rounded-full blur-[120px] translate-y-1/3 -translate-x-1/3 z-0" />

      {/* Header */}
      <header
        className={`relative z-10 w-full px-6 py-4 flex justify-between items-center border-b transition-colors duration-300 ${
          isDark
            ? "bg-gradient-to-r from-orange-600 via-[#FF5A2C] to-orange-700 text-white border-orange-500/30 shadow-md shadow-orange-950/20"
            : "bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white border-blue-500/30 shadow-md shadow-blue-900/15"
        }`}
      >
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white p-1 flex items-center justify-center shadow-sm">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-extrabold text-white text-lg tracking-tight leading-none">SynFit</h1>
              <p className="text-[9px] text-white/80 font-black tracking-widest uppercase mt-0.5">
                {language === 'id' ? 'KARTU MEMBER' : 'CUSTOMER MEMBER'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="px-3 py-1.5 bg-white/15 border border-white/25 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/25 transition-all flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>{language === "id" ? "Beranda" : "Home"}</span>
            </Link>

            {/* Language Switcher */}
            <button
              onClick={() => setLanguage(language === "id" ? "en" : "id")}
              className="px-3 py-1.5 bg-white/15 border border-white/25 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/25 transition-all"
            >
              {language === "id" ? "EN" : "ID"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 w-full max-w-lg md:max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full text-center space-y-3 mb-8 max-w-lg"
        >
          <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight heading-font">
            {language === "id" ? "Cek Member Card" : "Check Member Card"}
          </h2>
          <p className="text-xs text-gray-400 font-medium leading-relaxed max-w-xs mx-auto">
            {language === "id"
              ? "Masukkan Nama Lengkap atau Nomor WhatsApp Anda untuk melihat kartu member digital."
              : "Enter your full name or WhatsApp number to lookup your digital member card."}
          </p>
        </motion.div>

        {/* Lookup Form */}
        <div className="w-full glass-card p-6 mb-8 max-w-lg">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 group-focus-within:text-[#FF5A2C] transition-colors" />
              <Input
                placeholder={language === "id" ? "Nama Lengkap / WhatsApp..." : "Full Name / WhatsApp..."}
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                className="pl-14 h-14 bg-black/30 border-white/10 text-white placeholder:text-gray-600 w-full focus-visible:ring-1 focus-visible:ring-[#FF5A2C]/30 rounded-2xl font-bold"
              />
            </div>
            <Button
              type="submit"
              disabled={isSearching}
              className="w-full h-14 bg-gradient-to-r from-[#FF5A2C] to-red-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-orange-500/15 active:scale-[0.98] transition-all"
            >
              {isSearching ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : language === "id" ? (
                "CARI MEMBER"
              ) : (
                "LOOKUP MEMBER"
              )}
            </Button>
          </form>
        </div>

        {/* Results section */}
        <AnimatePresence mode="wait">
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold text-center rounded-2xl max-w-lg"
            >
              {errorMsg}
            </motion.div>
          )}

          {member && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-start mt-6"
            >
              {/* Digital Card Preview */}
              <div className="relative">
                <DigitalCard
                  memberId={member.id}
                  name={member.nama}
                  status={getDynamicStatus(member.tanggal_expired)}
                  qrToken={member.qr_token}
                  expiredAt={formatDate(member.tanggal_expired)}
                />
              </div>

              {/* Status Badge & Actions */}
              <div className="glass-card p-6 space-y-4 w-full">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    {language === "id" ? "Status Membership" : "Membership Status"}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getDynamicStatus(member.tanggal_expired) === "Expired"
                      ? "bg-red-500/10 text-red-500 border border-red-500/20"
                      : getDynamicStatus(member.tanggal_expired) === (language === "id" ? "Hampir Expired" : "Almost Expired")
                        ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
                        : "bg-teal-500/10 text-teal-500 border border-teal-500/20"
                      }`}
                  >
                    {getDynamicStatus(member.tanggal_expired)}
                  </span>
                </div>

                <div className="border-t border-white/5 my-2" />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                      {language === "id" ? "TANGGAL DAFTAR" : "JOINED DATE"}
                    </p>
                    <p className="text-xs font-bold text-white uppercase">{formatDate(member.tanggal_daftar)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                      {language === "id" ? "BERLAKU SAMPAI" : "VALID UNTIL"}
                    </p>
                    <p className="text-xs font-bold text-white uppercase">{formatDate(member.tanggal_expired)}</p>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleDownload}
                    className="w-full h-14 bg-white/5 border border-white/10 text-white font-black uppercase text-xs tracking-widest rounded-2xl hover:bg-white/10 transition-all"
                  >
                    <Download className="h-5 w-5 mr-2" />
                    {language === "id" ? "UNDUH KARTU" : "DOWNLOAD CARD"}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer
        className={`relative z-10 w-full py-8 text-center border-t text-[10px] font-black uppercase tracking-[0.25em] transition-colors duration-300 ${
          isDark
            ? "bg-gradient-to-r from-orange-600 via-[#FF5A2C] to-orange-700 border-orange-500/30 text-white"
            : "bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 border-blue-500/30 text-white"
        }`}
      >
        Â© {new Date().getFullYear()} SynFit. All rights reserved.
      </footer>
    </div>
  );
}
