"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { motion } from "framer-motion";
import { Settings, User, Bell, Shield, LogOut, Save, Camera, Trash2, AlertTriangle, Smartphone, Loader2, ArrowUpRight, Globe, Lock, Eye, EyeOff, Sun, Moon, Languages, FileText, Scale, CreditCard, Copy, ExternalLink, CheckCircle2, RefreshCw } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useUIStore } from "@/store/useUIStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import { translations } from "@/lib/translations";
import { useState, useEffect, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc, addDoc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "@/lib/navigation";
import { useNotifications } from "@/hooks/useNotifications";
import { Capacitor } from "@capacitor/core";
import { Button } from "@/components/ui/button";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { SuccessModal } from "@/components/ui/success-modal";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const { adminTheme: theme, toggleAdminTheme: toggleTheme } = useUIStore();
  const { language, setLanguage } = useLanguageStore();
  const t = translations[language];
  const router = useRouter();
  const { requestPermission, sendNotification } = useNotifications();

  const [profileData, setProfileData] = useState({
    name: user?.name || "Admin",
    email: user?.email || "admin@synfit.com"
  });

  const [notifications, setNotifications] = useState({
    emailNotifications: user?.settings?.emailNotifications ?? true,
    maintenanceAlerts: user?.settings?.maintenanceAlerts ?? true
  });

  const [isResetting, setIsResetting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [passwordSuccessModal, setPasswordSuccessModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrisInputRef = useRef<HTMLInputElement>(null);

  const [qrisUrl, setQrisUrl] = useState("");
  const [isUploadingQris, setIsUploadingQris] = useState(false);

  const [gymLatitude, setGymLatitude] = useState("");
  const [gymLongitude, setGymLongitude] = useState("");
  const [gymRadius, setGymRadius] = useState("30");
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  // Midtrans Payment Gateway status
  const [midtransStatus, setMidtransStatus] = useState<{
    configured?: boolean;
    isProduction?: boolean;
    environment?: string;
    message?: string;
    apiReachable?: boolean;
    clientKeyPrefix?: string | null;
  } | null>(null);
  const [isCheckingMidtrans, setIsCheckingMidtrans] = useState(false);

  const checkMidtrans = async () => {
    setIsCheckingMidtrans(true);
    try {
      const res = await fetch("/api/payment/test-connection");
      const data = await res.json();
      setMidtransStatus(data);
    } catch (e) {
      console.error("Failed to check Midtrans status:", e);
    } finally {
      setIsCheckingMidtrans(false);
    }
  };

  useEffect(() => {
    checkMidtrans();
  }, []);

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const configSnap = await getDoc(doc(db, "configs", "gym"));
        if (configSnap.exists()) {
          const data = configSnap.data();
          setQrisUrl(data.qris_image_url || "");
          setGymLatitude(data.latitude !== undefined ? String(data.latitude) : "");
          setGymLongitude(data.longitude !== undefined ? String(data.longitude) : "");
          setGymRadius(data.radius !== undefined ? String(data.radius) : "30");
        }
      } catch (error) {
        console.error("Error fetching configs:", error);
      }
    };
    fetchConfigs();
  }, []);

  const handleSaveGymLocation = async () => {
    if (!gymLatitude || !gymLongitude) {
      toast.warning(language === 'id' ? "Mohon isi latitude dan longitude." : "Please fill in latitude and longitude.");
      return;
    }
    setIsSavingLocation(true);
    try {
      await setDoc(doc(db, "configs", "gym"), {
        latitude: Number(gymLatitude),
        longitude: Number(gymLongitude),
        radius: Number(gymRadius) || 30
      }, { merge: true });
      toast.success(language === 'id' ? "Lokasi gym berhasil disimpan!" : "Gym location saved successfully!");
    } catch (error) {
      console.error("Error saving gym location:", error);
      toast.error(t.failed);
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleQrisUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingQris(true);
      try {
        const url = await uploadToCloudinary(file);
        if (url) {
          setQrisUrl(url);
          await setDoc(doc(db, "configs", "gym"), { qris_image_url: url }, { merge: true });
          toast.success(language === 'id' ? "Gambar QRIS berhasil diperbarui!" : "QRIS image updated successfully!");
        }
      } catch (error) {
        console.error("Error uploading QRIS image:", error);
        toast.error(t.failed);
      } finally {
        setIsUploadingQris(false);
      }
    }
  };

  useEffect(() => {
    if (user) {
      setProfileData({ name: user.name, email: user.email || "admin@synfit.com" });
      if (user.settings) {
        setNotifications({
          emailNotifications: user.settings.emailNotifications,
          maintenanceAlerts: user.settings.maintenanceAlerts
        });
      }
    }
  }, [user]);

  const updateFirestoreUser = async (updates: any) => {
    if (!user?.email) return;
    try {
      const q = query(collection(db, "users"), where("email", "==", user.email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(doc(db, "users", snap.docs[0].id), updates);
      } else {
        // If user document doesn't exist (like for some Dev accounts), create it
        await addDoc(collection(db, "users"), {
          ...updates,
          email: user.email,
          name: user.name,
          role: user.role,
          created_at: new Date()
        });
      }
    } catch (error) { console.error(error); }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    const newInitial = profileData.name.charAt(0).toUpperCase();
    setUser({ ...user, name: profileData.name, email: profileData.email, initial: newInitial });
    await updateFirestoreUser({ name: profileData.name, email: profileData.email });
    setSuccessModalOpen(true);
  };

  const toggleSetting = async (key: keyof typeof notifications) => {
    if (!user) return;
    const newVal = !notifications[key];
    setNotifications(prev => ({ ...prev, [key]: newVal }));
    const newSettings = { ...(user.settings || { emailNotifications: true, maintenanceAlerts: true }), [key]: newVal } as any;
    setUser({ ...user, settings: newSettings });
    await updateFirestoreUser({ settings: newSettings });
  };

  const handleResetData = async () => {
    if (!user) return;
    if (user.role !== "DEVELOPER" && user.role !== "ADMIN") return toast.error("Restricted.");
    setResetModalOpen(true);
  };

  const confirmResetData = async () => {
    setIsResetting(true);
    try {
      const deleteColl = async (name: string) => {
        const snap = await getDocs(query(collection(db, name)));
        await Promise.all(snap.docs.map(d => deleteDoc(doc(db, name, d.id))));
      };
      await deleteColl("members");
      await deleteColl("transactions");
      await deleteColl("checkins");
      toast.success(t.success);
      window.location.reload();
    } catch (e) { toast.error(t.failed); } finally { setIsResetting(false); setResetModalOpen(false); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      setIsUploading(true);
      try {
        const url = await uploadToCloudinary(file);
        if (url) {
          setUser({ ...user, photoUrl: url });
          await updateFirestoreUser({ photoUrl: url });
        }
      } catch (e) { toast.error(t.failed); } finally { setIsUploading(false); }
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      toast.warning(language === 'id' ? "Mohon isi password lama dan baru." : "Please fill both old and new passwords.");
      return;
    }

    if (newPassword.length < 6) {
      toast.warning(language === 'id' ? "Password baru minimal 6 karakter." : "New password must be at least 6 characters.");
      return;
    }

    if (user?.role === "DEVELOPER") {
      toast.warning(language === 'id' ? "Password akun Developer tidak dapat diubah via profil." : "Developer password cannot be changed via profile.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.email) {
        // 1. Re-authenticate
        const credential = EmailAuthProvider.credential(currentUser.email, oldPassword);
        await reauthenticateWithCredential(currentUser, credential);

        // 2. Update Password
        await updatePassword(currentUser, newPassword);

        setPasswordSuccessModal(true);
        setOldPassword("");
        setNewPassword("");
      } else {
        throw new Error("User session invalid.");
      }
    } catch (error: any) {
      console.error("Password update error:", error);
      if (error.code === 'auth/wrong-password') {
        toast.error(language === 'id' ? "Password lama salah." : "Incorrect old password.");
      } else {
        toast.error(error.message);
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleLogout = () => {
    setLogoutModalOpen(true);
  };

  const confirmLogout = async () => {
    await signOut(auth);
    setUser(null);
    router.replace("/login-admin");
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0">
        <Header />
        <main className="p-4 sm:p-10 flex-1 overflow-x-hidden space-y-10">

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6"
          >
            <div className="space-y-1">
              <h1 className="text-4xl sm:text-5xl font-black text-foreground tracking-tighter heading-font uppercase">{t.settings}</h1>
              <p className="text-[10px] font-bold text-gray-500 tracking-[0.2em] uppercase">{language === 'id' ? "PENGATURAN GYM & PREFERENSI AKUN" : "Gym Settings & Account Preferences"}</p>
            </div>
            <Button onClick={handleSaveProfile} className="bg-gradient-to-br from-[#FF5A2C] to-red-600 hover:brightness-110 text-white rounded-2xl px-8 py-6 font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-orange-500/20 active:scale-95">
              <Save className="h-4 w-4 mr-2" />
              {language === 'id' ? "SIMPAN PENGATURAN" : "SAVE SETTINGS"}
            </Button>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">

            <div className="lg:col-span-2 space-y-8">
              <div className="glass-card p-8 flex flex-col gap-8">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-[#FF5A2C]" />
                  <h2 className="text-xl font-black text-foreground heading-font uppercase tracking-tight">{t.accountIdentity}</h2>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-8 py-6 border-y border-white/5">
                  <div className="relative h-32 w-32 rounded-3xl glass border border-white/10 flex items-center justify-center overflow-hidden shadow-2xl">
                    {isUploading && <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center"><Loader2 className="h-8 w-8 text-[#FF5A2C] animate-spin" /></div>}
                    {user?.photoUrl ? (
                      <img src={user.photoUrl} alt="Profile" className="h-full w-full object-cover no-invert" />
                    ) : (
                      <span className="text-4xl font-black text-[#FF5A2C] heading-font uppercase">{user?.initial || "A"}</span>
                    )}
                  </div>
                  <div className="flex flex-col items-center sm:items-start gap-4">
                    <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
                    <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-foreground transition-all active:scale-95">
                      <Camera className="h-4 w-4 inline mr-2" /> {isUploading ? t.loading : (language === 'id' ? "UBAH FOTO PROFIL" : "UPDATE PHOTO")}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 tracking-widest uppercase ml-1">{t.fullName}</label>
                    <input type="text" value={profileData.name} onChange={(e) => setProfileData({ ...profileData, name: e.target.value })} className="w-full h-14 bg-black/20 border border-white/5 rounded-2xl px-6 text-sm font-bold text-foreground focus:outline-none focus:border-[#FF5A2C]/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 tracking-widest uppercase ml-1">{t.emailProtocol}</label>
                    <input type="email" value={profileData.email} onChange={(e) => setProfileData({ ...profileData, email: e.target.value })} className="w-full h-14 bg-black/20 border border-white/5 rounded-2xl px-6 text-sm font-bold text-foreground focus:outline-none focus:border-[#FF5A2C]/50" />
                  </div>
                </div>

                {/* QRIS Configuration */}
                <div className="glass-card p-8 flex flex-col gap-6">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-[#FF5A2C]" />
                    <h2 className="text-lg font-black text-foreground heading-font uppercase">{language === 'id' ? "Pengaturan QRIS" : "QRIS Settings"}</h2>
                  </div>
                  <div className="space-y-4 border-t border-white/5 pt-4 flex flex-col items-center">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider text-center">
                      {language === 'id' ? "Unggah QRIS Pembayaran" : "Upload Payment QRIS"}
                    </p>
                    {qrisUrl ? (
                      <div className="relative h-40 w-40 rounded-2xl bg-white p-2 border border-white/10 flex items-center justify-center overflow-hidden">
                        <img src={qrisUrl} alt="QRIS" className="h-full w-full object-contain no-invert" />
                      </div>
                    ) : (
                      <div className="h-40 w-40 rounded-2xl bg-white/5 border border-dashed border-white/10 flex flex-col items-center justify-center text-center p-4">
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">No QRIS Image</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" ref={qrisInputRef} className="hidden" onChange={handleQrisUpload} />
                    <button
                      onClick={() => qrisInputRef.current?.click()}
                      disabled={isUploadingQris}
                      className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-foreground transition-all active:scale-95 w-full flex items-center justify-center gap-2"
                    >
                      {isUploadingQris ? <Loader2 className="h-4 w-4 animate-spin text-orange-500" /> : <Camera className="h-4 w-4 text-orange-500" />}
                      {isUploadingQris ? t.loading : (language === 'id' ? "UNGGAH GAMBAR QRIS" : "UPLOAD QRIS")}
                    </button>
                  </div>
                </div>

                {/* Midtrans Payment Gateway Configuration */}
                <div className="glass-card p-8 flex flex-col gap-6 md:col-span-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-blue-500" />
                      <div>
                        <h2 className="text-lg font-black text-foreground heading-font uppercase">
                          Payment Gateway (Midtrans Snap)
                        </h2>
                        <p className="text-xs text-gray-400">
                          Integrasi pembayaran otomatis: QRIS, GoPay, ShopeePay, Virtual Account, & Kartu Kredit
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                          midtransStatus?.configured
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {midtransStatus?.configured ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            <span>{midtransStatus.environment}</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3 w-3" />
                            <span>Belum Dikonfigurasi</span>
                          </>
                        )}
                      </span>

                      <button
                        onClick={checkMidtrans}
                        disabled={isCheckingMidtrans}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs transition-all"
                        title="Periksa Ulang Status Midtrans"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isCheckingMidtrans ? "animate-spin text-blue-400" : ""}`} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-white/5 pt-4">
                    {/* Status message */}
                    <div
                      className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
                        midtransStatus?.configured
                          ? "bg-blue-500/10 border-blue-500/20 text-blue-200"
                          : "bg-amber-500/10 border-amber-500/20 text-amber-200"
                      }`}
                    >
                      <Shield className="h-4 w-4 shrink-0 mt-0.5 text-blue-400" />
                      <div className="space-y-1">
                        <p className="font-bold">
                          {midtransStatus?.message || "Memeriksa status koneksi Midtrans..."}
                        </p>
                        {midtransStatus?.configured && (
                          <p className="text-[11px] opacity-80">
                            Client Key: {midtransStatus.clientKeyPrefix || "Tersimpan"} | Server Key: Terlindungi aman di server.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Webhook URL for Midtrans Dashboard */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
                        Notification / Webhook URL (Wajib dimasukkan ke Dashboard Midtrans)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value="https://synfitgym.web.app/api/payment/notification"
                          className="flex-1 h-12 bg-black/20 border border-white/5 rounded-2xl px-4 text-xs font-mono text-gray-300 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText("https://synfitgym.web.app/api/payment/notification");
                            toast.success("Webhook URL berhasil disalin!");
                          }}
                          className="h-12 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span>Salin URL</span>
                        </button>
                      </div>
                    </div>

                    {/* Instructions guide */}
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs">
                      <p className="font-bold text-white flex items-center gap-1.5">
                        <ArrowUpRight className="h-4 w-4 text-blue-400" />
                        Panduan Menghubungkan Midtrans:
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-gray-400 text-[11px]">
                        <li>
                          Buka akun di{" "}
                          <a
                            href="https://dashboard.midtrans.com"
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-400 underline font-bold"
                          >
                            dashboard.midtrans.com
                          </a>{" "}
                          (gunakan Sandbox untuk uji coba gratis).
                        </li>
                        <li>
                          Buka menu <strong>Settings &gt; Configuration</strong>, lalu masukkan <strong>Payment Notification URL</strong> dengan URL webhook di atas.
                        </li>
                        <li>
                          Buka menu <strong>Settings &gt; Access Keys</strong>, salin <strong>Server Key</strong> & <strong>Client Key</strong>.
                        </li>
                        <li>
                          Buka file <code>.env.local</code> pada server/hosting, lalu isi <code>MIDTRANS_SERVER_KEY</code> dan <code>NEXT_PUBLIC_MIDTRANS_CLIENT_KEY</code>.
                        </li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gym Location Settings */}
              <div className="glass-card p-8 flex flex-col gap-6">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-[#FF5A2C]" />
                  <h2 className="text-lg font-black text-foreground heading-font uppercase">{language === 'id' ? "Lokasi Gym (GPS)" : "Gym GPS Location"}</h2>
                </div>
                <div className="space-y-4 border-t border-white/5 pt-4">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    {language === 'id'
                      ? "Tentukan koordinat pusat gym untuk fitur Check-in GPS"
                      : "Set center coordinates for GPS Check-in feature"}
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 tracking-widest uppercase ml-1">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        value={gymLatitude}
                        onChange={(e) => setGymLatitude(e.target.value)}
                        placeholder="-6.2088"
                        className="w-full h-14 bg-black/20 border border-white/5 rounded-2xl px-6 text-sm font-bold text-foreground focus:outline-none focus:border-[#FF5A2C]/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 tracking-widest uppercase ml-1">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        value={gymLongitude}
                        onChange={(e) => setGymLongitude(e.target.value)}
                        placeholder="106.8456"
                        className="w-full h-14 bg-black/20 border border-white/5 rounded-2xl px-6 text-sm font-bold text-foreground focus:outline-none focus:border-[#FF5A2C]/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 tracking-widest uppercase ml-1">
                      {language === 'id' ? "Radius Maksimal (Meter)" : "Maximum Radius (Meters)"}
                    </label>
                    <input
                      type="number"
                      value={gymRadius}
                      onChange={(e) => setGymRadius(e.target.value)}
                      placeholder="30"
                      className="w-full h-14 bg-black/20 border border-white/5 rounded-2xl px-6 text-sm font-bold text-foreground focus:outline-none focus:border-[#FF5A2C]/50"
                    />
                  </div>

                  <Button
                    onClick={handleSaveGymLocation}
                    disabled={isSavingLocation}
                    className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-foreground transition-all active:scale-95 w-full flex items-center justify-center gap-2"
                  >
                    {isSavingLocation ? <Loader2 className="h-4 w-4 animate-spin text-orange-500" /> : <Save className="h-4 w-4 text-orange-500" />}
                    {isSavingLocation ? t.loading : (language === 'id' ? "SIMPAN LOKASI GYM" : "SAVE GYM LOCATION")}
                  </Button>
                </div>
              </div>

              {/* Notifications */}
              <div className="glass-card p-8 flex flex-col gap-8">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-[#FF5A2C]" />
                  <h2 className="text-xl font-black text-foreground heading-font uppercase tracking-tight">{t.notifications}</h2>
                </div>
                <div className="space-y-6">
                  <ToggleRow
                    label={t.emailAlerts}
                    sub={language === 'id' ? "Terima verifikasi dan log sistem via email" : "Receive verification and system logs via email"}
                    active={notifications.emailNotifications}
                    onToggle={() => toggleSetting('emailNotifications')}
                  />
                  <ToggleRow
                    label={t.maintenanceAlerts}
                    sub={language === 'id' ? "Notifikasi staf saat skor SAW alat kritis" : "Notify staff when asset SAW score hits critical"}
                    active={notifications.maintenanceAlerts}
                    onToggle={() => toggleSetting('maintenanceAlerts')}
                  />
                </div>
              </div>

              {/* Security Section */}
              <div className="glass-card p-8 flex flex-col gap-8">
                <div className="flex items-center gap-3">
                  <Lock className="h-5 w-5 text-[#FF5A2C]" />
                  <h2 className="text-xl font-black text-foreground heading-font uppercase tracking-tight">{language === 'id' ? "Keamanan Akun" : "Account Security"}</h2>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 tracking-widest uppercase ml-1">{language === 'id' ? "Password Lama" : "Old Password"}</label>
                    <div className="relative">
                      <input
                        type={showPasswords ? "text" : "password"}
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                        className="w-full h-14 bg-black/20 border border-white/5 rounded-2xl px-6 text-sm font-bold text-foreground focus:outline-none focus:border-[#FF5A2C]/50"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 tracking-widest uppercase ml-1">{language === 'id' ? "Password Baru" : "New Password"}</label>
                    <div className="relative">
                      <input
                        type={showPasswords ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                        className="w-full h-14 bg-black/20 border border-white/5 rounded-2xl px-6 text-sm font-bold text-foreground focus:outline-none focus:border-[#FF5A2C]/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(!showPasswords)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                      >
                        {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button
                    onClick={handleChangePassword}
                    disabled={isUpdatingPassword || !oldPassword || !newPassword}
                    className="w-full h-14 bg-white/5 hover:bg-white/10 text-foreground font-black text-[10px] uppercase tracking-widest rounded-2xl border border-white/10 shadow-lg active:scale-95 disabled:opacity-50"
                  >
                    {isUpdatingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                    {language === 'id' ? "PERBARUI PASSWORD" : "UPDATE PASSWORD"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Sidebar Settings */}
            <div className="space-y-8">
              {/* Display & Language */}
              <div className="glass-card p-8 flex flex-col gap-6">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-blue-500" />
                  <h2 className="text-lg font-black text-foreground heading-font uppercase">{language === 'id' ? "Tampilan & Bahasa" : "Display & Language"}</h2>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        {theme === 'dark' ? <Moon className="h-4 w-4 text-blue-400" /> : <Sun className="h-4 w-4 text-yellow-500" />}
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest">{language === 'id' ? "Mode Tema" : "Theme Mode"}</p>
                    </div>
                    <button
                      onClick={toggleTheme}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                    >
                      {theme === 'dark' ? (language === 'id' ? 'GELAP' : 'DARK') : (language === 'id' ? 'TERANG' : 'LIGHT')}
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <Languages className="h-4 w-4 text-purple-400" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest">{language === 'id' ? "Bahasa" : "Language"}</p>
                    </div>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as any)}
                      className="bg-white/10 border-none rounded-xl text-[9px] font-black uppercase tracking-widest px-3 py-2 outline-none cursor-pointer"
                    >
                      <option value="id" className="bg-[#0c0c14]">Indonesia</option>
                      <option value="en" className="bg-[#0c0c14]">English</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Native Settings */}
              {Capacitor.isNativePlatform() && (
                <div className="glass-card p-8 flex flex-col gap-6">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-teal-500" />
                    <h2 className="text-lg font-black text-foreground heading-font uppercase">Native</h2>
                  </div>
                  <Button onClick={requestPermission} className="w-full h-12 bg-white/5 hover:bg-white/10 text-foreground font-black text-[10px] uppercase tracking-widest rounded-2xl border border-white/10">Permission</Button>
                  <Button onClick={() => sendNotification("SynFit System", { body: "Test Successful" })} className="w-full h-12 bg-white/5 hover:bg-white/10 text-foreground font-black text-[10px] uppercase tracking-widest rounded-2xl border border-white/10">Push Test</Button>
                </div>
              )}

              {/* Legal & About */}
              <div className="glass-card p-8 flex flex-col gap-6">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-[#FF5A2C]" />
                  <h2 className="text-lg font-black text-foreground heading-font uppercase">{language === 'id' ? "Hukum & Privasi" : "Legal & Privacy"}</h2>
                </div>

                <div className="space-y-4">
                  <button
                    onClick={() => router.push("/privacy-policy")}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                        <Shield className="h-4 w-4 text-orange-500" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest">{language === 'id' ? "Kebijakan Privasi" : "Privacy Policy"}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-gray-700 group-hover:text-foreground transition-all" />
                  </button>

                  <button
                    onClick={() => router.push("/terms-of-use")}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Scale className="h-4 w-4 text-blue-500" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest">{language === 'id' ? "Ketentuan Layanan" : "Terms of Use"}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-gray-700 group-hover:text-foreground transition-all" />
                  </button>

                  <button
                    onClick={() => router.push("/credits")}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-teal-500" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest">{language === 'id' ? "Pengembang Aplikasi" : "App Credits"}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-gray-700 group-hover:text-foreground transition-all" />
                  </button>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-blue-400" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest">Version</p>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">v1.2.0-stable</span>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="glass-card p-8 border-l-4 border-l-red-600 flex flex-col gap-6">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-red-600" />
                  <h2 className="text-lg font-black text-foreground heading-font uppercase">{t.dangerZone}</h2>
                </div>
                <button onClick={handleLogout} className="w-full h-14 bg-white/5 hover:bg-white/10 text-foreground font-black text-[10px] uppercase tracking-widest rounded-2xl border border-white/10 flex items-center justify-center gap-3 transition-all">
                  <LogOut className="h-4 w-4" /> {t.sessionTerminate}
                </button>
                <button onClick={handleResetData} disabled={isResetting} className="w-full h-14 bg-red-600/10 hover:bg-red-600/20 text-red-600 font-black text-[10px] uppercase tracking-widest rounded-2xl border border-red-600/20 flex items-center justify-center gap-3 transition-all">
                  {isResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} {t.purgeData}
                </button>
                <p className="text-[9px] font-bold text-red-600/60 uppercase leading-relaxed text-center tracking-widest">{language === 'id' ? "PERINGATAN: TINDAKAN TIDAK DAPAT DIBATALKAN. SEMUA DATA AKAN DIHAPUS." : "WARNING: IRREVERSIBLE ACTION. ALL RECORDS WILL BE WIPED."}</p>
              </div>
            </div>

          </div>
        </main>
      </div>
      <DeleteConfirmModal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={confirmLogout}
        title={t.logout}
        message={language === 'id' ? "Apakah Anda yakin ingin keluar dari akun admin?" : "Are you sure you want to log out from the admin account?"}
        confirmText={language === 'id' ? "Ya, Keluar" : "Yes, Log Out"}
      />

      <DeleteConfirmModal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onConfirm={confirmResetData}
        title={language === 'id' ? "RESET DATA SISTEM" : "RESET SYSTEM DATA"}
        message={language === 'id'
          ? "TINDAKAN KRITIS: Seluruh data member, transaksi kasir, dan riwayat presensi akan dihapus permanen. Lanjutkan?"
          : "CRITICAL ACTION: All member records, cashier transactions, and check-in logs will be permanently erased. Proceed?"}
      />

      <SuccessModal
        isOpen={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        title={language === 'id' ? "Berhasil Disimpan" : "Changes Saved"}
        message={language === 'id' ? "Profil dan preferensi akun Anda telah diperbarui." : "Your profile and account preferences have been updated."}
      />

      <SuccessModal
        isOpen={passwordSuccessModal}
        onClose={() => setPasswordSuccessModal(false)}
        title={language === 'id' ? "Password Diperbarui" : "Password Updated"}
        message={language === 'id' ? "Password akun Anda telah berhasil diubah." : "Your account password has been successfully updated."}
      />
    </div>
  );
}

function ToggleRow({ label, sub, active, onToggle }: any) {
  return (
    <div className="flex items-center justify-between p-6 rounded-2xl glass border border-white/5">
      <div>
        <p className="text-xs font-black text-foreground uppercase tracking-wide">{label}</p>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">{sub}</p>
      </div>
      <div
        onClick={onToggle}
        className={`h-7 w-12 rounded-full relative cursor-pointer transition-all ${active ? 'bg-[#FF5A2C] shadow-lg shadow-orange-500/30' : 'bg-white/10'}`}
      >
        <motion.div
          animate={{ x: active ? 22 : 4 }}
          className="h-5 w-5 rounded-full bg-white absolute top-1 shadow-md"
        />
      </div>
    </div>
  );
}
