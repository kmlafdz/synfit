"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "@/lib/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Sparkles,
  ShieldCheck,
  Zap,
  Calendar,
  User,
  Phone,
  Tag,
  AlertCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  Receipt,
  HelpCircle
} from "lucide-react";
import { db, auth } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useMidtransSnap } from "@/lib/useMidtransSnap";
import { toast } from "sonner";
import Link from "@/lib/navigation";

const DEFAULT_PBKDF2_PASSWORD_HASH =
  "828d85e0c4aabeb99e8986dafa56a004$d5a8046bc95c478b53b95887ea154aab548be35bb91f8bc7e751f30f5d8200f7";

const MIDTRANS_PAYMENT_LINK_1_MONTH =
  process.env.NEXT_PUBLIC_MIDTRANS_PAYMENT_LINK_1_MONTH ||
  "https://app.sandbox.midtrans.com/payment-links/c1c513a6-b31a-4dd7-8cfd-964d6502ccc8-aVfoEzez";

const MIDTRANS_PAYMENT_LINK_3_MONTH =
  process.env.NEXT_PUBLIC_MIDTRANS_PAYMENT_LINK_3_MONTH ||
  "https://app.sandbox.midtrans.com/payment-links/d91013bd-fbb7-480a-b5af-0b2c40303a78-jK4mFaeu";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface MemberInfo {
  id: string;
  nama: string;
  nomor_whatsapp: string;
  email?: string;
  membership_type?: string;
  status?: string;
  tanggal_expired?: string;
}

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openSnap } = useMidtransSnap();

  // URL Query Parameters
  const initialPlan = searchParams.get("plan");
  const callbackPayment = searchParams.get("payment");
  const paramName = searchParams.get("name") || "";
  const paramPhone = searchParams.get("phone") || "";
  const paramEmail = searchParams.get("email") || "";
  const paramRegistrationId = searchParams.get("registrationId") || "";
  const paramOrderType = searchParams.get("orderType") || "";
  const isAutoPay = searchParams.get("autoPay") === "true";

  // State
  const [selectedPlan, setSelectedPlan] = useState<"1 Bulan" | "3 Bulan">(
    initialPlan === "3_bulan" || initialPlan === "3 Bulan" ? "3 Bulan" : "1 Bulan"
  );
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [isLoadingMember, setIsLoadingMember] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [paymentCompleted, setPaymentCompleted] = useState(callbackPayment === "finish");
  const [lastOrderId, setLastOrderId] = useState<string>("");
  const [activationDetails, setActivationDetails] = useState<any>(null);
  const [autoPayTriggered, setAutoPayTriggered] = useState(false);

  // Manual input if not logged in
  const [manualName, setManualName] = useState(paramName);
  const [manualPhone, setManualPhone] = useState(paramPhone);
  const [manualEmail, setManualEmail] = useState(paramEmail);

  // Load member from local session or Firebase
  useEffect(() => {
    const loadSession = async () => {
      try {
        setIsLoadingMember(true);

        // 1. Check local session
        const rawLocalSession = localStorage.getItem("synfit_member_session");
        if (rawLocalSession) {
          try {
            const parsed = JSON.parse(rawLocalSession);
            if (parsed.memberId) {
              const memDoc = await getDoc(doc(db, "members", parsed.memberId));
              if (memDoc.exists()) {
                const data = memDoc.data();
                setMember({
                  id: memDoc.id,
                  nama: data.nama || parsed.name,
                  nomor_whatsapp: data.nomor_whatsapp || parsed.whatsapp,
                  email: data.email || parsed.email,
                  membership_type: data.membership_type,
                  status: data.status,
                  tanggal_expired: data.tanggal_expired,
                });
                setIsLoadingMember(false);
                return;
              }
            }
          } catch (e) {
            console.error("Failed to parse local session:", e);
          }
        }

        // 2. Check Firebase Auth
        const unsub = onAuthStateChanged(auth, async (user) => {
          if (user) {
            try {
              const q = query(collection(db, "members"), where("uid", "==", user.uid));
              const snap = await getDocs(q);
              if (!snap.empty) {
                const d = snap.docs[0].data();
                setMember({
                  id: snap.docs[0].id,
                  nama: d.nama || user.displayName || "Member",
                  nomor_whatsapp: d.nomor_whatsapp || "",
                  email: d.email || user.email || "",
                  membership_type: d.membership_type,
                  status: d.status,
                  tanggal_expired: d.tanggal_expired,
                });
              } else {
                setManualName(user.displayName || "");
                setManualEmail(user.email || "");
              }
            } catch (err) {
              console.error(err);
            }
          }
          setIsLoadingMember(false);
        });

        return () => unsub();
      } catch (err) {
        console.error(err);
        setIsLoadingMember(false);
      }
    };

    loadSession();
  }, []);

  // Price calculations
  const basePrice = selectedPlan === "3 Bulan" ? 350000 : 160000;
  const normalPrice = selectedPlan === "3 Bulan" ? 480000 : 160000;
  const discountAmount = Math.round(basePrice * appliedDiscount);
  const finalPrice = Math.max(0, basePrice - discountAmount);

  const handleApplyVoucher = () => {
    const cleanCode = voucherCode.trim().toUpperCase();
    if (!cleanCode) {
      toast.error("Masukkan kode promo atau referral");
      return;
    }

    if (cleanCode === "SYNFIT20" || cleanCode === "DISKON20" || cleanCode.startsWith("REF")) {
      setAppliedDiscount(0.2); // 20% discount
      toast.success("Voucher 20% berhasil diterapkan!");
    } else {
      toast.error("Kode promo tidak valid atau telah kedaluwarsa");
    }
  };

  // Fungsi aktivasi member serbaguna (dipanggil saat Snap berhasil atau redirect balik)
  const performMemberActivation = async (params: {
    name: string;
    phone: string;
    email?: string;
    plan: "1 Bulan" | "3 Bulan";
    amount: number;
    registrationId?: string | null;
    paymentMethod?: string;
  }) => {
    const { name, phone, email, plan, amount, registrationId, paymentMethod = "Midtrans Snap" } = params;
    const durationDays = plan === "3 Bulan" ? 90 : 30;
    const cleanPhone = phone.replace(/\D/g, "");

    setIsProcessing(true);
    try {
      const today = new Date();
      const expDateObj = new Date(today);
      expDateObj.setDate(expDateObj.getDate() + durationDays);
      const expFormatted = expDateObj.toISOString().split("T")[0];
      const todayFormatted = today.toISOString().split("T")[0];
      const qrToken = `AR-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

      // Cek apakah member sudah ada di Firestore
      const qMem = query(collection(db, "members"), where("nomor_whatsapp", "==", phone));
      const snapMem = await getDocs(qMem);

      let finalMemberId = "";
      let isNew = true;

      if (!snapMem.empty) {
        finalMemberId = snapMem.docs[0].id;
        isNew = false;
        const currentData = snapMem.docs[0].data();
        let baseExp = today;
        if (currentData.tanggal_expired) {
          const curExpDate = new Date(currentData.tanggal_expired);
          if (curExpDate > today) baseExp = curExpDate;
        }
        const updatedExp = new Date(baseExp);
        updatedExp.setDate(updatedExp.getDate() + durationDays);
        const updatedExpFormatted = updatedExp.toISOString().split("T")[0];

        await updateDoc(doc(db, "members", finalMemberId), {
          status: "Active",
          tanggal_expired: updatedExpFormatted,
          membership_type: plan,
        });
      } else {
        const newMemRef = await addDoc(collection(db, "members"), {
          nama: name,
          nomor_whatsapp: cleanPhone || phone,
          email: email || null,
          alamat: "-",
          membership_type: plan,
          status: "Active",
          must_change_password: true,
          tanggal_daftar: todayFormatted,
          tanggal_expired: expFormatted,
          qr_token: qrToken,
          created_at: serverTimestamp(),
        });
        finalMemberId = newMemRef.id;

        await addDoc(collection(db, "member_accounts"), {
          member_id: finalMemberId,
          nama: name,
          nomor_whatsapp: cleanPhone || phone,
          email: email || null,
          password_hash: DEFAULT_PBKDF2_PASSWORD_HASH,
          must_change_password: true,
          created_at: serverTimestamp(),
        });
      }

      const regId = registrationId || paramRegistrationId;
      if (regId) {
        try {
          await updateDoc(doc(db, "registrations", regId), {
            status: "Approved",
            payment_method: paymentMethod,
            member_id: finalMemberId,
          });
        } catch (regErr) {
          console.warn("Could not update registration:", regErr);
        }
      }

      await addDoc(collection(db, "transactions"), {
        member: name,
        type: isNew ? "New Registration (Online Midtrans)" : "Membership Renewal (Online Midtrans)",
        amount: amount || (plan === "3 Bulan" ? 350000 : 160000),
        method: paymentMethod,
        status: "Success",
        date: today.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }),
        created_at: serverTimestamp(),
      });

      setActivationDetails({
        isNewMember: isNew,
        name,
        whatsapp: phone,
        expiredDate: expFormatted,
        defaultPassword: "synfit123",
      });

      localStorage.removeItem("synfit_pending_payment");
      setPaymentCompleted(true);
      toast.success("ðŸŽ‰ Pembayaran Dikonfirmasi! Akun Member Anda Langsung Aktif!");
    } catch (actErr: any) {
      console.error("Auto activation error:", actErr);
      toast.error("Terjadi kendala saat aktivasi otomatis: " + actErr.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePay = async () => {
    const customerName = member?.nama || manualName.trim();
    const customerPhone = member?.nomor_whatsapp || manualPhone.trim();
    const customerEmail = member?.email || manualEmail.trim();

    if (!customerName) {
      toast.error("Silakan masukkan nama lengkap");
      return;
    }
    if (!customerPhone || customerPhone.length < 8) {
      toast.error("Silakan masukkan nomor WhatsApp yang valid");
      return;
    }

    setIsProcessing(true);

    // Dapatkan URL backend API (Opsi 1)
    const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
    let backendUrl = configuredApiUrl || "";
    if (!backendUrl && typeof window !== "undefined") {
      const host = window.location.hostname;
      if (host === "localhost" || host === "127.0.0.1") {
        backendUrl = "http://localhost:5000";
      }
    }

    try {
      const orderId = `SYNFIT-${Date.now()}`;
      setLastOrderId(orderId);

      // Simpan data order ke localStorage agar saat diarahkan kembali setelah bayar, member langsung diaktifkan
      // Simpan data order ke localStorage agar jika ada reload atau redirect, proses tetap dapat dipulihkan
      const pendingData = {
        orderId,
        orderType: member ? "renewal" : "registration",
        membershipType: selectedPlan,
        amount: finalPrice,
        name: customerName,
        phone: customerPhone,
        email: customerEmail,
        memberId: member?.id || null,
        registrationId: paramRegistrationId || null,
        timestamp: Date.now(),
      };
      localStorage.setItem("synfit_pending_payment", JSON.stringify(pendingData));

      // Catat juga ke Firestore payment_orders
      try {
        await addDoc(collection(db, "payment_orders"), {
          ...pendingData,
          status: "Pending",
          payment_method: backendUrl ? "Midtrans Snap (Opsi 1)" : "Midtrans Payment Link",
          created_at: serverTimestamp(),
        });
      } catch (fsErr) {
        console.warn("Could not record payment_orders to Firestore:", fsErr);
      }

      // Ambil Link Pembayaran Resmi Midtrans sesuai paket yang dipilih
      // OPSI 1: Jika Backend API URL tersedia, panggil Endpoint Backend /api/payment/create-snap
      if (backendUrl) {
        toast.info("Menghubungi Midtrans Gateway...");
        let res: Response;
        try {
          res = await fetch(`${backendUrl}/api/payment/create-snap`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pendingData),
          });
        } catch (fetchErr: any) {
          console.warn("Backend API tidak dapat dijangkau di " + backendUrl, fetchErr);
          throw new Error(
            `Tidak dapat menghubungi server pembayaran (${backendUrl}). Pastikan server backend Opsi 1 (server/index.js) sedang aktif.`
          );
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server backend mengembalikan status HTTP ${res.status}`);
        }

        const snapData = await res.json();
        if (!snapData.success || !snapData.token) {
          throw new Error(snapData.error || "Gagal mendapatkan token transaksi dari Midtrans.");
        }

        const snapToken = snapData.token;
        const redirectUrl = snapData.redirectUrl;

        // Buka Pop-up Midtrans Snap
        if (typeof window !== "undefined" && window.snap) {
          openSnap(snapToken, {
            onSuccess: async (result) => {
              toast.success("Pembayaran berhasil diverifikasi!");
              // Konfirmasi ke backend
              try {
                await fetch(`${backendUrl}/api/payment/confirm-order`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    ...pendingData,
                    orderId: snapData.orderId || orderId,
                  }),
                });
              } catch (e) {
                console.warn("Backend confirm warning:", e);
              }

              // Aktivasi member langsung
              await performMemberActivation({
                name: customerName,
                phone: customerPhone,
                email: customerEmail,
                plan: selectedPlan,
                amount: finalPrice,
                registrationId: paramRegistrationId,
                paymentMethod: "Midtrans Snap (Opsi 1)",
              });
            },
            onPending: (result) => {
              toast.info("Pembayaran sedang diproses / menunggu transfer Anda.");
              setIsProcessing(false);
            },
            onError: (result) => {
              toast.error("Pembayaran gagal atau dibatalkan di Midtrans.");
              setIsProcessing(false);
            },
            onClose: () => {
              toast.warning("Jendela pembayaran ditutup.");
              setIsProcessing(false);
            },
          });
          return;
        } else if (redirectUrl) {
          // Jika script Snap diblokir popup blocker / browser extension, alihkan langsung
          window.location.href = redirectUrl;
          return;
        }
      }

      // OPSI 4 FALLBACK (jika backend URL tidak diset)
      const targetPaymentLink =
        selectedPlan === "3 Bulan"
          ? MIDTRANS_PAYMENT_LINK_3_MONTH
          : MIDTRANS_PAYMENT_LINK_1_MONTH;

      toast.info("Membuka halaman pembayaran aman Midtrans...");

      // Arahkan ke Midtrans Payment Link resmi
      setTimeout(() => {
        window.location.href = targetPaymentLink;
      }, 300);
    } catch (err: any) {
      console.error("Payment error:", err);
      toast.error(err.message || "Gagal memproses pembayaran");
      setIsProcessing(false);
    }
  };

  // Cek apakah baru saja menyelesaikan pembayaran dari Midtrans (payment=finish atau ada pending di storage)
  useEffect(() => {
    const checkPaymentReturn = async () => {
      const isFinish = callbackPayment === "finish" || searchParams.get("payment") === "finish";
      const rawPending = localStorage.getItem("synfit_pending_payment");

      if (isFinish || (rawPending && !isAutoPay)) {
        let pendingData: any = null;
        if (rawPending) {
          try {
            pendingData = JSON.parse(rawPending);
          } catch (e) {}
        }

        const name = pendingData?.name || paramName || "Member";
        const phone = pendingData?.phone || paramPhone || "";
        const email = pendingData?.email || paramEmail || "";
        const plan = pendingData?.membershipType || selectedPlan;
        const durationDays = plan === "3 Bulan" ? 90 : 30;
        const cleanPhone = phone.replace(/\D/g, "");

        if (!phone) {
          if (isFinish) setPaymentCompleted(true);
          return;
        }

        setIsProcessing(true);
        try {
          const today = new Date();
          const expDateObj = new Date(today);
          expDateObj.setDate(expDateObj.getDate() + durationDays);
          const expFormatted = expDateObj.toISOString().split("T")[0];
          const todayFormatted = today.toISOString().split("T")[0];
          const qrToken = `AR-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

          // Cek apakah member sudah ada di Firestore
          const qMem = query(collection(db, "members"), where("nomor_whatsapp", "==", phone));
          const snapMem = await getDocs(qMem);

          let finalMemberId = "";
          let isNew = true;

          if (!snapMem.empty) {
            finalMemberId = snapMem.docs[0].id;
            isNew = false;
            const currentData = snapMem.docs[0].data();
            let baseExp = today;
            if (currentData.tanggal_expired) {
              const curExpDate = new Date(currentData.tanggal_expired);
              if (curExpDate > today) baseExp = curExpDate;
            }
            const updatedExp = new Date(baseExp);
            updatedExp.setDate(updatedExp.getDate() + durationDays);
            const updatedExpFormatted = updatedExp.toISOString().split("T")[0];

            await updateDoc(doc(db, "members", finalMemberId), {
              status: "Active",
              tanggal_expired: updatedExpFormatted,
              membership_type: plan,
            });
          } else {
            const newMemRef = await addDoc(collection(db, "members"), {
              nama: name,
              nomor_whatsapp: cleanPhone || phone,
              email: email || null,
              alamat: "-",
              membership_type: plan,
              status: "Active",
              must_change_password: true,
              tanggal_daftar: todayFormatted,
              tanggal_expired: expFormatted,
              qr_token: qrToken,
              created_at: serverTimestamp(),
            });
            finalMemberId = newMemRef.id;

            await addDoc(collection(db, "member_accounts"), {
              member_id: finalMemberId,
              nama: name,
              nomor_whatsapp: cleanPhone || phone,
              email: email || null,
              password_hash: DEFAULT_PBKDF2_PASSWORD_HASH,
              must_change_password: true,
              created_at: serverTimestamp(),
            });
          }

          const regId = pendingData?.registrationId || paramRegistrationId;
          if (regId) {
            try {
              await updateDoc(doc(db, "registrations", regId), {
                status: "Approved",
                payment_method: "Midtrans Payment Link",
                member_id: finalMemberId,
              });
            } catch (regErr) {
              console.warn("Could not update registration:", regErr);
            }
          }

          await addDoc(collection(db, "transactions"), {
            member: name,
            type: isNew ? "New Registration (Online Midtrans)" : "Membership Renewal (Online Midtrans)",
            amount: pendingData?.amount || (plan === "3 Bulan" ? 350000 : 160000),
            method: "Midtrans Payment Link",
            status: "Success",
            date: today.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }),
            created_at: serverTimestamp(),
          });

          setActivationDetails({
            isNewMember: isNew,
            name,
            whatsapp: phone,
            expiredDate: expFormatted,
            defaultPassword: "synfit123",
          });

          localStorage.removeItem("synfit_pending_payment");
          setPaymentCompleted(true);
          toast.success("ðŸŽ‰ Pembayaran Dikonfirmasi! Akun Member Anda Langsung Aktif!");
        } catch (actErr: any) {
          console.error("Auto activation error:", actErr);
          toast.error("Terjadi kendala saat aktivasi otomatis: " + actErr.message);
        } finally {
          setIsProcessing(false);
        }
        await performMemberActivation({
          name,
          phone,
          email,
          plan,
          amount: pendingData?.amount || (plan === "3 Bulan" ? 350000 : 160000),
          registrationId: pendingData?.registrationId || paramRegistrationId,
          paymentMethod: "Midtrans Online",
        });
      }
    };

    checkPaymentReturn();
  }, [callbackPayment]);

  // Auto-redirect ke Midtrans jika autoPay=true dari form pendaftaran baru
  useEffect(() => {
    if (isAutoPay && !autoPayTriggered && !paymentCompleted && !isLoadingMember) {
      const targetName = member?.nama || manualName.trim();
      const targetPhone = member?.nomor_whatsapp || manualPhone.trim();
      if (targetName && targetPhone.length >= 8) {
        setAutoPayTriggered(true);
        const timer = setTimeout(() => {
          handlePay();
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [isAutoPay, autoPayTriggered, paymentCompleted, isLoadingMember, manualName, manualPhone, member]);

  return (
    <div className="min-h-screen bg-[#0A0D14] text-white flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-white/10 bg-[#0F131C]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali</span>
          </button>

          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-black tracking-tighter bg-gradient-to-r from-blue-400 via-indigo-400 to-[#FF5A2C] bg-clip-text text-transparent">
              SYNFIT GYM
            </span>
          </Link>

          <Link
            href="/member/dashboard"
            className="text-xs font-bold px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/20 text-gray-300 transition-all flex items-center gap-1.5"
          >
            <User className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Dashboard Member</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 sm:py-12">
        <AnimatePresence mode="wait">
          {paymentCompleted ? (
            /* PAYMENT SUCCESS SCREEN */
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-lg mx-auto p-6 sm:p-8 rounded-3xl border border-emerald-500/30 bg-[#121824] shadow-2xl space-y-6 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="h-8 w-8" />
              </div>

              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {activationDetails?.isNewMember ? "Pendaftaran Berhasil & Langsung Aktif" : "Pembayaran Terkonfirmasi"}
                </span>
                <h2 className="text-2xl font-black text-white">
                  {activationDetails?.isNewMember ? "Selamat Datang di SynFit!" : "Pembayaran Diterima!"}
                </h2>
                <p className="text-xs text-gray-300 leading-relaxed">
                  {activationDetails?.isNewMember
                    ? "Pembayaran Anda melalui Midtrans telah diverifikasi secara instan. Keanggotaan Anda otomatis aktif tanpa memerlukan persetujuan manual admin!"
                    : "Terima kasih, transaksi Anda via Midtrans telah terkonfirmasi. Membership Anda otomatis diperpanjang."}
                </p>
              </div>

              {/* Instant Account Credentials Box for New Members */}
              {activationDetails?.isNewMember && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-900/40 via-indigo-900/30 to-purple-900/40 border border-blue-500/40 text-left space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black text-blue-300 uppercase tracking-wider">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    <span>Akun Member Anda Langsung Siap:</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-white/10">
                      <span className="text-gray-400">Username / Login ID:</span>
                      <span className="font-mono font-bold text-white bg-black/40 px-2 py-0.5 rounded">
                        {activationDetails.whatsapp}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/10">
                      <span className="text-gray-400">Password Awal:</span>
                      <span className="font-mono font-bold text-amber-300 bg-black/40 px-2 py-0.5 rounded">
                        {activationDetails.defaultPassword || "synfit123"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-gray-400">Masa Aktif Hingga:</span>
                      <span className="font-bold text-emerald-400">
                        {activationDetails.expiredDate}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 italic">
                    *Gunakan nomor WhatsApp dan password di atas untuk masuk ke Member Dashboard dan mengunduh Kartu Digital Anda.
                  </p>
                </div>
              )}

              {lastOrderId && (
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-xs flex justify-between items-center font-mono">
                  <span className="text-gray-400">Order ID:</span>
                  <span className="font-bold text-blue-400">{lastOrderId}</span>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Paket Dipilih:</span>
                  <span className="font-extrabold text-white">{selectedPlan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Dibayar:</span>
                  <span className="font-extrabold text-emerald-400">
                    Rp {finalPrice.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status Keanggotaan:</span>
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Aktif Otomatis</span>
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <Link
                  href={activationDetails?.isNewMember ? "/login/member" : "/member/dashboard"}
                  className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2"
                >
                  <span>{activationDetails?.isNewMember ? "Masuk ke Akun Member Sekarang" : "Buka Dashboard Member"}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/"
                  className="block text-xs font-bold text-gray-400 hover:text-white py-2"
                >
                  Kembali ke Beranda
                </Link>
              </div>
            </motion.div>
          ) : (
            /* CHECKOUT FORM SCREEN */
            <motion.div
              key="checkout"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Header Title */}
              <div className="text-center space-y-2">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  Secure Checkout Midtrans
                </span>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                  Pembayaran Membership SynFit
                </h1>
                <p className="text-xs sm:text-sm text-gray-400 max-w-lg mx-auto">
                  Pilih durasi paket latihanmu dan selesaikan pembayaran instan melalui QRIS, Virtual Account, GoPay, atau Kartu Kredit.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Plan Selection & Member Info */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Member status banner if logged in */}
                  {member && (
                    <div className="p-4 rounded-3xl border border-white/10 bg-[#121622] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-black text-sm">
                          {member.nama.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-black text-white">{member.nama}</p>
                          <p className="text-[10px] text-gray-400">{member.nomor_whatsapp}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            member.status === "Active"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {member.status || "Member"}
                        </span>
                        {member.tanggal_expired && (
                          <p className="text-[9px] text-gray-400 mt-1">
                            Exp: {member.tanggal_expired}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Manual info fields if guest */}
                  {!member && !isLoadingMember && (
                    <div className="p-5 rounded-3xl border border-white/10 bg-[#121622] space-y-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-400" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-gray-300">
                          Data Pelanggan
                        </h3>
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Nama Lengkap *"
                          value={manualName}
                          onChange={(e) => setManualName(e.target.value)}
                          className="w-full p-3 rounded-2xl bg-[#090C14] border border-white/10 text-xs outline-none focus:border-blue-500 transition-colors"
                        />
                        <input
                          type="tel"
                          placeholder="Nomor WhatsApp (contoh: 081234567890) *"
                          value={manualPhone}
                          onChange={(e) => setManualPhone(e.target.value)}
                          className="w-full p-3 rounded-2xl bg-[#090C14] border border-white/10 text-xs outline-none focus:border-blue-500 transition-colors"
                        />
                        <input
                          type="email"
                          placeholder="Email (Opsional untuk bukti invoice)"
                          value={manualEmail}
                          onChange={(e) => setManualEmail(e.target.value)}
                          className="w-full p-3 rounded-2xl bg-[#090C14] border border-white/10 text-xs outline-none focus:border-blue-500 transition-colors"
                        />
                      </div>
                    </div>
                  )}

                  {/* Package Selector Cards */}
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase tracking-wider text-gray-400 block">
                      Pilih Paket Membership:
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* 1 Month Card */}
                      <div
                        onClick={() => setSelectedPlan("1 Bulan")}
                        className={`p-4 rounded-3xl border cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                          selectedPlan === "1 Bulan"
                            ? "border-blue-500 bg-blue-600/10 shadow-lg shadow-blue-950/20 ring-1 ring-blue-500"
                            : "border-white/10 bg-[#121622] hover:border-white/20"
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-white">Paket 1 Bulan</span>
                            {selectedPlan === "1 Bulan" && (
                              <CheckCircle2 className="h-4 w-4 text-blue-400" />
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400">Durasi aktif 30 hari penuh</p>
                          <p className="text-lg font-black text-white pt-1">Rp 160.000</p>
                        </div>
                        <ul className="text-[10px] text-gray-400 space-y-1 border-t border-white/5 pt-2">
                          <li>âœ“ Akses seluruh alat & beban</li>
                          <li>âœ“ Jam operasional penuh</li>
                          <li>âœ“ Loker & fasilitas gym</li>
                        </ul>
                      </div>

                      {/* 3 Months Card (Promo Best Value) */}
                      <div
                        onClick={() => setSelectedPlan("3 Bulan")}
                        className={`p-4 rounded-3xl border cursor-pointer transition-all flex flex-col justify-between gap-3 relative overflow-hidden ${
                          selectedPlan === "3 Bulan"
                            ? "border-indigo-500 bg-indigo-600/10 shadow-lg shadow-indigo-950/20 ring-1 ring-indigo-500"
                            : "border-white/10 bg-[#121622] hover:border-white/20"
                        }`}
                      >
                        <div className="absolute top-0 right-0 bg-gradient-to-l from-indigo-500 to-purple-600 text-white text-[8px] font-black uppercase px-2.5 py-0.5 rounded-bl-xl tracking-wider">
                          Promo Hemat 27%
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-white">Paket 3 Bulan</span>
                            {selectedPlan === "3 Bulan" && (
                              <CheckCircle2 className="h-4 w-4 text-indigo-400" />
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400">Durasi aktif 90 hari penuh</p>
                          <div className="flex items-baseline gap-1.5 pt-1">
                            <span className="text-lg font-black text-indigo-400">Rp 350.000</span>
                            <span className="text-[10px] line-through text-gray-500">Rp 480.000</span>
                          </div>
                        </div>
                        <ul className="text-[10px] text-gray-400 space-y-1 border-t border-white/5 pt-2">
                          <li>âœ“ Akses seluruh alat & beban 90 hari</li>
                          <li>âœ“ Hemat Rp 130.000</li>
                          <li>âœ“ Fitur AI Coach & Habit Tracker</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Promo / Referral Voucher Field */}
                  <div className="p-4 rounded-3xl border border-white/10 bg-[#121622] space-y-2">
                    <label className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-blue-400" />
                      <span>Punya Kode Voucher / Referral?</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Contoh: SYNFIT20"
                        value={voucherCode}
                        onChange={(e) => setVoucherCode(e.target.value)}
                        className="flex-1 p-2.5 rounded-2xl bg-[#090C14] border border-white/10 text-xs font-mono uppercase outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleApplyVoucher}
                        className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-all"
                      >
                        Terapkan
                      </button>
                    </div>
                    {appliedDiscount > 0 && (
                      <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Potongan 20% aktif diterapkan!
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Column: Order Summary & Midtrans Pay CTA */}
                <div className="lg:col-span-5">
                  <div className="p-6 rounded-3xl border border-white/10 bg-[#121622] shadow-xl space-y-5 sticky top-24">
                    <div className="flex items-center gap-2 pb-3 border-b border-white/10">
                      <Receipt className="h-4 w-4 text-blue-400" />
                      <h3 className="text-sm font-black uppercase tracking-wider text-white">
                        Ringkasan Pembayaran
                      </h3>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Paket Membership</span>
                        <span className="font-extrabold text-white">{selectedPlan}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Harga Standar</span>
                        <span className="font-bold text-gray-300">
                          Rp {basePrice.toLocaleString("id-ID")}
                        </span>
                      </div>

                      {appliedDiscount > 0 && (
                        <div className="flex justify-between text-emerald-400">
                          <span>Diskon Voucher (20%)</span>
                          <span className="font-bold">-Rp {discountAmount.toLocaleString("id-ID")}</span>
                        </div>
                      )}

                      <div className="pt-3 border-t border-white/10 flex justify-between items-baseline">
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                          Total Pembayaran
                        </span>
                        <span className="text-2xl font-black text-blue-400">
                          Rp {finalPrice.toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>

                    {/* Midtrans Features Box */}
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-[11px] text-gray-300">
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>Kanal Pembayaran Midtrans Snap</span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-relaxed">
                        Mendukung pembayaran otomatis melalui <strong>QRIS (GoPay/ShopeePay)</strong>, <strong>Virtual Account (BCA, BNI, BRI, Mandiri)</strong>, & <strong>Kartu Kredit</strong>. Tanpa biaya admin tambahan.
                      </p>
                    </div>

                    {/* Pay Button */}
                    <button
                      onClick={handlePay}
                      disabled={isProcessing}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:opacity-95 text-white font-black text-xs uppercase tracking-wider transition-all active:scale-98 shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Mempersiapkan Pembayaran...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>Bayar Sekarang via Midtrans</span>
                        </>
                      )}
                    </button>

                    <p className="text-[9px] text-gray-500 text-center">
                      Transaksi dienkripsi aman 256-bit SSL & diawasi oleh Bank Indonesia.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 text-center text-xs text-gray-500">
        <p>Â© 2026 SynFit Gym Management. Powered by Midtrans Payment Gateway.</p>
      </footer>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0D14] text-white flex items-center justify-center">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            <span>Memuat halaman pembayaran...</span>
          </div>
        </div>
      }
    >
      <PaymentContent />
    </Suspense>
  );
}

