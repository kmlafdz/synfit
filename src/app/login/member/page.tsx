"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/lib/navigation";
import {
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Phone,
  Key,
  ArrowLeft,
  QrCode,
  Activity,
  CalendarCheck,
  UserCheck,
  CheckCircle2,
  X,
  Mail,
  Lock,
  AlertCircle,
  RefreshCw,
  Send
} from "lucide-react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc
} from "firebase/firestore";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  User
} from "firebase/auth";
import Link from "@/lib/navigation";
import { useLanguage } from "@/store/useLanguageStore";

interface CandidateProfile {
  accountId: string;
  memberId: string;
  name: string;
  whatsapp: string;
  token?: string;
  mustChangePassword?: boolean;
}

type AuthTab = "google" | "email" | "whatsapp";
type EmailMode = "signin" | "signup";

export default function MemberLoginPage() {
  const router = useRouter();
  const { language, setLanguage } = useLanguage();

  // Tab & Mode
  const [authTab, setAuthTab] = useState<AuthTab>("email");
  const [emailMode, setEmailMode] = useState<EmailMode>("signin");

  // Loading & Error States
  const [loadingAction, setLoadingAction] = useState<"email" | "google" | "whatsapp" | "checkVerify" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  // Email/Password Form
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailPasswordConfirm, setEmailPasswordConfirm] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // WhatsApp Form (Backwards Compatibility)
  const [whatsapp, setWhatsapp] = useState("");
  const [waPassword, setWaPassword] = useState("");

  // Modals
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState("");

  // Email Verification State
  const [showVerifyNotice, setShowVerifyNotice] = useState(false);
  const [unverifiedUser, setUnverifiedUser] = useState<User | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);

  // Duplicate Profile Picker (for legacy WhatsApp lookup)
  const [duplicateProfiles, setDuplicateProfiles] = useState<CandidateProfile[] | null>(null);

  // Auto-redirect if member already has an active session
  useEffect(() => {
    try {
      const session = localStorage.getItem("memberSession");
      if (session) {
        router.replace("/member/dashboard");
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  }, [router]);

  // Check for Google Sign-In redirect result on page load (Mobile / fallback)
  useEffect(() => {
    let isMounted = true;
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user && isMounted) {
          setLoadingAction("google");
          await resolveMemberSession(result.user);
        }
      } catch (err: any) {
        console.error("Google Redirect Result Error:", err);
        if (isMounted) {
          setErrorMsg(
            err.code === "auth/account-exists-with-different-credential"
              ? (language === "id"
                  ? "Email ini telah terdaftar dengan metode masuk lain. Silakan masuk dengan email dan kata sandi."
                  : "An account already exists with the same email address using another sign-in method.")
              : (err.message || (language === "id" ? "Gagal memproses login Google." : "Google login failed."))
          );
          setLoadingAction(null);
        }
      }
    };
    checkRedirect();
    return () => {
      isMounted = false;
    };
  }, [language]);

  // Resend Cooldown Timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  /**
   * Post-authentication Member Profile Resolution
   * Checks whether the authenticated Firebase user has a registered active member profile
   */
  const resolveMemberSession = async (user: User) => {
    try {
      const idToken = await user.getIdToken(true);

      // 1. First attempt server-side verification route (Firebase Admin SDK)
      try {
        const res = await fetch("/api/auth/member-firebase", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ idToken }),
        });

        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await res.json();
          if (res.ok && data.success) {
            if (data.isMember && data.member) {
              // Valid existing member profile linked
              localStorage.setItem(
                "memberSession",
                JSON.stringify({
                  memberId: data.member.id,
                  name: data.member.nama || user.displayName || "Member",
                  email: user.email || data.member.email || "",
                  whatsapp: data.member.nomor_whatsapp || "",
                  token: idToken,
                  uid: user.uid,
                  mustChangePassword: false,
                })
              );
              router.replace("/member/dashboard");
              return;
            } else if (data.status === "Pending") {
              setInfoMsg(
                language === "id"
                  ? "Pendaftaran membership Anda sedang ditinjau oleh staf kasir SynFit. Mohon menunggu persetujuan."
                  : "Your membership application is currently pending staff review. Please wait for approval."
              );
              setLoadingAction(null);
              return;
            } else {
              // Firebase account exists but no member profile found -> Redirect to registration
              router.replace(
                `/membership?tab=register&email=${encodeURIComponent(user.email || "")}&nama=${encodeURIComponent(
                  user.displayName || ""
                )}&uid=${encodeURIComponent(user.uid)}`
              );
              return;
            }
          }
        }
      } catch (apiErr) {
        // Fall through to client-side Firestore resolution (Static Hosting CDN)
      }

      // 2. Client-side Firestore fallback (Firebase Hosting static export)
      let matchedMember: any = null;

      // Query by UID first
      try {
        const qUid = query(collection(db, "members"), where("uid", "==", user.uid));
        const snapUid = await getDocs(qUid);
        if (!snapUid.empty) {
          matchedMember = { id: snapUid.docs[0].id, ...snapUid.docs[0].data() };
        }
      } catch (e) {
        console.warn("UID member query fallback notice:", e);
      }

      // Query by Email if not found by UID
      if (!matchedMember && user.email) {
        try {
          const cleanEmail = user.email.toLowerCase().trim();
          const qEmail = query(collection(db, "members"), where("email", "==", cleanEmail));
          const snapEmail = await getDocs(qEmail);
          if (!snapEmail.empty) {
            matchedMember = { id: snapEmail.docs[0].id, ...snapEmail.docs[0].data() };
            // Transparently link UID for future instant lookups
            try {
              await updateDoc(doc(db, "members", snapEmail.docs[0].id), {
                uid: user.uid,
                email_verified: user.emailVerified,
              });
            } catch (linkErr) {
              console.warn("Could not link UID to member record:", linkErr);
            }
          }
        } catch (e) {
          console.warn("Email member query fallback notice:", e);
        }
      }

      // 3. Fallback: Check member_accounts collection if members doc not found directly
      if (!matchedMember) {
        try {
          let accountDoc: any = null;
          const qAccUid = query(collection(db, "member_accounts"), where("uid", "==", user.uid));
          const snapAccUid = await getDocs(qAccUid);
          if (!snapAccUid.empty) {
            accountDoc = snapAccUid.docs[0].data();
          } else if (user.email) {
            const cleanEmail = user.email.toLowerCase().trim();
            const qAccEmail = query(collection(db, "member_accounts"), where("email", "==", cleanEmail));
            const snapAccEmail = await getDocs(qAccEmail);
            if (!snapAccEmail.empty) {
              accountDoc = snapAccEmail.docs[0].data();
            }
          }

          if (accountDoc && accountDoc.member_id) {
            const memDoc = await getDoc(doc(db, "members", accountDoc.member_id));
            if (memDoc.exists()) {
              matchedMember = { id: memDoc.id, ...memDoc.data() };
              // Transparently link UID to member record
              try {
                await updateDoc(doc(db, "members", memDoc.id), {
                  uid: user.uid,
                  email_verified: user.emailVerified,
                });
              } catch (linkErr) {
                console.warn("Could not link UID to member:", linkErr);
              }
            }
          }
        } catch (accErr) {
          console.warn("Member accounts fallback notice:", accErr);
        }
      }

      if (matchedMember) {
        const needsPassChange = matchedMember.must_change_password === true;
        localStorage.setItem(
          "memberSession",
          JSON.stringify({
            memberId: matchedMember.id,
            name: matchedMember.nama || user.displayName || "Member",
            email: user.email || matchedMember.email || "",
            whatsapp: matchedMember.nomor_whatsapp || "",
            token: idToken,
            uid: user.uid,
            mustChangePassword: needsPassChange,
          })
        );
        router.replace("/member/dashboard");
      } else {
        // Check if there is a pending registration by UID or email
        try {
          const qReg = query(
            collection(db, "registrations"),
            where("uid", "==", user.uid),
            where("status", "==", "Pending")
          );
          let snapReg = await getDocs(qReg);

          if (snapReg.empty && user.email) {
            const cleanEmail = user.email.toLowerCase().trim();
            const qRegEmail = query(
              collection(db, "registrations"),
              where("email", "==", cleanEmail),
              where("status", "==", "Pending")
            );
            snapReg = await getDocs(qRegEmail);
          }

          if (!snapReg.empty) {
            setInfoMsg(
              language === "id"
                ? "Pendaftaran membership Anda dengan akun ini sudah tersimpan dan sedang menunggu persetujuan kasir SynFit. Begitu disetujui, Anda langsung dapat mengakses dasbor."
                : "Your membership application with this account is pending SynFit staff approval. You will gain dashboard access once verified."
            );
            setLoadingAction(null);
            return;
          }
        } catch (regErr) {}

        // No profile found -> Redirect to complete registration form
        router.replace(
          `/membership?tab=register&email=${encodeURIComponent(user.email || "")}&nama=${encodeURIComponent(
            user.displayName || ""
          )}&uid=${encodeURIComponent(user.uid)}`
        );
      }
    } catch (err: any) {
      console.error("Session resolution error:", err);
      setErrorMsg(
        err.message ||
          (language === "id"
            ? "Gagal menghubungkan profil akun member. Silakan coba kembali."
            : "Failed to connect member profile. Please try again.")
      );
      setLoadingAction(null);
    }
  };

  /**
   * Google OAuth Login Handler
   */
  const handleGoogleSignIn = async () => {
    setLoadingAction("google");
    setErrorMsg("");
    setInfoMsg("");
    setShowVerifyNotice(false);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      try {
        const result = await signInWithPopup(auth, provider);
        if (result.user) {
          await resolveMemberSession(result.user);
        } else {
          setLoadingAction(null);
        }
      } catch (popupErr: any) {
        // Fallback to signInWithRedirect if popup is blocked or not supported (e.g. in-app mobile browsers)
        if (
          popupErr.code === "auth/popup-blocked" ||
          popupErr.code === "auth/operation-not-supported-in-this-environment"
        ) {
          console.warn("Popup blocked or not supported, redirecting to Google Sign-In...", popupErr);
          await signInWithRedirect(auth, provider);
          return;
        }
        throw popupErr;
      }
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      if (error.code === "auth/popup-closed-by-user") {
        setErrorMsg(
          language === "id"
            ? "Jendela login Google ditutup sebelum proses selesai."
            : "Google login window was closed before completing."
        );
      } else if (error.code === "auth/account-exists-with-different-credential") {
        setErrorMsg(
          language === "id"
            ? "Email ini telah terdaftar dengan metode masuk lain. Silakan masuk dengan email dan kata sandi."
            : "An account already exists with the same email address using another sign-in method."
        );
      } else if (error.code === "auth/unauthorized-domain") {
        setErrorMsg(
          language === "id"
            ? "Domain ini belum diotorisasi di Firebase Authentication Console. Harap hubungi administrator."
            : "This domain is not authorized in Firebase Authentication Console. Please contact administrator."
        );
      } else if (error.code === "auth/network-request-failed") {
        setErrorMsg(
          language === "id"
            ? "Koneksi jaringan terputus. Mohon periksa koneksi internet Anda."
            : "Network error occurred. Please check your internet connection."
        );
      } else {
        setErrorMsg(
          error.message ||
            (language === "id" ? "Gagal melakukan login Google." : "Google Sign-In failed.")
        );
      }
      setLoadingAction(null);
    }
  };

  /**
   * Email/Password Sign-In & Sign-Up Handler
   */
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAction("email");
    setErrorMsg("");
    setInfoMsg("");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMsg(language === "id" ? "Format email tidak valid." : "Please enter a valid email address.");
      setLoadingAction(null);
      return;
    }

    if (emailPassword.length < 6) {
      setErrorMsg(
        language === "id"
          ? "Kata sandi minimal 6 karakter."
          : "Password must be at least 6 characters."
      );
      setLoadingAction(null);
      return;
    }

    if (emailMode === "signup") {
      if (emailPassword !== emailPasswordConfirm) {
        setErrorMsg(
          language === "id"
            ? "Konfirmasi kata sandi tidak cocok."
            : "Passwords do not match."
        );
        setLoadingAction(null);
        return;
      }
      if (!fullName.trim()) {
        setErrorMsg(language === "id" ? "Mohon isi nama lengkap Anda." : "Please enter your full name.");
        setLoadingAction(null);
        return;
      }
    }

    try {
      if (emailMode === "signin") {
        let user: User | null = null;
        try {
          const userCred = await signInWithEmailAndPassword(auth, cleanEmail, emailPassword);
          user = userCred.user;
        } catch (signInErr: any) {
          // If user doesn't exist in Firebase Auth yet, check if they are already an approved member
          // using default password (synfit123 or areta123)
          if (
            (signInErr.code === "auth/user-not-found" || signInErr.code === "auth/invalid-credential") &&
            (emailPassword === "synfit123" || emailPassword === "areta123")
          ) {
            try {
              const qMem = query(collection(db, "members"), where("email", "==", cleanEmail));
              const snapMem = await getDocs(qMem);
              if (!snapMem.empty) {
                // Member exists in database: create Firebase Auth user for them
                const newCred = await createUserWithEmailAndPassword(auth, cleanEmail, emailPassword);
                user = newCred.user;

                // Send email verification immediately
                try {
                  await sendEmailVerification(user);
                } catch (sendErr) {
                  console.warn("sendEmailVerification error on initial member setup:", sendErr);
                }

                setUnverifiedUser(user);
                setShowVerifyNotice(true);
                setInfoMsg(
                  language === "id"
                    ? `Akun Anda telah terdaftar sebagai member resmi! Tautan verifikasi telah dikirim ke ${cleanEmail}. Silakan verifikasi email Anda untuk dapat masuk ke SynFit App.`
                    : `Your account is registered! A verification link has been sent to ${cleanEmail}. Please verify your email to access the SynFit App.`
                );
                setLoadingAction(null);
                return;
              }
            } catch (memberLookupErr) {
              console.warn("Member lookup notice:", memberLookupErr);
            }
          }
          throw signInErr;
        }

        if (!user) {
          throw new Error("Gagal melakukan autentikasi.");
        }

        // Required email verification on first login
        if (!user.emailVerified) {
          try {
            await sendEmailVerification(user);
            setResendCooldown(60);
          } catch (sendErr) {
            console.warn("sendEmailVerification notice:", sendErr);
          }

          setUnverifiedUser(user);
          setShowVerifyNotice(true);
          setInfoMsg(
            language === "id"
              ? `Tautan verifikasi telah dikirim ke ${cleanEmail}. Silakan klik tautan di email Anda untuk mengaktifkan akses masuk.`
              : `A verification link has been sent to ${cleanEmail}. Please click the link to activate your access.`
          );
          setLoadingAction(null);
          return;
        }

        // Email is verified -> Proceed directly to app dashboard
        await resolveMemberSession(user);
      } else {
        // Sign up
        const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, emailPassword);
        const user = userCred.user;

        // Send Email Verification via Firebase Auth
        try {
          await sendEmailVerification(user);
          setResendCooldown(60);
        } catch (sendErr) {
          console.warn("sendEmailVerification error:", sendErr);
        }

        setUnverifiedUser(user);
        setShowVerifyNotice(true);
        setInfoMsg(
          language === "id"
            ? "Akun berhasil dibuat! Tautan verifikasi telah dikirimkan ke email Anda. Silakan verifikasi email sebelum masuk."
            : "Account created! A verification link has been sent to your email. Please verify before signing in."
        );
        setLoadingAction(null);
      }
    } catch (error: any) {
      console.error("Email auth error:", error);
      let friendly = error.message;
      if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        friendly =
          language === "id"
            ? "Email atau kata sandi tidak valid. Silakan periksa kembali."
            : "Invalid email or password. Please try again.";
      } else if (error.code === "auth/email-already-in-use") {
        friendly =
          language === "id"
            ? "Email ini sudah terdaftar. Silakan masuk atau gunakan fitur reset kata sandi."
            : "This email is already registered. Please sign in or use password reset.";
      } else if (error.code === "auth/too-many-requests") {
        friendly =
          language === "id"
            ? "Terlalu banyak percobaan gagal. Silakan tunggu beberapa saat atau reset kata sandi Anda."
            : "Too many failed attempts. Please wait a few moments or reset your password.";
      }
      setErrorMsg(friendly);
      setLoadingAction(null);
    }
  };

  /**
   * Resend Email Verification Handler
   */
  const handleResendVerification = async () => {
    if (!unverifiedUser || resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    try {
      await sendEmailVerification(unverifiedUser);
      setResendCooldown(60);
      setInfoMsg(
        language === "id"
          ? "Email verifikasi berhasil dikirim ulang! Cek kotak masuk atau folder spam Anda."
          : "Verification email sent again! Please check your inbox or spam folder."
      );
    } catch (err: any) {
      setErrorMsg(
        err.message ||
          (language === "id"
            ? "Gagal mengirim ulang email verifikasi. Coba beberapa saat lagi."
            : "Failed to resend verification email.")
      );
    } finally {
      setResendLoading(false);
    }
  };

  /**
   * Check Verification Status Handler
   */
  const handleCheckVerification = async () => {
    if (!auth.currentUser) return;
    setLoadingAction("checkVerify");
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        setShowVerifyNotice(false);
        await resolveMemberSession(auth.currentUser);
      } else {
        setErrorMsg(
          language === "id"
            ? "Email Anda belum terverifikasi. Silakan klik tautan verifikasi yang ada di email Anda terlebih dahulu."
            : "Your email is not verified yet. Please click the link sent to your inbox first."
        );
        setLoadingAction(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memeriksa status verifikasi.");
      setLoadingAction(null);
    }
  };

  /**
   * Password Reset Handler (Firebase Auth native)
   */
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetError("");
    setResetSuccess(false);

    const clean = resetEmail.trim().toLowerCase();
    if (!clean || !clean.includes("@")) {
      setResetError(language === "id" ? "Masukkan alamat email yang valid." : "Please enter a valid email address.");
      setResetLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, clean);
      setResetSuccess(true);
    } catch (err: any) {
      console.error("Password reset error:", err);
      if (err.code === "auth/user-not-found") {
        // Prevent email enumeration
        setResetSuccess(true);
      } else {
        setResetError(
          err.message ||
            (language === "id"
              ? "Gagal mengirim instruksi reset kata sandi."
              : "Failed to send password reset instructions.")
        );
      }
    } finally {
      setResetLoading(false);
    }
  };

  /**
   * Legacy WhatsApp Login Helper Functions
   */
  const getPhoneVariants = (input: string): string[] => {
    const rawDigits = input.replace(/\D/g, "");
    if (!rawDigits) return [];

    let base = rawDigits;
    if (base.startsWith("62")) {
      base = base.substring(2);
    } else if (base.startsWith("0")) {
      base = base.substring(1);
    }

    if (!base) return [rawDigits];

    return Array.from(
      new Set([`62${base}`, `+62${base}`, `0${base}`, base, rawDigits])
    );
  };

  const executeLoginSession = (profile: CandidateProfile) => {
    localStorage.setItem(
      "memberSession",
      JSON.stringify({
        memberId: profile.memberId,
        name: profile.name,
        whatsapp: profile.whatsapp,
        accountId: profile.accountId,
        token: profile.token || "",
        mustChangePassword: profile.mustChangePassword || false,
      })
    );
    router.replace("/member/dashboard");
  };

  const verifyBrowserPassword = async (inputPass: string, storedHashOrPlain?: string): Promise<boolean> => {
    const trimmedInput = (inputPass || "").trim();
    if (!storedHashOrPlain) {
      return trimmedInput === "synfit123" || trimmedInput === "areta123";
    }
    const trimmedStored = storedHashOrPlain.trim();
    if (trimmedInput === trimmedStored) return true;

    if (
      (trimmedInput === "synfit123" || trimmedInput === "areta123") &&
      (trimmedStored === "synfit123" ||
        trimmedStored === "areta123" ||
        trimmedStored.includes("d5a8046bc95c478b53b95887ea154aab548be35bb91f8bc7e751f30f5d8200f7") ||
        trimmedStored.includes("b9c095037bd64c50214e15507656d7fad6f0229c99479339bfbba6234cdd4087"))
    ) {
      return true;
    }

    if (trimmedStored.includes("$")) {
      const raw = trimmedStored.startsWith("$") ? trimmedStored.substring(1) : trimmedStored;
      const parts = raw.split("$");
      if (parts.length >= 2) {
        const salt = parts[0];
        const targetHash = parts[1];
        try {
          const enc = new TextEncoder();
          const keyMaterial = await crypto.subtle.importKey(
            "raw",
            enc.encode(trimmedInput),
            { name: "PBKDF2" },
            false,
            ["deriveBits"]
          );
          const derivedBits = await crypto.subtle.deriveBits(
            {
              name: "PBKDF2",
              salt: enc.encode(salt),
              iterations: 10000,
              hash: "SHA-256",
            },
            keyMaterial,
            256
          );
          const hashArray = Array.from(new Uint8Array(derivedBits));
          const computedHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
          if (computedHash.toLowerCase() === targetHash.toLowerCase()) {
            return true;
          }
        } catch (e) {
          console.error("PBKDF2 error:", e);
        }
      }
    }
    return false;
  };

  const handleWhatsAppLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAction("whatsapp");
    setErrorMsg("");
    setInfoMsg("");
    setDuplicateProfiles(null);

    try {
      const cleanDigits = whatsapp.replace(/\D/g, "");
      if (cleanDigits.length < 7) {
        throw new Error(
          language === "id"
            ? "Masukkan nomor WhatsApp yang valid (minimal 8 digit)."
            : "Please enter a valid WhatsApp number (min 8 digits)."
        );
      }

      // Check server API first
      try {
        const res = await fetch("/api/auth/member-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ whatsapp, password: waPassword }),
        });
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await res.json();
          if (res.ok && data.success && data.member) {
            executeLoginSession({
              accountId: data.member.accountId,
              memberId: data.member.memberId,
              name: data.member.name,
              whatsapp: data.member.whatsapp,
              token: data.token,
              mustChangePassword: Boolean(data.member.must_change_password),
            });
            return;
          } else if (res.status === 400 || res.status === 401) {
            throw new Error(
              data.error ||
                (language === "id"
                  ? "Nomor WhatsApp atau kata sandi tidak valid."
                  : "Invalid WhatsApp number or password.")
            );
          }
        }
      } catch (apiErr: any) {
        if (apiErr.message?.includes("tidak valid") || apiErr.message?.includes("Invalid WhatsApp")) {
          throw apiErr;
        }
      }

      // Client-side Firestore lookup fallback
      const phoneVariants = getPhoneVariants(whatsapp);
      let matchedAccount: any = null;

      try {
        const qAcc = query(
          collection(db, "member_accounts"),
          where("nomor_whatsapp", "in", phoneVariants.slice(0, 10))
        );
        const snapAcc = await getDocs(qAcc);
        for (const docSnap of snapAcc.docs) {
          const accData = docSnap.data();
          const storedSecret = accData.password_hash || accData.password || "";
          const isMatch = await verifyBrowserPassword(waPassword, storedSecret);
          if (isMatch) {
            matchedAccount = { id: docSnap.id, ...accData };
            break;
          }
        }
      } catch (e) {}

      if (!matchedAccount) {
        const qMem = query(
          collection(db, "members"),
          where("nomor_whatsapp", "in", phoneVariants.slice(0, 10))
        );
        const snapMem = await getDocs(qMem);
        for (const docSnap of snapMem.docs) {
          const memData = docSnap.data();
          const memberPass = memData.password_hash || memData.password || "areta123";
          const isMatch = await verifyBrowserPassword(waPassword, memberPass);
          if (isMatch) {
            const isDefault = waPassword === "areta123" || waPassword === "synfit123";
            matchedAccount = {
              id: `acc_${docSnap.id}`,
              member_id: docSnap.id,
              nama: memData.nama,
              nomor_whatsapp: memData.nomor_whatsapp,
              must_change_password: isDefault || memData.must_change_password === true,
            };
            break;
          }
        }
      }

      if (!matchedAccount) {
        throw new Error(
          language === "id"
            ? "Nomor WhatsApp atau kata sandi tidak valid. Silakan periksa kembali."
            : "Invalid WhatsApp number or password. Please try again."
        );
      }

      let memberName = matchedAccount.nama || "Member";
      let memMustChange = matchedAccount.must_change_password;
      if (matchedAccount.member_id) {
        try {
          const memDoc = await getDoc(doc(db, "members", matchedAccount.member_id));
          if (memDoc.exists()) {
            const mData = memDoc.data();
            memberName = mData.nama || memberName;
            if (memMustChange === undefined && mData.must_change_password !== undefined) {
              memMustChange = mData.must_change_password;
            }
          }
        } catch (e) {}
      }

      const isDefaultPass = waPassword === "areta123" || waPassword === "synfit123";
      const shouldForceChange = isDefaultPass || memMustChange === true;

      executeLoginSession({
        accountId: matchedAccount.id,
        memberId: matchedAccount.member_id || matchedAccount.id,
        name: memberName,
        whatsapp: matchedAccount.nomor_whatsapp || whatsapp,
        token: `client_session_${Date.now()}`,
        mustChangePassword: shouldForceChange,
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal masuk");
      setLoadingAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-white selection:bg-blue-500/30 font-sans relative overflow-x-hidden">
      {/* Background Photographic Ambience with Deep Royal Blue Atmosphere */}
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
      <div className="relative z-10 w-full min-h-screen grid grid-cols-1 lg:grid-cols-12">
        {/* Left Column: Athletic Credibility & Member Perks (Desktop) */}
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
                ATHLETIC CLUB
              </p>
            </div>
          </Link>

          {/* Center Motivational Content */}
          <div className="space-y-4 my-auto py-2 max-w-lg">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FF5A2C]/10 border border-[#FF5A2C]/20 text-[#FF5A2C] text-[10px] font-bold tracking-wider uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A2C]" />
                PORTAL RESMI ANGGOTA
              </div>

              <h1 className="text-3xl xl:text-4xl font-black uppercase heading-font tracking-tight leading-[1.1] text-white">
                Disiplin Latihan. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF5A2C] to-[#FF8A00]">
                  Hasil Terukur.
                </span>
              </h1>

              <p className="text-xs text-gray-400 font-medium leading-relaxed">
                {language === "id"
                  ? "Buka akses penuh ke ekosistem pintar SynFit. Lacak biomekanik, check-in barcode, dan maksimalkan setiap repetisi."
                  : "Unlock full access to SynFit. Track biomechanical progression, check in contactless, and optimize reps."}
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="space-y-2 pt-0.5">
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <QrCode className="w-3.5 h-3.5 text-[#FF5A2C]" />
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">
                    {language === "id" ? "Presensi Cepat Barcode" : "Instant QR Check-In"}
                  </h4>
                  <p className="text-[10px] text-gray-400 leading-snug">
                    {language === "id"
                      ? "Akses masuk gym instan dengan barcode digital di dasbor member."
                      : "Seamless gym entrance access with digital QR code."}
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Activity className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">
                    {language === "id" ? "AI Form Coach Vision" : "AI Form Coach Vision"}
                  </h4>
                  <p className="text-[10px] text-gray-400 leading-snug">
                    {language === "id"
                      ? "Analisis sudut sendi & postur repetisi real-time dari kamera HP."
                      : "Real-time joint angle analysis & rep posture tracking via device camera."}
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <CalendarCheck className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">
                    {language === "id" ? "Manajemen Keanggotaan" : "Membership Management"}
                  </h4>
                  <p className="text-[10px] text-gray-400 leading-snug">
                    {language === "id"
                      ? "Pantau sisa masa aktif langganan dan perpanjang paket tanpa antre."
                      : "Track active pass validity days and renew memberships seamlessly."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Security Assurance */}
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-[#FF5A2C]" />
            <span>
              {language === "id"
                ? "Sesi terenkripsi & data keanggotaan terverifikasi resmi Firebase."
                : "Encrypted session & officially verified Firebase member credentials."}
            </span>
          </div>
        </div>

        {/* Right Column: Authentication Panel */}
        <div className="lg:col-span-7 xl:col-span-6 min-h-screen flex flex-col justify-start bg-[#0A101D]/95 backdrop-blur-2xl lg:border-l lg:border-blue-900/30 p-4 sm:p-8 lg:p-10 xl:p-14 overflow-y-auto relative">
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

          {/* Clean Form Container */}
          <div className="w-full max-w-sm sm:max-w-md mx-auto mt-1 sm:mt-4 mb-6 py-1 space-y-4">
            {/* Form Header */}
            <div className="space-y-1">
              <span className="text-[9px] font-black text-[#FF5A2C] tracking-[0.25em] uppercase">
                {language === "id" ? "MASUK KEANGGOTAAN" : "MEMBER SIGN IN"}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white uppercase heading-font tracking-tight">
                {language === "id" ? "Masuk Akun Member" : "Welcome Back"}
              </h2>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                {language === "id"
                  ? "Akses akun member resmi dengan Email terverifikasi atau Google OAuth."
                  : "Access your member account using verified Email or Google OAuth."}
              </p>
            </div>

            {/* Error Alert Box */}
            {errorMsg && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] font-semibold leading-relaxed flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Info Message Box */}
            {infoMsg && (
              <div
                role="status"
                className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] font-semibold leading-relaxed flex items-start gap-2"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                <span>{infoMsg}</span>
              </div>
            )}

            {/* Email Verification Pending Notice Card */}
            {showVerifyNotice && unverifiedUser && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2.5">
                <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[11px]">
                  <Mail className="w-4 h-4" />
                  <span>{language === "id" ? "Verifikasi Email Diperlukan" : "Email Verification Required"}</span>
                </div>
                <p className="text-[11px] text-gray-300 leading-relaxed">
                  {language === "id"
                    ? `Email verifikasi telah dikirim ke ${unverifiedUser.email}. Buka link di inbox/spam Anda untuk mengaktifkan akun.`
                    : `A verification link has been sent to ${unverifiedUser.email}. Open the link to activate your account.`}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCheckVerification}
                    disabled={loadingAction === "checkVerify"}
                    className="flex-1 py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-bold text-[11px] uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {loadingAction === "checkVerify" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{language === "id" ? "Saya Sudah Verifikasi" : "I Have Verified"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendCooldown > 0 || resendLoading}
                    className="py-2 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white font-bold text-[11px] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
                  >
                    {resendLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>{resendCooldown > 0 ? `${resendCooldown}s` : language === "id" ? "Kirim Ulang" : "Resend"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Auth Tab Selector (Email vs WhatsApp) */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-white/[0.04] border border-white/10 rounded-xl">
              <button
                type="button"
                onClick={() => setAuthTab("email")}
                className={`py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  authTab === "email"
                    ? "bg-[#FF5A2C] text-white shadow-md shadow-orange-500/20"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email</span>
              </button>
              <button
                type="button"
                onClick={() => setAuthTab("whatsapp")}
                className={`py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  authTab === "whatsapp"
                    ? "bg-[#FF5A2C] text-white shadow-md shadow-orange-500/20"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>
            </div>

            {/* EMAIL / PASSWORD FORM */}
            {authTab === "email" && (
              <form onSubmit={handleEmailAuth} className="space-y-3 pt-1">
                {/* Form Subheader without redundant signup toggle */}
                <div className="pb-0.5">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    {language === "id" ? "Login Akun Email" : "Email Sign In"}
                  </span>
                </div>

                {/* Email Field */}
                <div className="space-y-1">
                  <label
                    htmlFor="member-email"
                    className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider"
                  >
                    {language === "id" ? "Alamat Email" : "Email Address"}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                    <input
                      id="member-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-11 bg-black/40 border border-white/10 focus:border-[#FF5A2C] focus:ring-1 focus:ring-[#FF5A2C] rounded-xl pl-10 pr-3 text-sm font-bold text-white placeholder:text-gray-600 focus:outline-none transition-all"
                      placeholder="member@synfitgym.com"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="member-password"
                      className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider"
                    >
                      {language === "id" ? "Kata Sandi" : "Password"}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setResetEmail(email);
                        setShowResetModal(true);
                        setResetError("");
                        setResetSuccess(false);
                      }}
                      className="text-[10px] font-bold text-gray-400 hover:text-[#FF5A2C] transition-colors cursor-pointer"
                    >
                      {language === "id" ? "Lupa Kata Sandi?" : "Forgot Password?"}
                    </button>
                  </div>
                  <div className="relative">
                    <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                    <input
                      id="member-password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={emailPassword}
                      onChange={(e) => setEmailPassword(e.target.value)}
                      className="w-full h-11 bg-black/40 border border-white/10 focus:border-[#FF5A2C] focus:ring-1 focus:ring-[#FF5A2C] rounded-xl pl-10 pr-10 text-sm font-bold text-white placeholder:text-gray-600 focus:outline-none transition-all"
                      placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Toggle password visibility"
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors cursor-pointer p-0.5"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Submit Action: Masuk ke SynFit App */}
                <div className="pt-1.5">
                  <button
                    type="submit"
                    disabled={loadingAction === "email"}
                    className="w-full h-11 sm:h-12 bg-[#FF5A2C] hover:bg-[#E04E25] text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-[0_8px_20px_-4px_rgba(255,90,44,0.4)] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loadingAction === "email" ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{language === "id" ? "Memproses..." : "Processing..."}</span>
                      </>
                    ) : (
                      <>
                        <span>{language === "id" ? "Masuk ke SynFit App" : "Sign In to SynFit App"}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* WHATSAPP FORM (Legacy / Backwards Compatibility) */}
            {authTab === "whatsapp" && (
              <form onSubmit={handleWhatsAppLogin} className="space-y-3 pt-1">
                <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-[10px] text-gray-400 leading-snug">
                  {language === "id"
                    ? "Masuk menggunakan nomor WhatsApp terdaftar dari sistem lama SynFit."
                    : "Sign in using your legacy registered WhatsApp number."}
                </div>

                {/* WhatsApp Phone Field */}
                <div className="space-y-1">
                  <label
                    htmlFor="legacy-whatsapp"
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
                      id="legacy-whatsapp"
                      type="tel"
                      required
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="w-full h-11 bg-black/40 border border-white/10 focus:border-[#FF5A2C] focus:ring-1 focus:ring-[#FF5A2C] rounded-xl pl-20 pr-3 text-sm font-bold text-white placeholder:text-gray-600 focus:outline-none transition-all"
                      placeholder="81234567890"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1">
                  <label
                    htmlFor="legacy-password"
                    className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider"
                  >
                    {language === "id" ? "Kata Sandi" : "Password"}
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                    <input
                      id="legacy-password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={waPassword}
                      onChange={(e) => setWaPassword(e.target.value)}
                      className="w-full h-11 bg-black/40 border border-white/10 focus:border-[#FF5A2C] focus:ring-1 focus:ring-[#FF5A2C] rounded-xl pl-10 pr-10 text-sm font-bold text-white placeholder:text-gray-600 focus:outline-none transition-all"
                      placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Toggle password visibility"
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors cursor-pointer p-0.5"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Submit Action: Masuk ke SynFit App */}
                <div className="pt-1.5">
                  <button
                    type="submit"
                    disabled={loadingAction === "whatsapp"}
                    className="w-full h-11 sm:h-12 bg-[#FF5A2C] hover:bg-[#E04E25] text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-[0_8px_20px_-4px_rgba(255,90,44,0.4)] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loadingAction === "whatsapp" ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{language === "id" ? "Memverifikasi..." : "Verifying..."}</span>
                      </>
                    ) : (
                      <>
                        <span>{language === "id" ? "Masuk ke SynFit App" : "Sign In to SynFit App"}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Divider below submit button */}
            <div className="relative flex items-center justify-center pt-2">
              <div className="border-t border-white/10 w-full" />
              <span className="bg-[#07090E] px-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest shrink-0">
                {language === "id" ? "Atau Lanjutkan dengan" : "Or Continue with"}
              </span>
              <div className="border-t border-white/10 w-full" />
            </div>

            {/* Google OAuth Button: Positioned below primary button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loadingAction === "google"}
              className="w-full h-11 sm:h-12 bg-white hover:bg-gray-100 text-gray-900 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 cursor-pointer border border-white/20"
            >
              {loadingAction === "google" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-gray-900" />
                  <span>{language === "id" ? "Menghubungkan Google..." : "Connecting Google..."}</span>
                </>
              ) : (
                <>
                  {/* Official Google 'G' Icon */}
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{language === "id" ? "Lanjutkan dengan Google" : "Continue with Google"}</span>
                </>
              )}
            </button>

            {/* Dual-Direction Switcher to Registration */}
            <div className="pt-2 border-t border-white/10 text-center space-y-1.5">
              <p className="text-[11px] text-gray-400">
                {language === "id" ? "Belum memiliki keanggotaan aktif?" : "Not a registered member yet?"}
              </p>
              <Link
                href="/membership?tab=register"
                className="inline-flex items-center justify-center w-full h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold uppercase tracking-wider text-white transition-all cursor-pointer"
              >
                {language === "id" ? "Daftar Membership Baru" : "Register New Membership"}
              </Link>
            </div>
          </div>

          {/* Panel Footer */}
          <div className="text-center text-[10px] text-gray-600 font-medium shrink-0 pt-2">
            Â© {new Date().getFullYear()} SynFit Athletic Club. All rights reserved.
          </div>
        </div>
      </div>

      {/* Forgot Password Modal (Native Firebase Auth Password Reset) */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl bg-[#0F131C] border border-white/15 p-6 shadow-2xl relative space-y-4">
            <button
              type="button"
              onClick={() => setShowResetModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[#FF5A2C] mb-2">
                <Key className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-white uppercase heading-font">
                {language === "id" ? "Reset Kata Sandi" : "Reset Password"}
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                {language === "id"
                  ? "Masukkan email akun Anda. Kami akan mengirimkan tautan untuk membuat kata sandi baru."
                  : "Enter your account email. We will send you a link to reset your password."}
              </p>
            </div>

            {resetSuccess ? (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{language === "id" ? "Email Terkirim" : "Email Sent"}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-emerald-200">
                  {language === "id"
                    ? "Tautan reset kata sandi telah dikirimkan. Silakan periksa inbox atau folder spam Anda."
                    : "Password reset link has been dispatched. Please check your inbox or spam folder."}
                </p>
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="w-full mt-2 py-2 rounded-lg bg-emerald-500 text-black font-bold text-xs uppercase tracking-wider"
                >
                  {language === "id" ? "Tutup" : "Close"}
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-3">
                {resetError && (
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[11px]">
                    {resetError}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FF5A2C]"
                    placeholder="member@synfitgym.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full h-11 bg-[#FF5A2C] hover:bg-[#E04E25] text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {resetLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>{language === "id" ? "Kirim Tautan Reset" : "Send Reset Link"}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

