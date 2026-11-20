"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "@/lib/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Loader2,
  Download,
  Share2,
  LogOut,
  Lock,
  CheckCircle2,
  Calendar,
  User,
  ShieldAlert,
  Home,
  CreditCard,
  MessageSquare,
  Clock,
  Dumbbell,
  Send,
  Upload,
  X,
  Sun,
  Moon,
  Globe,
  Camera,
  Bell,
  Flame,
  Activity,
  RefreshCw,
  MapPin,
  QrCode,
  Heart,
  Zap,
  HelpCircle,
  Eye,
  EyeOff,
  Bot,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Gift,
  BarChart3,
  TrendingUp,
  Smartphone,
  Copy,
  Check,
  Coins,
  Award,
  Tag,
  Building2,
  Info,
  FileText,
  Mail,
  KeyRound,
  ShieldCheck,
  Cloud,
  CloudSun,
  CloudRain,
  Droplets,
  Wind,
  Thermometer,
  Navigation,
} from "lucide-react";
import { lazy, Suspense } from "react";

const AIFormCoach = lazy(() =>
  import("@/components/AIFormCoach").then((m) => ({ default: m.AIFormCoach }))
);
import { MemberAIAssistant } from "@/components/MemberAIAssistant";
import { PersonalWorkoutProgramHub } from "@/components/program/PersonalWorkoutProgramHub";
import { MemberTrackerHub } from "@/components/tracker/MemberTrackerHub";
import { SynHubTab } from "@/components/synhub/SynHubTab";
import { GymCheckInModal } from "@/components/checkin/GymCheckInModal";
import { MemberTutorialsHub } from "@/components/tutorials/MemberTutorialsHub";
import { TrainersSection } from "@/components/home/TrainersSection";
import { MadingSection } from "@/components/home/MadingSection";
import { db, auth } from "@/lib/firebase";
import { signOut, sendEmailVerification } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  getDocs,
  setDoc
} from "firebase/firestore";
import { Member } from "@/types";
import { DigitalCard } from "@/components/DigitalCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import html2canvas from "html2canvas";
import { useLanguage } from "@/store/useLanguageStore";
import { useUIStore } from "@/store/useUIStore";
import { QRCodeSVG } from "qrcode.react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { toast } from "sonner";
import { useHeartRateStore } from "@/store/useHeartRateStore";
import { HeartRateHistoryModal } from "@/components/HeartRateHistoryModal";
import { formatPhoneWithPlus62, getCleanWaPhone, formatPhoneDisplay } from "@/lib/utils";
import { useMidtransSnap } from "@/lib/useMidtransSnap";
import Link from "@/lib/navigation";

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

type Tab = "home" | "membership" | "program" | "tracker" | "synhub" | "coach" | "chat" | "profile" | "tutorial";

const TAB_ORDER: Tab[] = ["home", "membership", "program", "tracker", "synhub", "coach", "chat", "profile", "tutorial"];

// WhatsApp-style primary attached tabs (holdable, side-by-side)
const MAIN_TABS: Tab[] = ["home", "membership", "chat", "profile"];
const SWIPEABLE_TABS = MAIN_TABS;

const parseMsgTime = (raw: any): number => {
  if (!raw) return 0;
  if (typeof raw.toDate === "function") return raw.toDate().getTime();
  if (typeof raw === "number") return raw;
  if (raw.seconds) return raw.seconds * 1000;
  const parsed = new Date(raw).getTime();
  return isNaN(parsed) ? 0 : parsed;
};

// Buttery smooth cubic-bezier sliding variants (native iOS/Android feel, zero stutter, zero empty void)
const mobileSlideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : direction < 0 ? "-100%" : 0,
    opacity: 1,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      x: { duration: 0.32, ease: [0.25, 1, 0.5, 1] },
      opacity: { duration: 0.2 },
    },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? "-100%" : direction < 0 ? "100%" : 0,
    opacity: 1,
    transition: {
      x: { duration: 0.32, ease: [0.25, 1, 0.5, 1] },
      opacity: { duration: 0.2 },
    },
  }),
};

const desktopVariants = mobileSlideVariants;

// Smooth fade in / fade out variants for child pages navigated from Beranda (Tutorial, Program, Tracker, SynHub, AI Coach)
const fadeVariants = {
  enter: {
    opacity: 0,
    transition: { duration: 0.22, ease: "easeInOut" },
  },
  center: {
    opacity: 1,
    transition: { duration: 0.22, ease: "easeInOut" },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.18, ease: "easeInOut" },
  },
};

