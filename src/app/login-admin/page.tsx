"use client";

import { useState } from "react";
import { useRouter } from "@/lib/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "@/lib/navigation";
import { Loader2, Eye, EyeOff, Check, LayoutDashboard, Settings, ArrowRight, ArrowLeft, ShieldCheck, X } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail, signOut, sendEmailVerification } from "firebase/auth";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { useAuthStore } from "@/store/useAuthStore";
import { SuccessModal } from "@/components/ui/success-modal";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [unverifiedUser, setUnverifiedUser] = useState<any>(null);

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [successModal, setSuccessModal] = useState({ isOpen: false, title: "", message: "" });

  const handleOpenResetModal = () => {
    if (loginId.includes("@")) {
      setResetEmail(loginId);
    } else {
      setResetEmail("");
    }
    setIsResetModalOpen(true);
  };

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    setIsSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setIsResetModalOpen(false);
      setSuccessModal({
        isOpen: true,
        title: "Link Reset Terkirim",
        message: "Link reset password telah dikirim ke email Anda! Silakan periksa folder INBOX dan SPAM email Anda."
      });
    } catch (error: any) {
      toast.error("Gagal mengirim link reset password: " + error.message);
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const cleanId = loginId.trim().toLowerCase();

      // Dev account shortcut (kmlafdz / kemal@dev.com with pw 1234 or kemal123456)
      if ((cleanId === "kmlafdz" || cleanId === "kemal@dev.com") && (password === "1234" || password === "kemal123456")) {
        const userCred = await signInWithEmailAndPassword(auth, "kemal@dev.com", "kemal123456");
        let devData = {
          id: userCred.user.uid,
          name: "Muhammad Kemal",
          role: "DEVELOPER",
          initial: "K",
          email: "kemal@dev.com"
        } as any;

        try {
          const q = query(collection(db, "users"), where("email", "==", "kemal@dev.com"));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const userData = snap.docs[0].data();
            devData = {
              ...devData,
              id: snap.docs[0].id,
              name: userData.name || devData.name,
              ...(userData.photoUrl && { photoUrl: userData.photoUrl }),
              settings: userData.settings
            };
          }
        } catch (err) {
          console.warn("Could not fetch dev profile doc, using default:", err);
        }

        setUser(devData);
        toast.success("Berhasil masuk sebagai Developer!");
        setTimeout(() => router.push("/admin/dashboard"), 300);
        return;
      }

      let targetEmail = loginId.trim();

      if (!targetEmail.includes("@")) {
        let emailFound = "";
        try {
          const lookupRes = await fetch("/api/auth/staff-lookup/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: targetEmail })
          });
          const ct = lookupRes.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const lookupData = await lookupRes.json();
            if (lookupRes.ok && lookupData.success && lookupData.email) {
              emailFound = lookupData.email;
            }
          }
        } catch (e) {}

        // Static hosting fallback (direct query)
        if (!emailFound) {
          const q = query(collection(db, "users"), where("username", "==", targetEmail));
          const snap = await getDocs(q);
          if (!snap.empty) {
            emailFound = snap.docs[0].data().email;
          }
        }

        if (!emailFound) {
          throw new Error("Username tidak terdaftar.");
        }
        targetEmail = emailFound;
      }

      // Perform Firebase Auth sign-in
      const userCred = await signInWithEmailAndPassword(auth, targetEmail, password);

      // Now caller is authenticated (request.auth != null), safely query own user profile from users collection
      let targetName = userCred.user.displayName || loginId.split("@")[0];
      let targetRole = "ADMIN";
      let photoUrl = "";
      let settings = undefined;

      const userQ = query(collection(db, "users"), where("email", "==", targetEmail));
      const userSnap = await getDocs(userQ);
      if (!userSnap.empty) {
        const userData = userSnap.docs[0].data();
        targetName = userData.name || targetName;
        targetRole = userData.role || "ADMIN";
        photoUrl = userData.photoUrl || "";
        settings = userData.settings;

        if (userData.status === "Pending Verification") {
          await updateDoc(doc(db, "users", userSnap.docs[0].id), { status: "Active" });
        }
      }

      if (!userCred.user.emailVerified) {
        setUnverifiedUser(userCred.user);
        throw new Error("Email belum diverifikasi.");
      }

      setUser({
        id: userCred.user.uid,
        name: targetName,
        email: targetEmail,
        role: targetRole.toUpperCase(),
        initial: targetName.charAt(0).toUpperCase(),
        ...(photoUrl && { photoUrl }),
        ...(settings && { settings })
      });

      router.push("/admin/dashboard");
    } catch (error: any) {
      toast.error("Login gagal: " + error.message);
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedUser) return;
    try {
      await sendEmailVerification(unverifiedUser);
      toast.success("Email verifikasi terkirim!");
      await signOut(auth);
      setUnverifiedUser(null);
    } catch (error: any) { toast.error("Gagal: " + error.message); }
  };

  return (
    <div className="flex min-h-screen bg-[#050505] overflow-hidden selection:bg-[#FF5A2C]/30 font-sans relative">

      {/* BACKGROUND IMAGE & AMBIENCE */}
      <div className="absolute inset-0 z-0">
        <img
          src="/gym_bg.jpg"
          alt="Gym Background"
          className="w-full h-full object-cover scale-105 select-none"
        />
        <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-black/70" />

        {/* DYNAMIC MOVING BLOBS */}
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-24 -left-24 w-[500px] h-[500px] bg-[#FF5A2C]/20 blur-[120px] rounded-full"
        />
        <motion.div
          animate={{
            x: [0, -150, 0],
            y: [0, 100, 0],
            scale: [1, 1.3, 1]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 left-1/4 w-[600px] h-[600px] bg-blue-600/10 blur-[150px] rounded-full"
        />
        <motion.div
          animate={{
            x: [0, 80, 0],
            y: [0, -120, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-0 right-1/4 w-[450px] h-[450px] bg-purple-600/10 blur-[100px] rounded-full"
        />
      </div>

      {/* CONTENT GRID */}
      <div className="relative z-10 grid lg:grid-cols-2 w-full h-screen max-h-screen overflow-hidden">

        {/* LEFT: BRANDING & HERO */}
        <div className="hidden lg:flex flex-col justify-between p-8 lg:p-12 xl:p-16 my-auto max-h-screen">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3.5"
          >
            <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-xl p-1.5 shadow-2xl flex items-center justify-center w-12 h-12 overflow-hidden">
              <img src="/logo.png" alt="SynFit" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-[0.2em] leading-none uppercase">SynFit</h1>
              <p className="text-[8px] font-black text-gray-400 tracking-[0.3em] uppercase mt-1">Management System</p>
            </div>
          </motion.div>

          <div className="max-w-md my-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-5xl xl:text-6xl font-black text-white leading-[0.95] tracking-tighter uppercase heading-font">
                Elevate <br />
                <span className="text-[#FF5A2C]">Performance</span>
              </h2>
              <div className="h-1.5 w-16 bg-[#FF5A2C] mt-5 rounded-full shadow-[0_0_15px_rgba(255,90,44,0.5)]" />
              <p className="text-gray-300 text-sm font-medium mt-5 max-w-sm leading-relaxed tracking-wide opacity-80">
                Solusi manajemen gym tercanggih untuk kontrol total, analitik real-time, dan pertumbuhan tanpa batas.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex gap-3 mt-6"
            >
              {[
                { icon: ShieldCheck, text: "Enterprise Security" },
                { icon: LayoutDashboard, text: "SAW Analytics" }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-xl px-4 py-2 shadow-lg">
                  <item.icon className="h-3.5 w-3.5 text-[#FF5A2C]" />
                  <span className="text-[9px] font-black text-white uppercase tracking-widest">{item.text}</span>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-[9px] font-black text-gray-500 uppercase tracking-widest"
          >
            Â© 2026 SynTriad Team. All Rights Reserved.
          </motion.p>
        </div>

        {/* RIGHT: FULL AUTHENTICATION PANEL (NO CARD) */}
        <div className="h-full flex flex-col justify-between bg-[#07090E]/95 backdrop-blur-2xl lg:border-l lg:border-white/10 p-6 sm:p-10 lg:p-14 overflow-y-auto relative">
          {/* Subtle Top Kinetic Accent */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#FF5A2C]/80 to-transparent pointer-events-none" />

          {/* Mobile Top Header */}
          <div className="lg:hidden flex items-center justify-between w-full shrink-0 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="bg-white/10 border border-white/15 rounded-lg p-1 w-7 h-7 flex items-center justify-center">
                <img src="/logo.png" alt="SynFit" className="w-full h-full object-contain" />
              </div>
              <span className="text-xs font-black tracking-[0.2em] uppercase text-white">SynFit</span>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors px-2.5 py-1 rounded-lg bg-white/5 border border-white/10"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Portal</span>
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full max-w-sm sm:max-w-md mx-auto my-auto space-y-5"
          >
            <div>
              <p className="text-[9px] font-black text-[#FF5A2C] tracking-[0.3em] uppercase mb-1.5">Authentication</p>
              <h3 className="text-2xl sm:text-3xl font-black text-white uppercase heading-font tracking-tight">Sign In</h3>
              <div className="h-1 w-10 bg-[#FF5A2C] mt-2 rounded-full" />
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 tracking-widest uppercase ml-1">Account Access</label>
                  <input
                    type="text"
                    required
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    className="w-full h-12 bg-white/[0.05] border border-white/10 focus:border-[#FF5A2C]/50 rounded-xl px-5 text-sm font-bold text-white placeholder:text-gray-600 focus:outline-none transition-all shadow-md"
                    placeholder="Email or Username"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[9px] font-black text-gray-400 tracking-widest uppercase">Secret Key</label>
                    <button type="button" onClick={handleOpenResetModal} className="text-[9px] font-black text-[#FF5A2C] uppercase tracking-widest hover:underline cursor-pointer">Reset</button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-12 bg-white/[0.05] border border-white/10 focus:border-[#FF5A2C]/50 rounded-xl px-5 text-sm font-bold text-white placeholder:text-gray-600 focus:outline-none transition-all shadow-md"
                      placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group w-full h-12 sm:h-13 bg-[#FF5A2C] hover:bg-[#E04E25] text-white rounded-xl font-black text-xs uppercase tracking-[0.15em] transition-all shadow-[0_12px_24px_-8px_rgba(255,90,44,0.4)] active:scale-95 disabled:opacity-70 flex items-center justify-center gap-3 cursor-pointer"
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                    <>
                      Access Dashboard
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>

              <AnimatePresence>
                {unverifiedUser && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center pt-1">
                    <button type="button" onClick={handleResendVerification} className="text-[9px] font-black text-orange-500 hover:text-orange-600 uppercase tracking-widest border-b border-orange-500/20 pb-0.5 cursor-pointer">
                      Resend Verification Email
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>

            <p className="text-center text-[9px] font-bold text-gray-400 uppercase tracking-widest">
              Secure access for authorized staff only
            </p>
          </motion.div>

          <div className="lg:hidden text-center text-[9px] font-black text-gray-500 uppercase tracking-widest pt-2 shrink-0">
            Â© 2026 SynTriad Team. All Rights Reserved.
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isResetModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0d0d0d] border border-white/10 rounded-[2.5rem] p-10 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.7)] relative overflow-hidden"
            >
              {/* Glow effect */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#FF5A2C]/10 blur-[60px] rounded-full" />

              <div className="relative z-10 space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-black text-[#FF5A2C] tracking-[0.3em] uppercase mb-2">Reset Password</p>
                    <h3 className="text-2xl font-black text-white uppercase heading-font tracking-tight">Lupa Password</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(false)}
                    className="text-gray-500 hover:text-white transition-colors p-2"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <p className="text-gray-400 text-xs font-bold leading-relaxed">
                  Masukkan email Anda di bawah ini. Kami akan mengirimkan tautan untuk menyetel ulang kata sandi Anda.
                </p>

                <form onSubmit={handleSendResetEmail} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full h-16 bg-white/[0.05] border border-white/10 focus:border-[#FF5A2C]/50 rounded-[1.25rem] px-8 text-sm font-bold text-white placeholder:text-gray-600 focus:outline-none transition-all shadow-xl"
                      placeholder="name@email.com"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSendingReset}
                    className="w-full h-16 bg-[#FF5A2C] hover:bg-[#E04E25] text-white rounded-[1.25rem] font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {isSendingReset ? <Loader2 className="h-5 w-5 animate-spin" /> : "Kirim Link Reset"}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <SuccessModal
        isOpen={successModal.isOpen}
        onClose={() => setSuccessModal({ ...successModal, isOpen: false })}
        title={successModal.title}
        message={successModal.message}
      />

    </div>
  );
}
