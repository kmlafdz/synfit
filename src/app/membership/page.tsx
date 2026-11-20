"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/lib/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  MapPin,
  User,
  Check,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Loader2,
  QrCode,
  CreditCard,
  UploadCloud,
  ShieldCheck,
  Clock,
  Sparkles,
  Dumbbell,
  Mail,
  Download,
  MessageCircle,
  ExternalLink,
  Copy
} from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { useLanguage } from "@/store/useLanguageStore";
import Link from "@/lib/navigation";
import { toast } from "sonner";
import { formatPhoneWithPlus62, formatPhoneDisplay, getCleanWaPhone } from "@/lib/utils";
import { useMidtransSnap } from "@/lib/useMidtransSnap";

export default function UnifiedMembershipPage() {
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const { openSnap } = useMidtransSnap();

  // Registration step: 1 (data diri), 2 (paket & pembayaran)
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);

  // Authenticated Firebase User state
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);

  // Registration form state
  const [registerForm, setRegisterForm] = useState({
    nama: "",
    email: "",
    nomor_whatsapp: "",
    alamat: "",
    membership_type: "1 Bulan",
    payment_method: "Midtrans",
    bukti_pembayaran: "",
  });

  // Status handlers
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submittedRegistration, setSubmittedRegistration] = useState<{
    id: string;
    nama: string;
    whatsapp: string;
    email: string;
    membership_type: string;
    payment_method: string;
    amount: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [qrisUrl, setQrisUrl] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");

  // Listen to Firebase Auth and parse URL query params
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "login") {
        router.replace("/login/member");
        return;
      }
      const urlEmail = params.get("email");
      const urlNama = params.get("nama");
      if (urlEmail || urlNama) {
        setRegisterForm((prev) => ({
          ...prev,
          email: urlEmail || prev.email,
          nama: urlNama || prev.nama,
        }));
      }
    }

    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setFirebaseUser(user);
        setRegisterForm((prev) => ({
          ...prev,
          email: prev.email || user.email || "",
          nama: prev.nama || user.displayName || "",
        }));
      }
    });

    return () => unsub();
  }, [router]);

  // Fetch QRIS config from Firestore
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
      // 2. Client-side canvas / direct fetch fallback
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

  const handlePhoneChange = (val: string) => {
    const clean = val.replace(/\D/g, "");
    if (clean.length > 15) return;
    setRegisterForm((prev) => ({ ...prev, nomor_whatsapp: clean }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setRegisterForm((prev) => ({ ...prev, bukti_pembayaran: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    let cleanPhone = registerForm.nomor_whatsapp.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "62" + cleanPhone.substring(1);
    if (cleanPhone.startsWith("+62")) cleanPhone = "62" + cleanPhone.substring(3);

    if (!registerForm.nama.trim()) {
      setErrorMsg(language === "id" ? "Mohon isi nama lengkap Anda." : "Please enter your full name.");
      return;
    }

    if (cleanPhone.length < 8) {
      setErrorMsg(
        language === "id"
          ? "Nomor WhatsApp tidak valid (minimal 8 digit)."
          : "Please enter a valid WhatsApp number (min 8 digits)."
      );
      return;
    }

    if (!registerForm.alamat.trim()) {
      setErrorMsg(language === "id" ? "Mohon isi alamat domisili Anda." : "Please enter your residential address.");
      return;
    }

    setRegisterStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      let cleanPhone = registerForm.nomor_whatsapp.replace(/\D/g, "");
      if (cleanPhone.startsWith("0")) cleanPhone = "62" + cleanPhone.substring(1);
      if (cleanPhone.startsWith("+62")) cleanPhone = "62" + cleanPhone.substring(3);

      if (cleanPhone.length < 8) {
        throw new Error(language === "id" ? "Nomor WhatsApp tidak valid." : "Invalid WhatsApp number.");
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
              throw new Error(
                language === "id"
                  ? "Nomor WhatsApp ini sudah terdaftar sebagai member aktif. Silakan masuk menggunakan akun Anda."
                  : "This WhatsApp number is already registered as an active member. Please sign in instead."
              );
            }
            if (checkData.isPending) {
              throw new Error(
                language === "id"
                  ? "Pendaftaran dengan nomor WhatsApp ini sedang menunggu persetujuan admin."
                  : "A registration with this WhatsApp number is already pending approval."
              );
            }
          }
        }
      } catch (checkErr: any) {
        if (checkErr.message?.includes("terdaftar") || checkErr.message?.includes("menunggu persetujuan")) {
          throw checkErr;
        }
        // Client-side Firestore check for Firebase Hosting Classic (Spark Plan)
        try {
          const qMem = query(collection(db, "members"), where("nomor_whatsapp", "==", cleanPhone));
          const snapMem = await getDocs(qMem);
          if (!snapMem.empty) {
            throw new Error(
              language === "id"
                ? "Nomor WhatsApp ini sudah terdaftar sebagai member aktif. Silakan masuk menggunakan akun Anda."
                : "This WhatsApp number is already registered as an active member. Please sign in instead."
            );
          }
        } catch (e: any) {
          if (e.message?.includes("terdaftar")) throw e;
        }
      }

      if (registerForm.payment_method === "QRIS" && !registerForm.bukti_pembayaran) {
        throw new Error(
          language === "id"
            ? "Silakan unggah bukti transfer QRIS terlebih dahulu."
            : "Please upload your QRIS payment receipt."
        );
      }

      let amount = 160000;
      if (registerForm.membership_type === "3 Bulan") {
        amount = 480000;
      }

      const userEmail = (registerForm.email || firebaseUser?.email || "").toLowerCase().trim();
      const userUid = firebaseUser?.uid || null;

      // Idempotency check: allow Midtrans to continue payment even if pending registration exists
      if (userUid || userEmail || cleanPhone) {
        try {
          const qCheck = query(
            collection(db, "registrations"),
            where("status", "==", "Pending"),
            where("nomor_whatsapp", "==", cleanPhone)
          );
          const snapCheck = await getDocs(qCheck);
          if (!snapCheck.empty) {
            const existingRegId = snapCheck.docs[0].id;

            // Jika memilih bayar online lewat Midtrans, jangan blokir! Lanjutkan pembayaran!
            if (registerForm.payment_method === "Midtrans") {
              await updateDoc(doc(db, "registrations", existingRegId), {
                nama: registerForm.nama,
                email: userEmail || null,
                alamat: registerForm.alamat,
                membership_type: registerForm.membership_type,
                payment_method: "Midtrans",
                amount: amount,
              });

              toast.info("Melanjutkan pembayaran Midtrans...");
              const planParam = registerForm.membership_type === "3 Bulan" ? "3_bulan" : "1_bulan";
              router.push(
                `/payment?orderType=registration&registrationId=${existingRegId}&name=${encodeURIComponent(
                  registerForm.nama
                )}&phone=${cleanPhone}&email=${encodeURIComponent(userEmail || "")}&plan=${planParam}&autoPay=true`
              );
              return;
            } else {
              throw new Error(
                language === "id"
                  ? "Pendaftaran Anda sudah tersimpan dan sedang menunggu persetujuan kasir."
                  : "Your registration is already received and pending approval."
              );
            }
          }
        } catch (e: any) {
          if (e.message?.includes("sudah tersimpan")) throw e;
        }
      }

      const docRef = await addDoc(collection(db, "registrations"), {
        nama: registerForm.nama,
        email: userEmail || null,
        uid: userUid,
        nomor_whatsapp: cleanPhone,
        alamat: registerForm.alamat,
        membership_type: registerForm.membership_type,
        payment_method: registerForm.payment_method,
        bukti_pembayaran: registerForm.bukti_pembayaran || null,
        status: "Pending",
        amount: amount,
        created_at: serverTimestamp(),
      });

      const regSummary = {
        id: docRef.id,
        nama: registerForm.nama,
        whatsapp: cleanPhone,
        email: userEmail || "-",
        membership_type: registerForm.membership_type,
        payment_method: registerForm.payment_method,
        amount: amount,
      };

      setSubmittedRegistration(regSummary);

      // If user selected Midtrans, redirect directly to dedicated Midtrans payment page
      if (registerForm.payment_method === "Midtrans") {
        toast.info("Mengarahkan Anda ke pembayaran aman Midtrans...");
        const planParam = registerForm.membership_type === "3 Bulan" ? "3_bulan" : "1_bulan";
        router.push(
          `/payment?orderType=registration&registrationId=${docRef.id}&name=${encodeURIComponent(
            registerForm.nama
          )}&phone=${cleanPhone}&email=${encodeURIComponent(userEmail || "")}&plan=${planParam}&autoPay=true`
        );
        return;
      }

      setShowSuccessModal(true);

      // WhatsApp text generation to Admin: 085163010405
      const adminPhone = "6285163010405";
      const waMessage = [
        "Halo Admin SynFit, saya telah melakukan pendaftaran membership baru.",
        "",
        `*ID Pendaftaran:* ${docRef.id}`,
        `*Nama Lengkap:* ${registerForm.nama}`,
        `*Nomor WhatsApp:* ${cleanPhone}`,
        `*Email:* ${userEmail || "-"}`,
        `*Paket Membership:* ${registerForm.membership_type} (Rp ${amount.toLocaleString("id-ID")})`,
        `*Metode Pembayaran:* ${registerForm.payment_method}`,
        "",
        "_(Mohon jangan mengubah isi pesan ini untuk mempermudah verifikasi pendaftaran oleh kasir/admin SynFit)_",
      ].join("\n");

      // Auto-open WhatsApp chat with prefilled message
      try {
        const waUrl = `https://wa.me/${adminPhone}?text=${encodeURIComponent(waMessage)}`;
        window.open(waUrl, "_blank");
      } catch (waErr) {
        console.warn("Could not auto-open WhatsApp:", waErr);
      }

      setRegisterStep(1);
      setFileName("");
      setRegisterForm({
        nama: "",
        email: "",
        nomor_whatsapp: "",
        alamat: "",
        membership_type: "1 Bulan",
        payment_method: "Bayar di Kasir",
        bukti_pembayaran: "",
      });
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || (language === "id" ? "Pendaftaran gagal, coba lagi." : "Registration failed."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentAmount = registerForm.membership_type === "3 Bulan" ? 480000 : 160000;

  return (
    <div className="h-screen max-h-screen bg-[#070B14] text-white selection:bg-blue-500/30 font-sans relative overflow-hidden">
      {/* Background Gym Workout Photographic Ambience with Deep Royal Blue Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src="/gym_bg.jpg"
          alt="Gym Training Facility"
          className="w-full h-full object-cover object-center scale-105 select-none opacity-40 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-[#070B14]/80 backdrop-blur-[3px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070B14] via-[#0A1224]/85 to-[#070B14]" />
        <div className="absolute inset-0 bg-radial-gradient from-blue-600/15 via-transparent to-transparent" />
        {/* Deep Blue Glow Orbs */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-blue-600/20 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-10 right-0 w-[500px] h-[500px] rounded-full bg-blue-500/15 blur-[150px] pointer-events-none" />
      </div>

      {/* Main Split Screen Container */}
      <div className="relative z-10 w-full h-full grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        
        {/* Left Column: Brand Pillars & Membership Values (Desktop) */}
        <div className="hidden lg:flex lg:col-span-5 xl:col-span-6 flex-col justify-between p-8 lg:p-12 xl:p-16 my-auto h-full max-h-screen overflow-hidden">
          {/* Top Brand */}
          <Link href="/" className="flex items-center gap-2.5 group w-fit">
            <div className="bg-white/10 border border-white/15 rounded-lg p-1.5 w-9 h-9 flex items-center justify-center transition-transform group-hover:scale-105">
              <img src="/logo.png" alt="SynFit Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-base font-black text-white tracking-[0.2em] leading-none uppercase heading-font">
                SynFit
              </span>
              <p className="text-[8px] font-bold text-gray-500 tracking-[0.25em] uppercase mt-0.5">
                MEMBERSHIP HUB
              </p>
            </div>
          </Link>

          {/* Center Brand Pillars */}
          <div className="space-y-4 my-auto py-2 max-w-lg">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FF5A2C]/10 border border-[#FF5A2C]/20 text-[#FF5A2C] text-[10px] font-bold tracking-wider uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A2C]" />
                KEANGGOTAAN EKSKLUSIF SYNFIT
              </div>

              <h1 className="text-3xl xl:text-4xl font-black uppercase heading-font tracking-tight leading-[1.1] text-white">
                Mulai Disiplin. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF5A2C] to-[#FF8A00]">
                  Raih Transformasi.
                </span>
              </h1>

              <p className="text-xs text-gray-400 font-medium leading-relaxed">
                {language === "id"
                  ? "Daftar keanggotaan online untuk akses penuh ke fasilitas kebugaran modern, AI Form Coach, dan presensi barcode instan."
                  : "Register online for full access to cutting-edge workout facilities, AI Form Coach, and instant barcode check-ins."}
              </p>
            </div>

            {/* Core Member Pillars */}
            <div className="space-y-2 pt-0.5">
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-0.5">
                <div className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-[#FF5A2C]" />
                  <span>{language === "id" ? "Akses Alat & Fasilitas Penuh" : "Full Equipment & Facility Access"}</span>
                </div>
                <p className="text-[10px] text-gray-400 pl-5.5 leading-snug">
                  {language === "id"
                    ? "Zona beban bebas, mesin fungsional, dan area cardio dengan higienitas tinggi."
                    : "Free weights zone, functional machines, and cardio area with high standards."}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-0.5">
                <div className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-[#FF5A2C]" />
                  <span>{language === "id" ? "Telemetri AI Form Coach" : "AI Form Coach Biometrics"}</span>
                </div>
                <p className="text-[10px] text-gray-400 pl-5.5 leading-snug">
                  {language === "id"
                    ? "Koreksi sudut siku, lutut, dan postur tubuh langsung dari kamera HP."
                    : "Real-time posture feedback on elbow, knee, and back angles via mobile camera."}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-0.5">
                <div className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-[#FF5A2C]" />
                  <span>{language === "id" ? "Presensi & Masa Aktif Digital" : "Digital Pass & Real-Time Validity"}</span>
                </div>
                <p className="text-[10px] text-gray-400 pl-5.5 leading-snug">
                  {language === "id"
                    ? "Cek sisa hari aktif dan barcode check-in langsung dari dasbor anggota."
                    : "Monitor active days remaining and generate contactless check-in barcodes anytime."}
                </p>
              </div>
            </div>
          </div>

          {/* Trust Footer */}
          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-gray-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#FF5A2C] shrink-0" />
            <span>
              {language === "id"
                ? "Proses pendaftaran diverifikasi langsung oleh petugas kasir SynFit."
                : "Registrations are verified by SynFit desk personnel."}
            </span>
          </div>
        </div>

        {/* Right Column: Full Right Registration Panel (No Card) */}
        <div className="lg:col-span-7 xl:col-span-6 h-full flex flex-col justify-start bg-[#0A101D]/95 backdrop-blur-2xl lg:border-l lg:border-blue-900/30 p-4 sm:p-8 lg:p-10 xl:p-14 overflow-y-auto relative">
          {/* Subtle Top Blue Kinetic Accent */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/80 to-transparent pointer-events-none" />

          {/* Top Panel Bar: Back Button on Left */}
          <div className="flex items-center justify-between w-full shrink-0 mb-2 sm:mb-4">
            <Link
              href="/"
              aria-label={language === "id" ? "Kembali ke Beranda" : "Back to Home"}
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/30 text-gray-300 hover:text-white transition-all cursor-pointer group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Clean Form Container - Directly on Panel without Card Wrapper */}
          <div className="w-full max-w-sm sm:max-w-lg mx-auto mt-1 sm:mt-3 mb-6 py-1 space-y-3">
            {/* Header Box on Top of Form */}
            <div className="pb-1.5 border-b border-white/10">
              <h2 className="text-xl sm:text-2xl font-black text-white uppercase heading-font tracking-tight">
                {language === "id" ? "Pendaftaran Member Baru" : "Member Registration"}
              </h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {language === "id" ? "Lengkapi formulir untuk memulai keanggotaan Anda." : "Complete the form to start your membership."}
              </p>
            </div>

            {/* Error Alert Box */}
            {errorMsg && (
              <div
                role="alert"
                className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] font-semibold leading-relaxed"
              >
                {errorMsg}
              </div>
            )}

            {/* Registration Flow */}
            <div className="space-y-3">
              {/* Step Progress Tracker */}
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${
                      registerStep === 1
                        ? "bg-[#FF5A2C] text-white"
                        : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    }`}
                  >
                    {registerStep === 2 ? <Check className="w-3.5 h-3.5" /> : "1"}
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                      {language === "id" ? "Langkah 1" : "Step 1"}
                    </p>
                    <p className="text-[11px] font-bold text-white leading-tight">
                      {language === "id" ? "Data Diri & Kontak" : "Personal Info"}
                    </p>
                  </div>
                </div>

                <div className="w-6 h-px bg-white/10" />

                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${
                      registerStep === 2
                        ? "bg-[#FF5A2C] text-white"
                        : "bg-white/5 text-gray-500 border border-white/10"
                    }`}
                  >
                    2
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                      {language === "id" ? "Langkah 2" : "Step 2"}
                    </p>
                    <p className="text-[11px] font-bold text-white leading-tight">
                      {language === "id" ? "Paket & Pembayaran" : "Plan & Payment"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 1: Personal Information */}
              {registerStep === 1 && (
                <form onSubmit={handleStep1Next} className="space-y-3">
                  {/* Firebase Account Linked Indicator */}
                  {firebaseUser && (
                    <div className="p-2.5 rounded-xl bg-orange-500/10 border border-[#FF5A2C]/30 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-gray-300">
                        <ShieldCheck className="w-4 h-4 text-[#FF5A2C]" />
                        <span className="text-[11px] font-medium">
                          {language === "id" ? "Terhubung ke Akun:" : "Linked Account:"}{" "}
                          <strong className="text-white">{firebaseUser.email}</strong>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Name Field */}
                  <div className="space-y-1">
                    <label
                      htmlFor="reg-nama"
                      className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider"
                    >
                      {language === "id" ? "Nama Lengkap" : "Full Name"}
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reg-nama"
                        type="text"
                        required
                        value={registerForm.nama}
                        onChange={(e) => setRegisterForm({ ...registerForm, nama: e.target.value })}
                        placeholder={language === "id" ? "Nama sesuai identitas" : "Your full name"}
                        className="w-full h-11 bg-black/40 border border-white/10 focus:border-[#FF5A2C] focus:ring-1 focus:ring-[#FF5A2C] rounded-xl pl-10 pr-3 text-sm font-bold text-white placeholder:text-gray-600 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Email Field */}
                  <div className="space-y-1">
                    <label
                      htmlFor="reg-email"
                      className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider"
                    >
                      {language === "id" ? "Alamat Email" : "Email Address"}
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reg-email"
                        type="email"
                        required
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                        placeholder="member@synfitgym.com"
                        className="w-full h-11 bg-black/40 border border-white/10 focus:border-[#FF5A2C] focus:ring-1 focus:ring-[#FF5A2C] rounded-xl pl-10 pr-3 text-sm font-bold text-white placeholder:text-gray-600 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* WhatsApp Phone Field */}
                  <div className="space-y-1">
                    <label
                      htmlFor="reg-whatsapp"
                      className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider"
                    >
                      {language === "id" ? "Nomor WhatsApp" : "WhatsApp Number"}
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 flex items-center gap-1.5 pointer-events-none text-gray-400 border-r border-white/10 pr-2.5">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs font-bold text-gray-300">+62</span>
                      </div>
                      <input
                        id="reg-whatsapp"
                        type="tel"
                        pattern="[0-9]*"
                        required
                        value={registerForm.nomor_whatsapp}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder="81234567890"
                        className="w-full h-11 bg-black/40 border border-white/10 focus:border-[#FF5A2C] focus:ring-1 focus:ring-[#FF5A2C] rounded-xl pl-20 pr-3 text-sm font-bold text-white placeholder:text-gray-600 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Address Field */}
                  <div className="space-y-1">
                    <label
                      htmlFor="reg-alamat"
                      className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider"
                    >
                      {language === "id" ? "Alamat Domisili" : "Home Address"}
                    </label>
                    <div className="relative">
                      <MapPin className="w-3.5 h-3.5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reg-alamat"
                        type="text"
                        required
                        value={registerForm.alamat}
                        onChange={(e) => setRegisterForm({ ...registerForm, alamat: e.target.value })}
                        placeholder={language === "id" ? "Kota / Alamat tempat tinggal" : "City / Residential address"}
                        className="w-full h-11 bg-black/40 border border-white/10 focus:border-[#FF5A2C] focus:ring-1 focus:ring-[#FF5A2C] rounded-xl pl-10 pr-3 text-sm font-bold text-white placeholder:text-gray-600 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Continue Button & Single Login Link */}
                  <div className="pt-1.5 space-y-2">
                    <button
                      type="submit"
                      className="w-full h-11 sm:h-12 bg-[#FF5A2C] hover:bg-[#E04E25] text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-[0_8px_20px_-4px_rgba(255,90,44,0.4)] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>{language === "id" ? "Lanjut ke Pilihan Paket" : "Proceed to Membership Plans"}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <div className="text-center pt-0.5">
                      <Link
                        href="/login/member"
                        className="text-[11px] font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-wider inline-flex items-center gap-1.5"
                      >
                        <span>{language === "id" ? "Sudah Member? Masuk di sini" : "Already a Member? Login here"}</span>
                        <ArrowRight className="w-3 h-3 text-[#FF5A2C]" />
                      </Link>
                    </div>
                  </div>
                </form>
              )}

              {/* Step 2: Plan & Payment Selection */}
              {registerStep === 2 && (
                <form onSubmit={handleRegisterSubmit} className="space-y-3">
                  {/* Interactive Plan Selector Cards */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                      {language === "id" ? "Pilih Paket Keanggotaan" : "Select Membership Plan"}
                    </label>

                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Option 1: 1 Bulan */}
                      <button
                        type="button"
                        onClick={() => setRegisterForm({ ...registerForm, membership_type: "1 Bulan" })}
                        className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                          registerForm.membership_type === "1 Bulan"
                            ? "bg-[#FF5A2C]/10 border-[#FF5A2C] shadow-[0_0_15px_-4px_rgba(255,90,44,0.3)]"
                            : "bg-black/30 border-white/10 hover:border-white/20"
                        }`}
                      >
                        {registerForm.membership_type === "1 Bulan" && (
                          <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#FF5A2C] flex items-center justify-center text-white">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        )}
                        <p className="text-[9px] font-black uppercase tracking-wider text-gray-400">
                          30 HARI
                        </p>
                        <h4 className="text-sm font-black text-white mt-0.5">1 Bulan Pass</h4>
                        <p className="text-sm sm:text-base font-black text-[#FF5A2C] mt-1">Rp 160.000</p>
                        <p className="text-[9px] text-gray-400 mt-0.5 line-clamp-1">
                          {language === "id" ? "Akses penuh alat & AI Coach" : "Full gym & AI access"}
                        </p>
                      </button>

                      {/* Option 2: 3 Bulan */}
                      <button
                        type="button"
                        onClick={() => setRegisterForm({ ...registerForm, membership_type: "3 Bulan" })}
                        className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                          registerForm.membership_type === "3 Bulan"
                            ? "bg-[#FF5A2C]/10 border-[#FF5A2C] shadow-[0_0_15px_-4px_rgba(255,90,44,0.3)]"
                            : "bg-black/30 border-white/10 hover:border-white/20"
                        }`}
                      >
                        <div className="absolute -top-2 right-2 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#FF5A2C] to-red-600 text-[8px] font-black uppercase tracking-wider text-white">
                          POPULER
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-wider text-gray-400">
                          90 HARI
                        </p>
                        <h4 className="text-sm font-black text-white mt-0.5">3 Bulan Pass</h4>
                        <p className="text-sm sm:text-base font-black text-[#FF5A2C] mt-1">Rp 480.000</p>
                        <p className="text-[9px] text-gray-400 mt-0.5 line-clamp-1">
                          {language === "id" ? "Disiplin tanpa repot perpanjang" : "Priority & consistency"}
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                      {language === "id" ? "Metode Pembayaran" : "Payment Method"}
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setRegisterForm({ ...registerForm, payment_method: "Midtrans" })}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                          registerForm.payment_method === "Midtrans"
                            ? "bg-blue-500/20 border-blue-500/60 text-white shadow-sm ring-1 ring-blue-500/30"
                            : "bg-black/30 border-white/10 text-gray-400 hover:border-white/20"
                        }`}
                      >
                        <Sparkles className="w-4 h-4 shrink-0 text-blue-400" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-white">Online (Midtrans)</p>
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-blue-500/30 text-blue-300 uppercase">
                              Instan
                            </span>
                          </div>
                          <p className="text-[9px] text-gray-400">
                            QRIS, VA, GoPay, Kartu
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRegisterForm({ ...registerForm, payment_method: "Bayar di Kasir" })}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                          registerForm.payment_method === "Bayar di Kasir"
                            ? "bg-white/10 border-white/30 text-white"
                            : "bg-black/30 border-white/10 text-gray-400 hover:border-white/20"
                        }`}
                      >
                        <CreditCard className="w-4 h-4 shrink-0 text-[#FF5A2C]" />
                        <div>
                          <p className="text-xs font-bold text-white">
                            {language === "id" ? "Bayar di Kasir" : "Pay at Desk"}
                          </p>
                          <p className="text-[9px] text-gray-400">
                            {language === "id" ? "Tunai/Debit" : "Cash/Debit"}
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRegisterForm({ ...registerForm, payment_method: "QRIS" })}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                          registerForm.payment_method === "QRIS"
                            ? "bg-white/10 border-white/30 text-white"
                            : "bg-black/30 border-white/10 text-gray-400 hover:border-white/20"
                        }`}
                      >
                        <QrCode className="w-4 h-4 shrink-0 text-[#FF5A2C]" />
                        <div>
                          <p className="text-xs font-bold text-white">QRIS Manual</p>
                          <p className="text-[9px] text-gray-400">
                            {language === "id" ? "Upload Struk" : "Upload Receipt"}
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Midtrans Info Section if Selected */}
                  {registerForm.payment_method === "Midtrans" && (
                    <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-200 space-y-1">
                      <div className="flex items-center gap-2 font-bold text-white">
                        <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0" />
                        <span>Pembayaran Aman & Otomatis via Midtrans</span>
                      </div>
                      <p className="text-[11px] text-gray-300 leading-relaxed">
                        Setelah menekan tombol daftar, jendela pembayaran Midtrans akan muncul. Anda dapat membayar melalui <strong>QRIS (GoPay/ShopeePay), Virtual Account Bank (BCA, BNI, BRI, Mandiri)</strong>, atau <strong>Kartu Kredit</strong> tanpa perlu unggah struk manual.
                      </p>
                    </div>
                  )}

                  {/* QRIS Transfer Section if Selected */}
                  {registerForm.payment_method === "QRIS" && (
                    <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-gray-300 uppercase tracking-wider text-[10px]">
                          {language === "id" ? "Kode QRIS" : "QRIS Code"}
                        </span>
                        <span className="font-black text-[#FF5A2C]">
                          Rp {currentAmount.toLocaleString("id-ID")}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center gap-1.5 shrink-0">
                          <div className="flex items-center justify-center p-1.5 bg-white rounded-xl w-24 h-24 shadow-md">
                            {qrisUrl ? (
                              <img
                                src={qrisUrl}
                                alt="SynFit QRIS"
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="text-center text-black">
                                <QrCode className="w-12 h-12 mx-auto text-black" />
                                <p className="text-[8px] font-black uppercase">QRIS</p>
                              </div>
                            )}
                          </div>
                          {qrisUrl && (
                            <button
                              type="button"
                              onClick={handleDownloadQris}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[9px] font-bold text-[#FF5A2C] transition-all cursor-pointer"
                            >
                              <Download className="w-2.5 h-2.5" />
                              <span>{language === "id" ? "Unduh QRIS" : "Download"}</span>
                            </button>
                          )}
                        </div>

                        {/* File Upload for Proof */}
                        <div className="flex-1">
                          <label
                            htmlFor="reg-proof"
                            className="border border-dashed border-white/20 hover:border-[#FF5A2C] rounded-xl p-2.5 flex flex-col items-center justify-center gap-1 cursor-pointer bg-white/[0.02] hover:bg-white/[0.04] transition-all text-center"
                          >
                            <UploadCloud className="w-4 h-4 text-gray-400" />
                            <span className="text-[11px] font-bold text-white leading-tight">
                              {fileName ? fileName : language === "id" ? "Unggah Bukti" : "Upload Receipt"}
                            </span>
                            <span className="text-[9px] text-gray-500">JPG/PNG</span>
                            <input
                              id="reg-proof"
                              type="file"
                              accept="image/*"
                              required
                              onChange={handleFileChange}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setRegisterStep(1)}
                      className="w-1/3 h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold uppercase tracking-wider text-white transition-all cursor-pointer"
                    >
                      {language === "id" ? "Kembali" : "Back"}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-2/3 h-11 bg-[#FF5A2C] hover:bg-[#E04E25] text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-[0_8px_20px_-4px_rgba(255,90,44,0.4)] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{language === "id" ? "Mengirimkan..." : "Submitting..."}</span>
                        </>
                      ) : (
                        <span>{language === "id" ? "Kirim Pendaftaran" : "Submit Registration"}</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>

          </div>

          {/* Panel Footer */}
          <div className="text-center text-[10px] text-gray-600 font-medium shrink-0 pt-2">
            Â© {new Date().getFullYear()} SynFit Athletic Club. All rights reserved.
          </div>
        </div>

      </div>

      {/* Success Modal / Pending Verification View */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0D111A] border border-white/10 p-8 rounded-[2.5rem] text-center space-y-6 relative overflow-hidden shadow-2xl"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white uppercase tracking-tight heading-font">
                  {language === "id" ? "Pendaftaran Berhasil Dikirim" : "Registration Submitted"}
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {language === "id"
                    ? "Data pendaftaran keanggotaan Anda telah berhasil terkirim dan saat ini sedang ditinjau oleh staf kasir SynFit."
                    : "Your membership application has been received and is currently being verified by SynFit front desk staff."}
                </p>
              </div>

              {/* Registration Reference & Notification Box */}
              {submittedRegistration && (
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-left space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#FF5A2C] uppercase tracking-wider">
                      {language === "id" ? "ID Pendaftaran" : "Registration ID"}
                    </span>
                    <span className="font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded text-[11px] select-all">
                      {submittedRegistration.id}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-gray-300 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-gray-500">{language === "id" ? "Nama:" : "Name:"}</span>
                      <span className="font-semibold text-white">{submittedRegistration.nama}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">{language === "id" ? "WhatsApp:" : "WhatsApp:"}</span>
                      <span className="font-bold text-emerald-400 font-mono">{formatPhoneDisplay(submittedRegistration.whatsapp)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{language === "id" ? "Paket:" : "Plan:"}</span>
                      <span className="font-semibold text-white">{submittedRegistration.membership_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{language === "id" ? "Metode Bayar:" : "Payment:"}</span>
                      <span className="font-semibold text-white">{submittedRegistration.payment_method}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{language === "id" ? "Default Password:" : "Default Password:"}</span>
                      <code className="bg-white/10 px-1.5 py-0.5 rounded text-white font-mono font-bold">synfit123</code>
                    </div>
                  </div>

                  {/* WhatsApp Admin Direct Action */}
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <p className="text-[10px] text-amber-300/90 leading-relaxed flex items-start gap-1.5 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                      <span>âš ï¸</span>
                      <span>
                        {language === "id"
                          ? "Pesan konfirmasi otomatis telah dibuka ke WhatsApp Admin (0851-6301-0405). Disarankan untuk TIDAK MENGUBAH isi pesan agar verifikasi dapat diproses cepat."
                          : "Confirmation message was automatically created for Admin WhatsApp (0851-6301-0405). Please DO NOT MODIFY the message text for expedited verification."}
                      </span>
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        const adminPhone = "6285163010405";
                        const waMessage = [
                          "Halo Admin SynFit, saya telah melakukan pendaftaran membership baru.",
                          "",
                          `*ID Pendaftaran:* ${submittedRegistration.id}`,
                          `*Nama Lengkap:* ${submittedRegistration.nama}`,
                          `*Nomor WhatsApp:* ${submittedRegistration.whatsapp}`,
                          `*Email:* ${submittedRegistration.email}`,
                          `*Paket Membership:* ${submittedRegistration.membership_type} (Rp ${submittedRegistration.amount.toLocaleString("id-ID")})`,
                          `*Metode Pembayaran:* ${submittedRegistration.payment_method}`,
                          "",
                          "_(Mohon jangan mengubah isi pesan ini untuk mempermudah verifikasi pendaftaran oleh kasir/admin SynFit)_",
                        ].join("\n");
                        window.open(`https://wa.me/${adminPhone}?text=${encodeURIComponent(waMessage)}`, "_blank");
                      }}
                      className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-600/20 active:scale-[0.99]"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{language === "id" ? "Kirim Pesan WhatsApp ke Admin" : "Send WhatsApp to Admin"}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowSuccessModal(false);
                    router.push("/login/member");
                  }}
                  className="w-full h-12 bg-[#FF5A2C] hover:bg-[#E04E25] text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-orange-500/20 active:scale-[0.99]"
                >
                  {language === "id" ? "Kembali ke Halaman Login Member" : "Back to Member Login"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSuccessModal(false);
                    router.push("/login/member");
                  }}
                  className="w-full h-10 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  {language === "id" ? "Tutup & Menuju Login" : "Close & Go to Login"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