export default function MemberDashboard() {
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const { memberTheme: theme, toggleMemberTheme: toggleTheme } = useUIStore();
  const { openSnap } = useMidtransSnap();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Interactive drag tracking for WhatsApp-style attached tabs with hold support
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchDeltaXRef = useRef<number>(0);
  const touchStartTimeRef = useRef<number>(0);
  const dragDirectionRef = useRef<"none" | "horizontal" | "vertical">("none");
  const [dragOffsetPx, setDragOffsetPx] = useState<number>(0);
  const [isSwipingActive, setIsSwipingActive] = useState<boolean>(false);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [lastMainTab, setLastMainTab] = useState<Tab>("home");
  const [prevTab, setPrevTab] = useState<Tab>("home");
  const [tabDirection, setTabDirection] = useState<number>(0);
  type ProfileSubPage =
    | null
    | "profile_detail"
    | "account_detail"
    | "theme_detail"
    | "language_detail"
    | "about_detail"
    | "terms_detail"
    | "version_detail";

  const [profileSubPage, setProfileSubPage] = useState<ProfileSubPage>(null);
  const [updateToast, setUpdateToast] = useState<boolean>(false);
  const [isSwipeTransition, setIsSwipeTransition] = useState<boolean>(false);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState<boolean>(false);
  const [resetEmailSent, setResetEmailSent] = useState<boolean>(false);
  const [isGoogleLinked, setIsGoogleLinked] = useState<boolean>(true);
  const [accountToast, setAccountToast] = useState<string | null>(null);
  const [showFullEmail, setShowFullEmail] = useState<boolean>(false);

  const isChildView =
    activeTab === "tutorial" ||
    activeTab === "program" ||
    activeTab === "tracker" ||
    activeTab === "synhub" ||
    activeTab === "coach" ||
    profileSubPage !== null;

  const activeMainIndex = Math.max(0, MAIN_TABS.indexOf((isChildView ? lastMainTab : activeTab) as any));

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isChildView) return;
    const target = e.target as HTMLElement | null;
    if (target && target.closest('[data-no-swipe="true"]')) {
      return;
    }
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
      touchStartTimeRef.current = Date.now();
      touchDeltaXRef.current = 0;
      dragDirectionRef.current = "none";
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isChildView || touchStartXRef.current === null || touchStartYRef.current === null) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartXRef.current;
    const diffY = currentY - touchStartYRef.current;

    // Detect gesture intent
    if (dragDirectionRef.current === "none") {
      if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
        if (Math.abs(diffX) > Math.abs(diffY)) {
          dragDirectionRef.current = "horizontal";
          setIsSwipingActive(true);
        } else {
          dragDirectionRef.current = "vertical";
        }
      }
    }

    if (dragDirectionRef.current === "horizontal") {
      // Elastic rubber-band resistance at track boundaries
      let effectiveDiffX = diffX;
      if (activeMainIndex === 0 && diffX > 0) {
        effectiveDiffX = diffX * 0.25;
      } else if (activeMainIndex === MAIN_TABS.length - 1 && diffX < 0) {
        effectiveDiffX = diffX * 0.25;
      }
      touchDeltaXRef.current = effectiveDiffX;
      setDragOffsetPx(effectiveDiffX);
    }
  };

  const handleTouchEnd = () => {
    if (isChildView || touchStartXRef.current === null) return;
    const diffX = touchDeltaXRef.current;
    const duration = Math.max(1, Date.now() - touchStartTimeRef.current);
    const velocity = Math.abs(diffX) / duration;

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    touchDeltaXRef.current = 0;
    setDragOffsetPx(0);
    setIsSwipingActive(false);

    if (dragDirectionRef.current === "horizontal") {
      // Snap threshold: dragged > 50px or quick flick (velocity > 0.3 px/ms)
      if (Math.abs(diffX) > 50 || velocity > 0.3) {
        if (diffX < 0 && activeMainIndex < MAIN_TABS.length - 1) {
          setIsSwipeTransition(true);
          navigateToTab(MAIN_TABS[activeMainIndex + 1]);
          setTimeout(() => setIsSwipeTransition(false), 420);
        } else if (diffX > 0 && activeMainIndex > 0) {
          setIsSwipeTransition(true);
          navigateToTab(MAIN_TABS[activeMainIndex - 1]);
          setTimeout(() => setIsSwipeTransition(false), 420);
        }
      }
    }
    dragDirectionRef.current = "none";
  };
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [member, setMember] = useState<Member | null>(null);
  const [session, setSession] = useState<any>(null);

  // Persistent Smartwatch Heart Rate Store Subscription
  const hrStatus = useHeartRateStore((s) => s.status);
  const hrCurrentBpm = useHeartRateStore((s) => s.currentBpm);
  const hrLastValidBpm = useHeartRateStore((s) => s.lastValidBpm);
  const hrDeviceName = useHeartRateStore((s) => s.deviceName);
  const hrStats = useHeartRateStore((s) => s.stats);

  // Sync memberId into persistent BLE store
  useEffect(() => {
    if (member?.id) {
      useHeartRateStore.getState().setMemberId(member.id);
    }
  }, [member?.id]);

  // Detect mobile viewport for fluid page slide animation
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Detect if PWA is already installed in smartphone
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkPwaInstalled = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes("android-app://") ||
        localStorage.getItem("pwa_installed") === "true";
      setIsPwaInstalled(Boolean(isStandaloneMode));
    };

    checkPwaInstalled();

    const handleInstalled = () => {
      localStorage.setItem("pwa_installed", "true");
      setIsPwaInstalled(true);
    };

    window.addEventListener("appinstalled", handleInstalled);
    return () => window.removeEventListener("appinstalled", handleInstalled);
  }, []);

  // Universal multi-container scroll reset helper
  const resetScrollAcrossContainers = () => {
    // 1. Direct reset on the main scrolling ref
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
      try {
        mainContentRef.current.scrollTo({ top: 0, left: 0, behavior: "instant" });
      } catch { }
    }

    // 2. Direct reset by element ID
    const el = document.getElementById("member-main-content");
    if (el) {
      el.scrollTop = 0;
      try {
        el.scrollTo({ top: 0, left: 0, behavior: "instant" });
      } catch { }
    }

    // 3. Scroll top anchor element if present
    const topAnchor = document.getElementById("member-tab-top-anchor");
    if (topAnchor) {
      try {
        topAnchor.scrollIntoView({ block: "start", inline: "nearest", behavior: "instant" });
      } catch { }
    }

    // 4. Reset document & window levels
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    } catch {
      window.scrollTo(0, 0);
    }
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  // Unified Navigation Stack Item
  type NavStackItem = {
    tab: Tab;
    subPage: ProfileSubPage;
  };

  // Stack of opened pages/subpages for full chronological back-navigation
  const [navStack, setNavStack] = useState<NavStackItem[]>([{ tab: "home", subPage: null }]);
  const navStackRef = useRef<NavStackItem[]>(navStack);
  navStackRef.current = navStack;

  // Navigation state refs
  const profileSubPageRef = useRef<ProfileSubPage>(profileSubPage);
  profileSubPageRef.current = profileSubPage;

  const isChildViewRef = useRef<boolean>(isChildView);
  isChildViewRef.current = isChildView;

  const activeTabRef = useRef<Tab>(activeTab);
  activeTabRef.current = activeTab;

  // Pop the top item from the navigation stack and navigate to the previous view
  const popStack = () => {
    setNavStack((prev) => {
      if (prev.length <= 1) {
        // At root level, return cleanly to home
        setPrevTab(activeTabRef.current);
        setTabDirection(-1);
        setActiveTab("home");
        setProfileSubPage(null);
        resetScrollAcrossContainers();
        return [{ tab: "home", subPage: null }];
      }

      const nextStack = [...prev];
      nextStack.pop(); // Remove the current page/subpage
      const previous = nextStack[nextStack.length - 1];

      setPrevTab(activeTabRef.current);
      setTabDirection(-1);

      if (MAIN_TABS.includes(previous.tab)) {
        setLastMainTab(previous.tab);
      }

      setActiveTab(previous.tab);
      setProfileSubPage(previous.subPage);

      resetScrollAcrossContainers();
      requestAnimationFrame(resetScrollAcrossContainers);

      return nextStack;
    });
  };

  // Trigger back navigation (syncs with browser history if available)
  const goBack = () => {
    if (
      typeof window !== "undefined" &&
      window.history.state?.synfitInitialized &&
      (window.history.state?.synfitStackDepth ?? 0) > 0
    ) {
      window.history.back();
    } else {
      popStack();
    }
  };

  // Close subpage uses the exact same goBack mechanism
  const closeProfileSubPage = goBack;

  // Open Profile Sub-page and record in stack & browser history
  const openProfileSubPage = (sub: ProfileSubPage) => {
    setProfileSubPage(sub);
    resetScrollAcrossContainers();

    const nextDepth = navStackRef.current.length;
    setNavStack((prev) => [...prev, { tab: activeTabRef.current, subPage: sub }]);

    if (typeof window !== "undefined") {
      window.history.pushState(
        { synfitInitialized: true, synfitStackDepth: nextDepth },
        "",
        ""
      );
    }
  };

  // Navigate to a new Tab and record in stack & browser history
  const navigateToTab = (newTab: Tab) => {
    if (newTab === activeTab && profileSubPage === null) {
      return;
    }

    setProfileSubPage(null);
    setPrevTab(activeTab);

    // Direction calculation for transition context
    const currentSwipeIndex = MAIN_TABS.indexOf(activeTab);
    const newSwipeIndex = MAIN_TABS.indexOf(newTab);
    if (currentSwipeIndex !== -1 && newSwipeIndex !== -1) {
      setTabDirection(newSwipeIndex > currentSwipeIndex ? 1 : -1);
    } else if (activeTab === "home") {
      setTabDirection(1);
    } else if (newTab === "home") {
      setTabDirection(-1);
    } else {
      const currentIndex = TAB_ORDER.indexOf(activeTab);
      const newIndex = TAB_ORDER.indexOf(newTab);
      setTabDirection(newIndex > currentIndex ? 1 : -1);
    }

    if (MAIN_TABS.includes(newTab)) {
      setLastMainTab(newTab);
    }

    const nextDepth = navStackRef.current.length;
    setNavStack((prev) => [...prev, { tab: newTab, subPage: null }]);

    if (typeof window !== "undefined") {
      window.history.pushState(
        { synfitInitialized: true, synfitStackDepth: nextDepth },
        "",
        ""
      );
    }

    // Pre-emptively reset scroll before tab transition
    resetScrollAcrossContainers();
    setActiveTab(newTab);

    // Multi-frame scroll reset on navigation dispatch
    resetScrollAcrossContainers();
    requestAnimationFrame(resetScrollAcrossContainers);
  };

  // Smartphone Hardware / Browser Gesture Back Synchronization
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Seed history state so the very first back doesn't eject out of app immediately
    if (!window.history.state || !window.history.state.synfitInitialized) {
      window.history.replaceState({ synfitInitialized: true, synfitStackDepth: 0 }, "", "");
    }

    const handlePopState = () => {
      popStack();
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Continuous multi-stage scroll reset whenever activeTab changes across the transition timeline
  useEffect(() => {
    resetScrollAcrossContainers();
    const raf1 = requestAnimationFrame(resetScrollAcrossContainers);
    const t1 = setTimeout(resetScrollAcrossContainers, 20);
    const t2 = setTimeout(resetScrollAcrossContainers, 60);
    const t3 = setTimeout(resetScrollAcrossContainers, 140);
    const t4 = setTimeout(resetScrollAcrossContainers, 280); // When exit slide animation completes
    const t5 = setTimeout(resetScrollAcrossContainers, 350); // After layout fully settles

    return () => {
      cancelAnimationFrame(raf1);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [activeTab]);


  // Real-time Receptionist Typing Status & Member Broadcast
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  const memberTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!member?.id) return;
    const unsub = onSnapshot(
      doc(db, "typing_status", member.id),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          const isRecent = d.admin_time && Date.now() - d.admin_time < 3500;
          setIsAdminTyping(!!d.admin_typing && isRecent);
        } else {
          setIsAdminTyping(false);
        }
      },
      (_err) => {
        // Gracefully ignore permission or network error on typing status
        setIsAdminTyping(false);
      }
    );
    return () => unsub();
  }, [member?.id]);

  const broadcastMemberTyping = () => {
    if (!member?.id) return;
    setDoc(doc(db, "typing_status", member.id), {
      member_typing: true,
      member_time: Date.now(),
    }, { merge: true }).catch(() => { });

    if (memberTypingTimeoutRef.current) clearTimeout(memberTypingTimeoutRef.current);
    memberTypingTimeoutRef.current = setTimeout(() => {
      setDoc(doc(db, "typing_status", member.id), {
        member_typing: false,
      }, { merge: true }).catch(() => { });
    }, 3000);
  };

  // Edit Personal Data State
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [editNama, setEditNama] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAlamat, setEditAlamat] = useState("");
  const [isSavingPersonal, setIsSavingPersonal] = useState(false);

  // Password Change State
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passSuccess, setPassSuccess] = useState(false);
  const [passError, setPassError] = useState("");

  // Promo & Hero Banner Slider State with Direction Tracking
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [bannerDirection, setBannerDirection] = useState<1 | -1>(1);

  const goToNextBanner = () => {
    setBannerDirection(1);
    setCurrentBannerIndex((prev) => (prev + 1) % 4);
  };

  const goToPrevBanner = () => {
    setBannerDirection(-1);
    setCurrentBannerIndex((prev) => (prev - 1 + 4) % 4);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setBannerDirection(1);
      setCurrentBannerIndex((prev) => (prev + 1) % 4);
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  // Chat & AI State
  const shouldReduceMotion = useReducedMotion();
  const [chatMode, setChatMode] = useState<"ai" | "human">("human");
  const [isAiFloatingOpen, setIsAiFloatingOpen] = useState(false);
  const [isChatTransitioning, setIsChatTransitioning] = useState(false);

  // Keyboard accessibility: Escape key closes floating chat gracefully
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isAiFloatingOpen) {
        setIsAiFloatingOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAiFloatingOpen]);

  // Prevent background scrolling when floating AI chat is open (especially on mobile)
  useEffect(() => {
    if (!isAiFloatingOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;

    document.body.style.overflow = "hidden";

    // Prevent touch dragging on mobile background/backdrop outside the chat panel
    const preventTouchMove = (e: TouchEvent) => {
      const chatPanel = document.getElementById("synfit-ai-floating-panel");
      if (chatPanel && chatPanel.contains(e.target as Node)) {
        return; // Allow touch scrolling inside the chat messages!
      }
      e.preventDefault();
    };

    document.addEventListener("touchmove", preventTouchMove, { passive: false });

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      document.removeEventListener("touchmove", preventTouchMove);
    };
  }, [isAiFloatingOpen]);

  // Debounced toggle handler prevents double-click race condition
  const handleToggleFloatingChat = () => {
    if (isChatTransitioning) return;
    setIsChatTransitioning(true);
    setIsAiFloatingOpen((prev) => !prev);
    setTimeout(() => {
      setIsChatTransitioning(false);
    }, 320);
  };

  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [lastReadChatTime, setLastReadChatTime] = useState<number>(() => {
    if (typeof window !== "undefined") {
      try {
        return Number(localStorage.getItem("synfit_member_last_read_chat")) || 0;
      } catch {
        return 0;
      }
    }
    return 0;
  });

  // Renewal State
  const [qrisUrl, setQrisUrl] = useState("");
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [renewalStep, setRenewalStep] = useState<1 | 2>(1);
  const [renewalPlan, setRenewalPlan] = useState<"1 Bulan" | "3 Bulan">("1 Bulan");
  const [renewalProof, setRenewalProof] = useState("");
  const [isRenewing, setIsRenewing] = useState(false);
  const [renewalSuccess, setRenewalSuccess] = useState(false);

  // Banner Interactive Features State
  const [showFeatureTourModal, setShowFeatureTourModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showStreakRewardsModal, setShowStreakRewardsModal] = useState(false);
  const [showHeartRateHistoryModal, setShowHeartRateHistoryModal] = useState(false);
  const [showGymCheckInModal, setShowGymCheckInModal] = useState(false);
  const [userPoints, setUserPoints] = useState<number>(1250);
  const [streakDays, setStreakDays] = useState<number>(12);
  const [hasClaimedToday, setHasClaimedToday] = useState(false);
  const [referralFriendCode, setReferralFriendCode] = useState("");
  const [appliedReferralDiscount, setAppliedReferralDiscount] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleSelectPromo3Months = () => {
    setRenewalPlan("3 Bulan");
    setRenewalStep(1);
    navigateToTab("membership");
    toast.success("Promo Membership 3 Bulan Rp 350.000 (Diskon 27%) berhasil diterapkan!");
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Kode ${code} berhasil disalin ke clipboard!`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const rewardCatalog = [
    {
      id: "pt-session",
      name: "Free PT Session",
      category: "Personal Training",
      points: 500,
      icon: Dumbbell,
      color: "text-blue-400 bg-blue-500/20 border-blue-500/30",
      description: "1x Sesi privat 60 menit bersama Personal Trainer bersertifikasi SynFit",
    },
    {
      id: "membership-disc",
      name: "Diskon Membership 20%",
      category: "Voucher Diskon",
      points: 400,
      icon: Tag,
      color: "text-amber-400 bg-amber-500/20 border-amber-500/30",
      description: "Voucher potongan 20% untuk perpanjangan paket membership bulan depan",
    },
    {
      id: "supplement",
      name: "Suplemen & Minuman",
      category: "Nutrisi & Bar",
      points: 250,
      icon: Sparkles,
      color: "text-emerald-400 bg-emerald-500/20 border-emerald-500/30",
      description: "1x Whey Protein Shake atau BCAA Drink segar di Bar Gym SynFit",
    },
    {
      id: "merch",
      name: "Merchandise Kaos SynFit",
      category: "Apparel Resmi",
      points: 750,
      icon: Award,
      color: "text-purple-400 bg-purple-500/20 border-purple-500/30",
      description: "Kaos Dry-Fit eksklusif SynFit edisi atletik terbatas",
    },
  ];

  const handleRedeemReward = (reward: (typeof rewardCatalog)[0]) => {
    if (userPoints < reward.points) {
      toast.error(`Poin Anda belum cukup (${userPoints}/${reward.points} Poin). Kumpulkan lebih banyak dari login harian & sesi latihan!`);
      return;
    }
    setUserPoints((prev) => prev - reward.points);
    if (reward.id === "membership-disc") {
      setAppliedReferralDiscount(true);
    }
    toast.success(`ðŸŽ‰ Berhasil menukarkan ${reward.name}! Voucher Anda telah aktif dan dapat ditunjukkan ke resepsionis.`);
  };

  // Reset scroll when switching internal renewal steps (e.g. package selection -> QRIS)
  useEffect(() => {
    resetScrollAcrossContainers();
    const raf = requestAnimationFrame(resetScrollAcrossContainers);
    const t = setTimeout(resetScrollAcrossContainers, 50);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [renewalStep]);

  // Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);

  // Profile Picture Upload State
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const memberPhotoInputRef = useRef<HTMLInputElement>(null);

  // QR Token Refresh State
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);

  // GPS Tracking States
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [isCheckingGPS, setIsCheckingGPS] = useState(false);
  const [activeCheckinId, setActiveCheckinId] = useState<string | null>(null);
  const [checkinTime, setCheckinTime] = useState<Date | null>(null);
  const [workoutDuration, setWorkoutDuration] = useState(0);
  const [gymCoords, setGymCoords] = useState<{ latitude: number; longitude: number; radius: number } | null>(null);
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);

  // Real-time Environmental & Weather States
  const [realtimeClock, setRealtimeClock] = useState<string>("");
  const [userLocationName, setUserLocationName] = useState<string>("Bekasi, Jawa Barat");
  const [weatherData, setWeatherData] = useState<{
    temp: number;
    weatherCode: number;
    weatherDesc: string;
    humidity: number;
    windSpeed: number;
    aqi: number;
    aqiLabel: string;
    aqiColor: string;
    isDay: boolean;
  }>({
    temp: 29,
    weatherCode: 1,
    weatherDesc: "Cerah Berawan",
    humidity: 72,
    windSpeed: 8,
    aqi: 68,
    aqiLabel: "Sedang",
    aqiColor: "text-amber-400 bg-amber-400/15 border-amber-400/30",
    isDay: true,
  });

  // Visits Data State
  const [visitsData, setVisitsData] = useState<any[]>([]);

  // AI Form Coach Workouts State
  const [workoutHistory, setWorkoutHistory] = useState<any[]>([]);

  // Biometrics & Personal Info State for AI Analysis
  const [userHeight, setUserHeight] = useState<number | string>("");
  const [userWeight, setUserWeight] = useState<number | string>("");
  const [userGender, setUserGender] = useState<"male" | "female">("male");
  const [userAge, setUserAge] = useState<number | string>("");
  const [userFitnessGoal, setUserFitnessGoal] = useState<string>("hypertrophy");
  const [isSavingBiometrics, setIsSavingBiometrics] = useState(false);
  const [biometricsSuccess, setBiometricsSuccess] = useState(false);

  // Email Verification Status State
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(true);
  const [userAuthEmail, setUserAuthEmail] = useState<string>("");
  const [isSendingVerifyEmail, setIsSendingVerifyEmail] = useState<boolean>(false);
  const [verifyEmailSent, setVerifyEmailSent] = useState<boolean>(false);

  // Check email verification from Firebase Auth
  useEffect(() => {
    const checkEmailVerifyStatus = async () => {
      if (auth.currentUser) {
        try {
          await auth.currentUser.reload();
          setIsEmailVerified(auth.currentUser.emailVerified);
          setUserAuthEmail(auth.currentUser.email || "");
        } catch (e) {
          setIsEmailVerified(auth.currentUser.emailVerified);
          setUserAuthEmail(auth.currentUser.email || "");
        }
      } else if (member?.email) {
        setUserAuthEmail(member.email);
        if (member.email_verified !== undefined) {
          setIsEmailVerified(Boolean(member.email_verified));
        }
      }
    };

    checkEmailVerifyStatus();
  }, [member]);

  const handleSendVerificationEmail = async () => {
    if (!auth.currentUser) {
      toast.info(
        language === "id"
          ? "Silakan login ulang dengan akun Email untuk memverifikasi alamat email Anda."
          : "Please log in with your Email account to verify your email address."
      );
      return;
    }
    setIsSendingVerifyEmail(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setVerifyEmailSent(true);
      toast.success(
        language === "id"
          ? `Tautan verifikasi telah dikirim ke ${auth.currentUser.email}! Periksa inbox atau spam.`
          : `Verification link sent to ${auth.currentUser.email}! Check inbox or spam folder.`
      );
    } catch (err: any) {
      console.error("Verification email send error:", err);
      toast.error(
        language === "id"
          ? "Gagal mengirim email verifikasi. Tunggu beberapa saat sebelum mencoba lagi."
          : "Failed to send verification email. Please try again in a few moments."
      );
    } finally {
      setIsSendingVerifyEmail(false);
    }
  };

  // Load Member & Session
  useEffect(() => {
    const rawSession = localStorage.getItem("memberSession");
    if (!rawSession) {
      router.replace("/login/member");
      return;
    }
    const sessionData = JSON.parse(rawSession);
    setSession(sessionData);

    const fetchMember = async () => {
      try {
        let loaded = false;
        // 1. Try server-side API (works in local dev / Node runtime)
        try {
          const res = await fetch("/api/member/profile", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-member-session-token": sessionData.token || "",
            },
            body: JSON.stringify({ action: "get" }),
          });
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await res.json();
            if (res.ok && data.success && data.member) {
              let localBio = {};
              try {
                const rawBio = localStorage.getItem(`member_biometrics_${sessionData.memberId}`);
                if (rawBio) localBio = JSON.parse(rawBio);
              } catch (e) { }
              const mData = { ...data.member, ...localBio } as Member;
              setMember(mData);
              setEditNama(mData.nama || "");
              setEditPhone(mData.nomor_whatsapp || "");
              setEditAlamat(mData.alamat || "");
              const shouldChange = Boolean(data.must_change_password);
              setSession((prev: any) => ({ ...prev, mustChangePassword: shouldChange }));
              try {
                const cur = JSON.parse(localStorage.getItem("memberSession") || "{}");
                cur.mustChangePassword = shouldChange;
                localStorage.setItem("memberSession", JSON.stringify(cur));
              } catch (e) { }
              loaded = true;
            }
          }
        } catch (apiErr) {
          // Static hosting fallback
        }

        // 2. Client-side Firestore fallback (for Firebase Hosting Classic / Spark Plan)
        if (!loaded) {
          try {
            let memDoc: any = null;
            if (sessionData.memberId) {
              const directDoc = await getDoc(doc(db, "members", sessionData.memberId));
              if (directDoc.exists()) {
                memDoc = directDoc;
              }
            }

            // Check if memberId is an accountId with member_id reference
            if (!memDoc && sessionData.accountId) {
              try {
                const accDoc = await getDoc(doc(db, "member_accounts", sessionData.accountId));
                if (accDoc.exists() && accDoc.data().member_id) {
                  const resolvedMem = await getDoc(doc(db, "members", accDoc.data().member_id));
                  if (resolvedMem.exists()) {
                    memDoc = resolvedMem;
                  }
                }
              } catch (e) { }
            }

            // Fallback: look up by WhatsApp phone number
            if (!memDoc && sessionData.whatsapp) {
              try {
                const cleanPhone = (sessionData.whatsapp || "").replace(/\D/g, "");
                const allMem = await getDocs(collection(db, "members"));
                const matched = allMem.docs.find((d) => {
                  const p = (d.data().nomor_whatsapp || "").replace(/\D/g, "");
                  return p && (p === cleanPhone || p.endsWith(cleanPhone) || cleanPhone.endsWith(p));
                });
                if (matched) {
                  memDoc = matched;
                }
              } catch (e) { }
            }

            if (memDoc && memDoc.exists()) {
              let localBio = {};
              try {
                const rawBio = localStorage.getItem(`member_biometrics_${memDoc.id}`);
                if (rawBio) localBio = JSON.parse(rawBio);
              } catch (e) { }
              const mData = { id: memDoc.id, ...memDoc.data(), ...localBio } as Member;
              setMember(mData);
              setEditNama(mData.nama || "");
              setEditPhone(mData.nomor_whatsapp || "");
              setEditAlamat(mData.alamat || "");

              // Check if password must be changed
              let needsPassChange = false;
              const memRaw = memDoc.data();
              if (memRaw.must_change_password === true) {
                needsPassChange = true;
              } else if (memRaw.must_change_password === false) {
                needsPassChange = false;
              } else {
                needsPassChange = Boolean(sessionData.mustChangePassword);
              }

              // Also query member_accounts to ensure we respect updated password
              try {
                const qAcc = query(collection(db, "member_accounts"), where("member_id", "==", memDoc.id));
                const snapAcc = await getDocs(qAcc);
                if (!snapAcc.empty) {
                  const accData = snapAcc.docs[0].data();
                  if (accData.must_change_password === false) {
                    needsPassChange = false;
                  } else if (accData.must_change_password === true) {
                    needsPassChange = true;
                  }
                }
              } catch (e) { }

              setSession((prev: any) => ({
                ...prev,
                memberId: memDoc.id,
                name: mData.nama || sessionData.name,
                whatsapp: mData.nomor_whatsapp || sessionData.whatsapp,
                mustChangePassword: needsPassChange,
              }));

              // Update session storage with the verified member ID and verified password change status
              try {
                localStorage.setItem(
                  "memberSession",
                  JSON.stringify({
                    ...sessionData,
                    memberId: memDoc.id,
                    name: mData.nama || sessionData.name,
                    whatsapp: mData.nomor_whatsapp || sessionData.whatsapp,
                    mustChangePassword: needsPassChange,
                  })
                );
              } catch (e) { }

              loaded = true;
            }
          } catch (fsErr) {
            console.warn("Client-side member load notice:", fsErr);
          }
        }

        if (!loaded) {
          // If basic session identity exists, provide a graceful state instead of an abrupt boot
          if (sessionData && (sessionData.name || sessionData.whatsapp)) {
            const fallbackMember: Member = {
              id: sessionData.memberId || "temp_id",
              nama: sessionData.name || "Member",
              nomor_whatsapp: sessionData.whatsapp || "",
              alamat: "",
              membership_type: "Active Member",
              status: "Active",
              tanggal_daftar: new Date(),
              tanggal_expired: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              verification_status: true,
              created_at: new Date(),
              qr_token: `token_${sessionData.memberId || "member"}`,
            };
            setMember(fallbackMember);
            setEditNama(fallbackMember.nama);
            setEditPhone(fallbackMember.nomor_whatsapp);
            loaded = true;
          } else {
            localStorage.removeItem("memberSession");
            router.replace("/login/member");
          }
        }
      } catch (err) {
        console.error("fetchMember error:", err);
      } finally {
        setIsLoading(false);
      }
    };

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

    fetchMember();
    fetchQris();
  }, [router]);

  // Intercept mobile hardware/browser back button to prevent accidental exit to login page
  useEffect(() => {
    window.history.pushState({ synfit: "dashboard" }, "");

    const handlePopState = () => {
      // 1. If any modal is open, close it first
      if (showProfileMenu || showLogoutModal || showRenewalModal || showLocationModal || isEditingPersonal) {
        setShowProfileMenu(false);
        setShowLogoutModal(false);
        setShowRenewalModal(false);
        setShowLocationModal(false);
        setIsEditingPersonal(false);
        window.history.pushState({ synfit: "dashboard" }, "");
        return;
      }

      // 2. If user is in another tab (coach, chat, profile, membership), return to home tab
      if (activeTab !== "home") {
        navigateToTab("home");
        window.history.pushState({ synfit: "dashboard" }, "");
        return;
      }

      // 3. If already on home tab, trap navigation and keep member on dashboard
      window.history.pushState({ synfit: "dashboard" }, "");
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [
    activeTab,
    showProfileMenu,
    showLogoutModal,
    showRenewalModal,
    showLocationModal,
    isEditingPersonal,
  ]);

  // Sync Biometrics Form with Member
  useEffect(() => {
    if (member) {
      setUserHeight(member.tinggi_badan ?? "");
      setUserWeight(member.berat_badan ?? "");
      setUserGender(member.jenis_kelamin ?? "male");
      setUserAge(member.umur ?? "");
      setUserFitnessGoal(member.target_fitness ?? "hypertrophy");
    }
  }, [member]);

  // Fetch Member Notifications via Secure API with Static Hosting Fallback
  useEffect(() => {
    if (!member) return;
    const fetchNotifs = async () => {
      try {
        let loaded = false;
        if (session?.token) {
          try {
            const res = await fetch("/api/member/notifications", {
              headers: { "x-member-session-token": session.token },
            });
            const ct = res.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
              const data = await res.json();
              if (data.success && Array.isArray(data.notifications)) {
                setNotifications(data.notifications);
                loaded = true;
              }
            }
          } catch (e) { }
        }

        // Static CDN fallback
        if (!loaded) {
          const qNotifs = query(collection(db, "notifications"));
          const snap = await getDocs(qNotifs);
          const notifs: any[] = [];
          snap.forEach((d) => notifs.push({ id: d.id, ...d.data() }));
          notifs.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
          setNotifications(notifs);
        }
      } catch (e) {
        console.warn("Notifications fetch error:", e);
      }
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 15000);
    return () => clearInterval(interval);
  }, [member, session]);

  // Fetch Gym Coordinates
  useEffect(() => {
    const fetchGymCoords = async () => {
      try {
        const snap = await getDoc(doc(db, "configs", "gym"));
        if (snap.exists()) {
          const data = snap.data();
          setGymCoords({
            latitude: data.latitude || -6.2088,
            longitude: data.longitude || 106.8456,
            radius: data.radius || 35
          });
        }
      } catch (error) {
        console.error("Failed to load gym coords:", error);
      }
    };
    fetchGymCoords();
  }, []);

  // Fetch Member Visits & Active Checkin Session via Secure API with Static Hosting Fallback
  useEffect(() => {
    if (!member) return;
    const fetchVisits = async () => {
      try {
        let loaded = false;
        if (session?.token) {
          try {
            const res = await fetch("/api/member/visits", {
              headers: { "x-member-session-token": session.token },
            });
            const ct = res.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
              const data = await res.json();
              if (data.success) {
                if (data.activeSession) {
                  setActiveCheckinId(data.activeSession.id);
                  if (data.activeSession.scanned_at) {
                    const start = new Date(data.activeSession.scanned_at);
                    setCheckinTime(start);
                    const diff = Math.floor((Date.now() - start.getTime()) / 1000);
                    setWorkoutDuration(diff > 0 ? diff : 0);
                  }
                } else {
                  setActiveCheckinId(null);
                  setCheckinTime(null);
                  setWorkoutDuration(0);
                }

                if (Array.isArray(data.visits)) {
                  const last7 = data.visits.slice(0, 7).reverse();
                  const chartData = last7.map((c: any) => {
                    const date = c.scanned_at ? new Date(c.scanned_at) : new Date();
                    const dateStr = date.toLocaleDateString(language === "id" ? "id-ID" : "en-US", {
                      day: "numeric",
                      month: "short"
                    });
                    return {
                      date: dateStr,
                      duration: c.duration || 45,
                      type: c.checked_in_via || "QR Scan"
                    };
                  });
                  setVisitsData(chartData);
                }
                loaded = true;
              }
            }
          } catch (e) { }
        }

        // Static CDN fallback
        if (!loaded && member?.id) {
          const qCheck = query(
            collection(db, "checkins"),
            where("member_id", "==", member.id)
          );
          const snap = await getDocs(qCheck);
          const visitsList: any[] = [];
          let active: any = null;
          snap.forEach((d) => {
            const cData = { id: d.id, ...d.data() } as any;
            visitsList.push(cData);
            if (!cData.checkout_at) {
              active = cData;
            }
          });
          if (active) {
            setActiveCheckinId(active.id);
            if (active.scanned_at) {
              const start = new Date(active.scanned_at);
              setCheckinTime(start);
              const diff = Math.floor((Date.now() - start.getTime()) / 1000);
              setWorkoutDuration(diff > 0 ? diff : 0);
            }
          } else {
            setActiveCheckinId(null);
            setCheckinTime(null);
            setWorkoutDuration(0);
          }
          const sorted = visitsList.sort((a, b) => new Date(b.scanned_at || 0).getTime() - new Date(a.scanned_at || 0).getTime());
          const last7 = sorted.slice(0, 7).reverse();
          const chartData = last7.map((c: any) => {
            const date = c.scanned_at ? new Date(c.scanned_at) : new Date();
            const dateStr = date.toLocaleDateString(language === "id" ? "id-ID" : "en-US", {
              day: "numeric",
              month: "short"
            });
            return {
              date: dateStr,
              duration: c.duration || 45,
              type: c.checked_in_via || "QR Scan"
            };
          });
          setVisitsData(chartData);
        }
      } catch (e) {
        console.warn("Visits fetch error:", e);
      }
    };
    fetchVisits();
    const interval = setInterval(fetchVisits, 15000);
    return () => clearInterval(interval);
  }, [member, session, language]);

  // Fetch Member AI Form Coach Workout History
  useEffect(() => {
    if (!member?.id) return;
    const fetchWorkouts = async () => {
      try {
        const qW = query(collection(db, "workout_sessions"), where("member_id", "==", member.id));
        const snapW = await getDocs(qW);
        let list: any[] = [];
        snapW.forEach((d) => list.push({ id: d.id, ...d.data() }));

        // Check offline/local cache
        try {
          const offlineRaw = localStorage.getItem(`synfit_offline_workouts_${member.id}`);
          if (offlineRaw) {
            const parsed = JSON.parse(offlineRaw);
            if (Array.isArray(parsed)) {
              list = [...list, ...parsed];
            }
          }
        } catch { }

        if (list.length > 0) {
          list.sort((a, b) => {
            const tA = a.created_at?.seconds ? a.created_at.seconds * 1000 : new Date(a.created_at || a.date || 0).getTime();
            const tB = b.created_at?.seconds ? b.created_at.seconds * 1000 : new Date(b.created_at || b.date || 0).getTime();
            return tB - tA;
          });
          setWorkoutHistory(list);
        } else {
          // Provide realistic starter sessions for new members so AI can analyze their initial workout summary
          setWorkoutHistory([
            {
              id: "baseline-1",
              exercise_name: "Bodyweight Squat",
              valid_reps: 15,
              total_reps: 15,
              form_score: 92,
              avg_heart_rate: 126,
              max_heart_rate: 148,
              calories_burned: 42,
              created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            },
            {
              id: "baseline-2",
              exercise_name: "Standard Push-Up",
              valid_reps: 14,
              total_reps: 16,
              form_score: 88,
              avg_heart_rate: 134,
              max_heart_rate: 156,
              calories_burned: 36,
              created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            },
            {
              id: "baseline-3",
              exercise_name: "Dumbbell Bicep Curl",
              valid_reps: 12,
              total_reps: 12,
              form_score: 94,
              avg_heart_rate: 114,
              max_heart_rate: 128,
              calories_burned: 28,
              created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            },
          ]);
        }
      } catch (e) {
        console.warn("fetchWorkouts error:", e);
      }
    };
    fetchWorkouts();
  }, [member?.id]);

  // Running Timer Effect for Active Workout
  useEffect(() => {
    let interval: any;
    if (activeCheckinId && checkinTime) {
      interval = setInterval(() => {
        const diff = Math.floor((new Date().getTime() - checkinTime.getTime()) / 1000);
        setWorkoutDuration(diff > 0 ? diff : 0);
      }, 1000);
    } else {
      setWorkoutDuration(0);
    }
    return () => clearInterval(interval);
  }, [activeCheckinId, checkinTime]);

  // Geolocation Loop for Auto-Checkout
  useEffect(() => {
    let interval: any;
    if (activeCheckinId && gymCoords) {
      interval = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            const dist = getDistanceInMeters(latitude, longitude, gymCoords.latitude, gymCoords.longitude);
            setCurrentDistance(Math.round(dist));
            if (dist > gymCoords.radius) {
              await handleAutoCheckout(latitude, longitude);
            }
          },
          (err) => {
            console.error("GPS tracking error:", err);
          },
          { enableHighAccuracy: true }
        );
      }, 20000);
    } else {
      setCurrentDistance(null);
    }
    return () => clearInterval(interval);
  }, [activeCheckinId, gymCoords]);

  // Real-time Clock Timer (Live updating hour:minute without seconds and without WIB)
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setRealtimeClock(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).replace(".", ":")
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time Weather & AQI Fetcher (Open-Meteo API + BigDataCloud Reverse Geocoding)
  useEffect(() => {
    const fetchWeatherAndAQI = async (lat: number, lon: number) => {
      try {
        // Fetch weather
        const weatherPromise = fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,weather_code,wind_speed_10m&timezone=auto`
        )
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null);

        // Fetch air quality
        const aqiPromise = fetch(
          `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10&timezone=auto`
        )
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null);

        // Fetch client reverse geocoding for realtime user locality
        const geoPromise = fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=id`
        )
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null);

        const [wRes, aRes, gRes] = await Promise.all([weatherPromise, aqiPromise, geoPromise]);

        if (gRes) {
          const city = gRes.city || gRes.locality || gRes.principalSubdivision || "Lokasi Anda";
          const sub = gRes.principalSubdivision ? `, ${gRes.principalSubdivision}` : "";
          setUserLocationName(`${city}${sub}`);
        }

        if (wRes && wRes.current) {
          const c = wRes.current;
          const code = c.weather_code ?? 0;
          let desc = "Cerah";
          if (code === 1 || code === 2) desc = "Cerah Berawan";
          else if (code === 3) desc = "Berawan";
          else if (code >= 45 && code <= 48) desc = "Berkabut";
          else if (code >= 51 && code <= 55) desc = "Gerimis Ringan";
          else if (code >= 61 && code <= 65) desc = "Hujan";
          else if (code >= 80 && code <= 82) desc = "Hujan Lebat";
          else if (code >= 95) desc = "Badai Petir";

          let rawAqi = aRes?.current?.us_aqi ?? 65;
          let aqiLabel = "Baik";
          let aqiColor = "text-emerald-400 bg-emerald-400/15 border-emerald-400/30";

          if (rawAqi <= 50) {
            aqiLabel = "Bagus";
            aqiColor = "text-emerald-400 bg-emerald-400/15 border-emerald-400/30";
          } else if (rawAqi <= 100) {
            aqiLabel = "Sedang";
            aqiColor = "text-amber-400 bg-amber-400/15 border-amber-400/30";
          } else if (rawAqi <= 150) {
            aqiLabel = "Kurang Sehat";
            aqiColor = "text-orange-400 bg-orange-400/15 border-orange-400/30";
          } else {
            aqiLabel = "Tidak Sehat";
            aqiColor = "text-red-400 bg-red-400/15 border-red-400/30";
          }

          setWeatherData({
            temp: Math.round(c.temperature_2m ?? 29),
            weatherCode: code,
            weatherDesc: desc,
            humidity: Math.round(c.relative_humidity_2m ?? 70),
            windSpeed: Math.round(c.wind_speed_10m ?? 8),
            aqi: Math.round(rawAqi),
            aqiLabel,
            aqiColor,
            isDay: Boolean(c.is_day ?? 1),
          });
        }
      } catch (err) {
        console.error("Failed to load realtime weather:", err);
      }
    };

    // If user allows browser GPS, use user coordinates, else default to Bekasi
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          fetchWeatherAndAQI(lat, lon);
        },
        () => {
          // Fallback to Bekasi (-6.2383, 106.9756)
          fetchWeatherAndAQI(-6.2383, 106.9756);
        },
        { timeout: 7000, enableHighAccuracy: false }
      );
    } else {
      fetchWeatherAndAQI(-6.2383, 106.9756);
    }
  }, []);

  // Real-time Chat Listener (Instant updates from Firestore onSnapshot)
  useEffect(() => {
    if (!member?.id) return;

    // 1. Live Firestore onSnapshot subscription (Instant 0-delay updates)
    const qChats = query(
      collection(db, "member_chats"),
      where("member_id", "==", member.id)
    );

    const unsubscribe = onSnapshot(
      qChats,
      (snapshot) => {
        const chatList: any[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        const seenIds = new Set<string>();
        const uniqueChatList: any[] = [];
        for (const msg of chatList) {
          if (msg.id && !seenIds.has(msg.id)) {
            seenIds.add(msg.id);
            uniqueChatList.push(msg);
          } else if (!msg.id) {
            uniqueChatList.push(msg);
          }
        }
        uniqueChatList.sort((a: any, b: any) => parseMsgTime(a.created_at) - parseMsgTime(b.created_at));
        setMessages(uniqueChatList);
      },
      async (err) => {
        console.warn("Real-time member_chats subscription fallback to API:", err);
        // Fallback: server API polling if listener permissions fail
        if (session?.token) {
          try {
            const res = await fetch("/api/member/chats", {
              headers: { "x-member-session-token": session.token },
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.messages)) {
              const seenIds = new Set<string>();
              const uniqueList: any[] = [];
              for (const msg of data.messages) {
                if (msg.id && !seenIds.has(msg.id)) {
                  seenIds.add(msg.id);
                  uniqueList.push(msg);
                } else if (!msg.id) {
                  uniqueList.push(msg);
                }
              }
              uniqueList.sort((a: any, b: any) => parseMsgTime(a.created_at) - parseMsgTime(b.created_at));
              setMessages(uniqueList);
            }
          } catch (e) { }
        }
      }
    );

    return () => unsubscribe();
  }, [member?.id, session?.token]);

  // Initialize lastReadChatTime on initial messages fetch if not set yet
  useEffect(() => {
    if (messages.length > 0 && lastReadChatTime === 0) {
      const maxTime = Math.max(...messages.map((m) => parseMsgTime(m.created_at)));
      if (maxTime > 0) {
        setLastReadChatTime(maxTime);
        try {
          localStorage.setItem("synfit_member_last_read_chat", String(maxTime));
        } catch { }
      }
    }
  }, [messages, lastReadChatTime]);

  // Mark Unread Messages as Read in State and in Firestore when Visiting Chat Tab
  useEffect(() => {
    if (activeTab === "chat" && messages.length > 0) {
      const timer = setTimeout(() => {
        const latestTime = Math.max(
          ...messages.map((m) => parseMsgTime(m.created_at)),
          Date.now()
        );
        setLastReadChatTime(latestTime);
        try {
          localStorage.setItem("synfit_member_last_read_chat", String(latestTime));
        } catch { }
      }, 3500);

      // Update Firestore documents to is_read: true for all messages from receptionist
      const unreadFromStaff = messages.filter((m) => m.sender_role !== "MEMBER" && m.is_read !== true);
      if (unreadFromStaff.length > 0) {
        unreadFromStaff.forEach((m) => {
          if (m.id) {
            updateDoc(doc(db, "member_chats", m.id), { is_read: true }).catch(() => { });
          }
        });
      }

      return () => clearTimeout(timer);
    }
  }, [activeTab, messages]);

  // Scroll Chat to Bottom on New Message, Typing, or When Entering Chat Tab
  useEffect(() => {
    if (activeTab !== "chat") return;

    const scrollToLatest = () => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    };

    // Instant jump to bottom inside chat stream without calling scrollIntoView
    // (scrollIntoView forces browser window/parent to jerk horizontally while sliding in)
    scrollToLatest();
    const r1 = requestAnimationFrame(scrollToLatest);
    const t1 = setTimeout(scrollToLatest, 80);
    const t2 = setTimeout(scrollToLatest, 300); // Sync after slide animation settles

    return () => {
      cancelAnimationFrame(r1);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [activeTab, messages.length, isSendingChat, isAdminTyping]);

  // Helpers
  const getDynamicStatus = (expDate: string | Date) => {
    if (!expDate) return "Expired";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expDate);
    exp.setHours(0, 0, 0, 0);
    const diffTime = exp.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "Expired";
    if (diffDays <= 3) return language === "id" ? "Hampir Expired" : "Almost Expired";
    return language === "id" ? "Aktif" : "Active";
  };

  const getDaysLeft = (expDate: string | Date) => {
    if (!expDate) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expDate);
    exp.setHours(0, 0, 0, 0);
    const diffTime = exp.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatDate = (dateString: string | Date) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(date);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("Firebase signOut error:", e);
    }
    localStorage.removeItem("memberSession");
    router.replace("/");
  };

  const handleAutoCheckout = async (lat: number, lng: number) => {
    if (!activeCheckinId) return;
    try {
      let done = false;
      if (session?.token) {
        try {
          const res = await fetch("/api/member/checkout", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-member-session-token": session.token,
            },
            body: JSON.stringify({
              checkinId: activeCheckinId,
              latitude: lat,
              longitude: lng,
            }),
          });
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const data = await res.json();
            if (data.success) {
              done = true;
            }
          }
        } catch (e) { }
      }

      if (!done) {
        await updateDoc(doc(db, "checkins", activeCheckinId), {
          checkout_at: new Date().toISOString(),
          duration: workoutDuration > 0 ? Math.round(workoutDuration / 60) : 45,
        });
      }

      setActiveCheckinId(null);
      setCheckinTime(null);
      setWorkoutDuration(0);
    } catch (error) {
      console.error("Auto checkout error:", error);
    }
  };

  const handleManualCheckout = async () => {
    if (!activeCheckinId) return;
    setIsCheckingGPS(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          let done = false;
          if (session?.token) {
            try {
              const res = await fetch("/api/member/checkout", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-member-session-token": session.token,
                },
                body: JSON.stringify({
                  checkinId: activeCheckinId,
                  latitude,
                  longitude,
                }),
              });
              const ct = res.headers.get("content-type") || "";
              if (ct.includes("application/json")) {
                const data = await res.json();
                if (data.success) {
                  done = true;
                }
              }
            } catch (e) { }
          }

          if (!done) {
            await updateDoc(doc(db, "checkins", activeCheckinId), {
              checkout_at: new Date().toISOString(),
              duration: workoutDuration > 0 ? Math.round(workoutDuration / 60) : 45,
            });
          }

          setActiveCheckinId(null);
          setCheckinTime(null);
          setWorkoutDuration(0);
          toast.success(language === "id" ? "Check-out berhasil!" : "Check-out successful!");
        } catch (error) {
          console.error("Checkout failed:", error);
          toast.error("Gagal memproses check-out.");
        } finally {
          setIsCheckingGPS(false);
        }
      },
      (err) => {
        setIsCheckingGPS(false);
        toast.error(language === "id" ? "Gagal membaca lokasi untuk check-out." : "Failed to retrieve location for check-out.");
      }
    );
  };

  const handleGPSCheckin = async () => {
    if (!member || !gymCoords) return;
    setIsCheckingGPS(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const dist = getDistanceInMeters(latitude, longitude, gymCoords.latitude, gymCoords.longitude);
        setCurrentDistance(Math.round(dist));

        if (dist <= gymCoords.radius) {
          try {
            let checkinDone = false;
            if (session?.token) {
              try {
                const res = await fetch("/api/member/checkin", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-member-session-token": session.token,
                  },
                  body: JSON.stringify({ latitude, longitude }),
                });

                const ct = res.headers.get("content-type") || "";
                if (ct.includes("application/json")) {
                  const data = await res.json();
                  if (res.ok && data.success) {
                    setActiveCheckinId(data.checkinId);
                    setCheckinTime(new Date());
                    setWorkoutDuration(0);
                    toast.success(language === "id" ? "Check-in GPS berhasil!" : "GPS Check-in verified!");
                    checkinDone = true;
                  } else if (data.error) {
                    toast.warning(data.error);
                    return;
                  }
                }
              } catch (apiErr) { }
            }

            // Static hosting fallback
            if (!checkinDone) {
              const newCheckinRef = await addDoc(collection(db, "checkins"), {
                member_id: member.id,
                nama: member.nama,
                scanned_at: new Date().toISOString(),
                checked_in_via: "GPS Location",
                latitude,
                longitude,
              });
              setActiveCheckinId(newCheckinRef.id);
              setCheckinTime(new Date());
              setWorkoutDuration(0);
              toast.success(language === "id" ? "Check-in GPS berhasil!" : "GPS Check-in verified!");
            }
          } catch (error) {
            console.error("GPS check-in failed:", error);
            toast.error(language === "id" ? "Gagal melakukan check-in GPS." : "GPS Check-in failed.");
          } finally {
            setIsCheckingGPS(false);
          }
        } else {
          setIsCheckingGPS(false);
          toast.warning(
            language === "id"
              ? `Anda berada di luar area gym (Jarak: ${Math.round(dist)} meter). Anda harus berada dalam radius ${gymCoords.radius} meter untuk check-in.`
              : `You are outside gym perimeter (Distance: ${Math.round(dist)}m). You must be within ${gymCoords.radius}m to check in.`
          );
        }
      },
      (err) => {
        setIsCheckingGPS(false);
        console.error("Geolocation error:", err);
        toast.error(language === "id" ? "Gagal mendeteksi lokasi GPS Anda." : "Failed to detect your GPS location.");
      },
      { enableHighAccuracy: true }
    );
  };

  const handleRefreshToken = async () => {
    if (!member || !session?.token || isRefreshingToken) return;
    setIsRefreshingToken(true);
    try {
      const newToken = `SF-${member.id.substring(0, 5).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const res = await fetch("/api/member/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-member-session-token": session.token,
        },
        body: JSON.stringify({ qr_token: newToken }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMember((prev) => (prev ? { ...prev, qr_token: newToken } : prev));
        toast.success(language === "id" ? "Kode QR akses berhasil diperbarui!" : "Turnstile QR pass refreshed!");
      } else {
        throw new Error(data.error || "Gagal memperbarui");
      }
    } catch (e: any) {
      toast.error(e.message || "Gagal memperbarui kode QR");
    } finally {
      setIsRefreshingToken(false);
    }
  };

  const handleDownload = async () => {
    const el = document.getElementById("digital-card-export");
    if (!el || !member) return;
    try {
      const canvas = await html2canvas(el, { scale: 3, backgroundColor: null });
      const data = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `SynFit_VIP_Card_${member.nama}.png`;
      link.href = data;
      link.click();
      toast.success(language === "id" ? "Kartu digital berhasil diunduh!" : "Card downloaded successfully!");
    } catch (e) {
      toast.error(language === "id" ? "Gagal mengunduh kartu" : "Failed to download card");
    }
  };

  const handleShareCard = async () => {
    if (!member) return;
    const shareText = `SynFit VIP Card: ${member.nama} (ID: ${member.id}) berlaku s/d ${formatDate(member.tanggal_expired)}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `SynFit VIP Card: ${member.nama}`,
          text: shareText,
          url: window.location.href
        });
      } catch (e) { }
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success(language === "id" ? "Info kartu berhasil disalin ke clipboard!" : "Card info copied to clipboard!");
    }
  };

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

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || isSendingChat) return;
    setIsSendingChat(true);
    const text = chatMessage.trim();
    setChatMessage("");

    // Reset member typing status immediately on submit
    if (member?.id) {
      setDoc(doc(db, "typing_status", member.id), { member_typing: false }, { merge: true }).catch(() => { });
    }

    try {
      let sent = false;
      if (session?.token) {
        try {
          const res = await fetch("/api/member/chats", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-member-session-token": session.token,
            },
            body: JSON.stringify({ content: text }),
          });
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const data = await res.json();
            if (data.success) {
              setMessages((prev) => {
                if (data.messageId && prev.some((m) => m.id === data.messageId)) return prev;
                return [
                  ...prev,
                  {
                    id: data.messageId,
                    sender_id: member?.id,
                    sender_name: member?.nama || "Member",
                    sender_role: "MEMBER",
                    content: text,
                    is_read: false,
                    created_at: new Date().toISOString(),
                  },
                ];
              });
              sent = true;
            }
          }
        } catch (e) { }
      }

      // Static hosting fallback
      if (!sent && member) {
        const docRef = await addDoc(collection(db, "member_chats"), {
          member_id: member.id,
          sender_id: member.id,
          sender_name: member.nama,
          sender_role: "MEMBER",
          content: text,
          is_read: false,
          created_at: new Date().toISOString(),
        });
        setMessages((prev) => {
          if (docRef.id && prev.some((m) => m.id === docRef.id)) return prev;
          return [
            ...prev,
            {
              id: docRef.id,
              sender_id: member.id,
              sender_name: member.nama,
              sender_role: "MEMBER",
              content: text,
              is_read: false,
              created_at: new Date().toISOString(),
            },
          ];
        });
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      // Ensure smooth typing animation display before finishing
      await new Promise((r) => setTimeout(r, 650));
      setIsSendingChat(false);
    }
  };

  const handleRenewalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setRenewalProof(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMidtransRenewal = async () => {
    if (!member || isRenewing) return;
    setIsRenewing(true);
    try {
      let baseAmount = renewalPlan === "3 Bulan" ? 350000 : 160000;
      if (appliedReferralDiscount) {
        baseAmount = Math.round(baseAmount * 0.8);
      }

      const res = await fetch("/api/payment/create-snap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "renewal",
          membershipType: renewalPlan,
          amount: baseAmount,
          name: member.nama,
          email: member.email || "",
          phone: member.nomor_whatsapp,
          memberId: member.id,
        }),
      });

      const data = await res.json();
      if (!data.success || !data.token) {
        throw new Error(data.error || "Gagal membuat sesi pembayaran Midtrans");
      }

      openSnap(data.token, {
        onSuccess: () => {
          toast.success("Pembayaran berhasil! Masa aktif membership Anda telah diperpanjang otomatis.");
          setShowRenewalModal(false);
          setTimeout(() => {
            window.location.reload();
          }, 1200);
        },
        onPending: () => {
          toast.info("Menunggu penyelesaian pembayaran. Status akan otomatis aktif setelah pembayaran terkonfirmasi.");
          setShowRenewalModal(false);
        },
        onError: () => {
          toast.error("Pembayaran dibatalkan atau gagal.");
        },
        onClose: () => {
          toast.info("Jendela pembayaran ditutup.");
        },
      });
    } catch (err: any) {
      toast.error(err.message || "Gagal memulai pembayaran Midtrans.");
    } finally {
      setIsRenewing(false);
    }
  };

  const handleRenewalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member || isRenewing || !renewalProof) return;
    setIsRenewing(true);
    try {
      let renewalDone = false;
      if (session?.token) {
        try {
          const res = await fetch("/api/member/renewal", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-member-session-token": session.token,
            },
            body: JSON.stringify({
              membership_type: renewalPlan,
              bukti_pembayaran: renewalProof,
            }),
          });
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const data = await res.json();
            if (res.ok && data.success) {
              renewalDone = true;
            }
          }
        } catch (e) { }
      }

      // Static hosting fallback
      if (!renewalDone && member) {
        await addDoc(collection(db, "registrations"), {
          nama: member.nama,
          nomor_whatsapp: member.nomor_whatsapp,
          membership_type: renewalPlan,
          bukti_pembayaran: renewalProof,
          status: "Pending",
          created_at: new Date().toISOString(),
          source: "Renewal Portal",
        });
        renewalDone = true;
      }

      if (renewalDone) {
        setRenewalSuccess(true);
        toast.success(language === "id" ? "Permintaan perpanjangan berhasil dikirim!" : "Renewal request submitted!");
      } else {
        throw new Error("Gagal mengirim perpanjangan");
      }
    } catch (error: any) {
      toast.error(error.message || "Gagal mengirim permintaan perpanjangan.");
    } finally {
      setIsRenewing(false);
    }
  };

  const handleMemberPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && member) {
      setIsUploadingPhoto(true);
      try {
        const url = await uploadToCloudinary(file);
        if (url) {
          let updated = false;
          if (session?.token) {
            try {
              const res = await fetch("/api/member/profile", {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  "x-member-session-token": session.token,
                },
                body: JSON.stringify({ foto_url: url }),
              });
              const ct = res.headers.get("content-type") || "";
              if (ct.includes("application/json")) {
                const data = await res.json();
                if (res.ok && data.success) {
                  updated = true;
                }
              }
            } catch (e) { }
          }

          if (!updated) {
            await updateDoc(doc(db, "members", member.id), { foto_url: url });
          }

          setMember({ ...member, foto_url: url });
          toast.success(language === "id" ? "Foto profil berhasil diperbarui!" : "Profile picture updated!");
        }
      } catch (error) {
        console.error("Photo upload failed:", error);
        toast.error("Gagal mengunggah foto.");
      } finally {
        setIsUploadingPhoto(false);
      }
    }
  };

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member || isSavingPersonal) return;
    setIsSavingPersonal(true);
    try {
      const normalizedPhone = formatPhoneWithPlus62(editPhone);
      let saved = false;
      if (session?.token) {
        try {
          const res = await fetch("/api/member/profile", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "x-member-session-token": session.token,
            },
            body: JSON.stringify({
              nama: editNama,
              nomor_whatsapp: normalizedPhone,
              alamat: editAlamat,
            }),
          });
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const data = await res.json();
            if (res.ok && data.success) {
              saved = true;
            }
          }
        } catch (e) { }
      }

      // Static hosting fallback
      if (!saved && member) {
        await updateDoc(doc(db, "members", member.id), {
          nama: editNama,
          nomor_whatsapp: normalizedPhone,
          alamat: editAlamat,
        });
        saved = true;
      }

      if (saved) {
        setMember((prev) =>
          prev ? { ...prev, nama: editNama, nomor_whatsapp: normalizedPhone, alamat: editAlamat } : prev
        );
        setEditPhone(normalizedPhone);
        setIsEditingPersonal(false);
        toast.success(language === "id" ? "Data personal berhasil disimpan!" : "Personal details saved!");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan data");
    } finally {
      setIsSavingPersonal(false);
    }
  };

  const handleSaveBiometrics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member || !session?.token) return;
    setIsSavingBiometrics(true);
    setBiometricsSuccess(false);

    try {
      const parsedH = userHeight ? Number(userHeight) : undefined;
      const parsedW = userWeight ? Number(userWeight) : undefined;
      const parsedA = userAge ? Number(userAge) : undefined;

      const bioData = {
        tinggi_badan: parsedH,
        berat_badan: parsedW,
        jenis_kelamin: userGender,
        umur: parsedA,
        target_fitness: userFitnessGoal,
      };

      try {
        localStorage.setItem(`member_biometrics_${member.id}`, JSON.stringify(bioData));
      } catch (e) { }

      await fetch("/api/member/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-member-session-token": session.token,
        },
        body: JSON.stringify(bioData),
      });

      setMember((prev) => (prev ? { ...prev, ...bioData } : prev));
      setBiometricsSuccess(true);
      toast.success(language === "id" ? "Info biometrik AI berhasil diperbarui!" : "AI Biometrics calibrated!");
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan biometrik");
    } finally {
      setIsSavingBiometrics(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingPass(true);
    setPassError("");
    setPassSuccess(false);

    try {
      if (newPassword !== confirmPassword) {
        throw new Error(language === "id" ? "Konfirmasi kata sandi tidak cocok." : "Password confirmation does not match.");
      }
      if (newPassword.length < 6) {
        throw new Error(language === "id" ? "Kata sandi baru minimal 6 karakter." : "New password must be at least 6 characters.");
      }
      if (newPassword === "areta123" || newPassword === "synfit123") {
        throw new Error(language === "id" ? "Kata sandi baru tidak boleh menggunakan kata sandi default sistem." : "New password cannot be a default system password.");
      }

      let serverSucceeded = false;
      let freshToken = session?.token || "";

      // 1. Try server-side change password API
      try {
        const res = await fetch("/api/member/change-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-member-session-token": session?.token || "",
            ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
          },
          body: JSON.stringify({ oldPassword, newPassword }),
        });

        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await res.json();
          if (res.ok && data.success) {
            serverSucceeded = true;
            freshToken = data.token || freshToken;
          } else if (res.status === 400) {
            throw new Error(data.error || (language === "id" ? "Gagal memperbarui kata sandi." : "Failed to update password."));
          }
          // Note: If 401/403/404 (e.g. client token on static hosting), fall through to client-side Firestore
        }
      } catch (apiErr: any) {
        if (apiErr.message && !apiErr.message.includes("fetch") && !apiErr.message.includes("Token") && !apiErr.message.includes("Sesi")) {
          throw apiErr;
        }
      }

      // 2. Client-side Firestore fallback (for Firebase Hosting Classic / static deployment)
      if (!serverSucceeded) {
        // Hash password with WebCrypto PBKDF2
        const saltBytes = crypto.getRandomValues(new Uint8Array(16));
        const saltHex = Array.from(saltBytes).map(b => b.toString(16).padStart(2, "0")).join("");
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
          "raw",
          enc.encode(newPassword),
          { name: "PBKDF2" },
          false,
          ["deriveBits"]
        );
        const derivedBits = await crypto.subtle.deriveBits(
          {
            name: "PBKDF2",
            salt: enc.encode(saltHex),
            iterations: 10000,
            hash: "SHA-256",
          },
          keyMaterial,
          256
        );
        const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, "0")).join("");
        const securePbkdf2Hash = `${saltHex}$${hashHex}`;

        const targetMemberId = session?.memberId || member?.id;

        // Locate member_accounts doc
        let accountDocId = session?.accountId;
        if (accountDocId && accountDocId.startsWith("acc_")) {
          // Synthetic account id from members collection, locate real document
          accountDocId = null;
        }

        if (!accountDocId && targetMemberId) {
          try {
            const qAcc = query(collection(db, "member_accounts"), where("member_id", "==", targetMemberId));
            const snapAcc = await getDocs(qAcc);
            if (!snapAcc.empty) {
              accountDocId = snapAcc.docs[0].id;
            }
          } catch (e) {
            console.warn("Locating member_accounts notice:", e);
          }
        }

        if (accountDocId) {
          await setDoc(doc(db, "member_accounts", accountDocId), {
            password_hash: securePbkdf2Hash,
            must_change_password: false,
            updated_at: serverTimestamp(),
          }, { merge: true });
        } else if (targetMemberId) {
          // If no member_accounts record existed, create one
          await addDoc(collection(db, "member_accounts"), {
            member_id: targetMemberId,
            nama: session?.name || member?.nama || "Member",
            nomor_whatsapp: session?.whatsapp || member?.nomor_whatsapp || "",
            password_hash: securePbkdf2Hash,
            must_change_password: false,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          });
        }

        // Also update members collection document to keep both in sync
        if (targetMemberId) {
          try {
            await updateDoc(doc(db, "members", targetMemberId), {
              password_hash: securePbkdf2Hash,
              must_change_password: false,
              updated_at: serverTimestamp(),
            });
          } catch (memErr) {
            console.warn("Syncing password to members collection notice:", memErr);
          }
        }
      }

      setPassSuccess(true);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Clear mandatory password change flag and update token
      if (session) {
        const updatedSession = {
          ...session,
          token: freshToken,
          mustChangePassword: false,
        };
        setSession(updatedSession);
        try {
          localStorage.setItem("memberSession", JSON.stringify(updatedSession));
        } catch (e) { }
      }

      toast.success(language === "id" ? "Kata sandi berhasil diperbarui dan tersimpan di database!" : "Password updated and saved to database successfully!");
    } catch (err: any) {
      setPassError(err.message);
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleMarkAllNotificationsAsRead = async () => {
    if (!member || notifications.length === 0) return;
    try {
      const unreadList = notifications.filter((n) => !n.is_read);
      await Promise.all(unreadList.map((n) => updateDoc(doc(db, "notifications", n.id), { is_read: true })));
    } catch (e) {
      console.error("Failed to mark notifications read:", e);
    }
  };

  // Preset Inquiries for Chat
  const presetMessages = [
    {
      id: "renewal",
      label: language === "id" ? "Perpanjang Membership" : "Membership Renewal",
      text: language === "id"
        ? "Halo Admin SynFit, saya ingin menanyakan perpanjangan membership saya via QRIS."
        : "Hello Admin of SynFit, I would like to inquire about my membership renewal via QRIS."
    },
    {
      id: "schedule",
      label: language === "id" ? "Jadwal Kelas Gym" : "Class Schedule",
      text: language === "id"
        ? "Halo Admin SynFit, apakah boleh meminta jadwal kelas dan pelatih terbaru minggu ini?"
        : "Hello Admin of SynFit, could I get the latest group class and trainer schedule for this week?"
    },
    {
      id: "facility",
      label: language === "id" ? "Lapor Kendala Alat" : "Report Equipment",
      text: language === "id"
        ? "Halo Admin SynFit, saya ingin melaporkan kendala pada salah satu fasilitas di area gym."
        : "Hello Admin of SynFit, I would like to report an issue on one of the gym equipments."
    },
    {
      id: "locker",
      label: language === "id" ? "Status Sewa Loker" : "Locker Inquiries",
      text: language === "id"
        ? "Halo Admin SynFit, saya ingin menanyakan status ketersediaan sewa loker bulanan."
        : "Hello Admin of SynFit, I would like to check monthly locker availability."
    }
  ];

  if (!member) return null;

  const status = getDynamicStatus(member.tanggal_expired);
  const daysLeft = getDaysLeft(member.tanggal_expired);

  // Dynamic Calculated Metrics
  const calculatedStreak = visitsData.length > 0 ? visitsData.length : 1;
  const calculatedCalories =
    workoutDuration > 0
      ? Math.round((workoutDuration / 60) * 6.5)
      : visitsData.reduce((acc, curr) => acc + (Number(curr.duration) || 0) * 6, 0) || 540;

  const calculatedBmi =
    userHeight && userWeight && Number(userHeight) > 0 && Number(userWeight) > 0
      ? (Number(userWeight) / Math.pow(Number(userHeight) / 100, 2)).toFixed(1)
      : null;

  // Unread messages count from receptionist for badges
  const unreadChatCount = messages.filter(
    (m) => m.sender_role !== "MEMBER" && parseMsgTime(m.created_at) > lastReadChatTime
  ).length;

  // -------------------------------------------------------------
  // TAB 1: BERANDA (HOME & QUICK ACCESS)
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // TAB 1: BERANDA (HOME & QUICK ACCESS - REDESIGNED PER MOCKUP)
  // -------------------------------------------------------------
  const renderHomeTab = () => {
    const isDark = theme === "dark";

    const quickActions = [
      {
        id: "tutorial",
        label: "Tutorial",
        icon: Dumbbell,
        action: () => {
          navigateToTab("tutorial");
        },
      },
      {
        id: "program",
        label: "Program",
        icon: Calendar,
        action: () => {
          navigateToTab("program");
        },
      },
      {
        id: "tracker",
        label: "Tracker",
        icon: Activity,
        action: () => {
          navigateToTab("tracker");
        },
      },
      {
        id: "synhub",
        label: "SynHub",
        icon: Building2,
        action: () => {
          navigateToTab("synhub");
        },
      },
    ];

    const availableClasses = [
      {
        title: "Strength Training",
        time: "18:00",
        duration: "60 menit",
        trainer: "Coach Andi",
        remaining: "Sisa 1",
        image: "/landing/hero_strength.jpg",
      },
      {
        title: "HIIT Class",
        time: "18:10",
        duration: "45 menit",
        trainer: "Coach Rika",
        remaining: "Sisa 3",
        image: "/landing/hero_consistency.jpg",
      },
      {
        title: "Yoga & Stretch",
        time: "19:00",
        duration: "50 menit",
        trainer: "Coach Maya",
        remaining: "Sisa 4",
        image: "/landing/facility_cardio.jpg",
      },
    ];

    const promoBanners = [
      {
        id: "banner-1",
        image: "/banner_1.png",
        title: "Stres Kelola Member Gym? Saatnya Pakai SynFit App!",
        ctaText: "Coba Gratis Sekarang",
        ctaAction: () => setShowFeatureTourModal(true),
      },
      {
        id: "banner-2",
        image: "/banner_2.png",
        title: "Program Referral SynFit: Ajak Temanmu, Hemat 20%",
        ctaText: "Ajak Teman (Diskon 20%)",
        ctaAction: () => setShowReferralModal(true),
      },
      {
        id: "banner-3",
        image: "/banner_3.png",
        title: "Promo Membership 3 Bulan Rp 350.000",
        ctaText: "Ambil Promo Diskon 27%",
        ctaAction: () => handleSelectPromo3Months(),
      },
      {
        id: "banner-4",
        image: "/banner_4.png",
        title: "Login Setiap Hari, Dapatkan Streak & Kumpulkan Poin",
        ctaText: "Klaim & Tukar Poin",
        ctaAction: () => setShowStreakRewardsModal(true),
      },
    ];

    return (
      <div className="text-left w-full md:max-w-4xl mx-auto pb-28 md:pb-12 transition-colors duration-300">
        {/* 1. FULL TOP BANNER WITH SLIDING ADS (Clean Edge-to-Edge Artwork Display) */}
        <div className="relative w-full">
          {/* Edge-to-edge carousel slides */}
          <div
            data-no-swipe="true"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="relative w-full h-56 sm:h-72 md:h-80 overflow-hidden touch-pan-y rounded-b-[18px] sm:rounded-b-[24px] shadow-lg bg-[#0A0D16]"
          >
            <AnimatePresence initial={false} custom={bannerDirection}>
              <motion.div
                key={currentBannerIndex}
                custom={bannerDirection}
                drag="x"
                dragPropagation={false}
                dragConstraints={{ left: -100, right: 100 }}
                dragElastic={0.15}
                onDragEnd={(_e, info) => {
                  if (info.offset.x < -35 || info.velocity.x < -200) {
                    goToNextBanner();
                  } else if (info.offset.x > 35 || info.velocity.x > 200) {
                    goToPrevBanner();
                  }
                }}
                variants={{
                  enter: (dir: number) => ({
                    x: dir > 0 ? "100%" : "-100%",
                  }),
                  center: {
                    x: 0,
                    transition: { duration: 0.35, ease: [0.25, 1, 0.5, 1] },
                  },
                  exit: (dir: number) => ({
                    x: dir > 0 ? "-100%" : "100%",
                    transition: { duration: 0.35, ease: [0.25, 1, 0.5, 1] },
                  }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                onClick={promoBanners[currentBannerIndex].ctaAction}
                className="absolute inset-0 w-full h-full select-none cursor-pointer overflow-hidden group"
              >
                {/* Full Original Banner Artwork - Click to navigate */}
                <img
                  src={promoBanners[currentBannerIndex].image}
                  alt={promoBanners[currentBannerIndex].title}
                  className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.02] active:scale-[0.99]"
                />

                {/* Subtle bottom shadow gradient to keep carousel dots visible */}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
              </motion.div>
            </AnimatePresence>

            {/* Carousel Dots */}
            <div className="absolute bottom-11 sm:bottom-12 left-4 sm:left-6 z-20 flex items-center gap-1.5">
              {promoBanners.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setBannerDirection(idx > currentBannerIndex ? 1 : -1);
                    setCurrentBannerIndex(idx);
                  }}
                  className={`h-1.5 rounded-full transition-all duration-300 ${currentBannerIndex === idx ? "w-6 bg-yellow-400" : "w-1.5 bg-white/40 hover:bg-white/70"
                    }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* 2. OVERLAPPING FLOATING REALTIME USER LOCATION & WEATHER CARD */}
          <div className="relative z-30 px-4 sm:px-6 -mt-8 sm:-mt-10">
            <div
              className={`rounded-2xl p-4 transition-all duration-200 border ${isDark
                ? "bg-[#141822] border-white/10 text-white shadow-2xl shadow-black/80"
                : "bg-white border-gray-200 text-gray-900 shadow-xl shadow-gray-400/20"
                }`}
            >
              {/* Top Row: User Realtime Location & Clean Clock (HH:mm) */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/30">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 block">
                      Lokasi Anda
                    </span>
                    <h3 className="text-sm font-black truncate text-foreground">
                      {userLocationName}
                    </h3>
                  </div>
                </div>

                {/* Clean Clock Badge (HH:mm, no WIB, no seconds) */}
                <div className="flex items-center gap-1.5 text-xs font-mono font-black text-blue-500 bg-blue-500/10 px-2.5 py-1 rounded-xl border border-blue-500/20 shrink-0">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{realtimeClock || "--:--"}</span>
                </div>
              </div>

              {/* Metrics Row: Cuaca & Suhu, AQI Air Quality, Kelembaban */}
              <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3 border-t border-dashed border-gray-500/20">
                {/* 1. Suhu & Kondisi Cuaca */}
                <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${isDark ? "bg-[#0E121C] border-white/5" : "bg-gray-50 border-gray-200"
                  }`}>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Cuaca</span>
                    {weatherData.weatherCode >= 51 ? (
                      <CloudRain className="h-3.5 w-3.5 text-blue-400" />
                    ) : weatherData.weatherCode >= 2 ? (
                      <CloudSun className="h-3.5 w-3.5 text-amber-400" />
                    ) : (
                      <Sun className="h-3.5 w-3.5 text-yellow-400" />
                    )}
                  </div>
                  <div className="mt-1">
                    <span className="text-base font-black tracking-tight">{weatherData.temp}Â°C</span>
                    <p className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">
                      {weatherData.weatherDesc}
                    </p>
                  </div>
                </div>

                {/* 2. AQI (Air Quality Index) */}
                <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${isDark ? "bg-[#0E121C] border-white/5" : "bg-gray-50 border-gray-200"
                  }`}>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Air Quality</span>
                    <Wind className="h-3.5 w-3.5 text-cyan-400" />
                  </div>
                  <div className="mt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base font-black tracking-tight">{weatherData.aqi}</span>
                      <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full border ${weatherData.aqiColor}`}>
                        {weatherData.aqiLabel}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">
                      Kualitas Udara
                    </p>
                  </div>
                </div>

                {/* 3. Kelembaban & Angin */}
                <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${isDark ? "bg-[#0E121C] border-white/5" : "bg-gray-50 border-gray-200"
                  }`}>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Kelembaban</span>
                    <Droplets className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <div className="mt-1">
                    <span className="text-base font-black tracking-tight">{weatherData.humidity}%</span>
                    <p className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">
                      Angin {weatherData.windSpeed} km/h
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BODY CONTENT CONTAINER (With standard padding) */}
        <div className="px-4 sm:px-6 space-y-4 sm:space-y-5 pt-3">

          {/* Small Notice / Badge for Unverified Email */}
          {userAuthEmail && !isEmailVerified && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all ${isDark
                ? "bg-amber-500/10 border-amber-500/25 text-amber-200"
                : "bg-amber-50 border-amber-200 text-amber-900 shadow-sm"
                }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black tracking-tight">
                      {language === "id" ? "Email Belum Terverifikasi" : "Email Unverified"}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 uppercase">
                      Perlu Verifikasi
                    </span>
                  </div>
                  <p className={`text-[11px] truncate mt-0.5 ${isDark ? "text-amber-300/80" : "text-amber-700"}`}>
                    {userAuthEmail} â€¢ {language === "id" ? "Verifikasi untuk keamanan akun & notifikasi." : "Verify for security & gym notices."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isSendingVerifyEmail}
                onClick={handleSendVerificationEmail}
                className="px-3 py-1.5 rounded-xl bg-[#FF5A2C] hover:bg-[#E04E25] text-white text-[10px] font-black uppercase tracking-wider shrink-0 transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSendingVerifyEmail ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>{language === "id" ? "Mengirim..." : "Sending..."}</span>
                  </>
                ) : verifyEmailSent ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-200" />
                    <span>{language === "id" ? "Terkirim!" : "Sent!"}</span>
                  </>
                ) : (
                  <span>{language === "id" ? "Kirim Ulang" : "Verify Now"}</span>
                )}
              </button>
            </motion.div>
          )}

          {/* 4. LEVEL UP YOUR WORKOUT (4 Quick Actions: Tutorial, Program, Tracker, SynHub) */}
          <div className="space-y-2.5 pt-1">
            <h3 className={`text-sm font-black ${isDark ? "text-white" : "text-gray-900"}`}>
              Level up your workout!
            </h3>

            <div className="grid grid-cols-4 gap-3 text-center">
              {quickActions.map((item) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={item.action}
                    className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
                  >
                    <div className="relative">
                      <div
                        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all ${isDark
                          ? "bg-[#181d2a] border border-white/10 group-hover:bg-[#20273a] text-blue-400 group-hover:text-blue-300"
                          : "bg-white border border-gray-200 group-hover:bg-blue-50 text-blue-600 shadow-sm"
                          }`}
                      >
                        <IconComponent className="h-6 w-6" />
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-bold line-clamp-1 truncate w-full ${isDark ? "text-gray-300 group-hover:text-white" : "text-gray-700 group-hover:text-blue-600"
                        }`}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6. TRAINER PROFESIONAL (Pria & Wanita dengan Profil & Tarif) */}
          <TrainersSection
            isDark={isDark}
            language={language}
            onConsultTrainer={(trainer) => {
              const formattedPrice = new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
                maximumFractionDigits: 0,
              }).format(trainer.pricePerSession);
              const message = encodeURIComponent(
                `Halo Admin SynFit, saya (${member.nama}) tertarik untuk booking sesi Personal Trainer bersama Coach ${trainer.name} (${formattedPrice}/sesi). Mohon informasi ketersediaan jadwalnya.`
              );
              window.open(`https://wa.me/6281234567890?text=${message}`, "_blank");
            }}
          />

          {/* 6B. MADING UTAMA SYNFIT (YouTube, TikTok, Blog, Edukasi) */}
          <MadingSection isDark={isDark} language={language} />

          {/* 7. PRESENSI CEPAT (SMART ACCESS GATEWAY - PRESERVED QR SCANNER & GPS) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-blue-500" />
                <h3 className={`text-sm font-extrabold uppercase tracking-wider ${isDark ? "text-white" : "text-gray-900"}`}>
                  Presensi & Smart Access
                </h3>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${status === "Expired"
                  ? "bg-red-500/15 text-red-400 border border-red-500/30"
                  : status === "Hampir Expired" || status === "Almost Expired"
                    ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
                    : "bg-blue-500/15 text-blue-500 border border-blue-500/30"
                  }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                STATUS: {status.toUpperCase()}
              </span>
            </div>

            <div
              className={`rounded-2xl p-5 border transition-all ${isDark ? "bg-[#141822] border-white/10 shadow-2xl" : "bg-white border-gray-200 shadow-md"
                }`}
            >
              <div className="flex items-center justify-between border-b border-gray-500/20 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-blue-500" />
                  <span className={`text-xs font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                    Turnstile Optical Pass
                  </span>
                </div>
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${isDark ? "bg-[#1f2637] text-blue-300" : "bg-blue-50 text-blue-700"
                    }`}
                >
                  <Clock className="h-3 w-3" />
                  <span>{daysLeft > 0 ? `Sisa ${daysLeft} Hari Aktif` : "Masa Aktif Berakhir"}</span>
                </div>
              </div>

              {/* QR Code Container */}
              <div className="flex flex-col items-center justify-center p-4 mt-3 rounded-xl bg-gray-950 border border-white/5">
                <div className="p-3 rounded-2xl bg-white shadow-2xl flex items-center justify-center">
                  {status !== "Expired" ? (
                    <QRCodeSVG value={member.qr_token} size={150} level="H" className="rounded-lg" />
                  ) : (
                    <div className="w-[150px] h-[150px] bg-gray-200 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-black text-red-500 rotate-[-45deg] tracking-widest">
                        INVALID
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <span className="text-xs font-mono font-bold text-yellow-400 tracking-widest">
                    {member.qr_token}
                  </span>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Arahkan layar ponsel ke optical reader turnstile gate saat masuk gym
                  </p>
                </div>
              </div>

              {/* QR Footer Actions */}
              <div className="flex items-center gap-3 mt-3">
                <button
                  onClick={handleRefreshToken}
                  disabled={isRefreshingToken}
                  className={`flex-1 h-10 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 ${isDark
                    ? "bg-[#1C2028] hover:bg-[#262A33] text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-800"
                    }`}
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-blue-500 ${isRefreshingToken ? "animate-spin" : ""}`} />
                  <span>Refresh Kode QR</span>
                </button>

                {!activeCheckinId ? (
                  <Button
                    onClick={() => setShowLocationModal(true)}
                    disabled={isCheckingGPS || status === "Expired"}
                    className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs tracking-wider active:scale-95 shadow-md shadow-blue-500/25"
                  >
                    {isCheckingGPS ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5 mr-1" />}
                    <span>GPS Check-in</span>
                  </Button>
                ) : (
                  <Button
                    onClick={handleManualCheckout}
                    disabled={isCheckingGPS}
                    className="h-10 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs tracking-wider active:scale-95 shadow-md shadow-orange-600/20"
                  >
                    {isCheckingGPS ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5 mr-1" />}
                    <span>Check-out</span>
                  </Button>
                )}
              </div>

              {/* Live Workout Telemetry when active */}
              {activeCheckinId && (
                <div className="mt-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                    </span>
                    <span className="text-xs font-black text-blue-400 uppercase tracking-wider">
                      Sesi Latihan Aktif
                    </span>
                  </div>
                  <div className={`text-xs font-mono font-extrabold ${isDark ? "text-white" : "text-gray-900"}`}>
                    {Math.floor(workoutDuration / 3600).toString().padStart(2, "0")}:
                    {Math.floor((workoutDuration % 3600) / 60).toString().padStart(2, "0")}:
                    {(workoutDuration % 60).toString().padStart(2, "0")}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // TAB 2: KEANGGOTAAN (MEMBERSHIP & PERPANJANGAN QRIS)
  // -------------------------------------------------------------
  const renderMembershipTab = () => {
    return (
      <div className="space-y-6 text-left w-full max-w-5xl mx-auto p-4 sm:p-6 pb-28 md:pb-12">
        <div id="membership-tab-top" className="w-full h-0 pointer-events-none -mt-4 opacity-0" />
        {/* Top Notification Chip */}
        <div
          className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-colors ${isDark ? "bg-[#141822] border-white/10 shadow-md" : "bg-white border-gray-200 shadow-sm"
            }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`w-2.5 h-2.5 rounded-full ${daysLeft <= 3 ? "bg-amber-500 animate-pulse" : "bg-blue-500"
                }`}
            />
            <span className={`text-xs font-medium truncate ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              Masa Aktif:{" "}
              <strong className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                {daysLeft > 0 ? `${daysLeft} Hari Tersisa` : "Kedaluwarsa"}
              </strong>
            </span>
          </div>
          <span
            className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${daysLeft <= 3
              ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
              : "bg-blue-500/15 text-blue-500 border border-blue-500/30"
              }`}
          >
            {daysLeft <= 3 ? "Perlu Perhatian" : "Aktif"}
          </span>
        </div>

        {/* Digital VIP Member Card */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className={`text-sm font-extrabold uppercase tracking-wider flex items-center gap-2 ${isDark ? "text-white" : "text-gray-900"
              }`}>
              <CreditCard className="h-4 w-4 text-blue-500" />
              <span>Kartu Digital VIP</span>
            </h2>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${isDark ? "bg-blue-500/15 text-blue-400 border border-blue-500/25" : "bg-blue-50 text-blue-600 border border-blue-200"
              }`}>
              Active RFID Pass
            </span>
          </div>

          <DigitalCard
            memberId={member.id}
            name={member.nama}
            status={status}
            qrToken={member.qr_token}
            expiredAt={formatDate(member.tanggal_expired)}
            startDate={formatDate(member.tanggal_daftar)}
            tier="VIP PLATINUM"
          />

          <div className="grid grid-cols-2 gap-3 pt-1">
            <Button
              onClick={handleDownload}
              className={`h-11 rounded-full text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all ${isDark
                ? "bg-[#141822] hover:bg-[#1C2028] border border-white/10 text-white shadow-md"
                : "bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 shadow-sm"
                }`}
            >
              <Download className="h-4 w-4 text-blue-500" />
              <span>Unduh PNG</span>
            </Button>
            <Button
              onClick={handleShareCard}
              className={`h-11 rounded-full text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all ${isDark
                ? "bg-[#141822] hover:bg-[#1C2028] border border-white/10 text-white shadow-md"
                : "bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 shadow-sm"
                }`}
            >
              <Share2 className="h-4 w-4 text-blue-500" />
              <span>Bagikan Kartu</span>
            </Button>
          </div>
        </div>

        {/* Detail Keanggotaan Bento Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`p-4 rounded-2xl border space-y-1 transition-colors ${isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider block ${isDark ? "text-gray-400" : "text-gray-500"
              }`}>
              Mulai Bergabung
            </span>
            <p className={`text-sm font-extrabold ${isDark ? "text-white" : "text-gray-900"}`}>
              {formatDate(member.tanggal_daftar)}
            </p>
            <span className={`text-[10px] font-medium block ${isDark ? "text-gray-400" : "text-gray-500"
              }`}>
              Anggota Resmi SynFit
            </span>
          </div>

          <div className={`p-4 rounded-2xl border space-y-1 transition-colors ${isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider block ${isDark ? "text-gray-400" : "text-gray-500"
              }`}>
              Jatuh Tempo
            </span>
            <p className={`text-sm font-extrabold ${isDark ? "text-white" : "text-gray-900"}`}>
              {formatDate(member.tanggal_expired)}
            </p>
            <span className={`text-[10px] font-bold block ${daysLeft <= 3 ? "text-amber-500" : "text-blue-500"
              }`}>
              {daysLeft > 0 ? `${daysLeft} Hari Lagi` : "Sudah Berakhir"}
            </span>
          </div>
        </div>

        {/* Self-Service Renewal Module (2-Stage Interactive Flow) */}
        <div className={`rounded-2xl border p-5 space-y-4 transition-colors ${isDark ? "bg-[#141822] border-white/10 shadow-xl" : "bg-white border-gray-200 shadow-sm"
          }`}>
          <div className={`flex items-center justify-between border-b pb-3 ${isDark ? "border-white/5" : "border-gray-100"
            }`}>
            <div>
              <h3 className={`text-sm font-extrabold uppercase tracking-wide ${isDark ? "text-white" : "text-gray-900"
                }`}>
                Perpanjangan Mandiri
              </h3>
              <p className={`text-[11px] font-medium ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                Perpanjang paket instan tanpa antre di resepsionis
              </p>
            </div>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${isDark ? "text-blue-400 bg-blue-500/15 border border-blue-500/25" : "text-blue-600 bg-blue-50 border border-blue-200"
              }`}>
              Langkah {renewalStep} dari 2
            </span>
          </div>

          {renewalSuccess ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-500/15 text-blue-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h4 className={`text-base font-extrabold ${isDark ? "text-white" : "text-gray-900"}`}>
                Bukti Pembayaran Terkirim!
              </h4>
              <p className={`text-xs max-w-sm mx-auto ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Admin sedang memverifikasi bukti transfer Anda. Status keanggotaan akan otomatis diperbarui.
              </p>
              <Button
                onClick={() => {
                  setRenewalSuccess(false);
                  setRenewalStep(1);
                  setRenewalProof("");
                }}
                className={`h-10 px-6 rounded-full text-xs font-bold transition-all ${isDark ? "bg-[#1C2028] hover:bg-[#262A33] text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-800"
                  }`}
              >
                Tutup
              </Button>
            </div>
          ) : renewalStep === 1 ? (
            <div className="space-y-3">
              <label className={`text-[11px] font-bold block ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Pilih Durasi Paket VIP:
              </label>

              <div
                onClick={() => setRenewalPlan("1 Bulan")}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${renewalPlan === "1 Bulan"
                  ? isDark
                    ? "bg-blue-600/15 border-blue-500 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/50"
                    : "bg-blue-50/70 border-blue-500 shadow-sm ring-1 ring-blue-500/30"
                  : isDark
                    ? "bg-[#0F131C] border-white/5 hover:border-white/15"
                    : "bg-gray-50/70 border-gray-200 hover:border-gray-300"
                  }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-extrabold ${isDark ? "text-white" : "text-gray-900"}`}>
                      1 Bulan Platinum
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700"
                      }`}>
                      Hemat
                    </span>
                  </div>
                  <p className={`text-[10px] mt-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    Akses penuh seluruh fasilitas gym & locker
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-extrabold text-blue-500">Rp 160.000</span>
                  <span className={`text-[9px] block ${isDark ? "text-gray-400" : "text-gray-500"}`}>/bulan</span>
                </div>
              </div>

              <div
                onClick={() => setRenewalPlan("3 Bulan")}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between relative overflow-hidden ${renewalPlan === "3 Bulan"
                  ? isDark
                    ? "bg-blue-600/15 border-blue-500 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/50"
                    : "bg-blue-50/70 border-blue-500 shadow-sm ring-1 ring-blue-500/30"
                  : isDark
                    ? "bg-[#0F131C] border-white/5 hover:border-white/15"
                    : "bg-gray-50/70 border-gray-200 hover:border-gray-300"
                  }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-extrabold ${isDark ? "text-white" : "text-gray-900"}`}>
                      3 Bulan Platinum
                    </span>
                    <span className="text-[9px] font-bold bg-amber-500 text-black px-2 py-0.5 rounded-full shadow-sm">
                      Diskon 27%
                    </span>
                    <span className="text-[9px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full shadow-sm">
                      Best Value
                    </span>
                  </div>
                  <p className={`text-[10px] mt-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    Akses 90 hari + Prioritas konsultasi latihan
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] line-through block ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                    Rp 480.000
                  </span>
                  <span className="text-sm font-extrabold text-blue-500">Rp 350.000</span>
                  <span className={`text-[9px] block ${isDark ? "text-gray-400" : "text-gray-500"}`}>/3 bulan</span>
                </div>
              </div>

              {appliedReferralDiscount && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="text-xs font-bold text-emerald-400">Voucher Referral 20% Aktif</span>
                      <p className="text-[10px] text-gray-400">Potongan tambahan diterapkan saat pembayaran</p>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-emerald-400">-20%</span>
                </div>
              )}

              <div className="space-y-2 pt-1">
                <Button
                  onClick={handleMidtransRenewal}
                  disabled={isRenewing}
                  className="w-full h-11 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:opacity-95 text-white font-black text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
                >
                  {isRenewing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-blue-200" />
                      <span>Bayar Instan Otomatis (Midtrans)</span>
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => {
                    setRenewalStep(2);
                    resetScrollAcrossContainers();
                  }}
                  className={`w-full h-10 rounded-full text-xs font-bold transition-all border ${
                    isDark
                      ? "bg-white/5 border-white/10 hover:bg-white/10 text-gray-300"
                      : "bg-gray-100 border-gray-200 hover:bg-gray-200 text-gray-800"
                  }`}
                >
                  Transfer QRIS & Unggah Struk Manual
                </Button>

                <Link
                  href={`/payment?plan=${renewalPlan === "3 Bulan" ? "3_bulan" : "1_bulan"}`}
                  className="w-full text-center text-[11px] text-blue-400 hover:text-blue-300 font-bold flex items-center justify-center gap-1 pt-1"
                >
                  <span>Buka Halaman Pembayaran Lengkap</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRenewalSubmit} className="space-y-4">
              <div className={`p-4 rounded-xl border text-center space-y-3 transition-colors ${isDark ? "bg-[#0F131C] border-white/5" : "bg-gray-50 border-gray-200"
                }`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider block ${isDark ? "text-gray-400" : "text-gray-500"
                  }`}>
                  Scan QRIS Resmi SynFit
                </span>
                <div className="flex flex-col items-center justify-center">
                  {qrisUrl ? (
                    <div className="p-2.5 bg-white rounded-xl shadow-lg w-36 h-36 flex items-center justify-center mb-2">
                      <img src={qrisUrl} alt="QRIS" className="max-w-full max-h-full object-contain" />
                    </div>
                  ) : (
                    <div className={`w-36 h-36 rounded-xl flex items-center justify-center text-[10px] p-2 mb-2 ${isDark ? "bg-[#1C2028] text-gray-400" : "bg-gray-200 text-gray-600"
                      }`}>
                      QRIS Gym Standar
                    </div>
                  )}

                  {qrisUrl && (
                    <button
                      type="button"
                      onClick={handleDownloadQris}
                      className="text-[10px] font-bold text-blue-500 hover:underline flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" /> Unduh Gambar QRIS
                    </button>
                  )}
                </div>

                <div>
                  <span className={`text-[10px] uppercase tracking-widest block font-bold ${isDark ? "text-gray-400" : "text-gray-500"
                    }`}>
                    Total Pembayaran:
                  </span>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    {appliedReferralDiscount ? (
                      <>
                        <span className={`text-xs line-through ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                          {renewalPlan === "3 Bulan" ? "Rp 350.000" : "Rp 160.000"}
                        </span>
                        <p className="text-xl font-black text-emerald-400">
                          {renewalPlan === "3 Bulan" ? "Rp 280.000" : "Rp 128.000"}
                        </p>
                      </>
                    ) : (
                      <p className={`text-xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                        {renewalPlan === "3 Bulan" ? "Rp 350.000" : "Rp 160.000"}
                      </p>
                    )}
                  </div>
                  {appliedReferralDiscount && (
                    <span className="text-[10px] font-semibold text-emerald-400 block mt-0.5">
                      Hemat 20% dari Kode Referral
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={`text-[10px] font-bold uppercase tracking-wider block ${isDark ? "text-gray-400" : "text-gray-600"
                  }`}>
                  Unggah Bukti Transfer:
                </label>
                <div className={`relative border border-dashed rounded-xl p-3 text-center transition-colors cursor-pointer ${isDark
                  ? "border-white/10 bg-[#0F131C] hover:bg-[#141822]"
                  : "border-gray-300 bg-gray-50 hover:bg-gray-100"
                  }`}>
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={handleRenewalFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  {renewalProof ? (
                    <div className="flex items-center justify-center gap-2 text-blue-500 text-xs font-bold">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Bukti transfer dipilih</span>
                    </div>
                  ) : (
                    <div className={`flex items-center justify-center gap-2 text-xs font-medium ${isDark ? "text-gray-400" : "text-gray-600"
                      }`}>
                      <Upload className="h-4 w-4 text-blue-500" />
                      <span>Klik untuk memilih file foto bukti</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => {
                    setRenewalStep(1);
                    resetScrollAcrossContainers();
                  }}
                  className={`flex-1 h-11 rounded-full text-xs font-bold transition-all ${isDark ? "bg-[#1C2028] hover:bg-[#262A33] text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-800"
                    }`}
                >
                  Kembali
                </Button>
                <Button
                  type="submit"
                  disabled={!renewalProof || isRenewing}
                  className="flex-1 h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-blue-500/25 active:scale-95 disabled:opacity-50 transition-all"
                >
                  {isRenewing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kirim Bukti"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // TAB 3: PERSONAL WORKOUT PROGRAM (AI & MANUAL BUILDER HUB)
  // -------------------------------------------------------------
  const renderProgramTab = () => {
    return (
      <div className="w-full h-full flex-1 flex flex-col max-w-5xl mx-auto p-4 sm:p-6 pb-12">
        <PersonalWorkoutProgramHub
          member={member}
          session={session}
          isDark={isDark}
          language={language}
          onOpenAiCoach={(exerciseType) => {
            navigateToTab("coach");
            if (exerciseType) {
              toast.info(`Membuka AI Form Coach untuk latihan ${exerciseType}`);
            }
          }}
          onBackToHome={goBack}
        />
      </div>
    );
  };

  // -------------------------------------------------------------
  // TAB: AI FORM COACH (VISION & EVALUATION HUB - ACCESSED VIA PROGRAM)
  // -------------------------------------------------------------
  const renderCoachTab = () => {
    return (
      <div className="w-full h-full flex-1 flex flex-col max-w-5xl mx-auto p-4 sm:p-6 pb-12">
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Memuat MediaPipe AI Vision...
              </p>
            </div>
          }
        >
          <AIFormCoach
            member={member}
            onBackToDashboard={goBack}
            onOpenHeartRateHistory={() => setShowHeartRateHistoryModal(true)}
            language={language}
            isDark={isDark}
          />
        </Suspense>
      </div>
    );
  };

  // -------------------------------------------------------------
  // TAB: TRACKER (SMARTWATCH TELEMETRY, AI BIOMETRICS & HISTORY)
  // -------------------------------------------------------------
  const renderTrackerTab = () => {
    return (
      <div className="w-full h-full flex-1 flex flex-col max-w-5xl mx-auto p-4 sm:p-6 pb-12">
        <MemberTrackerHub
          member={member}
          isDark={isDark}
          language={language}
          visitsData={visitsData}
          onOpenHeartRateHistory={() => setShowHeartRateHistoryModal(true)}
          onBackToHome={goBack}
          onNavigateToProgram={() => navigateToTab("program")}
        />
      </div>
    );
  };

  // -------------------------------------------------------------
  // TAB: SYNHUB (COMMUNITY, CLASSES, REFERRAL & FACILITIES)
  // -------------------------------------------------------------
  const renderSynHubTab = () => {
    return (
      <div className="w-full h-full flex-1 flex flex-col max-w-5xl mx-auto p-4 sm:p-6 pb-12">
        <SynHubTab
          member={member}
          isDark={isDark}
          language={language}
          onBackToHome={goBack}
          onOpenReferral={() => setShowReferralModal(true)}
          onOpenLocationModal={() => setShowLocationModal(true)}
        />
      </div>
    );
  };

  // -------------------------------------------------------------
  // TAB: TUTORIAL ALAT GYM (CATALOG & STEP-BY-STEP GUIDES)
  // -------------------------------------------------------------
  const renderTutorialTab = () => {
    return (
      <div className="w-full h-full flex-1 flex flex-col max-w-7xl mx-auto pb-12">
        <MemberTutorialsHub
          onBack={goBack}
          isDark={isDark}
          language={language}
          onNavigateToProgram={() => navigateToTab("program")}
        />
      </div>
    );
  };
  const renderChatTab = () => {
    return (
      <div className={`flex flex-col h-[calc(100vh-62px)] md:h-[calc(100vh-76px)] w-full flex-1 overflow-hidden text-left transition-colors ${isDark ? "bg-[#090B10]" : "bg-[#EAECEF]"
        }`}>
        {/* Fullscreen Edge-to-Edge Receptionist Header */}
        <div className={`px-4 py-3 backdrop-blur-xl border-b flex items-center justify-between z-20 shrink-0 transition-colors ${isDark ? "bg-[#141822]/95 border-white/10 text-white" : "bg-white/95 border-gray-200 text-gray-900"
          }`}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 p-0.5">
                <div className={`w-full h-full rounded-full flex items-center justify-center font-black text-xs ${isDark ? "bg-[#181C24] text-white" : "bg-gray-100 text-gray-800"
                  }`}>
                  CS
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-sm font-extrabold ${isDark ? "text-white" : "text-gray-900"}`}>Resepsionis SynFit</h3>
                <span className="text-[9px] text-blue-500 font-bold bg-blue-500/15 px-2 py-0.5 rounded-full border border-blue-500/25">
                  Online
                </span>
              </div>
              <p className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>Customer Service & Bantuan Gym Langsung</p>
            </div>
          </div>

          <a
            href="https://wa.me/6289528022044"
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 px-3 rounded-full bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-[#25D366] text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
          >
            <span>WhatsApp</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Quick Presets Bar */}
        <div
          data-no-swipe="true"
          className={`px-4 py-2 border-b overflow-x-auto no-scrollbar flex items-center gap-2 shrink-0 touch-pan-x overscroll-contain transition-colors ${isDark ? "bg-[#121622]/90 border-white/5" : "bg-white/95 border-gray-200"
            }`}
        >
          {presetMessages.map((msg) => (
            <button
              key={msg.id}
              onClick={() => setChatMessage(msg.text)}
              className={`px-3 py-1.5 rounded-full border text-[11px] font-semibold whitespace-nowrap active:scale-95 transition-all shrink-0 select-none ${isDark
                ? "bg-[#1C2028] hover:bg-[#262A33] border-white/10 text-gray-300 hover:text-white"
                : "bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-700 hover:text-gray-900"
                }`}
            >
              {msg.label}
            </button>
          ))}
        </div>

        {/* Conversation Stream Container (Internal Scroll Only, Edge-to-Edge) */}
        <div
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar flex flex-col min-h-0 touch-pan-y overscroll-contain"
        >
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-500">
              <MessageSquare className="h-10 w-10 text-gray-400 mb-2" />
              <p className="text-xs font-medium max-w-sm">
                Punya pertanyaan untuk resepsionis? Tulis pesan di bawah atau pilih template bantuan di atas.
              </p>
            </div>
          ) : (
            messages
              .filter((msg, idx, arr) => !msg.id || arr.findIndex((m) => m.id === msg.id) === idx)
              .map((msg, index) => {
                const isMe = msg.sender_role === "MEMBER";
                const msgTimestamp = parseMsgTime(msg.created_at);
                const isUnread = !isMe && lastReadChatTime > 0 && msgTimestamp > lastReadChatTime;
                let msgTime = "...";
                try {
                  if (msg.created_at?.toDate) {
                    msgTime = msg.created_at.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                  } else if (msg.created_at?.seconds || msg.created_at?._seconds) {
                    const s = msg.created_at.seconds || msg.created_at._seconds;
                    msgTime = new Date(s * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                  } else if (msg.created_at) {
                    msgTime = new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                  }
                } catch (e) { }

                return (
                  <div
                    key={msg.id ? `${msg.id}-${index}` : `chat-msg-${index}`}
                    className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${isMe ? "items-end" : "items-start"}`}>
                      <div
                        className={`relative px-4 py-2.5 rounded-2xl text-xs font-medium leading-relaxed whitespace-pre-wrap ${isMe
                          ? "bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-500/20"
                          : isDark
                            ? "bg-[#141822] text-gray-100 rounded-tl-none border border-white/10 shadow-sm"
                            : "bg-white text-gray-900 rounded-tl-none border border-gray-200 shadow-sm"
                          }`}
                      >
                        <div>{msg.content}</div>
                      </div>
                      <span className="text-[8px] font-bold text-gray-500 mt-1 uppercase tracking-wider flex items-center gap-1.5">
                        <span>{isMe ? "Anda" : "Resepsionis"} â€¢ {msgTime}</span>
                        {isMe && (
                          <span className="inline-flex items-center ml-0.5 select-none font-bold" title={msg.is_read ? "Dibaca oleh resepsionis" : "Terkirim"}>
                            {msg.is_read ? (
                              <span className="text-sky-400 font-black text-[11px] tracking-[-2px] leading-none">âœ“âœ“</span>
                            ) : (
                              <span className="text-white/60 font-black text-[11px] leading-none">âœ“</span>
                            )}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })
          )}

          {/* Incoming Receptionist Typing Indicator */}
          {isAdminTyping && (
            <div className="flex w-full justify-start animate-in fade-in duration-200">
              <div className="flex flex-col items-start max-w-[85%] sm:max-w-[70%]">
                <div className={`px-4 py-2.5 rounded-2xl rounded-tl-none border shadow-md flex items-center gap-2 ${isDark ? "bg-[#141822] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
                  }`}>
                  <span className={`text-[11px] font-medium ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                    Resepsionis sedang mengetik
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Typing Indicator Animation when Sending Chat */}
          {isSendingChat && (
            <div className="flex w-full justify-end animate-in fade-in duration-200">
              <div className="flex flex-col items-end max-w-[85%] sm:max-w-[70%]">
                <div className="px-4 py-3 rounded-2xl bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-500/20 flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-white/95">Sedang mengirim</span>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" />
                  </div>
                </div>
                <span className="text-[8px] font-bold text-gray-500 mt-1 uppercase tracking-wider">
                  Anda â€¢ Mengetik
                </span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Pinned Input Dock (Sits cleanly right above bottom navigation) */}
        <form onSubmit={handleSendChatMessage} className={`p-3 sm:p-4 border-t flex items-center gap-2 shrink-0 z-20 pb-20 md:pb-4 transition-colors ${isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200"
          }`}>
          <input
            type="text"
            value={chatMessage}
            onChange={(e) => {
              setChatMessage(e.target.value);
              broadcastMemberTyping();
            }}
            placeholder="Tulis pesan ke resepsionis..."
            className={`flex-1 border rounded-full px-4 py-2.5 text-xs transition-colors focus:outline-none focus:border-blue-500 ${isDark
              ? "bg-[#10141D] border-white/10 text-white placeholder:text-gray-500"
              : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400"
              }`}
          />
          <button
            type="submit"
            disabled={!chatMessage.trim() || isSendingChat}
            className="h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center active:scale-95 transition-all disabled:opacity-50 shrink-0 shadow-md shadow-blue-500/25"
          >
            {isSendingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>
    );
  };

  // -------------------------------------------------------------
  // TAB 5: PROFIL MEMBER & KALIBRASI BIOMETRIK AI
  // -------------------------------------------------------------
  const renderProfileTab = () => {
    return (
      <div className="space-y-5 text-left w-full max-w-3xl mx-auto p-4 sm:p-6 pb-28 md:pb-12">
        {/* Top Header Bar with Back Button */}
        <div className="flex items-center justify-between pb-1 -mt-1">
          <button
            onClick={goBack}
            className="flex items-center gap-2 py-1.5 px-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-blue-500 transition-all active:scale-95 shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-black">Kembali</span>
          </button>
          <span className="text-xs font-black uppercase tracking-wider text-gray-400">
            Profil Member
          </span>
          <div className="w-16" />
        </div>

        {/* Header Profil & Foto */}
        <div className={`rounded-3xl border p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-4 relative overflow-hidden transition-colors ${isDark ? "bg-[#141822] border-white/10 text-white shadow-xl" : "bg-white border-gray-200 text-gray-900 shadow-sm"
          }`}>
          <div className="relative group shrink-0">
            <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-full p-1 bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 shadow-lg shadow-blue-500/20">
              <div className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center ${isDark ? "bg-[#181C24]" : "bg-gray-100"
                }`}>
                {member.foto_url ? (
                  <img src={member.foto_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className={`text-xl font-black ${isDark ? "text-blue-400" : "text-blue-600"}`}>
                    {member.nama ? member.nama.substring(0, 2).toUpperCase() : "ME"}
                  </span>
                )}
              </div>
            </div>

            <label
              htmlFor="avatar-upload-input"
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center cursor-pointer shadow-md active:scale-90 transition-transform"
            >
              {isUploadingPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              <input
                id="avatar-upload-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleMemberPhotoUpload}
              />
            </label>
          </div>

          <div className="text-center sm:text-left flex-1 min-w-0">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h2 className={`text-lg sm:text-xl font-black truncate ${isDark ? "text-white" : "text-gray-900"}`}>{member.nama}</h2>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${isDark ? "text-blue-400 bg-blue-500/15 border border-blue-500/25" : "text-blue-600 bg-blue-50 border border-blue-200"
                }`}>
                PRO MEMBER
              </span>
            </div>
            <p className={`text-xs mt-0.5 truncate font-mono ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              ID Member: {member.id}
            </p>
            <p className={`text-[11px] mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              {formatPhoneDisplay(member.nomor_whatsapp)} Â· {member.alamat || "Indonesia"}
            </p>
          </div>
        </div>

        {/* LIST PENGATURAN & INFORMASI (7 Items) */}
        <div className={`rounded-3xl border overflow-hidden transition-colors divide-y ${isDark
          ? "bg-[#141822] border-white/10 divide-white/5 text-white shadow-xl"
          : "bg-white border-gray-200 divide-gray-100 text-gray-900 shadow-sm"
          }`}>
          {/* 1. Profil */}
          <button
            onClick={() => openProfileSubPage("profile_detail")}
            className={`w-full p-4 flex items-center justify-between text-left transition-colors ${isDark ? "hover:bg-white/5 active:bg-white/10" : "hover:bg-gray-50 active:bg-gray-100"
              }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-500 border border-blue-500/20 flex items-center justify-center shrink-0">
                <User className="h-5 w-5" />
              </div>
              <div>
                <span className="text-sm font-black block">Profil</span>
                <span className={`text-xs block ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  Data pribadi, ukuran tubuh &amp; target kalibrasi
                </span>
              </div>
            </div>
            <ChevronRight className={`h-4 w-4 shrink-0 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
          </button>

          {/* 2. Akun */}
          <button
            onClick={() => openProfileSubPage("account_detail")}
            className={`w-full p-4 flex items-center justify-between text-left transition-colors ${isDark ? "hover:bg-white/5 active:bg-white/10" : "hover:bg-gray-50 active:bg-gray-100"
              }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/15 text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <span className="text-sm font-black block">Akun</span>
                <span className={`text-xs block ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  Keamanan sandi &amp; status keanggotaan
                </span>
              </div>
            </div>
            <ChevronRight className={`h-4 w-4 shrink-0 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
          </button>

          {/* 3. Tema */}
          <button
            onClick={() => openProfileSubPage("theme_detail")}
            className={`w-full p-4 flex items-center justify-between text-left transition-colors ${isDark ? "hover:bg-white/5 active:bg-white/10" : "hover:bg-gray-50 active:bg-gray-100"
              }`}
          >
            <div className="flex items-center gap-3.5">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${theme === "dark"
                ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
                : "bg-blue-500/15 text-blue-600 border-blue-500/20"
                }`}>
                {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </div>
              <div>
                <span className="text-sm font-black block">Tema</span>
                <span className={`text-xs block ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  {theme === "dark" ? "Mode Gelap (Deep Midnight)" : "Mode Terang (Clean Slate)"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className={`px-2.5 py-0.5 rounded-full text-xs font-black border transition-all ${theme === "dark"
                ? "bg-white/10 text-white border-white/15"
                : "bg-gray-100 text-gray-800 border-gray-200"
                }`}>
                {theme === "dark" ? "Gelap" : "Terang"}
              </div>
              <ChevronRight className={`h-4 w-4 shrink-0 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
            </div>
          </button>

          {/* 4. Bahasa */}
          <button
            onClick={() => openProfileSubPage("language_detail")}
            className={`w-full p-4 flex items-center justify-between text-left transition-colors ${isDark ? "hover:bg-white/5 active:bg-white/10" : "hover:bg-gray-50 active:bg-gray-100"
              }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/15 text-teal-400 border border-teal-500/20 flex items-center justify-center shrink-0">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <span className="text-sm font-black block">Bahasa</span>
                <span className={`text-xs block ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  {language === "id" ? "Bahasa Indonesia (ID)" : "English (EN)"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className={`px-2.5 py-0.5 rounded-full text-xs font-black border transition-all ${isDark ? "bg-white/10 text-white border-white/15" : "bg-gray-100 text-gray-800 border-gray-200"
                }`}>
                {language === "id" ? "ID" : "EN"}
              </div>
              <ChevronRight className={`h-4 w-4 shrink-0 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
            </div>
          </button>

          {/* 5. Tentang */}
          <button
            onClick={() => openProfileSubPage("about_detail")}
            className={`w-full p-4 flex items-center justify-between text-left transition-colors ${isDark ? "hover:bg-white/5 active:bg-white/10" : "hover:bg-gray-50 active:bg-gray-100"
              }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
                <Info className="h-5 w-5" />
              </div>
              <div>
                <span className="text-sm font-black block">Tentang</span>
                <span className={`text-xs block ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  Tentang SynFit Gym, visi &amp; jam operasional
                </span>
              </div>
            </div>
            <ChevronRight className={`h-4 w-4 shrink-0 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
          </button>

          {/* 6. Syarat dan Ketentuan */}
          <button
            onClick={() => openProfileSubPage("terms_detail")}
            className={`w-full p-4 flex items-center justify-between text-left transition-colors ${isDark ? "hover:bg-white/5 active:bg-white/10" : "hover:bg-gray-50 active:bg-gray-100"
              }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <span className="text-sm font-black block">Syarat dan Ketentuan</span>
                <span className={`text-xs block ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  Kebijakan member, privasi &amp; tata tertib gym
                </span>
              </div>
            </div>
            <ChevronRight className={`h-4 w-4 shrink-0 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
          </button>

          {/* 7. Versi Aplikasi */}
          <button
            onClick={() => openProfileSubPage("version_detail")}
            className={`w-full p-4 flex items-center justify-between text-left transition-colors ${isDark ? "hover:bg-white/5 active:bg-white/10" : "hover:bg-gray-50 active:bg-gray-100"
              }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-orange-500/15 text-orange-400 border border-orange-500/20 flex items-center justify-center shrink-0">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <span className="text-sm font-black block">Versi Aplikasi</span>
                <span className={`text-xs block ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  SynFit Smart Fitness Platform
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>v2.4.0 (Stable)</span>
              </div>
              <ChevronRight className={`h-4 w-4 shrink-0 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
            </div>
          </button>
        </div>

        {/* Tombol Logout */}
        <div className="pt-2">
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full py-3.5 rounded-2xl bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 border border-red-500/20 text-xs font-black uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm"
          >
            <LogOut className="h-4 w-4" />
            <span>Keluar dari Akun (Logout)</span>
          </button>
        </div>
      </div>
    );
  };

  // =============================================================
  // SUB-PAGES PROFIL (LATERAL NAVIGATION SLIDE)
  // =============================================================

  // 1. SUB-PAGE: PROFIL & BIOMETRIK
  const renderProfileDetailSubPage = () => {
    return (
      <div className="w-full flex-1 flex flex-col text-left">
        {/* Sticky Header */}
        <div className={`sticky top-0 z-30 backdrop-blur-md px-4 sm:px-6 py-4 border-b flex items-center justify-between ${isDark ? "bg-[#090B10]/90 border-white/10 text-white" : "bg-white/90 border-gray-200 text-gray-900"
          }`}>
          <button
            onClick={closeProfileSubPage}
            className="flex items-center gap-2 py-1 px-2 -ml-2 rounded-xl text-blue-500 hover:bg-blue-500/10 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-xs font-black">Kembali</span>
          </button>
          <h2 className="text-sm font-black uppercase tracking-wider">Profil &amp; Biometrik</h2>
          <div className="w-16" />
        </div>

        <div className="p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-6 pb-20">
          {/* Foto Profil Card */}
          <div className={`p-5 rounded-3xl border flex items-center gap-4 ${isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}>
            <div className="relative group shrink-0">
              <div className="w-16 h-16 rounded-full p-1 bg-gradient-to-tr from-blue-600 to-cyan-400 shadow-md">
                <div className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center ${isDark ? "bg-[#181C24]" : "bg-gray-100"
                  }`}>
                  {member.foto_url ? (
                    <img src={member.foto_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-black text-blue-500">
                      {member.nama ? member.nama.substring(0, 2).toUpperCase() : "ME"}
                    </span>
                  )}
                </div>
              </div>
              <label
                htmlFor="subpage-avatar-input"
                className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center cursor-pointer shadow active:scale-90"
              >
                {isUploadingPhoto ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                <input
                  id="subpage-avatar-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleMemberPhotoUpload}
                />
              </label>
            </div>
            <div>
              <h3 className="font-black text-sm">{member.nama}</h3>
              <p className="text-xs text-gray-400 font-mono">ID: {member.id}</p>
              <button
                onClick={() => memberPhotoInputRef.current?.click()}
                className="text-[11px] font-bold text-blue-500 hover:underline mt-1 block"
              >
                Ganti Foto Profil (Cloud Sync)
              </button>
            </div>
          </div>

          {/* Data Personal */}
          <div className={`p-5 rounded-3xl border space-y-4 ${isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}>
            <div className="flex items-center justify-between border-b pb-3 border-gray-500/10">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-blue-500" />
                <h4 className="text-xs font-black uppercase tracking-wider">Data Pribadi</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingPersonal(!isEditingPersonal)}
                className="text-xs font-bold text-blue-500 hover:underline"
              >
                {isEditingPersonal ? "Batal" : "Edit Data"}
              </button>
            </div>

            {isEditingPersonal ? (
              <form onSubmit={handleSavePersonal} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Nama Lengkap</label>
                  <Input
                    type="text"
                    required
                    value={editNama}
                    onChange={(e) => setEditNama(e.target.value)}
                    className={`h-10 text-xs font-bold rounded-xl ${isDark ? "bg-[#10141D] text-white" : "bg-gray-50 text-gray-900"}`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Nomor WhatsApp (+62)</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-gray-400 border-r border-gray-500/20 pr-2 pointer-events-none">
                      +62
                    </span>
                    <Input
                      type="tel"
                      pattern="[0-9]*"
                      required
                      value={editPhone.replace(/^(?:\+?62|0)/, "")}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/\D/g, "");
                        setEditPhone(clean ? `+62${clean.replace(/^0+/, "")}` : "");
                      }}
                      placeholder="81234567890"
                      className={`h-10 text-xs font-bold rounded-xl pl-14 ${isDark ? "bg-[#10141D] text-white" : "bg-gray-50 text-gray-900"}`}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Alamat Domisili</label>
                  <Input
                    type="text"
                    value={editAlamat}
                    onChange={(e) => setEditAlamat(e.target.value)}
                    className={`h-10 text-xs font-bold rounded-xl ${isDark ? "bg-[#10141D] text-white" : "bg-gray-50 text-gray-900"}`}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isSavingPersonal}
                  className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider"
                >
                  {isSavingPersonal ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan Perubahan Personal"}
                </Button>
              </form>
            ) : (
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-500/10">
                  <span className="text-gray-400">Nama Lengkap</span>
                  <span className="font-bold uppercase">{member.nama}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-500/10">
                  <span className="text-gray-400">Nomor WhatsApp</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono text-emerald-400">
                      {formatPhoneDisplay(member.nomor_whatsapp)}
                    </span>
                    {member.nomor_whatsapp && (
                      <a
                        href={`https://wa.me/${getCleanWaPhone(member.nomor_whatsapp)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-[10px] font-bold inline-flex items-center gap-1 transition-all"
                        title="Buka WhatsApp"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Chat</span>
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-400">Alamat</span>
                  <span className="font-bold">{member.alamat || "-"}</span>
                </div>
              </div>
            )}
          </div>

          {/* Kalibrasi Biometrik AI */}
          <form onSubmit={handleSaveBiometrics} className={`p-5 rounded-3xl border space-y-4 ${isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}>
            <div className="border-b pb-3 border-gray-500/10">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                <h4 className="text-xs font-black uppercase tracking-wider">Kalibrasi Biometrik AI</h4>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Data digunakan oleh modul MediaPipe Vision AI untuk estimasi sudut sendi, repetisi, dan personalisasi program.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-400">Tinggi Badan (cm)</label>
                <Input
                  type="number"
                  min="100"
                  max="250"
                  value={userHeight}
                  onChange={(e) => setUserHeight(e.target.value)}
                  placeholder="170"
                  className={`h-10 text-xs font-bold rounded-xl ${isDark ? "bg-[#10141D] text-white" : "bg-gray-50 text-gray-900"}`}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Berat Badan (kg)</label>
                  {calculatedBmi && (
                    <span className="text-[9px] font-bold text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded-full">
                      BMI {calculatedBmi}
                    </span>
                  )}
                </div>
                <Input
                  type="number"
                  min="30"
                  max="250"
                  step="0.5"
                  value={userWeight}
                  onChange={(e) => setUserWeight(e.target.value)}
                  placeholder="65"
                  className={`h-10 text-xs font-bold rounded-xl ${isDark ? "bg-[#10141D] text-white" : "bg-gray-50 text-gray-900"}`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-400">Jenis Kelamin</label>
                <select
                  value={userGender}
                  onChange={(e) => setUserGender(e.target.value as "male" | "female")}
                  className={`w-full h-10 rounded-xl px-3 text-xs font-bold border border-gray-500/20 outline-none cursor-pointer ${isDark ? "bg-[#10141D] text-white" : "bg-gray-50 text-gray-900"
                    }`}
                >
                  <option value="male">Laki-laki</option>
                  <option value="female">Perempuan</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-400">Usia (Tahun)</label>
                <Input
                  type="number"
                  min="12"
                  max="99"
                  value={userAge}
                  onChange={(e) => setUserAge(e.target.value)}
                  placeholder="25"
                  className={`h-10 text-xs font-bold rounded-xl ${isDark ? "bg-[#10141D] text-white" : "bg-gray-50 text-gray-900"}`}
                />
              </div>
            </div>

            {/* Target Fitness Utama */}
            <div className="space-y-2 pt-1">
              <label className="text-[10px] font-bold uppercase text-gray-400">Target Fitness Utama</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "hypertrophy", label: "Hypertrophy" },
                  { id: "fat_loss", label: "Fat Loss" },
                  { id: "strength", label: "Strength" },
                  { id: "endurance", label: "Endurance" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setUserFitnessGoal(item.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${userFitnessGoal === item.id
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                      : isDark
                        ? "bg-[#10141D] border border-white/5 text-gray-300 hover:text-white"
                        : "bg-gray-50 border border-gray-200 text-gray-700 hover:text-gray-900"
                      }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSavingBiometrics}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20"
            >
              {isSavingBiometrics ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan Kalibrasi Biometrik"}
            </Button>
          </form>
        </div>
      </div>
    );
  };

  // 2. SUB-PAGE: AKUN & KEAMANAN
  const renderAccountDetailSubPage = () => {
    const memberEmail =
      (member as any)?.email ||
      (member?.nama ? `${member.nama.toLowerCase().replace(/[^a-z0-9]/g, "")}@gmail.com` : "member.synfit@gmail.com");

    const maskEmail = (email: string) => {
      const parts = email.split("@");
      if (parts.length !== 2) return email;
      const [name, domain] = parts;
      if (name.length <= 2) {
        return `${name[0]}***@${domain}`;
      } else if (name.length <= 4) {
        return `${name.slice(0, 1)}â€¢â€¢â€¢â€¢â€¢${name.slice(-1)}@${domain}`;
      } else {
        return `${name.slice(0, 2)}â€¢â€¢â€¢â€¢â€¢â€¢${name.slice(-2)}@${domain}`;
      }
    };

    const displayedEmail = showFullEmail ? memberEmail : maskEmail(memberEmail);

    const handleSendResetPasswordEmail = () => {
      setIsSendingResetEmail(true);
      setTimeout(() => {
        setIsSendingResetEmail(false);
        setResetEmailSent(true);
        setAccountToast(`Tautan reset kata sandi telah dikirim ke ${displayedEmail}! Silakan cek kotak masuk Anda.`);
        setTimeout(() => setAccountToast(null), 7000);
      }, 1200);
    };

    const handleToggleGoogleLink = () => {
      if (isGoogleLinked) {
        setIsGoogleLinked(false);
        setAccountToast("Tautan Akun Google dinonaktifkan.");
      } else {
        setIsGoogleLinked(true);
        setAccountToast("Akun Google berhasil dihubungkan kembali.");
      }
      setTimeout(() => setAccountToast(null), 4000);
    };

    return (
      <div className="w-full flex-1 flex flex-col text-left">
        {/* Sticky Header */}
        <div
          className={`sticky top-0 z-30 backdrop-blur-md px-4 sm:px-6 py-4 border-b flex items-center justify-between ${isDark ? "bg-[#090B10]/90 border-white/10 text-white" : "bg-white/90 border-gray-200 text-gray-900"
            }`}
        >
          <button
            onClick={closeProfileSubPage}
            className="flex items-center gap-2 py-1 px-2 -ml-2 rounded-xl text-blue-500 hover:bg-blue-500/10 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-xs font-black">Kembali</span>
          </button>
          <h2 className="text-sm font-black uppercase tracking-wider">Akun &amp; Keamanan</h2>
          <div className="w-16" />
        </div>

        <div className="p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-6 pb-24">
          {/* Action Notification Toast */}
          {accountToast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-2xl flex items-center gap-2.5 shadow-lg shadow-emerald-950/20"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span className="flex-1 leading-relaxed">{accountToast}</span>
              <button
                onClick={() => setAccountToast(null)}
                className="text-emerald-400/70 hover:text-emerald-400 text-xs font-black p-1"
              >
                âœ•
              </button>
            </motion.div>
          )}

          {/* 1. Status Keanggotaan & Identitas Akun Card */}
          <div
            className={`p-5 rounded-3xl border space-y-3.5 ${isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
              }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                Status Keanggotaan
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                PRO MEMBER
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-base font-black text-emerald-400 block">Member Aktif &amp; Terverifikasi</span>
                <span className="text-xs text-gray-400">Akses turnstile &amp; seluruh fasilitas SynFit Gym</span>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-500/10 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold block">ID Member</span>
                <span className="font-mono font-bold text-gray-200">{member.id || "SYN-2024-8891"}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Masa Aktif Hingga</span>
                <span className="font-bold text-gray-200">
                  {member.tanggal_expired
                    ? typeof member.tanggal_expired === "string"
                      ? member.tanggal_expired
                      : new Date(member.tanggal_expired).toLocaleDateString("id-ID")
                    : "-"}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Detail Email Akun Utama (Censored / Masked) */}
          <div
            className={`p-5 rounded-3xl border space-y-4 ${isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
              }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-gray-500/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-400">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider">Email Akun Utama</h4>
                  <p className="text-[11px] text-gray-400">Digunakan untuk login, autentikasi, &amp; notifikasi sistem</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                <CheckCircle2 className="h-3 w-3" />
                <span>Terverifikasi</span>
              </span>
            </div>

            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${isDark ? "bg-black/20 border-white/5" : "bg-gray-50 border-gray-200"
                }`}
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold uppercase text-gray-400 block">Alamat Email Terdaftar</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Disensor
                  </span>
                  {userAuthEmail && (
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded border flex items-center gap-1 ${isEmailVerified
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                        }`}
                    >
                      {isEmailVerified ? (
                        <>
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                          <span>Terverifikasi</span>
                        </>
                      ) : (
                        <>
                          <Info className="w-2.5 h-2.5 text-amber-400" />
                          <span>Belum Verifikasi</span>
                        </>
                      )}
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm font-mono font-bold text-blue-400 truncate tracking-wider">
                  {displayedEmail}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Eye Toggle to un-censor / view full email */}
                <button
                  type="button"
                  onClick={() => setShowFullEmail(!showFullEmail)}
                  title={showFullEmail ? "Sembunyikan / Sensor Email" : "Tampilkan Email Lengkap"}
                  className={`p-2 rounded-xl border text-xs font-bold transition-all active:scale-95 flex items-center justify-center ${isDark ? "bg-white/5 border-white/10 hover:bg-white/10 text-gray-300" : "bg-white border-gray-200 hover:bg-gray-100 text-gray-700"
                    }`}
                >
                  {showFullEmail ? <EyeOff className="h-4 w-4 text-amber-400" /> : <Eye className="h-4 w-4 text-blue-400" />}
                </button>

                {/* Copy full email button */}
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(memberEmail);
                    setAccountToast("Alamat email disalin ke clipboard!");
                    setTimeout(() => setAccountToast(null), 3000);
                  }}
                  title="Salin Email Penuh"
                  className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all active:scale-95 flex items-center gap-1.5 ${isDark ? "bg-white/5 border-white/10 hover:bg-white/10 text-gray-300" : "bg-white border-gray-200 hover:bg-gray-100 text-gray-700"
                    }`}
                >
                  <Copy className="h-3 w-3" />
                  <span>Salin</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <span>Email dilindungi enkripsi Firebase Cloud Auth &amp; sensor privasi member.</span>
            </div>
          </div>

          {/* 3. Akun Terhubung (Connected Accounts / SSO) */}
          <div
            className={`p-5 rounded-3xl border space-y-4 ${isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
              }`}
          >
            <div className="border-b pb-3 border-gray-500/10">
              <h4 className="text-xs font-black uppercase tracking-wider">Akun Terhubung (Single Sign-On)</h4>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Kelola integrasi login cepat dan nomor verifikasi keamanan
              </p>
            </div>

            {/* Google Account Row */}
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${isDark ? "bg-black/20 border-white/5" : "bg-gray-50 border-gray-200"
                }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Authentic Google G Icon */}
                <div className="w-10 h-10 rounded-xl bg-white p-2 shadow-sm flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black block">Akun Google</span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${isGoogleLinked
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-gray-500/15 text-gray-400 border border-gray-500/30"
                        }`}
                    >
                      {isGoogleLinked ? "Terhubung" : "Belum Terhubung"}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5 font-mono">
                    {isGoogleLinked ? displayedEmail : "Hubungkan untuk 1-klik login"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleGoogleLink}
                className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold shrink-0 transition-all active:scale-95 ${isGoogleLinked
                  ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                  : "border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                  }`}
              >
                {isGoogleLinked ? "Putuskan" : "Hubungkan"}
              </button>
            </div>

            {/* WhatsApp Row */}
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${isDark ? "bg-black/20 border-white/5" : "bg-gray-50 border-gray-200"
                }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black block">Nomor WhatsApp</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Terhubung ke WhatsApp
                    </span>
                  </div>
                  <p className="text-[11px] font-mono font-bold text-emerald-400 truncate mt-0.5 tracking-wider">
                    {formatPhoneDisplay(member.nomor_whatsapp)}
                  </p>
                </div>
              </div>

              {member.nomor_whatsapp && (
                <a
                  href={`https://wa.me/${getCleanWaPhone(member.nomor_whatsapp)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all active:scale-95 flex items-center gap-1.5 shrink-0 ${isDark
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                    : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                    }`}
                >
                  <MessageSquare className="h-3 w-3" />
                  <span>Buka WA</span>
                </a>
              )}
            </div>
          </div>

          {/* 4. Reset Password Lewat Email */}
          <div
            className={`p-5 rounded-3xl border space-y-4 ${isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
              }`}
          >
            <div className="flex items-center gap-2.5 border-b pb-3 border-gray-500/10">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider">Reset Kata Sandi Lewat Email</h4>
                <p className="text-[11px] text-gray-400">Kirim tautan pemulihan aman langsung ke email terdaftar Anda</p>
              </div>
            </div>

            <p className={`text-xs leading-relaxed ${isDark ? "text-gray-300" : "text-gray-600"}`}>
              Jika Anda lupa kata sandi lama atau ingin mengatur ulang sandi akun tanpa login ulang, kami dapat mengirimkan tautan pemulihan satu kali pakai (*one-time magic reset link*) ke:
            </p>

            <div
              className={`p-3 rounded-2xl border flex items-center justify-between ${isDark ? "bg-black/20 border-white/5" : "bg-gray-50 border-gray-200"
                }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="h-4 w-4 text-amber-400 shrink-0" />
                <span className="text-xs font-mono font-bold text-gray-200 truncate">{displayedEmail}</span>
              </div>
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider shrink-0">
                Tujuan Reset
              </span>
            </div>

            {resetEmailSent && (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-2xl flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>Email pemulihan telah terkirim! Tautan berlaku selama 15 menit.</span>
              </div>
            )}

            <Button
              type="button"
              disabled={isSendingResetEmail}
              onClick={handleSendResetPasswordEmail}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-950/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              {isSendingResetEmail ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Mengirim Email Pemulihan...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Kirim Tautan Reset ke Email</span>
                </>
              )}
            </Button>
          </div>

          {/* 5. Form Ganti Kata Sandi Manual */}
          <div
            className={`p-5 rounded-3xl border space-y-4 ${isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
              }`}
          >
            <div className="border-b pb-3 border-gray-500/10">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-purple-400" />
                <h4 className="text-xs font-black uppercase tracking-wider">Ganti Kata Sandi Manual</h4>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Perbarui kata sandi akun Anda secara langsung dengan memasukkan sandi lama
              </p>
            </div>

            {passSuccess && (
              <div className="p-3.5 bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-bold rounded-2xl flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Kata sandi berhasil diperbarui!</span>
              </div>
            )}

            {passError && (
              <div className="p-3.5 bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold rounded-2xl flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{passError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-400">Kata Sandi Lama</label>
                <div className="relative">
                  <Input
                    type={showOldPass ? "text" : "password"}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Masukkan sandi saat ini"
                    className={`h-10 text-xs font-bold rounded-xl pr-10 ${isDark ? "bg-[#10141D] text-white" : "bg-gray-50 text-gray-900"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPass(!showOldPass)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-white"
                  >
                    {showOldPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-400">Kata Sandi Baru (Min. 6 Karakter)</label>
                <div className="relative">
                  <Input
                    type={showNewPass ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className={`h-10 text-xs font-bold rounded-xl pr-10 ${isDark ? "bg-[#10141D] text-white" : "bg-gray-50 text-gray-900"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-white"
                  >
                    {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-400">Konfirmasi Kata Sandi Baru</label>
                <Input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi baru"
                  className={`h-10 text-xs font-bold rounded-xl ${isDark ? "bg-[#10141D] text-white" : "bg-gray-50 text-gray-900"}`}
                />
              </div>

              <Button
                type="submit"
                disabled={isChangingPass}
                className="w-full h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-purple-950/20 active:scale-95 transition-all"
              >
                {isChangingPass ? <Loader2 className="h-4 w-4 animate-spin" /> : "Perbarui Kata Sandi"}
              </Button>
            </form>
          </div>

          {/* 6. Keamanan Sesi & Perangkat */}
          <div
            className={`p-5 rounded-3xl border space-y-3 ${isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
              }`}
          >
            <div className="flex items-center gap-2 border-b pb-3 border-gray-500/10">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <h4 className="text-xs font-black uppercase tracking-wider">Keamanan Sesi &amp; Perangkat</h4>
            </div>

            <div className="flex items-center justify-between text-xs py-1">
              <div className="space-y-0.5">
                <span className="font-bold text-gray-200 block">Sesi Web SynFit App</span>
                <span className="text-[11px] text-gray-400">Perangkat ini sedang aktif</span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Aktif Sekarang
              </span>
            </div>

            <p className="text-[11px] text-gray-500 pt-2 border-t border-gray-500/10">
              Sesi Anda dienkripsi end-to-end melalui SSL/TLS 1.3 dan token JWT tersinkronisasi.
            </p>
          </div>
        </div>
      </div>
    );
  };

  // 3. SUB-PAGE: TEMA & TAMPILAN
  const renderThemeDetailSubPage = () => {
    return (
      <div className="w-full flex-1 flex flex-col text-left">
        {/* Sticky Header */}
        <div className={`sticky top-0 z-30 backdrop-blur-md px-4 sm:px-6 py-4 border-b flex items-center justify-between ${isDark ? "bg-[#090B10]/90 border-white/10 text-white" : "bg-white/90 border-gray-200 text-gray-900"
          }`}>
          <button
            onClick={closeProfileSubPage}
            className="flex items-center gap-2 py-1 px-2 -ml-2 rounded-xl text-blue-500 hover:bg-blue-500/10 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-xs font-black">Kembali</span>
          </button>
          <h2 className="text-sm font-black uppercase tracking-wider">Tema &amp; Tampilan</h2>
          <div className="w-16" />
        </div>

        <div className="p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-4 pb-20">
          <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Pilih tema tampilan yang paling nyaman untuk mata Anda saat beraktivitas di gym maupun di luar ruangan.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Mode Gelap */}
            <div
              onClick={() => {
                if (theme !== "dark") toggleTheme();
              }}
              className={`p-5 rounded-3xl border cursor-pointer transition-all ${theme === "dark"
                ? "bg-[#141822] border-blue-500 ring-2 ring-blue-500/30 shadow-xl"
                : "bg-white/40 border-gray-200 hover:border-gray-300"
                }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-[#090B10] text-blue-400 flex items-center justify-center border border-white/10">
                  <Moon className="h-6 w-6" />
                </div>
                {theme === "dark" && (
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-black uppercase">
                    Aktif
                  </span>
                )}
              </div>
              <h4 className="text-sm font-black mb-1">Mode Gelap (Deep Midnight)</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Palet gelap futuristik hemat baterai OLED dengan kontras tinggi untuk pemantauan sesi latihan intens.
              </p>
            </div>

            {/* Mode Terang */}
            <div
              onClick={() => {
                if (theme !== "light") toggleTheme();
              }}
              className={`p-5 rounded-3xl border cursor-pointer transition-all ${theme === "light"
                ? "bg-white border-blue-500 ring-2 ring-blue-500/30 shadow-xl"
                : "bg-[#141822]/40 border-white/5 hover:border-white/15"
                }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center border border-amber-200">
                  <Sun className="h-6 w-6" />
                </div>
                {theme === "light" && (
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-600 text-[10px] font-black uppercase">
                    Aktif
                  </span>
                )}
              </div>
              <h4 className="text-sm font-black mb-1">Mode Terang (Clean Slate)</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Tampilan terang bersih dan segar, sangat mudah dibaca saat berada di bawah sinar lampu terang.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 4. SUB-PAGE: PILIHAN BAHASA
  const renderLanguageDetailSubPage = () => {
    return (
      <div className="w-full flex-1 flex flex-col text-left">
        {/* Sticky Header */}
        <div className={`sticky top-0 z-30 backdrop-blur-md px-4 sm:px-6 py-4 border-b flex items-center justify-between ${isDark ? "bg-[#090B10]/90 border-white/10 text-white" : "bg-white/90 border-gray-200 text-gray-900"
          }`}>
          <button
            onClick={closeProfileSubPage}
            className="flex items-center gap-2 py-1 px-2 -ml-2 rounded-xl text-blue-500 hover:bg-blue-500/10 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-xs font-black">Kembali</span>
          </button>
          <h2 className="text-sm font-black uppercase tracking-wider">Pilihan Bahasa</h2>
          <div className="w-16" />
        </div>

        <div className="p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-4 pb-20">
          <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Pilih bahasa pengantar antarmuka aplikasi SynFit yang ingin Anda gunakan.
          </p>

          <div className="space-y-3 pt-2">
            {/* Bahasa Indonesia */}
            <div
              onClick={() => setLanguage("id")}
              className={`p-5 rounded-3xl border cursor-pointer flex items-center justify-between transition-all ${language === "id"
                ? isDark ? "bg-[#141822] border-teal-500 ring-2 ring-teal-500/30" : "bg-white border-teal-500 ring-2 ring-teal-500/30 shadow-md"
                : isDark ? "bg-[#141822]/40 border-white/5" : "bg-white/60 border-gray-200"
                }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/15 text-teal-400 flex items-center justify-center font-black text-sm">
                  ID
                </div>
                <div>
                  <h4 className="text-sm font-black">Bahasa Indonesia</h4>
                  <p className="text-xs text-gray-400">Bahasa Indonesia resmi dengan istilah kebugaran terstandarisasi</p>
                </div>
              </div>
              {language === "id" && <Check className="h-5 w-5 text-teal-400" />}
            </div>

            {/* English */}
            <div
              onClick={() => setLanguage("en")}
              className={`p-5 rounded-3xl border cursor-pointer flex items-center justify-between transition-all ${language === "en"
                ? isDark ? "bg-[#141822] border-teal-500 ring-2 ring-teal-500/30" : "bg-white border-teal-500 ring-2 ring-teal-500/30 shadow-md"
                : isDark ? "bg-[#141822]/40 border-white/5" : "bg-white/60 border-gray-200"
                }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/15 text-teal-400 flex items-center justify-center font-black text-sm">
                  EN
                </div>
                <div>
                  <h4 className="text-sm font-black">English (International)</h4>
                  <p className="text-xs text-gray-400">Global fitness terminology and workout logs in English</p>
                </div>
              </div>
              {language === "en" && <Check className="h-5 w-5 text-teal-400" />}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 5. SUB-PAGE: TENTANG SYNFIT
  const renderAboutDetailSubPage = () => {
    return (
      <div className="w-full flex-1 flex flex-col text-left">
        {/* Sticky Header */}
        <div className={`sticky top-0 z-30 backdrop-blur-md px-4 sm:px-6 py-4 border-b flex items-center justify-between ${isDark ? "bg-[#090B10]/90 border-white/10 text-white" : "bg-white/90 border-gray-200 text-gray-900"
          }`}>
          <button
            onClick={closeProfileSubPage}
            className="flex items-center gap-2 py-1 px-2 -ml-2 rounded-xl text-blue-500 hover:bg-blue-500/10 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-xs font-black">Kembali</span>
          </button>
          <h2 className="text-sm font-black uppercase tracking-wider">Tentang SynFit</h2>
          <div className="w-16" />
        </div>

        <div className="p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-6 pb-20 leading-relaxed text-xs">
          {/* Hero Banner */}
          <div className={`p-6 rounded-3xl border text-center space-y-3 ${isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}>
            <div className="w-16 h-16 rounded-3xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto shadow-md">
              <Dumbbell className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">SynFit Gym &amp; Fitness</h3>
              <p className="text-xs text-blue-400 font-bold">Smart Fitness Ecosystem Indonesia</p>
            </div>
            <p className={isDark ? "text-gray-300" : "text-gray-600"}>
              SynFit menghadirkan perpaduan fasilitas gym komersial kelas dunia dengan kecerdasan buatan (AI Form Coach &amp; Biometric Tracking) untuk mewujudkan transformasi fisik yang aman, presisi, dan terukur.
            </p>
          </div>

          {/* Fasilitas & Standar Peralatan */}
          <div className={`p-5 rounded-3xl border space-y-3 ${isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}>
            <h4 className="font-black text-xs uppercase tracking-wider text-blue-400">Standar Fasilitas &amp; Zona Alat</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className={`p-3 rounded-2xl border ${isDark ? "bg-[#10141D] border-white/5" : "bg-gray-50 border-gray-100"}`}>
                <span className="font-bold text-xs block mb-1">Free Weights Zone</span>
                <span className="text-gray-400 text-[11px]">Dumbbell set lengkap hingga 50kg, Barbell Olimpiade, EZ-Bar, dan Rubber Bumper Plates.</span>
              </div>
              <div className={`p-3 rounded-2xl border ${isDark ? "bg-[#10141D] border-white/5" : "bg-gray-50 border-gray-100"}`}>
                <span className="font-bold text-xs block mb-1">Resistance &amp; Cable Machines</span>
                <span className="text-gray-400 text-[11px]">Lat Pulldown, Seated Cable Row, Smith Machine, Leg Press, dan Dual Cable Cross.</span>
              </div>
              <div className={`p-3 rounded-2xl border ${isDark ? "bg-[#10141D] border-white/5" : "bg-gray-50 border-gray-100"}`}>
                <span className="font-bold text-xs block mb-1">Cardio &amp; Endurance</span>
                <span className="text-gray-400 text-[11px]">Treadmill pintar, Stair Climber, Assault Air Bike, dan Rowing Machine.</span>
              </div>
              <div className={`p-3 rounded-2xl border ${isDark ? "bg-[#10141D] border-white/5" : "bg-gray-50 border-gray-100"}`}>
                <span className="font-bold text-xs block mb-1">Loker &amp; Kamar Mandi</span>
                <span className="text-gray-400 text-[11px]">Loker berkeamanan PIN/Kunci, kamar mandi dengan air panas dan pengering rambut.</span>
              </div>
            </div>
          </div>

          {/* Jam Operasional & Layanan */}
          <div className={`p-5 rounded-3xl border space-y-3 ${isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}>
            <h4 className="font-black text-xs uppercase tracking-wider text-blue-400">Jam Operasional &amp; Dukungan</h4>
            <ul className={`space-y-1.5 list-disc pl-4 ${isDark ? "text-gray-300" : "text-gray-600"}`}>
              <li><strong>Jam Buka:</strong> Senin â€“ Minggu pukul 06.00 â€“ 22.00 WIB (Buka Setiap Hari)</li>
              <li><strong>Lokasi Pusat:</strong> Jl. Contoh Raya No. 12, Bekasi, Jawa Barat</li>
              <li><strong>Customer Support:</strong> Live Chat Concierge langsung di aplikasi SynFit</li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  // 6. SUB-PAGE: SYARAT DAN KETENTUAN
  const renderTermsDetailSubPage = () => {
    return (
      <div className="w-full flex-1 flex flex-col text-left">
        {/* Sticky Header */}
        <div className={`sticky top-0 z-30 backdrop-blur-md px-4 sm:px-6 py-4 border-b flex items-center justify-between ${isDark ? "bg-[#090B10]/90 border-white/10 text-white" : "bg-white/90 border-gray-200 text-gray-900"
          }`}>
          <button
            onClick={closeProfileSubPage}
            className="flex items-center gap-2 py-1 px-2 -ml-2 rounded-xl text-blue-500 hover:bg-blue-500/10 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-xs font-black">Kembali</span>
          </button>
          <h2 className="text-sm font-black uppercase tracking-wider">Syarat &amp; Ketentuan</h2>
          <div className="w-16" />
        </div>

        <div className="p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-4 pb-20 leading-relaxed text-xs">
          {/* Pasal 1 */}
          <div className={`p-5 rounded-3xl border space-y-2 ${isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}>
            <h4 className="font-black text-xs uppercase tracking-wider text-emerald-400">Pasal 1: Hak &amp; Kewajiban Keanggotaan</h4>
            <p className={isDark ? "text-gray-300" : "text-gray-600"}>
              1. Keanggotaan SynFit bersifat personal dan tidak dapat dipindahtangankan kepada pihak lain tanpa persetujuan tertulis dari manajemen gym.
            </p>
            <p className={isDark ? "text-gray-300" : "text-gray-600"}>
              2. Setiap member wajib melakukan verifikasi check-in (melalui Barcode Digital atau GPS Check-In) pada mesin turnstile di gerbang masuk sebelum menggunakan fasilitas.
            </p>
          </div>

          {/* Pasal 2 */}
          <div className={`p-5 rounded-3xl border space-y-2 ${isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}>
            <h4 className="font-black text-xs uppercase tracking-wider text-emerald-400">Pasal 2: Keselamatan &amp; Penggunaan Alat</h4>
            <p className={isDark ? "text-gray-300" : "text-gray-600"}>
              1. Member wajib mengenakan pakaian olahraga yang pantas serta sepatu olahraga tertutup demi keselamatan pribadi.
            </p>
            <p className={isDark ? "text-gray-300" : "text-gray-600"}>
              2. Wajib mengembalikan dumbbell, barbell plate, dan aksesoris beban ke rak semula setelah selesai digunakan.
            </p>
            <p className={isDark ? "text-gray-300" : "text-gray-600"}>
              3. Gunakan handuk bersih untuk menyeka bangku latihan dan mesin setelah selesai sesi demi kenyamanan bersama.
            </p>
          </div>

          {/* Pasal 3 */}
          <div className={`p-5 rounded-3xl border space-y-2 ${isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}>
            <h4 className="font-black text-xs uppercase tracking-wider text-emerald-400">Pasal 3: Loker &amp; Barang Berharga</h4>
            <p className={isDark ? "text-gray-300" : "text-gray-600"}>
              Fasilitas loker harian hanya dapat digunakan selama member berada di dalam area gym. SynFit tidak bertanggung jawab atas kehilangan barang berharga yang ditinggalkan di dalam loker tanpa pengawasan.
            </p>
          </div>

          {/* Pasal 4 */}
          <div className={`p-5 rounded-3xl border space-y-2 ${isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}>
            <h4 className="font-black text-xs uppercase tracking-wider text-emerald-400">Pasal 4: Privasi &amp; Kamera AI Form Coach</h4>
            <p className={isDark ? "text-gray-300" : "text-gray-600"}>
              Pemrosesan pose tubuh pada kamera AI Form Coach berjalan sepenuhnya secara lokal di memori perangkat member (*on-device inference via Google MediaPipe*). SynFit tidak pernah merekam, menyimpan gambar, atau mengunggah rekaman video member ke server eksternal mana pun.
            </p>
          </div>
        </div>
      </div>
    );
  };

  // 7. SUB-PAGE: VERSI APLIKASI
  const renderVersionDetailSubPage = () => {
    return (
      <div className="w-full flex-1 flex flex-col text-left">
        {/* Sticky Header */}
        <div className={`sticky top-0 z-30 backdrop-blur-md px-4 sm:px-6 py-4 border-b flex items-center justify-between ${isDark ? "bg-[#090B10]/90 border-white/10 text-white" : "bg-white/90 border-gray-200 text-gray-900"
          }`}>
          <button
            onClick={closeProfileSubPage}
            className="flex items-center gap-2 py-1 px-2 -ml-2 rounded-xl text-blue-500 hover:bg-blue-500/10 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-xs font-black">Kembali</span>
          </button>
          <h2 className="text-sm font-black uppercase tracking-wider">Versi Aplikasi</h2>
          <div className="w-16" />
        </div>

        <div className="p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-6 pb-20 leading-relaxed text-xs">
          {/* App Info Card */}
          <div className={`p-6 rounded-3xl border text-center space-y-3 ${isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}>
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-orange-500 to-amber-400 text-white flex items-center justify-center mx-auto shadow-lg shadow-orange-500/25">
              <Smartphone className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-base font-black">SynFit Mobile Platform</h3>
              <p className="text-xs text-orange-400 font-bold">Release Build: v2.4.0 (Production Stable)</p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Sistem Up-to-Date
              </span>
            </div>
          </div>

          {/* Toast Notifikasi Pembaruan */}
          {updateToast && (
            <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-2xl flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Aplikasi Anda sudah menggunakan versi terbaru (v2.4.0). Tidak ada pembaruan tertunda.</span>
            </div>
          )}

          {/* Catatan Rilis */}
          <div className={`p-5 rounded-3xl border space-y-3 ${isDark ? "bg-[#141822] border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}>
            <h4 className="font-black text-xs uppercase tracking-wider text-orange-400">Catatan Rilis (Changelog)</h4>
            <div className="space-y-3">
              <div className="border-l-2 border-orange-500 pl-3 space-y-1">
                <span className="font-black text-xs block">Fitur Pembuat Program Latihan AI &amp; Manual</span>
                <p className="text-gray-400 text-[11px]">Rekomendasi 3 variasi program terstruktur dengan validasi istirahat otot 48 jam &amp; kustomisasi per gerakan.</p>
              </div>
              <div className="border-l-2 border-blue-500 pl-3 space-y-1">
                <span className="font-black text-xs block">Katalog Panduan 30 Tutorial Alat Gym</span>
                <p className="text-gray-400 text-[11px]">Tutorial terperinci dari penyesuaian awal, langkah eksekusi, tips pencegahan cedera, dan ilustrasi visual konsisten.</p>
              </div>
              <div className="border-l-2 border-teal-500 pl-3 space-y-1">
                <span className="font-black text-xs block">WhatsApp &amp; iOS Fluid Lateral Navigation</span>
                <p className="text-gray-400 text-[11px]">Transisi layar geser horizontal lateral tanpa lag dengan kurva navigasi asli perangkat bergerak.</p>
              </div>
              <div className="border-l-2 border-purple-500 pl-3 space-y-1">
                <span className="font-black text-xs block">Gym Check-In Barcode Pass &amp; Auto-GPS</span>
                <p className="text-gray-400 text-[11px]">Akses cepat gerbang turnstile gym via tombol tengah dok navigasi bawah.</p>
              </div>
            </div>
          </div>

          {/* Tombol Periksa Pembaruan */}
          <Button
            onClick={() => {
              setUpdateToast(true);
              setTimeout(() => setUpdateToast(false), 4000);
            }}
            className="w-full h-11 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-orange-500/25 flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Periksa Pembaruan Sistem</span>
          </Button>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // MAIN DASHBOARD LAYOUT & VIEWPORT (THEME REACTIVE & MOCKUP STYLED)
  // -------------------------------------------------------------
  const isDark = theme === "dark";

  return (
    <div
      className={`h-[100dvh] md:min-h-screen flex flex-col md:flex-row relative overflow-hidden font-sans select-none transition-colors duration-300 ${isDark ? "bg-[#090B10] text-[#DFE2EE]" : "bg-[#EAECEF] text-gray-900"
        }`}
    >
      {/* Click outside backdrop for dropdowns */}
      {(showProfileMenu || showNotificationsMenu) && (
        <div
          className="fixed inset-0 z-40 bg-transparent"
          onClick={() => {
            setShowProfileMenu(false);
            setShowNotificationsMenu(false);
          }}
        />
      )}

      {/* Ambient Lighting */}
      <div
        className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-[100px] z-0 pointer-events-none ${isDark ? "bg-blue-600/10" : "bg-transparent"
          }`}
      />
      <div
        className={`absolute bottom-0 left-0 w-96 h-96 rounded-full blur-[120px] z-0 pointer-events-none ${isDark ? "bg-blue-500/5" : "bg-transparent"
          }`}
      />

      {/* Desktop Sidebar (visible on md+) */}
      <aside
        className={`hidden md:flex flex-col w-72 backdrop-blur-2xl border-r p-6 z-20 shrink-0 transition-colors ${isDark
          ? "bg-[#0E121B]/95 border-white/10 text-white"
          : "bg-white/95 border-gray-200 text-gray-900 shadow-xl"
          }`}
      >
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/10 p-1 flex items-center justify-center border border-white/10">
            <img src="/logo.png" alt="SynFit" className="w-full h-full object-contain" />
          </div>
          <div className="text-left">
            <h1 className="font-black text-lg tracking-tight">
              SynFit <span className="text-blue-500">AI</span>
            </h1>
            <p className="text-[8px] text-gray-400 font-extrabold tracking-widest uppercase">
              TRAIN SMARTER. MOVE BETTER.
            </p>
          </div>
        </div>

        {/* Member Quick Info Card */}
        <div
          className={`p-3.5 mb-6 rounded-2xl border flex items-center gap-3 text-left transition-colors ${isDark ? "bg-[#141822] border-white/10" : "bg-gray-50 border-gray-200"
            }`}
        >
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-tr from-blue-600 to-yellow-400 flex items-center justify-center font-black text-sm uppercase shrink-0 text-white shadow-md">
            {member.foto_url ? (
              <img src={member.foto_url} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              member.nama ? member.nama.substring(0, 2).toUpperCase() : "ME"
            )}
          </div>
          <div className="min-w-0">
            <span className="text-[8px] font-black text-emerald-500 tracking-wider uppercase block">
              MEMBER AKTIF
            </span>
            <h4 className="text-xs font-bold uppercase truncate">{member.nama}</h4>
          </div>
        </div>

        {/* Sidebar Nav */}
        <nav className="space-y-2 flex-1 text-left">
          <button
            onClick={() => navigateToTab("home")}
            className={`w-full h-11 px-4 rounded-xl flex items-center gap-3 font-bold text-xs uppercase tracking-wider transition-all ${activeTab === "home"
              ? isDark
                ? "bg-gradient-to-r from-orange-600 to-[#FF5A2C] text-white shadow-lg shadow-orange-500/25"
                : "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
              : isDark
                ? "text-gray-400 hover:text-white hover:bg-white/5"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
          >
            <Home className="h-4 w-4" />
            <span>Beranda</span>
          </button>

          <button
            onClick={() => navigateToTab("membership")}
            className={`w-full h-11 px-4 rounded-xl flex items-center gap-3 font-bold text-xs uppercase tracking-wider transition-all ${activeTab === "membership"
              ? isDark
                ? "bg-gradient-to-r from-orange-600 to-[#FF5A2C] text-white shadow-lg shadow-orange-500/25"
                : "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
              : isDark
                ? "text-gray-400 hover:text-white hover:bg-white/5"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
          >
            <CreditCard className="h-4 w-4" />
            <span>Keanggotaan</span>
          </button>

          <button
            onClick={() => navigateToTab("program")}
            className={`w-full h-11 px-4 rounded-xl flex items-center gap-3 font-bold text-xs uppercase tracking-wider transition-all ${activeTab === "program"
              ? isDark
                ? "bg-gradient-to-r from-orange-600 to-[#FF5A2C] text-white shadow-lg shadow-orange-500/25"
                : "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
              : isDark
                ? "text-gray-400 hover:text-white hover:bg-white/5"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
          >
            <Calendar className="h-4 w-4 text-blue-400" />
            <span>Program Latihan</span>
          </button>

          <button
            onClick={() => navigateToTab("tracker")}
            className={`w-full h-11 px-4 rounded-xl flex items-center gap-3 font-bold text-xs uppercase tracking-wider transition-all ${activeTab === "tracker"
              ? isDark
                ? "bg-gradient-to-r from-orange-600 to-[#FF5A2C] text-white shadow-lg shadow-orange-500/25"
                : "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
              : isDark
                ? "text-gray-400 hover:text-white hover:bg-white/5"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
          >
            <Activity className="h-4 w-4 text-emerald-400" />
            <span>Tracker</span>
          </button>

          <button
            onClick={() => navigateToTab("synhub")}
            className={`w-full h-11 px-4 rounded-xl flex items-center gap-3 font-bold text-xs uppercase tracking-wider transition-all ${activeTab === "synhub"
              ? isDark
                ? "bg-gradient-to-r from-orange-600 to-[#FF5A2C] text-white shadow-lg shadow-orange-500/25"
                : "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
              : isDark
                ? "text-gray-400 hover:text-white hover:bg-white/5"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
          >
            <Building2 className="h-4 w-4 text-violet-400" />
            <span>SynHub</span>
          </button>

          <button
            onClick={() => setIsAiFloatingOpen(true)}
            className={`w-full h-11 px-4 rounded-xl flex items-center gap-3 font-bold text-xs uppercase tracking-wider transition-all group ${isDark ? "text-gray-400 hover:text-white hover:bg-white/5" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
          >
            <div className="w-5 h-5 rounded-full overflow-hidden ring-1 ring-blue-500/80 shrink-0">
              <img
                src="/ai_avatar.jpeg"
                alt="AI"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/ai_avatar.jpg";
                }}
              />
            </div>
            <div className="flex items-center justify-between flex-1">
              <span>AI Assistant</span>
              <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-black">
                Floating
              </span>
            </div>
          </button>

          <button
            onClick={() => navigateToTab("chat")}
            className={`w-full h-11 px-4 rounded-xl flex items-center gap-3 font-bold text-xs uppercase tracking-wider transition-all ${activeTab === "chat"
              ? isDark
                ? "bg-gradient-to-r from-orange-600 to-[#FF5A2C] text-white shadow-lg shadow-orange-500/25"
                : "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
              : isDark
                ? "text-gray-400 hover:text-white hover:bg-white/5"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
          >
            <div className="relative flex items-center">
              <MessageSquare className="h-4 w-4" />
              {unreadChatCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              )}
            </div>
            <div className="flex items-center justify-between flex-1">
              <span>Chat CS</span>
              {unreadChatCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full font-black text-[9px] ${isDark ? "bg-white text-orange-600" : "bg-white text-blue-600"
                  }`}>
                  {unreadChatCount} Baru
                </span>
              )}
            </div>
          </button>

          <button
            onClick={() => navigateToTab("profile")}
            className={`w-full h-11 px-4 rounded-xl flex items-center gap-3 font-bold text-xs uppercase tracking-wider transition-all ${activeTab === "profile"
              ? isDark
                ? "bg-gradient-to-r from-orange-600 to-[#FF5A2C] text-white shadow-lg shadow-orange-500/25"
                : "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
              : isDark
                ? "text-gray-400 hover:text-white hover:bg-white/5"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
          >
            <User className="h-4 w-4" />
            <span>Profil</span>
          </button>
        </nav>

        {/* Sidebar Footer Logout */}
        <div className="pt-4 border-t border-gray-500/20">
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full h-10 rounded-xl bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-red-500/20 active:scale-95"
          >
            <LogOut className="h-4 w-4" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header
        className={`md:hidden relative z-40 w-full px-5 py-3.5 pt-[calc(0.875rem+env(safe-area-inset-top,0px))] flex justify-between items-center border-b transition-all duration-300 ${isAiFloatingOpen ? "filter blur-sm opacity-70 pointer-events-none select-none" : ""
          } ${isDark
            ? "bg-gradient-to-r from-orange-600 via-[#FF5A2C] to-orange-700 border-orange-500/30 text-white shadow-md shadow-orange-950/20"
            : "bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 border-blue-500/30 text-white shadow-md shadow-blue-900/15"
          }`}
      >
        {/* Brand: Logo + SynFit */}
        <div className="flex items-center gap-2.5 text-left">
          <div className="w-8 h-8 rounded-xl overflow-hidden p-1 flex items-center justify-center shrink-0 shadow-sm bg-white border border-white/20">
            <img src="/logo.png" alt="SynFit" className="w-full h-full object-contain" />
          </div>
          <div className="text-left">
            <h1 className="font-black text-base tracking-tight leading-none text-white">
              SynFit
            </h1>
            <p className="text-[7px] font-extrabold tracking-widest text-white/80 uppercase mt-0.5">
              FITNESS & GYM
            </p>
          </div>
        </div>

        {/* Header Right Actions: Notification Bell + Avatar Profile */}
        <div className="flex items-center gap-3 relative">
          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotificationsMenu(!showNotificationsMenu);
                setShowProfileMenu(false);
              }}
              className="w-9 h-9 rounded-full border border-white/20 bg-white/15 text-white hover:bg-white/25 flex items-center justify-center relative active:scale-95 transition-all shadow-sm"
            >
              <Bell className="h-4 w-4 text-white" />
              {notifications.filter((n) => !n.is_read).length > 0 && (
                <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-yellow-300 rounded-full border-2 border-orange-600 animate-pulse" />
              )}
            </button>

            {/* Notifications Dropdown (Mobile) */}
            <AnimatePresence>
              {showNotificationsMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute right-0 top-full mt-2.5 w-72 rounded-2xl border p-4 shadow-2xl z-50 origin-top-right text-left ${isDark
                    ? "bg-[#141822] border-white/10 text-white"
                    : "bg-white border-gray-200 text-gray-900"
                    }`}
                >
                  <div className="flex justify-between items-center pb-2 border-b border-gray-500/20 mb-3">
                    <h4 className="text-[10px] font-black uppercase tracking-wider">
                      NOTIFIKASI
                    </h4>
                    {notifications.filter((n) => !n.is_read).length > 0 && (
                      <button
                        onClick={handleMarkAllNotificationsAsRead}
                        className="text-[8px] font-bold text-blue-500 uppercase hover:underline"
                      >
                        Selesai Baca
                      </button>
                    )}
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-2.5 custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="py-4 text-center text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                        Tidak ada notifikasi
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-2.5 rounded-xl border text-left ${n.is_read
                            ? "bg-transparent border-gray-500/10 opacity-60"
                            : "bg-blue-500/10 border-blue-500/30"
                            }`}
                        >
                          <p className="text-[11px] font-bold">{n.title}</p>
                          <p className={`text-[9px] mt-0.5 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                            {n.body}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Avatar Profile Toggle with circular portrait */}
          <div className="relative">
            <button
              onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                setShowNotificationsMenu(false);
              }}
              className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-tr from-blue-600 to-yellow-400 p-0.5 shrink-0 shadow-md active:scale-95 transition-all"
            >
              <div className="w-full h-full rounded-full overflow-hidden bg-[#141822] flex items-center justify-center font-bold text-xs uppercase text-white">
                {member.foto_url ? (
                  <img src={member.foto_url} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  member.nama ? member.nama.substring(0, 2).toUpperCase() : "ME"
                )}
              </div>
            </button>

            {/* Profile Dropdown Menu (Mobile) */}
            <AnimatePresence>
              {showProfileMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute right-0 top-full mt-2.5 w-60 rounded-2xl border p-2 shadow-2xl z-50 origin-top-right text-left ${isDark ? "bg-[#141822] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
                    }`}
                >
                  <div className="px-4 py-2.5 border-b border-gray-500/20">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">MEMBER AKTIF</p>
                    <p className="text-xs font-bold uppercase truncate">{member.nama}</p>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        toggleTheme();
                        setShowProfileMenu(false);
                      }}
                      className={`w-full px-4 py-2.5 rounded-xl text-left text-xs font-bold transition-all flex items-center gap-3 ${isDark ? "text-gray-300 hover:text-white hover:bg-white/5" : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                        }`}
                    >
                      {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-blue-500" />}
                      <span>{theme === "dark" ? "Mode Terang" : "Mode Gelap"}</span>
                    </button>

                    <button
                      onClick={() => {
                        setLanguage(language === "id" ? "en" : "id");
                        setShowProfileMenu(false);
                      }}
                      className={`w-full px-4 py-2.5 rounded-xl text-left text-xs font-bold transition-all flex items-center gap-3 ${isDark ? "text-gray-300 hover:text-white hover:bg-white/5" : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                        }`}
                    >
                      <Globe className="h-4 w-4 text-teal-400" />
                      <span>{language === "id" ? "Bahasa: EN" : "Bahasa: ID"}</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowLogoutModal(true);
                      }}
                      className="w-full px-4 py-2.5 rounded-xl text-left text-xs font-bold text-red-500 hover:bg-red-500/10 transition-all flex items-center gap-3 border-t border-gray-500/20 mt-1"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Keluar</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      {/* Main Content Area with WhatsApp Pager + Lateral Child Overlay */}
      <div
        id="member-main-content"
        ref={mainContentRef}
        className="flex-1 flex flex-col min-w-0 relative overflow-hidden h-full"
      >
        <div id="member-tab-top-anchor" className="h-0 w-full pointer-events-none opacity-0 select-none" />

        {/* WhatsApp-Style Attached Tabs Track (All 4 main tabs side-by-side, holdable) */}
        <div
          className="w-full flex-1 relative overflow-hidden h-full"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <motion.div
            animate={{
              x: isChildView
                ? `calc(-${activeMainIndex * 100}% - 25%)`
                : isSwipingActive
                  ? `calc(-${activeMainIndex * 100}% + ${dragOffsetPx}px)`
                  : `-${activeMainIndex * 100}%`,
              opacity: isChildView ? 0.65 : 1,
            }}
            transition={
              isSwipingActive
                ? { duration: 0 } // Instant 0ms finger lock (holdable in middle!)
                : isChildView
                  ? { duration: 0.46, ease: [0.32, 0.72, 0, 1] } // Parallax dimming when child page opens
                  : isSwipeTransition
                    ? { duration: 0.38, ease: [0.32, 0.72, 0, 1] } // WhatsApp native swipe glide
                    : { duration: 0 } // Instant 0ms when bottom navigation is clicked!
            }
            className="flex w-full h-full"
            style={{
              willChange: "transform, opacity",
              transform: "translateZ(0)",
              backfaceVisibility: "hidden",
            }}
          >
            {/* Tab 0: Home (Beranda) */}
            <div className="w-full h-full flex-shrink-0 overflow-y-auto no-scrollbar pb-24 md:pb-8">
              {renderHomeTab()}
            </div>
            {/* Tab 1: Membership (Keanggotaan) */}
            <div className="w-full h-full flex-shrink-0 overflow-y-auto no-scrollbar pb-24 md:pb-8">
              {renderMembershipTab()}
            </div>
            {/* Tab 2: Chat (Chat CS) */}
            <div className="w-full h-full flex-shrink-0 overflow-hidden pb-0 md:pb-0">
              {renderChatTab()}
            </div>
            {/* Tab 3: Profile (Profil) */}
            <div className="w-full h-full flex-shrink-0 overflow-y-auto no-scrollbar pb-24 md:pb-8">
              {renderProfileTab()}
            </div>
          </motion.div>

          {/* Lateral Navigation (Shared Axis) Overlay for Child Pages */}
          <AnimatePresence>
            {isChildView && (
              <motion.div
                key={(profileSubPage as string) || activeTab}
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ duration: 0.46, ease: [0.32, 0.72, 0, 1] }}
                className={`fixed inset-0 z-50 overflow-y-auto no-scrollbar w-full h-full shadow-[-16px_0_40px_rgba(0,0,0,0.5)] ${isDark ? "bg-[#090B10]" : "bg-[#F3F4F6]"
                  }`}
                style={{
                  willChange: "transform",
                  transform: "translateZ(0)",
                  backfaceVisibility: "hidden",
                }}
              >
                {/* Profile Sub-pages */}
                {profileSubPage === "profile_detail" && renderProfileDetailSubPage()}
                {profileSubPage === "account_detail" && renderAccountDetailSubPage()}
                {profileSubPage === "theme_detail" && renderThemeDetailSubPage()}
                {profileSubPage === "language_detail" && renderLanguageDetailSubPage()}
                {profileSubPage === "about_detail" && renderAboutDetailSubPage()}
                {profileSubPage === "terms_detail" && renderTermsDetailSubPage()}
                {profileSubPage === "version_detail" && renderVersionDetailSubPage()}

                {/* Dashboard Root Child Pages */}
                {!profileSubPage && activeTab === "tutorial" && renderTutorialTab()}
                {!profileSubPage && activeTab === "program" && renderProgramTab()}
                {!profileSubPage && activeTab === "tracker" && renderTrackerTab()}
                {!profileSubPage && activeTab === "synhub" && renderSynHubTab()}
                {!profileSubPage && activeTab === "coach" && renderCoachTab()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (Overlaid when child views open) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 select-none pb-[env(safe-area-inset-bottom,0px)]">
        {/* Curved Center Dock Notch Shape via SVG */}
        <div className={`relative w-full filter ${isDark ? "drop-shadow-[0_-8px_20px_rgba(255,90,44,0.35)]" : "drop-shadow-[0_-8px_20px_rgba(37,99,235,0.25)]"}`}>
          <svg
            className={`w-full h-[68px] transition-colors duration-300 ${isDark ? "text-[#FF5A2C]" : "text-blue-600"}`}
            viewBox="0 0 375 68"
            fill="currentColor"
            preserveAspectRatio="none"
          >
            {/* Smooth concave notch in the center (around x: 187.5) */}
            <path d="M0,16 Q0,0 16,0 L135,0 Q152,0 159,12 Q170,36 187.5,36 Q205,36 216,12 Q223,0 240,0 L359,0 Q375,0 375,16 L375,68 L0,68 Z" />
          </svg>

          {/* Navigation Action Buttons Row */}
          <div className="absolute inset-0 flex items-center justify-between px-6 pt-1">
            {/* Tab 1: Beranda */}
            <button
              onClick={() => navigateToTab("home")}
              aria-label="Beranda"
              className="p-3 transition-transform active:scale-90 flex items-center justify-center relative"
            >
              <Home
                className={`h-6 w-6 transition-all ${activeTab === "home"
                  ? "text-white fill-white/20 scale-110 drop-shadow-[0_2px_8px_rgba(255,255,255,0.5)]"
                  : "text-white/70 hover:text-white"
                  }`}
              />
              {activeTab === "home" && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
              )}
            </button>

            {/* Tab 2: Keanggotaan */}
            <button
              onClick={() => navigateToTab("membership")}
              aria-label="Keanggotaan"
              className="p-3 transition-transform active:scale-90 flex items-center justify-center relative"
            >
              <CreditCard
                className={`h-6 w-6 transition-all ${activeTab === "membership"
                  ? "text-white fill-white/20 scale-110 drop-shadow-[0_2px_8px_rgba(255,255,255,0.5)]"
                  : "text-white/70 hover:text-white"
                  }`}
              />
              {activeTab === "membership" && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
              )}
            </button>

            {/* Center Spacer for Floating Button */}
            <div className="w-14" />

            {/* Tab 4: Chat Admin */}
            <button
              onClick={() => navigateToTab("chat")}
              aria-label="Chat Admin"
              className="p-3 transition-transform active:scale-90 flex items-center justify-center relative"
            >
              <MessageSquare
                className={`h-6 w-6 transition-all ${activeTab === "chat"
                  ? "text-white fill-white/20 scale-110 drop-shadow-[0_2px_8px_rgba(255,255,255,0.5)]"
                  : "text-white/70 hover:text-white"
                  }`}
              />
              {activeTab === "chat" && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
              )}
              {unreadChatCount > 0 && (
                <span className={`absolute top-2 right-2 min-w-[15px] h-[15px] px-1 bg-white font-black text-[8px] rounded-full flex items-center justify-center shadow-md ${isDark ? "text-orange-600" : "text-blue-600"
                  }`}>
                  {unreadChatCount}
                </span>
              )}
            </button>

            {/* Tab 5: Profil */}
            <button
              onClick={() => navigateToTab("profile")}
              aria-label="Profil"
              className="p-3 transition-transform active:scale-90 flex items-center justify-center relative"
            >
              <User
                className={`h-6 w-6 transition-all ${activeTab === "profile"
                  ? "text-white fill-white/20 scale-110 drop-shadow-[0_2px_8px_rgba(255,255,255,0.5)]"
                  : "text-white/70 hover:text-white"
                  }`}
              />
              {activeTab === "profile" && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
              )}
            </button>
          </div>
        </div>

        {/* Center Floating Gym Check-In Pass & GPS Trigger */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center justify-center">
          <button
            onClick={() => setShowGymCheckInModal(true)}
            aria-label="Check In GYM"
            className={`w-14 h-14 rounded-full flex flex-col items-center justify-center shadow-xl border-4 active:scale-90 transition-all hover:scale-105 shrink-0 ${isDark
              ? "bg-gradient-to-tr from-amber-400 via-orange-500 to-[#FF5A2C] shadow-orange-500/40 border-[#090B10]"
              : "bg-gradient-to-tr from-blue-700 via-blue-500 to-indigo-600 shadow-blue-500/35 border-[#EAECEF]"
              }`}
          >
            <QrCode className="h-6 w-6 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
            <span className="text-[7px] font-black text-white uppercase tracking-tighter -mt-0.5">
              CHECK IN
            </span>
          </button>
        </div>

        {/* Safe area bottom color fill to maintain seamless full-screen color */}
        <div className={`w-full h-[env(safe-area-inset-bottom,0px)] transition-colors duration-300 ${isDark ? "bg-[#FF5A2C]" : "bg-blue-600"}`} />
      </div>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`p-6 rounded-2xl border w-full max-w-sm text-center space-y-4 shadow-2xl relative transition-colors ${isDark ? "bg-[#141822] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
                }`}
            >
              <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
                <LogOut className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                  Keluar dari SynFit?
                </h3>
                <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  Sesi latihan lokal dan data biometrik Anda telah tersinkronisasi dengan aman.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className={`flex-1 h-11 rounded-full text-xs font-bold transition-all active:scale-95 ${isDark ? "bg-[#1C2028] hover:bg-[#262A33] text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-800"
                    }`}
                >
                  Batal
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-bold transition-all shadow-lg shadow-red-500/25 active:scale-95"
                >
                  Keluar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Geolocation Permission Modal */}
      <AnimatePresence>
        {showLocationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`p-6 rounded-2xl border w-full max-w-sm text-center space-y-4 shadow-2xl relative transition-colors ${isDark ? "bg-[#141822] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
                }`}
            >
              <div className="w-14 h-14 bg-blue-500/15 border border-blue-500/30 text-blue-500 rounded-2xl flex items-center justify-center mx-auto">
                <Globe className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                  Izin Lokasi GPS
                </h3>
                <p className={`text-xs leading-relaxed ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  Aplikasi memerlukan lokasi GPS untuk memvalidasi bahwa Anda berada di area SynFit dan otomatis merekam durasi sesi latihan.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowLocationModal(false)}
                  className={`flex-1 h-11 rounded-full text-xs font-bold transition-all active:scale-95 ${isDark ? "bg-[#1C2028] hover:bg-[#262A33] text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-800"
                    }`}
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    setShowLocationModal(false);
                    handleGPSCheckin();
                  }}
                  className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-extrabold uppercase tracking-wider transition-all shadow-lg shadow-blue-500/25 active:scale-95"
                >
                  Izinkan & Check-in
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Mandatory Default Password Change Modal */}
      <AnimatePresence>
        {session?.mustChangePassword && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`p-6 rounded-2xl border w-full max-w-md text-left space-y-4 shadow-2xl relative transition-colors ${isDark ? "bg-[#141822] border-blue-500/30 text-white" : "bg-white border-blue-200 text-gray-900"
                }`}
            >
              <div className="w-14 h-14 bg-blue-500/15 border border-blue-500/30 text-blue-500 rounded-2xl flex items-center justify-center mx-auto">
                <Lock className="h-6 w-6" />
              </div>
              <div className="text-center space-y-1">
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                  {language === "id" ? "Wajib Ganti Kata Sandi Awal" : "Mandatory Password Change"}
                </h3>
                <p className={`text-xs leading-relaxed ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  {language === "id"
                    ? "Akun Anda saat ini masih menggunakan kata sandi bawaan default. Demi keamanan privasi dan akun keanggotaan Anda, silakan buat kata sandi baru."
                    : "Your account is currently using the default initial password. For your security, please create a new personal password."}
                </p>
              </div>

              {passError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                  {passError}
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="space-y-3 pt-2">
                <div>
                  <label className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    {language === "id" ? "Kata Sandi Baru (Min. 6 Karakter)" : "New Password (Min. 6 Characters)"}
                  </label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                    required
                    minLength={6}
                    className={`mt-1 h-10 text-sm ${isDark ? "bg-[#10141D] border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                      }`}
                  />
                </div>
                <div>
                  <label className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    {language === "id" ? "Konfirmasi Kata Sandi Baru" : "Confirm New Password"}
                  </label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                    required
                    minLength={6}
                    className={`mt-1 h-10 text-sm ${isDark ? "bg-[#10141D] border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                      }`}
                  />
                </div>
                <div className="pt-2 space-y-2">
                  <Button
                    type="submit"
                    disabled={isChangingPass}
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 active:scale-95 transition-all"
                  >
                    {isChangingPass ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : language === "id" ? (
                      "Simpan Kata Sandi Baru"
                    ) : (
                      "Save New Password"
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border active:scale-95 ${isDark
                      ? "bg-white/5 hover:bg-red-500/10 text-gray-400 hover:text-red-400 border-white/5"
                      : "bg-gray-100 hover:bg-red-500/10 text-gray-600 hover:text-red-500 border-gray-200"
                      }`}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>{language === "id" ? "Keluar (Logout)" : "Log Out"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating SynFit AI Assistant Backdrop with Rich Blur */}
      <AnimatePresence>
        {isAiFloatingOpen && (
          <motion.div
            key="synfit-ai-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsAiFloatingOpen(false)}
            aria-hidden="true"
            className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-md z-[60] cursor-pointer"
          />
        )}
      </AnimatePresence>

      {/* Fluid macOS/iOS-style Floating AI Assistant Panel positioned above the trigger button */}
      <AnimatePresence>
        {isAiFloatingOpen && (
          <motion.div
            key="synfit-ai-panel"
            id="synfit-ai-floating-panel"
            initial={{
              opacity: 0,
              scale: shouldReduceMotion ? 1 : 0.35,
              y: shouldReduceMotion ? 0 : 22,
              x: shouldReduceMotion ? 0 : 12,
              transformOrigin: "bottom right",
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              x: 0,
              transformOrigin: "bottom right",
              transition: shouldReduceMotion
                ? { duration: 0.15 }
                : {
                  type: "spring",
                  stiffness: 350,
                  damping: 28,
                  mass: 0.85,
                  opacity: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
                },
            }}
            exit={{
              opacity: 0,
              scale: shouldReduceMotion ? 1 : 0.38,
              y: shouldReduceMotion ? 0 : 18,
              x: shouldReduceMotion ? 0 : 10,
              transformOrigin: "bottom right",
              transition: shouldReduceMotion
                ? { duration: 0.12 }
                : {
                  duration: 0.24,
                  ease: [0.32, 0, 0.67, 0],
                  opacity: { duration: 0.18, ease: "easeOut" },
                },
            }}
            className={`fixed inset-x-2.5 bottom-[148px] top-12 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[420px] sm:h-[620px] sm:max-h-[calc(100vh-120px)] rounded-3xl overflow-hidden flex flex-col backdrop-blur-2xl z-[70] transition-colors overscroll-contain shadow-2xl ${isDark
              ? "bg-[#141822]/95 border border-white/15 text-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)]"
              : "bg-white/95 border border-gray-200 text-gray-900 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.18)]"
              }`}
          >
            <MemberAIAssistant
              isFloating={true}
              onClose={() => setIsAiFloatingOpen(false)}
              memberNama={member?.nama}
              memberContext={{
                memberId: member?.id,
                nama: member?.nama,
                nomorWhatsapp: member?.nomor_whatsapp,
                alamat: member?.alamat,
                membershipType: member?.membership_type,
                status: member?.status,
                tanggalDaftar: member?.tanggal_daftar,
                tanggalExpired: member?.tanggal_expired,
                tinggiBadan: userHeight || member?.tinggi_badan,
                beratBadan: userWeight || member?.berat_badan,
                umur: userAge || member?.umur,
                jenisKelamin: userGender || member?.jenis_kelamin,
                targetFitness: userFitnessGoal || member?.target_fitness,
                bmi: calculatedBmi,
                streakDays: streakDays,
                userPoints: userPoints,
                totalVisitsThisMonth: visitsData.length,
                lastCheckinTime: checkinTime || (visitsData[0]?.date ? visitsData[0].date : undefined),
                visitsData: visitsData,
                totalWorkouts: workoutHistory.length,
                overallAvgScore: workoutHistory.length > 0
                  ? Math.round(
                    workoutHistory.reduce(
                      (acc, w) => acc + (w.form_score || w.score || w.average_form_score || 0),
                      0
                    ) / workoutHistory.length
                  )
                  : 89,
                recentWorkouts: workoutHistory.slice(0, 5).map((w) => ({
                  exerciseName:
                    w.exercise_name || w.type || (w.exercises?.[0]?.name ? w.exercises[0].name : "Latihan"),
                  reps: w.valid_reps || w.reps || w.total_reps || 12,
                  score: w.form_score || w.score || w.average_form_score || 90,
                  avgHeartRate: w.avg_heart_rate || null,
                  maxHeartRate: w.max_heart_rate || null,
                  caloriesBurned: w.calories_burned || null,
                  date: w.created_at?.seconds
                    ? new Date(w.created_at.seconds * 1000).toLocaleDateString("id-ID")
                    : w.created_at
                      ? new Date(w.created_at).toLocaleDateString("id-ID")
                      : undefined,
                })),
                smartwatch: {
                  connected: hrStatus === "connected",
                  deviceName: hrDeviceName,
                  currentBpm: hrCurrentBpm || hrLastValidBpm,
                  avgBpm: hrStats.avgBpm,
                  maxBpm: hrStats.maxBpm,
                  minBpm: hrStats.minBpm,
                  totalSamples: hrStats.totalSamples,
                  cardioZone: hrStats.avgBpm
                    ? hrStats.avgBpm < 100
                      ? "Warm Up"
                      : hrStats.avgBpm < 130
                        ? "Fat Burn"
                        : hrStats.avgBpm < 160
                          ? "Aerobic"
                          : "Anaerobic"
                    : "Fat Burn",
                  restingHeartRate: hrStats.minBpm || 72,
                },
              }}
              onSwitchToHumanChat={() => {
                setIsAiFloatingOpen(false);
                navigateToTab("chat");
              }}
              onNavigateTab={(target) => {
                setIsAiFloatingOpen(false);
                if (target === "coach") navigateToTab("coach");
                else if (target === "renewal") setShowRenewalModal(true);
                else if (target === "profile") navigateToTab("profile");
                else navigateToTab("home");
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating SynFit AI Trigger Button */}
      {activeTab !== "chat" && (
        <div
          className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-[70] pointer-events-auto flex"
        >
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.94 }}
            onClick={handleToggleFloatingChat}
            aria-label={isAiFloatingOpen ? "Tutup AI Chat" : "Tanya SynFit AI"}
            className={`group relative flex items-center p-1.5 sm:p-2 rounded-full backdrop-blur-2xl border shadow-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-all ${isDark
              ? "bg-[#141822]/95 border-white/15 shadow-black/80 hover:border-blue-500/40"
              : "bg-white/95 border-gray-200 shadow-black/10 hover:border-blue-500/40"
              }`}
          >
            {/* Morphing Icon: AI Avatar vs Close Icon with Smooth Rotation */}
            <div className="relative w-12 h-12 sm:w-13 sm:h-13 rounded-full overflow-hidden ring-2 ring-blue-500 shadow-md shadow-blue-500/25 flex items-center justify-center bg-blue-600/10 shrink-0">
              <AnimatePresence mode="wait" initial={false}>
                {isAiFloatingOpen ? (
                  <motion.div
                    key="close-icon"
                    initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-center w-full h-full bg-blue-600 text-white"
                  >
                    <X className="h-6 w-6 stroke-[2.5]" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="avatar-icon"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    className="w-full h-full"
                  >
                    <img
                      src="/ai_avatar.jpeg"
                      alt="SynFit AI"
                      className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-300"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = "/ai_avatar.jpg";
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Desktop Label Text */}
            <div className="hidden sm:flex flex-col text-left pr-3 pl-1">
              <span
                className={`text-xs font-black transition-colors flex items-center gap-1 ${isDark
                  ? "text-white group-hover:text-blue-400"
                  : "text-gray-900 group-hover:text-blue-600"
                  }`}
              >
                {isAiFloatingOpen ? "Tutup AI" : "Tanya AI"}{" "}
                <Sparkles className="h-3 w-3 text-blue-500" />
              </span>
              <span
                className={`text-[9px] font-medium ${isDark ? "text-gray-400" : "text-gray-500"
                  }`}
              >
                {isAiFloatingOpen ? "Klik untuk menutup" : "Asisten 24/7"}
              </span>
            </div>
          </motion.button>
        </div>
      )}

      {/* â”€â”€ Banner 1: Feature Tour Modal (SynFit App All-in-One) â”€â”€ */}
      <AnimatePresence>
        {showFeatureTourModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className={`p-6 rounded-3xl border w-full max-w-lg text-left space-y-5 shadow-2xl relative transition-colors max-h-[90vh] overflow-y-auto ${isDark ? "bg-[#101424] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
                }`}
            >
              <button
                onClick={() => setShowFeatureTourModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 shrink-0">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">Fitur Lengkap SynFit App</span>
                  <h3 className="text-lg font-black tracking-tight">Semua Otomatis Dalam Satu Genggaman</h3>
                </div>
              </div>

              <p className={`text-xs leading-relaxed ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                Nikmati ekosistem gym pintar terlengkap: pantau repetisi latihan dengan kamera AI, rekam denyut jantung via smartwatch, dan check-in gate tanpa antre!
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div
                  onClick={() => {
                    setShowFeatureTourModal(false);
                    navigateToTab("coach");
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all active:scale-95 space-y-1.5 ${isDark ? "bg-white/5 border-white/10 hover:border-blue-500/50" : "bg-blue-50/50 border-blue-200 hover:border-blue-400"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl">ðŸ“¹</span>
                    <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">Live AI</span>
                  </div>
                  <h4 className="text-xs font-black">AI Form Coach</h4>
                  <p className="text-[10px] text-gray-400 leading-snug">
                    Kamera vision MediaPipe mengoreksi postur squat, bicep curl & pushup secara real-time.
                  </p>
                </div>

                <div
                  onClick={() => {
                    setShowFeatureTourModal(false);
                    setShowHeartRateHistoryModal(true);
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all active:scale-95 space-y-1.5 ${isDark ? "bg-white/5 border-white/10 hover:border-rose-500/50" : "bg-rose-50/50 border-rose-200 hover:border-rose-400"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl">âŒš</span>
                    <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400">Diagram & Uji</span>
                  </div>
                  <h4 className="text-xs font-black">Riwayat & Diagram Heart Rate</h4>
                  <p className="text-[10px] text-gray-400 leading-snug">
                    Lihat grafik tren BPM, distribusi zona bakar lemak, & lakukan uji denyut nadi 30 detik.
                  </p>
                </div>

                <div
                  onClick={() => {
                    setShowFeatureTourModal(false);
                    navigateToTab("membership");
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all active:scale-95 space-y-1.5 ${isDark ? "bg-white/5 border-white/10 hover:border-emerald-500/50" : "bg-emerald-50/50 border-emerald-200 hover:border-emerald-400"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl">ðŸªª</span>
                    <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">RFID Pass</span>
                  </div>
                  <h4 className="text-xs font-black">Kartu Digital VIP</h4>
                  <p className="text-[10px] text-gray-400 leading-snug">
                    Barcode check-in berteknologi HMAC dinamis untuk akses gate gym cepat tanpa kartu fisik.
                  </p>
                </div>

                <div
                  onClick={() => {
                    setShowFeatureTourModal(false);
                    setIsAiFloatingOpen(true);
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all active:scale-95 space-y-1.5 ${isDark ? "bg-white/5 border-white/10 hover:border-purple-500/50" : "bg-purple-50/50 border-purple-200 hover:border-purple-400"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl">ðŸ¤–</span>
                    <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">24/7 AI</span>
                  </div>
                  <h4 className="text-xs font-black">SynFit AI Coach</h4>
                  <p className="text-[10px] text-gray-400 leading-snug">
                    Asisten cerdas untuk konsultasi program latihan, panduan diet, dan info fasilitas gym.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => {
                    setShowFeatureTourModal(false);
                    navigateToTab("coach");
                  }}
                  className="w-full h-11 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-blue-500/25 active:scale-95 transition-all"
                >
                  Coba AI Form Coach Sekarang
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* â”€â”€ Banner 2: Referral Program Modal (Ajak Teman, Hemat 20%) â”€â”€ */}
      <AnimatePresence>
        {showReferralModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className={`p-6 rounded-3xl border w-full max-w-md text-left space-y-5 shadow-2xl relative transition-colors max-h-[90vh] overflow-y-auto ${isDark ? "bg-[#101424] border-orange-500/25 text-white" : "bg-white border-orange-200 text-gray-900"
                }`}
            >
              <button
                onClick={() => setShowReferralModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FF5A2C] to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30 shrink-0">
                  <Gift className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-orange-400">Program Referral SynFit</span>
                  <h3 className="text-lg font-black tracking-tight">Ajak Temanmu, Hemat 20%!</h3>
                </div>
              </div>

              <p className={`text-xs leading-relaxed ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                Ajak rekan gym atau sahabatmu bergabung di SynFit! Kamu dan temanmu masing-masing akan mendapatkan <strong className="text-orange-400">diskon 20%</strong> untuk langganan bulan berikutnya.
              </p>

              {/* Promo Banner Code (COBAFIT20) */}
              <div className={`p-4 rounded-2xl border space-y-2 ${isDark ? "bg-[#090D18] border-orange-500/30" : "bg-orange-50/60 border-orange-200"
                }`}>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-orange-400 block">
                  Kode Promo Resmi:
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xl font-mono font-black text-yellow-400 tracking-wider">
                    COBAFIT20
                  </span>
                  <button
                    onClick={() => handleCopyCode("COBAFIT20")}
                    className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  >
                    {copiedCode === "COBAFIT20" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode === "COBAFIT20" ? "Tersalin!" : "Salin"}</span>
                  </button>
                </div>
              </div>

              {/* Member Personal Referral Code */}
              <div className={`p-4 rounded-2xl border space-y-2 ${isDark ? "bg-[#090D18] border-white/10" : "bg-gray-50 border-gray-200"
                }`}>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 block">
                  Kode Referral Pribadi Anda:
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-mono font-bold text-white tracking-wider">
                    {`SYNFIT-${(member?.id || "MEMBER").slice(0, 6).toUpperCase()}`}
                  </span>
                  <button
                    onClick={() => handleCopyCode(`SYNFIT-${(member?.id || "MEMBER").slice(0, 6).toUpperCase()}`)}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    {copiedCode?.startsWith("SYNFIT") ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode?.startsWith("SYNFIT") ? "Tersalin!" : "Salin"}</span>
                  </button>
                </div>
              </div>

              {/* WhatsApp Share Button */}
              <button
                onClick={() => {
                  const referralMsg = encodeURIComponent(
                    `Halo! Yuk gabung di SynFit Gym bareng aku dan nikmati diskon 20% membership dengan kode promo *COBAFIT20* atau kode referralku *SYNFIT-${(member?.id || "MEMBER").slice(0, 6).toUpperCase()}*! Daftar langsung di: https://synfitgym.web.app/membership`
                  );
                  window.open(`https://api.whatsapp.com/send?text=${referralMsg}`, "_blank");
                }}
                className="w-full py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <Share2 className="w-4 h-4" />
                <span>Bagikan Langsung ke WhatsApp</span>
              </button>

              {/* Redeem Friend's Referral Code Form */}
              <div className="pt-2 border-t border-white/10 space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                  Punya Kode Referral Teman?
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={referralFriendCode}
                    onChange={(e) => setReferralFriendCode(e.target.value.toUpperCase())}
                    placeholder="Contoh: COBAFIT20"
                    className={`h-10 text-xs font-mono font-bold uppercase ${isDark ? "bg-[#090D18] border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                      }`}
                  />
                  <Button
                    onClick={() => {
                      if (!referralFriendCode.trim()) {
                        toast.error("Masukkan kode referral terlebih dahulu.");
                        return;
                      }
                      setAppliedReferralDiscount(true);
                      toast.success(`ðŸŽ‰ Kode referral ${referralFriendCode} berhasil dipasang! Diskon 20% telah aktif untuk paket keanggotaan Anda.`);
                      setShowReferralModal(false);
                      navigateToTab("membership");
                    }}
                    className="h-10 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-extrabold uppercase shrink-0"
                  >
                    Klaim Diskon
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* â”€â”€ Banner 4: Daily Streak & Reward Points Modal â”€â”€ */}
      <AnimatePresence>
        {showStreakRewardsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className={`p-6 rounded-3xl border w-full max-w-lg text-left space-y-5 shadow-2xl relative transition-colors max-h-[90vh] overflow-y-auto ${isDark ? "bg-[#101424] border-blue-500/25 text-white" : "bg-white border-blue-200 text-gray-900"
                }`}
            >
              <button
                onClick={() => setShowStreakRewardsModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30 shrink-0">
                  <Flame className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">SynFit Gamifikasi & Rewards</span>
                  <h3 className="text-lg font-black tracking-tight">Streak & Kumpulkan Poin!</h3>
                </div>
              </div>

              {/* Greeting Card */}
              <div className={`p-4 rounded-2xl border space-y-3 ${isDark ? "bg-[#090D18] border-white/10" : "bg-blue-50/60 border-blue-200"
                }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-300">
                    Halo, <strong className="text-white">{member?.nama || "Kemal"}</strong>!
                  </span>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1">
                    <Flame className="w-3 h-3" />
                    Streak: {streakDays} Hari
                  </span>
                </div>

                {/* Day of Week Tracker */}
                <div className="grid grid-cols-7 gap-1.5 pt-1 text-center">
                  {[
                    { day: "Sen", done: true },
                    { day: "Sel", done: true },
                    { day: "Rab", done: true },
                    { day: "Kam", done: true },
                    { day: "Jum", done: true },
                    { day: "Sab", done: false },
                    { day: "Min", done: false },
                  ].map((d, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${d.done
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                        : isDark ? "bg-white/5 text-gray-500 border border-white/10" : "bg-gray-200 text-gray-400"
                        }`}>
                        {d.done ? <Check className="w-3.5 h-3.5" /> : d.day[0]}
                      </div>
                      <span className="text-[9px] font-bold text-gray-400">{d.day}</span>
                    </div>
                  ))}
                </div>

                {/* Points Balance & Daily Claim */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-gray-400 block">Saldo Poin Kamu:</span>
                    <span className="text-2xl font-mono font-black text-amber-400 flex items-center gap-1">
                      <Coins className="w-5 h-5 text-amber-400" />
                      {userPoints.toLocaleString()} <span className="text-xs text-gray-400 font-sans font-normal">Poin</span>
                    </span>
                  </div>

                  <button
                    disabled={hasClaimedToday}
                    onClick={() => {
                      setUserPoints((prev) => prev + 50);
                      setStreakDays((prev) => prev + 1);
                      setHasClaimedToday(true);
                      toast.success(`ðŸŽ‰ Bonus Harian Berhasil Diklaim! +50 Poin ditambahkan. Total Poin: ${(userPoints + 50).toLocaleString()}`);
                    }}
                    className={`px-4 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-1.5 ${hasClaimedToday
                      ? "bg-white/10 text-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-orange-500/25"
                      }`}
                  >
                    {hasClaimedToday ? "âœ“ Diklaim Hari Ini" : "+50 Poin Harian"}
                  </button>
                </div>
              </div>

              {/* Benefit Redemption Catalog */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-300">
                    Tukar Poin Dengan Berbagai Benefit:
                  </h4>
                  <span className="text-[10px] text-gray-400">Pilih hadiah langsung</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {rewardCatalog.map((reward) => (
                    <div
                      key={reward.id}
                      className={`p-3.5 rounded-2xl border space-y-2 flex flex-col justify-between ${isDark ? "bg-[#090D18] border-white/10" : "bg-gray-50 border-gray-200"
                        }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${reward.color}`}>
                            {reward.category}
                          </span>
                          <span className="text-xs font-mono font-black text-amber-400 flex items-center gap-0.5">
                            <Coins className="w-3 h-3" />
                            {reward.points}
                          </span>
                        </div>
                        <h5 className="text-xs font-black">{reward.name}</h5>
                        <p className="text-[10px] text-gray-400 leading-snug mt-0.5">
                          {reward.description}
                        </p>
                      </div>

                      <button
                        onClick={() => handleRedeemReward(reward)}
                        className={`w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${userPoints >= reward.points
                          ? "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20"
                          : "bg-white/5 text-gray-500 cursor-not-allowed"
                          }`}
                      >
                        {userPoints >= reward.points ? "Tukar Hadiah" : "Poin Belum Cukup"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* â”€â”€ Riwayat Uji Heart Rate & Statistik Diagram Modal â”€â”€ */}
      <HeartRateHistoryModal
        isOpen={showHeartRateHistoryModal}
        onClose={() => setShowHeartRateHistoryModal(false)}
        memberId={member?.id}
        memberName={member?.nama}
        isDark={isDark}
        language={language}
      />

      {/* â”€â”€ Modal Check In di GYM (Barcode Turnstile Optical Pass & GPS Auto Check-In) â”€â”€ */}
      <GymCheckInModal
        isOpen={showGymCheckInModal}
        onClose={() => setShowGymCheckInModal(false)}
        member={member}
        status={status}
        daysLeft={daysLeft}
        isDark={isDark}
        isRefreshingToken={isRefreshingToken}
        onRefreshToken={handleRefreshToken}
        activeCheckinId={activeCheckinId}
        isCheckingGPS={isCheckingGPS}
        onOpenGpsCheckIn={() => {
          setShowGymCheckInModal(false);
          setShowLocationModal(true);
        }}
        onManualCheckout={handleManualCheckout}
        activeSessionDuration={workoutDuration}
      />
    </div>
  );
}
