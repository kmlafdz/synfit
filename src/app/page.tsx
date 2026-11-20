"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/lib/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dumbbell,
  Users,
  MapPin,
  Clock,
  Phone,
  Globe,
  Plus,
  ArrowRight,
  Search,
  Check,
  Download,
  Loader2,
  X,
  CreditCard,
  MessageSquare,
  Shield,
  Activity,
  Award,
  Sparkles,
  Wifi,
  Menu
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useLanguage } from "@/store/useLanguageStore";
import { translations } from "@/lib/translations";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, serverTimestamp, doc, getDoc, query, where } from "firebase/firestore";
import { DigitalCard } from "@/components/DigitalCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import html2canvas from "html2canvas";
import { toast } from "sonner";

export default function LandingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { language } = useLanguage();
  const t = translations[language];

  const [activeSection, setActiveSection] = useState<string>("hero");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const [qrisUrl, setQrisUrl] = useState<string>("");

  useEffect(() => {
    const fetchQris = async () => {
      try {
        const configSnap = await getDoc(doc(db, "configs", "gym"));
        if (configSnap.exists()) {
          setQrisUrl(configSnap.data().qris_image_url || "");
        }
      } catch (error) {
        console.error("Failed to load QRIS image:", error);
      }
    };
    fetchQris();
  }, []);

  const handleDownloadQris = async () => {
    if (!qrisUrl) return;
    try {
      // 1. Try downloading via server proxy endpoint for guaranteed Content-Disposition
      const proxyUrl = `/api/download-qris?url=${encodeURIComponent(qrisUrl)}`;
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = "SynFit_Official_QRIS.png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        toast.success(language === "id" ? "QRIS berhasil diunduh!" : "QRIS downloaded successfully!");
        return;
      }
    } catch (e) {
      // Fallback
    }

    try {
      // 2. Client-side fetch fallback
      const response = await fetch(qrisUrl, { mode: "cors" });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "SynFit_Official_QRIS.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(language === "id" ? "QRIS berhasil diunduh!" : "QRIS downloaded successfully!");
    } catch (error) {
      // 3. Direct new window fallback for mobile browsers
      window.open(qrisUrl, "_blank");
    }
  };

  useEffect(() => {
    const sections = ["hero", "features", "packages", "contact"];
    const observers = sections.map((id) => {
      const el = document.getElementById(id);
      if (!el) return null;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(id);
          }
        },
        {
          threshold: 0.2,
          rootMargin: "-25% 0px -40% 0px"
        }
      );
      observer.observe(el);
      return { observer, el };
    });

    return () => {
      observers.forEach((obs) => {
        if (obs) obs.observer.unobserve(obs.el);
      });
    };
  }, []);

  const [sparks, setSparks] = useState<{ id: number; x: number; size: number; duration: number; delay: number; drift: number }[]>([]);

  useEffect(() => {
    // Generate sparks only on client side
    const generatedSparks = Array.from({ length: 35 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100, // percentage 0-100
      size: Math.random() * 3.5 + 1.5, // size 1.5px to 5px
      duration: Math.random() * 6 + 6, // duration 6s to 12s
      delay: Math.random() * 8, // delay 0s to 8s
      drift: Math.random() * 100 - 50, // horizontal drift
    }));
    setSparks(generatedSparks);
  }, []);



  // Forms and actions
  const [formData, setFormData] = useState({
    nama: "",
    nomor_whatsapp: "",
    alamat: "",
    membership_type: "1 Bulan",
    payment_method: "Bayar di Kasir",
    bukti_pembayaran: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // Phone input formatting
  const handlePhoneChange = (val: string) => {
    const clean = val.replace(/\D/g, "");
    if (clean.length > 15) return;
    setFormData({ ...formData, nomor_whatsapp: clean });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, bukti_pembayaran: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let cleanPhone = formData.nomor_whatsapp.replace(/\D/g, "");
      if (cleanPhone.startsWith("0")) cleanPhone = "62" + cleanPhone.substring(1);

      if (cleanPhone.length < 7) {
        toast.warning(language === 'id' ? "Nomor WhatsApp tidak valid." : "Invalid WhatsApp number.");
        setIsSubmitting(false);
        return;
      }

      // Check if duplicate WhatsApp exists in active members or pending registrations
      try {
        const checkRes = await fetch("/api/membership/check-phone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ whatsapp: cleanPhone }),
        });
        const contentType = checkRes.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const checkData = await checkRes.json();
          if (checkRes.ok && checkData.success) {
            if (checkData.isRegistered) {
              toast.warning(language === 'id'
                ? "Nomor WhatsApp ini sudah terdaftar sebagai member aktif."
                : "This WhatsApp number is already registered as an active member.");
              setIsSubmitting(false);
              return;
            }
            if (checkData.isPending) {
              toast.warning(language === 'id'
                ? "Pendaftaran dengan nomor WhatsApp ini sedang menunggu persetujuan."
                : "A registration with this WhatsApp number is already pending approval.");
              setIsSubmitting(false);
              return;
            }
          }
        }
      } catch (checkErr) {
        // Client-side fallback for static Firebase Hosting
        try {
          const qMem = query(collection(db, "members"), where("nomor_whatsapp", "==", cleanPhone));
          const snapMem = await getDocs(qMem);
          if (!snapMem.empty) {
            toast.warning(language === 'id'
              ? "Nomor WhatsApp ini sudah terdaftar sebagai member aktif."
              : "This WhatsApp number is already registered as an active member.");
            setIsSubmitting(false);
            return;
          }
        } catch (e) {}
      }

      let amount = 160000;
      if (formData.membership_type === "3 Bulan") {
        amount = 480000;
      }

      // Save registration request to Registrations collection
      await addDoc(collection(db, "registrations"), {
        nama: formData.nama,
        nomor_whatsapp: cleanPhone,
        alamat: formData.alamat,
        membership_type: formData.membership_type,
        payment_method: formData.payment_method,
        bukti_pembayaran: formData.bukti_pembayaran || null,
        status: "Pending",
        amount: amount,
        created_at: serverTimestamp(),
      });

      setShowRegisterModal(false);
      setShowSuccessModal(true);
      setFormData({
        nama: "",
        nomor_whatsapp: "",
        alamat: "",
        membership_type: "1 Bulan",
        payment_method: "Bayar di Kasir",
        bukti_pembayaran: "",
      });
    } catch (error) {
      console.error(error);
      toast.error(language === "id" ? "Pendaftaran gagal, coba lagi." : "Registration failed, please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      setActiveSection(id);
    }
  };

  return (
    <div className="dark min-h-screen bg-[#050505] text-white selection:bg-[#FF5A2C]/30 font-sans relative overflow-x-hidden">

      {/* Background Animated Blobs */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Blob 1: Orange-Red (Brand Primary) */}
        <motion.div
          animate={{
            x: [0, 80, -40, 0],
            y: [0, 100, 50, 0],
            scale: [1, 1.15, 0.9, 1],
            rotate: [0, 90, 180, 0]
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{
            background: "radial-gradient(circle, rgba(255, 90, 44, 0.25) 0%, rgba(220, 38, 38, 0.15) 100%)"
          }}
          className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[100px] -translate-y-1/3 translate-x-1/3"
        />

        {/* Blob 2: Deep Blue (Contrast Accent) */}
        <motion.div
          animate={{
            x: [0, -120, 80, 0],
            y: [0, 80, -100, 0],
            scale: [1, 1.25, 0.85, 1],
            rotate: [0, -120, 120, 0]
          }}
          transition={{
            duration: 32,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{
            background: "radial-gradient(circle, rgba(37, 99, 235, 0.2) 0%, rgba(29, 78, 216, 0.1) 100%)"
          }}
          className="absolute top-[25%] left-0 w-[700px] h-[700px] rounded-full blur-[120px] -translate-x-1/3"
        />

        {/* Blob 3: Vibrant Amber/Yellow */}
        <motion.div
          animate={{
            x: [0, 100, -100, 0],
            y: [0, -60, 120, 0],
            scale: [0.9, 1.1, 0.9, 0.9],
            rotate: [0, 180, 360, 0]
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{
            background: "radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.08) 100%)"
          }}
          className="absolute bottom-[20%] right-[10%] w-[550px] h-[550px] rounded-full blur-[100px]"
        />

        {/* Blob 4: Soft Purple */}
        <motion.div
          animate={{
            x: [0, -70, 70, 0],
            y: [0, 90, 60, 0],
            scale: [1, 0.8, 1.25, 1],
          }}
          transition={{
            duration: 28,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{
            background: "radial-gradient(circle, rgba(124, 58, 237, 0.12) 0%, rgba(109, 40, 217, 0.05) 100%)"
          }}
          className="absolute bottom-0 left-[20%] w-[500px] h-[500px] rounded-full blur-[110px]"
        />
      </div>

      {/* Flying Fire Sparks/Embers Effect */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {sparks.map((spark) => (
          <motion.div
            key={spark.id}
            initial={{
              opacity: 0,
              y: "105vh",
              x: `${spark.x}vw`,
              scale: 1
            }}
            animate={{
              opacity: [0, 0.8, 0.8, 0],
              y: "-5vh",
              x: [`${spark.x}vw`, `${spark.x}vw`, `${spark.x + (spark.drift / 10)}vw`],
              scale: [1, 1.2, 0.8, 0.5]
            }}
            transition={{
              duration: spark.duration,
              delay: spark.delay,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute rounded-full"
            style={{
              width: `${spark.size}px`,
              height: `${spark.size}px`,
              background: "linear-gradient(to bottom, #FF8A00, #FF3D00)",
              boxShadow: "0 0 8px #FF3D00, 0 0 16px #FF8A00",
              filter: "blur(0.5px)"
            }}
          />
        ))}
      </div>

      {/* Navigation Bar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-black/40 backdrop-blur-xl border-b border-white/5 py-4">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => scrollToSection("hero")}>
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/10 p-1 flex items-center justify-center">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-extrabold text-white text-lg tracking-tight leading-none">SynFit</h1>
              <p className="text-[9px] text-[#FF5A2C] font-black tracking-widest uppercase mt-0.5">Your AI Gym Partner</p>
            </div>
          </div>

          {/* Nav Links */}
          <div className="hidden md:flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-gray-400">
            <button
              onClick={() => scrollToSection("hero")}
              className={`px-4 py-2 rounded-xl transition-all duration-300 font-black tracking-widest uppercase text-[10px] ${
                activeSection === "hero"
                  ? "bg-white/10 border border-white/10 text-[#FF5A2C] shadow-lg shadow-black/20"
                  : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection("features")}
              className={`px-4 py-2 rounded-xl transition-all duration-300 font-black tracking-widest uppercase text-[10px] ${
                activeSection === "features"
                  ? "bg-white/10 border border-white/10 text-[#FF5A2C] shadow-lg shadow-black/20"
                  : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              {language === "id" ? "Fasilitas" : "Facilities"}
            </button>
            <button
              onClick={() => scrollToSection("packages")}
              className={`px-4 py-2 rounded-xl transition-all duration-300 font-black tracking-widest uppercase text-[10px] ${
                activeSection === "packages"
                  ? "bg-white/10 border border-white/10 text-[#FF5A2C] shadow-lg shadow-black/20"
                  : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              {language === "id" ? "Paket Membership" : "Membership Packages"}
            </button>
            <button
              onClick={() => scrollToSection("contact")}
              className={`px-4 py-2 rounded-xl transition-all duration-300 font-black tracking-widest uppercase text-[10px] ${
                activeSection === "contact"
                  ? "bg-white/10 border border-white/10 text-[#FF5A2C] shadow-lg shadow-black/20"
                  : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              {language === "id" ? "Hubungi" : "Contact"}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {user ? (
              <button
                onClick={() => router.push("/admin/dashboard")}
                className="px-5 py-2.5 bg-[#FF5A2C] hover:brightness-110 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-orange-500/10 active:scale-95"
              >
                Dashboard
              </button>
            ) : (
              <button
                onClick={() => router.push("/login/member")}
                className="px-5 py-2.5 bg-gradient-to-r from-[#FF5A2C] to-red-600 hover:brightness-110 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-orange-500/10 active:scale-95 transition-all"
              >
                {language === "id" ? "Masuk" : "Login"}
              </button>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-all active:scale-95"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="md:hidden border-t border-white/5 bg-black/95 backdrop-blur-2xl px-6 py-4 space-y-2 mt-4"
            >
              <button
                onClick={() => {
                  scrollToSection("hero");
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 rounded-xl font-black tracking-widest uppercase text-xs transition-all ${
                  activeSection === "hero"
                    ? "bg-white/10 text-[#FF5A2C]"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                Home
              </button>
              <button
                onClick={() => {
                  scrollToSection("features");
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 rounded-xl font-black tracking-widest uppercase text-xs transition-all ${
                  activeSection === "features"
                    ? "bg-white/10 text-[#FF5A2C]"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {language === "id" ? "Fasilitas" : "Facilities"}
              </button>
              <button
                onClick={() => {
                  scrollToSection("packages");
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 rounded-xl font-black tracking-widest uppercase text-xs transition-all ${
                  activeSection === "packages"
                    ? "bg-white/10 text-[#FF5A2C]"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {language === "id" ? "Paket Membership" : "Membership Packages"}
              </button>
              <button
                onClick={() => {
                  scrollToSection("contact");
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 rounded-xl font-black tracking-widest uppercase text-xs transition-all ${
                  activeSection === "contact"
                    ? "bg-white/10 text-[#FF5A2C]"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {language === "id" ? "Hubungi" : "Contact"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section id="hero" className="relative z-10 pt-24 pb-12 max-w-7xl mx-auto px-6 grid md:grid-cols-12 gap-8 items-center min-h-screen scroll-mt-[76px] overflow-hidden">
        <div className="md:col-span-7 space-y-6 text-left">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-4"
          >
            <div className="inline-flex items-center space-x-2 bg-orange-500/10 border border-orange-500/20 px-4 py-1.5 rounded-full text-[10px] font-black text-[#FF5A2C] uppercase tracking-widest">
              <Sparkles className="h-3 w-3" />
              <span>{language === 'id' ? 'KESEHATAN & KEBUGARAN PREMIUM' : 'PREMIUM FITNESS CENTRE'}</span>
            </div>

            <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white uppercase leading-[0.95] tracking-tighter heading-font">
              Shape Your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF5A2C] to-red-600">Ultimate Body</span>
            </h2>

            <p className="text-gray-400 text-sm sm:text-base font-medium max-w-xl leading-relaxed mt-3">
              {language === 'id'
                ? 'Latih tubuh Anda di SynFit dengan peralatan modern, instruktur ahli, dan kelola keanggotaan Anda secara instan menggunakan Kartu Digital pintar.'
                : 'Train your body at SynFit with top-notch equipment, certified expert coaches, and instantly access your details with our premium smart Digital Card.'}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <button
              onClick={() => router.push("/membership?tab=register")}
              className="px-8 py-4 bg-gradient-to-r from-[#FF5A2C] to-red-600 hover:brightness-110 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
            >
              {language === 'id' ? 'Daftar Sekarang' : 'Register Now'}
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              onClick={() => router.push("/login/member")}
              className="px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              <Users className="h-4 w-4" />
              {language === 'id' ? 'Sudah Membership' : 'Already Member'}
            </button>
          </motion.div>
        </div>

        {/* Interactive Gym Images Accordion */}
        <div className="md:col-span-5 flex justify-center relative w-full h-full max-h-[500px]">
          {/* Background Glow behind Accordion */}
          <div className="absolute w-80 h-80 bg-[#FF5A2C]/15 rounded-full blur-[90px] -top-10 -left-10 z-0 pointer-events-none" />
          <div className="absolute w-80 h-80 bg-blue-600/10 rounded-full blur-[110px] -bottom-10 -right-10 z-0 pointer-events-none" />

          {/* Accordion Wrapper */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-[500px] h-[340px] xs:h-[380px] sm:h-[420px] md:h-auto md:aspect-[4/3] flex gap-3 rounded-[2.5rem] overflow-hidden border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] z-10 p-1.5 bg-black/25 backdrop-blur-sm"
          >
            {[
              {
                img: "/anime_1.png",
                tag: "STRENGTH",
                title: language === "id" ? "Batas Hanya Ilusi" : "Limits are Illusions",
                desc: language === "id"
                  ? "Semakin keras perjuanganmu, semakin nyata kekuatanmu."
                  : "The harder the struggle, the more real your power becomes."
              },
              {
                img: "/anime_2.png",
                tag: "CONSISTENCY",
                title: language === "id" ? "Konsistensi adalah Kunci" : "Consistency is Key",
                desc: language === "id"
                  ? "Latihan hari ini menentukan hasil hari esok. Jangan menyerah."
                  : "Today's training decides tomorrow's results. Never surrender."
              },
              {
                img: "/anime_3.png",
                tag: "MINDSET",
                title: language === "id" ? "Fokus & Taklukan" : "Focus & Conquer",
                desc: language === "id"
                  ? "Pikiran Anda mengendalikan tubuh. Tembus segala batas."
                  : "Your mind controls your body. Break through every barrier."
              }
            ].map((motto, idx) => {
              const isActive = hoveredIdx === idx || selectedIdx === idx;
              const anyActive = hoveredIdx !== null || selectedIdx !== null;

              return (
                <div
                  key={idx}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
                  style={{
                    flex: isActive ? 3.5 : (anyActive ? 0.75 : 1)
                  }}
                  className="relative h-full rounded-[1.75rem] overflow-hidden transition-all duration-500 ease-out border border-white/5 cursor-pointer group"
                >
                  {/* Image */}
                  <img
                    src={motto.img}
                    alt={motto.tag}
                    className={`w-full h-full object-cover transition-all duration-700 ${isActive ? "grayscale-0 contrast-[110%] brightness-[85%] scale-105" : "grayscale-[40%] contrast-[95%] brightness-[60%] scale-100"
                      }`}
                  />

                  {/* Gradient blend overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/30 to-transparent pointer-events-none z-10" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/15 via-transparent to-[#050505]/15 pointer-events-none z-10" />

                  {/* Static Title (Visible only when not hovered/focused) */}
                  <div
                    className={`absolute inset-x-0 bottom-6 text-center z-20 transition-all duration-300 pointer-events-none ${isActive ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
                      }`}
                  >
                    <span className="px-2.5 py-1 bg-black/60 backdrop-blur-md border border-white/10 text-[10px] sm:text-xs font-black text-[#FF5A2C] uppercase tracking-widest rounded-full">
                      {motto.tag}
                    </span>
                  </div>

                  {/* Motto Glass Card Overlay (Revealed when hovered or tapped) */}
                  <div
                    className={`absolute inset-x-3 bottom-3 p-3.5 sm:p-4 rounded-2xl bg-black/75 backdrop-blur-md border border-white/10 z-20 text-left transition-all duration-500 select-none ${isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
                      }`}
                  >
                    <p className="text-[10px] sm:text-[11px] font-black text-[#FF5A2C] tracking-widest uppercase">
                      {motto.tag} MOTTO
                    </p>
                    <h4 className="text-[13px] sm:text-[14px] font-black text-white uppercase mt-1 leading-tight">
                      {motto.title}
                    </h4>
                    <p className="text-[11px] sm:text-[12px] text-gray-300 font-medium mt-1 leading-relaxed italic">
                      "{motto.desc}"
                    </p>
                  </div>

                </div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Facilities Section */}
      <section id="features" className="bg-[#0a0a0a]/50 pt-16 pb-16 md:pt-20 md:pb-20 border-y border-white/5 relative z-10 min-h-screen flex flex-col justify-start scroll-mt-[76px]">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-8 md:space-y-10">
          <div className="space-y-3">
            <p className="text-[10px] font-black text-[#FF5A2C] uppercase tracking-[0.25em]">{language === 'id' ? 'SARANA & KENYAMANAN LATIHAN' : 'FACILITIES & AMENITIES'}</p>
            <h2 className="text-3xl sm:text-5xl font-black text-white uppercase heading-font tracking-tight">{language === 'id' ? 'Fasilitas Gym' : 'Gym Facilities'}</h2>
            <div className="h-1 w-20 bg-[#FF5A2C] mx-auto mt-4 rounded-full" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: "Strength Area", img: "/landing/facility_strength.jpg", desc: language === 'id' ? "Koleksi dumbbell lengkap, barbel, smith machine, dan power rack." : "Complete free weights, dumbbells, smith machines, and power racks." },
              { title: "Cardio Zone", img: "/landing/facility_cardio.jpg", desc: language === 'id' ? "Treadmill elektrik, static bike, dan elliptical trainer terawat." : "Maintained electric treadmills, stationary bikes, and elliptical trainers." },
              { title: "AC & Wi-Fi Area", img: "/landing/facility_floor.jpg", desc: language === 'id' ? "Ruangan ber-AC nyaman dengan akses internet Wi-Fi gratis untuk member." : "Air-conditioned workout floor with free Wi-Fi for all members." },
              { title: "Loker & Shower", img: "/landing/facility_locker.jpg", desc: language === 'id' ? "Loker penyimpanan barang, kamar ganti, dan kamar mandi bersih." : "Personal storage lockers, clean restrooms, and shower facilities." }
            ].map((facility, idx) => (
              <article key={idx} className="group text-left rounded-3xl overflow-hidden border border-white/10 bg-[#0D111A] hover:border-[#FF5A2C]/40 transition-colors duration-300">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={facility.img}
                    alt={facility.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0D111A] via-transparent to-transparent" />
                </div>
                <div className="p-5 space-y-2">
                  <h3 className="text-lg font-black text-white uppercase heading-font">{facility.title}</h3>
                  <p className="text-xs text-gray-400 font-medium leading-relaxed">{facility.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Packages Section */}
      <section id="packages" className="pt-16 pb-16 md:pt-20 md:pb-20 relative z-10 min-h-screen flex flex-col justify-start scroll-mt-[76px]">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-8 md:space-y-10">
          <div className="space-y-3">
            <p className="text-[10px] font-black text-[#FF5A2C] uppercase tracking-[0.25em]">{language === 'id' ? 'PILIHAN KEANGGOTAAN' : 'MEMBERSHIP OPTIONS'}</p>
            <h2 className="text-3xl sm:text-5xl font-black text-white uppercase heading-font tracking-tight">{language === 'id' ? 'Paket Membership' : 'Membership Plans'}</h2>
            <div className="h-1 w-20 bg-[#FF5A2C] mx-auto mt-4 rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* 1 Month Package */}
            <div className="rounded-[2rem] backdrop-blur-[40px] bg-gradient-to-br from-white/[0.05] to-white/[0.01] p-6 sm:p-8 text-left flex flex-col justify-between border border-white/10 hover:border-orange-500/30 relative overflow-hidden group shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] transition-all duration-300">
              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-black uppercase heading-font text-white">1 Month Pass</h3>
                    <p className="text-[10px] font-black text-[#FF5A2C] tracking-widest uppercase mt-1">STANDARD ACCESS</p>
                  </div>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-black heading-font text-white">Rp 160.000</span>
                  <span className="text-xs text-gray-500 font-bold uppercase">/ {language === 'id' ? 'Bulan' : 'Month'}</span>
                </div>

                <ul className="space-y-3 pt-4 border-t border-white/5 text-xs text-gray-400 font-medium">
                  {(language === 'id'
                    ? ["Akses ke Area Strength & Cardio", "Gratis Loker & Shower", "Akses Wi-Fi Kecepatan Tinggi", "Digital Member Card Instan"]
                    : ["Access to Strength & Cardio Area", "Free Locker & Shower", "High-Speed Wi-Fi Access", "Instant Digital Member Card"]
                  ).map((benefit, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="h-5 w-5 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-[#FF5A2C]" />
                      </div>
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                onClick={() => {
                  setFormData({ ...formData, membership_type: "1 Bulan" });
                  setShowRegisterModal(true);
                }}
                className="w-full h-14 bg-white/5 border border-white/10 hover:bg-[#FF5A2C] hover:border-transparent text-white font-black uppercase text-xs tracking-widest rounded-2xl transition-all mt-5"
              >
                {language === 'id' ? 'Pilih Paket' : 'Choose Package'}
              </Button>
            </div>

            {/* 3 Month Package */}
            <div className="rounded-[2rem] backdrop-blur-[40px] p-6 sm:p-8 text-left flex flex-col justify-between border-2 border-[#FF5A2C]/30 bg-gradient-to-b from-orange-950/10 via-black/50 to-black/70 relative overflow-hidden group shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] transition-all duration-300">
              <div className="absolute top-0 right-0 bg-[#FF5A2C] text-white font-black text-[9px] uppercase tracking-widest px-4 py-2 rounded-bl-2xl">
                {language === 'id' ? 'BEST VALUE' : 'BEST SAVINGS'}
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-black uppercase heading-font text-white">3 Months Pass</h3>
                    <p className="text-[10px] font-black text-[#FF5A2C] tracking-widest uppercase mt-1">UNLIMITED ACCESS</p>
                  </div>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-black heading-font text-white">Rp 480.000</span>
                  <span className="text-xs text-gray-500 font-bold uppercase">/ 3 {language === 'id' ? 'Bulan' : 'Months'}</span>
                </div>

                <ul className="space-y-3 pt-4 border-t border-white/5 text-xs text-gray-400 font-medium">
                  {(language === 'id'
                    ? ["Semua benefit Paket 1 Bulan", "Prioritas Pendaftaran Layanan", "Akses Prioritas Acara Gym", "Lebih Hemat & Terdokumentasi"]
                    : ["All 1-Month Pass benefits", "Priority Service Registration", "Priority Gym Event Access", "More Savings & Documented"]
                  ).map((benefit, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="h-5 w-5 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-[#FF5A2C]" />
                      </div>
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                onClick={() => {
                  setFormData({ ...formData, membership_type: "3 Bulan" });
                  setShowRegisterModal(true);
                }}
                className="w-full h-14 bg-gradient-to-r from-[#FF5A2C] to-red-600 hover:brightness-110 text-white font-black uppercase text-xs tracking-widest rounded-2xl transition-all shadow-xl shadow-orange-500/10 mt-5"
              >
                {language === 'id' ? 'Pilih Paket' : 'Choose Package'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="bg-[#0a0a0a]/50 pt-16 pb-16 md:pt-20 md:pb-20 border-t border-white/5 relative z-10 min-h-screen flex flex-col justify-start scroll-mt-[76px]">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-8 text-left">
            <div className="space-y-3">
              <p className="text-[10px] font-black text-[#FF5A2C] uppercase tracking-[0.25em]">{language === 'id' ? 'LOKASI & OPERASIONAL' : 'Operational Info'}</p>
              <h2 className="text-3xl sm:text-5xl font-black text-white uppercase heading-font tracking-tight">{language === 'id' ? 'Kunjungi Gym Kami' : 'Find Us Today'}</h2>
              <div className="h-1 w-20 bg-[#FF5A2C] mt-4 rounded-full" />
            </div>

            <p className="text-gray-400 text-sm font-medium leading-relaxed max-w-md">
              {language === 'id'
                ? 'Kami siap menyambut dan mendampingi Anda mencapai target kebugaran impian. Silakan hubungi kami untuk informasi lebih lanjut.'
                : 'We are fully prepared to support your ultimate physical transition. Contact our fitness advisors for detailed program information.'}
            </p>

            <div className="space-y-4 font-bold text-xs uppercase tracking-widest text-gray-300">
              <a
                href="https://maps.app.goo.gl/7MBeXXVhrq1V4r1HA"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 hover:opacity-80 transition-opacity group"
              >
                <div className="h-10 w-10 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center shrink-0 group-hover:border-[#FF5A2C]/50 transition-colors">
                  <MapPin className="h-5 w-5 text-[#FF5A2C]" />
                </div>
                <div>
                  <p className="text-[9px] text-gray-500 font-bold">{language === 'id' ? 'ALAMAT' : 'ADDRESS'}</p>
                  <p className="text-white text-left">Blok E8. 15, Perum Alamanda Regency Jl. Edelweis No.15, Karangsatria, Kec. Tambun Utara, Kabupaten Bekasi, Jawa Barat 17568</p>
                </div>
              </a>

              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-[#FF5A2C]" />
                </div>
                <div>
                  <p className="text-[9px] text-gray-500 font-bold">{language === 'id' ? 'JAM OPERASIONAL' : 'WORKING HOURS'}</p>
                  <p className="text-white">{language === 'id' ? 'Senin - Minggu: 08.00 - 21.00 WIB' : 'Mon - Sun: 08.00 AM - 09.00 PM'}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center shrink-0">
                  <Phone className="h-5 w-5 text-[#FF5A2C]" />
                </div>
                <div>
                  <p className="text-[9px] text-gray-500 font-bold">{language === 'id' ? 'KONSULTASI WHATSAPP' : 'WHATSAPP ADVISOR'}</p>
                  <p className="text-white">+62 895-2802-2044</p>
                </div>
              </div>
            </div>
          </div>

          {/* Front Desk Photo + Social Section */}
          <div className="rounded-3xl overflow-hidden border border-white/10 bg-[#0D111A] text-center">
            <div className="relative aspect-[16/10] overflow-hidden">
              <img
                src="/landing/gym_reception.jpg"
                alt={language === 'id' ? 'Meja resepsionis SynFit' : 'SynFit front desk'}
                loading="lazy"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D111A] via-transparent to-transparent" />
            </div>
          <div className="p-6 sm:p-8 space-y-4">
            <h3 className="text-lg font-black uppercase heading-font text-white">{language === 'id' ? 'Terhubung dengan Komunitas' : 'Join the Community'}</h3>
            <p className="text-xs text-gray-400 font-medium">{language === 'id' ? 'Ikuti Instagram kami untuk update promo, jadwal gym, dan tips kesehatan.' : 'Follow our official channels for fitness updates, coaching advice, and discount events.'}</p>

            <div className="flex justify-center gap-4 pt-4">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="h-14 w-14 rounded-2xl bg-white/5 hover:bg-[#FF5A2C] border border-white/10 hover:border-transparent flex items-center justify-center text-white transition-all">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </a>
              <a href="https://wa.me/6281234567890" target="_blank" rel="noreferrer" className="h-14 w-14 rounded-2xl bg-white/5 hover:bg-[#25D366] border border-white/10 hover:border-transparent flex items-center justify-center text-white transition-all">
                <MessageSquare className="h-6 w-6" />
              </a>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* Online Registration Modal */}
      <AnimatePresence>
        {showRegisterModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#0d0d12] border border-white/10 p-6 sm:p-8 shadow-2xl rounded-[2.5rem] relative max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#FF5A2C]/10 blur-[60px] rounded-full" />

              <div className="flex justify-between items-center mb-8 relative z-10">
                <div>
                  <p className="text-[10px] font-black text-[#FF5A2C] tracking-widest uppercase mb-1">{language === 'id' ? 'DAFTAR ONLINE' : 'ONLINE MEMBERSHIP'}</p>
                  <h2 className="text-2xl font-black text-white heading-font uppercase">{language === 'id' ? 'Registrasi Member' : 'Member Registration'}</h2>
                </div>
                <button onClick={() => setShowRegisterModal(false)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-gray-400 transition-all"><X className="h-5 w-5" /></button>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-6 relative z-10">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 tracking-widest uppercase ml-1">{language === 'id' ? 'Nama Lengkap' : 'Full Name'}</label>
                  <Input required className="h-14 bg-[#14151f] border border-white/10 rounded-2xl text-white font-bold" value={formData.nama} onChange={(e) => setFormData({ ...formData, nama: e.target.value })} placeholder="e.g. Kemal Rizky" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 tracking-widest uppercase ml-1">WhatsApp (+62)</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-xs font-bold text-gray-400 border-r border-white/10 pr-2 pointer-events-none">
                      +62
                    </span>
                    <Input
                      required
                      type="tel"
                      pattern="[0-9]*"
                      className="h-14 bg-[#14151f] border border-white/10 rounded-2xl text-white font-bold pl-16"
                      value={formData.nomor_whatsapp.replace(/^(?:\+?62|0)/, "")}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="81234567890"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 tracking-widest uppercase ml-1">{language === 'id' ? 'Alamat Rumah' : 'Home Address'}</label>
                  <Input required className="h-14 bg-[#14151f] border border-white/10 rounded-2xl text-white font-bold" value={formData.alamat} onChange={(e) => setFormData({ ...formData, alamat: e.target.value })} placeholder="e.g. Jl. Sudirman No. 12" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 tracking-widest uppercase ml-1">{language === 'id' ? 'Pilih Paket' : 'Select Plan'}</label>
                  <select className="flex h-14 w-full rounded-2xl border border-white/10 bg-[#14151f] px-4 text-sm font-bold text-white appearance-none outline-none" value={formData.membership_type} onChange={(e) => setFormData({ ...formData, membership_type: e.target.value })}>
                    <option value="1 Bulan" className="bg-[#0d0d12]">1 Month Pass - Rp 160.000</option>
                    <option value="3 Bulan" className="bg-[#0d0d12]">3 Months Pass - Rp 480.000</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 tracking-widest uppercase ml-1">{language === 'id' ? 'Metode Pembayaran' : 'Payment Method'}</label>
                  <select className="flex h-14 w-full rounded-2xl border border-white/10 bg-[#14151f] px-4 text-sm font-bold text-white appearance-none outline-none" value={formData.payment_method} onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}>
                    <option value="Bayar di Kasir" className="bg-[#0d0d12]">{language === 'id' ? 'Bayar di Kasir' : 'Pay at Cashier'}</option>
                    <option value="QRIS" className="bg-[#0d0d12]">QRIS</option>
                  </select>
                </div>

                <AnimatePresence>
                  {formData.payment_method === "QRIS" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 border border-white/5 bg-black/20 p-4 rounded-2xl overflow-hidden"
                    >
                      <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest text-center">
                        {language === 'id' ? 'Pindai QRIS SynFit' : 'Scan SynFit QRIS'}
                      </p>
                      <div className="flex flex-col items-center gap-2">
                        {qrisUrl ? (
                          <div className="bg-white p-3 rounded-2xl shadow-xl w-40 h-40 flex items-center justify-center">
                            <img src={qrisUrl} alt="QRIS" className="max-w-full max-h-full object-contain no-invert" />
                          </div>
                        ) : (
                          /* Mock QRIS SVG */
                          <div className="bg-white p-3 rounded-2xl shadow-xl w-40 h-40 flex flex-col justify-between items-center">
                            <p className="text-[8px] font-black text-black leading-none uppercase select-none">
                              {language === 'id' ? 'PROMO QRIS' : 'QRIS PROMO'}
                            </p>
                            <svg className="w-28 h-28 text-black" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M3 3h6v6H3zm2 2v2h2V5zm8-2h6v6h-6zm2 2v2h2V5zM3 13h6v6H3zm2 2v2h2v-2zm8 0h2v2h-2zm4-2h2v2h-2zm2 2h2v2h-2zm-4 4h2v2h-2zm2-2h2v2h-2zm-6 2h2v2h-2zm4-4h2v2h-2z" />
                            </svg>
                            <p className="text-[7px] font-bold text-gray-500 leading-none">SynFit Gym</p>
                          </div>
                        )}

                        {qrisUrl && (
                          <button
                            type="button"
                            onClick={handleDownloadQris}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-bold text-[#FF5A2C] transition-all cursor-pointer shadow-sm active:scale-95"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{language === "id" ? "Unduh Gambar QRIS" : "Download QRIS Image"}</span>
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">
                          {language === 'id' ? 'Unggah Bukti Transfer' : 'Upload Payment Receipt'}
                        </label>
                        <input
                          type="file"
                          required
                          accept="image/*"
                          onChange={handleFileChange}
                          className="w-full text-xs text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-white/5 file:text-white hover:file:bg-white/10 cursor-pointer"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Button type="submit" className="w-full h-16 bg-gradient-to-r from-[#FF5A2C] to-red-600 text-white font-black uppercase rounded-2xl shadow-xl shadow-orange-500/20 active:scale-95 mt-4" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (language === 'id' ? 'DAFTARKAN DIRI' : 'SUBMIT REGISTRATION')}
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Modal / Pending Approval View */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-md bg-[#0d0d12] border border-white/10 p-8 rounded-[2.5rem] text-center space-y-6 relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#FF5A2C]/10 blur-[60px] rounded-full" />

              <div className="h-20 w-20 rounded-[2rem] bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto">
                <Clock className="h-10 w-10 text-[#FF5A2C] animate-pulse" />
              </div>

              <div className="space-y-2 relative z-10">
                <h3 className="text-2xl font-black text-white uppercase tracking-tight heading-font">{language === 'id' ? 'Menunggu Konfirmasi Admin' : 'Awaiting Approval'}</h3>
                <p className="text-xs text-gray-400 font-medium leading-relaxed">
                  {language === 'id'
                    ? 'Pendaftaran keanggotaan Anda telah berhasil terkirim dan saat ini sedang ditinjau oleh tim admin kami.'
                    : 'Your membership registration has been successfully submitted and is currently being reviewed by our admin team.'}
                </p>
                <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl text-[11px] text-gray-400 text-left mt-4 space-y-2 leading-relaxed">
                  <p>ðŸ“Œ <strong>{language === 'id' ? 'Info Akun Otomatis' : 'Auto Account Info'}:</strong></p>
                  <p>{language === 'id' ? 'Setelah admin menyetujui (approve), akun member Anda akan aktif secara otomatis.' : 'Once approved by the admin, your membership account will automatically activate.'}</p>
                  <p>{language === 'id' ? 'â€¢ Username / Login ID: Nomor WhatsApp Anda' : 'â€¢ Username / Login ID: Your WhatsApp Number'}</p>
                  <p>{language === 'id' ? 'â€¢ Password Default: ' : 'â€¢ Default Password: '}<code className="bg-white/10 px-1.5 py-0.5 rounded text-white font-mono font-bold">synfit123</code></p>
                  <p className="text-[10px] text-orange-500/90">
                    {language === 'id'
                      ? '*Anda dapat mengubah password ini setelah masuk ke Dashboard Member.'
                      : '*You can change this password after logging into the Member Dashboard.'}
                  </p>
                </div>
              </div>

              <div className="pt-2 relative z-10">
                <Button onClick={() => setShowSuccessModal(false)} className="w-full h-14 bg-white/5 border border-white/10 text-white font-black uppercase text-xs tracking-widest rounded-2xl hover:bg-white/10 transition-all">
                  {language === 'id' ? 'Tutup' : 'Close'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



      {/* Footer */}
      <footer className="bg-black py-12 border-t border-white/5 relative z-10 text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-white/10 p-0.5 flex items-center justify-center">
            <img src="/logo.png" alt="SynFit" className="w-full h-full object-contain" />
          </div>
          <span className="font-black text-sm tracking-tight text-white">SynFit</span>
        </div>
        <div className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">
          Â© {new Date().getFullYear()} SynFit. Developed by SynTriad Team.
        </div>
      </footer>
    </div>
  );
}
