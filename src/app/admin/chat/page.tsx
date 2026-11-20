"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, MessageCircle, User, Loader2, Paperclip, X, Trash2, Eraser } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, deleteDoc, updateDoc, getDocs, writeBatch, setDoc } from "firebase/firestore";
import { useAuthStore } from "@/store/useAuthStore";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { format, differenceInMinutes } from "date-fns";
import { id, enUS } from "date-fns/locale";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useLanguageStore } from "@/store/useLanguageStore";
import { translations } from "@/lib/translations";
import { useNotifications } from "@/hooks/useNotifications";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "@/lib/navigation";
import { toast } from "sonner";

const APP_TAGS = [
  { label: "Dashboard", path: "/admin/dashboard", icon: "ðŸ“Š" },
  { label: "Members", path: "/admin/members", icon: "ðŸ‘¥" },
  { label: "Equipment", path: "/admin/equipment", icon: "ðŸ‹ï¸" },
  { label: "Reports", path: "/admin/reports", icon: "ðŸ“ˆ" },
  { label: "Scanner", path: "/admin/scanner", icon: "ðŸ”" },
  { label: "Transactions", path: "/admin/transactions", icon: "ðŸ’°" },
  { label: "SPK", path: "/admin/spk", icon: "ðŸ”§" },
  { label: "Settings", path: "/admin/settings", icon: "âš™ï¸" },
  { label: "Chat", path: "/admin/chat", icon: "ðŸ’¬" },
];

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  sender_photo?: string;
  content: string;
  image_url?: string;
  is_deleted?: boolean;
  is_read?: boolean;
  created_at: any;
}

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode") as "internal" | "member" | null;
  const memberIdParam = searchParams.get("memberId") || "";

  const { language } = useLanguageStore();
  const t = translations[language];
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeChatMode, setActiveChatMode] = useState<"internal" | "member">(modeParam || "internal");
  const [selectedMemberId, setSelectedMemberId] = useState(memberIdParam);

  useEffect(() => {
    const mode = modeParam || "internal";
    setActiveChatMode(mode);
    if (mode === "internal") {
      setSelectedMemberId("");
    } else if (memberIdParam) {
      setSelectedMemberId(memberIdParam);
    }
  }, [modeParam, memberIdParam]);
  const [memberMessages, setMemberMessages] = useState<any[]>([]);
  const [memberConversations, setMemberConversations] = useState<any[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isMemberLoading, setIsMemberLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isMemberTyping, setIsMemberTyping] = useState(false);
  const adminTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [deleteMsgModal, setDeleteMsgModal] = useState({ isOpen: false, msg: null as ChatMessage | null, type: 'soft' as 'soft' | 'hard' });
  const [clearHistoryModalOpen, setClearHistoryModalOpen] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [showMemberSuggestions, setShowMemberSuggestions] = useState(false);
  const [filteredTags, setFilteredTags] = useState(APP_TAGS);
  const [filteredMembers, setFilteredMembers] = useState<{id: string, nama: string}[]>([]);
  const [allMembers, setAllMembers] = useState<{id: string, nama: string}[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeChatMode !== "internal") return;
    const q = query(collection(db, "chats"), orderBy("created_at", "asc"), limit(200));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatMessage[]);
        setIsLoading(false);
      },
      (error) => {
        console.warn("Chats subscription notice:", error.message);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user, activeChatMode]);

  useEffect(() => {
    if (activeChatMode !== "member") return;
    const q = query(collection(db, "member_chats"), orderBy("created_at", "desc"), limit(1000));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const conversationsMap: { [key: string]: any } = {};
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const mId = data.member_id;
          if (mId) {
            if (!conversationsMap[mId]) {
              conversationsMap[mId] = {
                memberId: mId,
                lastMessage: data.content || (data.image_url ? "[Gambar]" : ""),
                lastMessageTime: data.created_at,
                unreadCount: 0,
              };
            }
            // Count unread messages sent by member
            if (data.sender_role === "MEMBER" && data.is_read !== true) {
              conversationsMap[mId].unreadCount += 1;
            }
          }
        });
        const list = Object.values(conversationsMap);
        list.sort((a: any, b: any) => {
          const tA = a.lastMessageTime?.toDate?.() ? a.lastMessageTime.toDate().getTime() : (a.lastMessageTime?.seconds ? a.lastMessageTime.seconds * 1000 : 0);
          const tB = b.lastMessageTime?.toDate?.() ? b.lastMessageTime.toDate().getTime() : (b.lastMessageTime?.seconds ? b.lastMessageTime.seconds * 1000 : 0);
          return tB - tA;
        });
        setMemberConversations(list);
        setIsLoading(false);
      },
      (error) => {
        console.warn("Member chats subscription notice:", error.message);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user, activeChatMode]);

  useEffect(() => {
    if (!selectedMemberId || activeChatMode !== "member") return;
    setIsMemberLoading(true);
    const q = query(
      collection(db, "member_chats"),
      where("member_id", "==", selectedMemberId)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const chatDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        chatDocs.sort((a: any, b: any) => {
          const timeA = a.created_at?.toDate ? a.created_at.toDate().getTime() : (a.created_at?.seconds ? a.created_at.seconds * 1000 : 0);
          const timeB = b.created_at?.toDate ? b.created_at.toDate().getTime() : (b.created_at?.seconds ? b.created_at.seconds * 1000 : 0);
          return timeA - timeB;
        });
        setMemberMessages(chatDocs);
        setIsMemberLoading(false);
      },
      (error) => {
        console.warn("Member messages subscription notice:", error.message);
        setIsMemberLoading(false);
      }
    );
    return () => unsubscribe();
  }, [selectedMemberId, activeChatMode]);

  // Auto mark unread member messages as read when viewing this member's chat
  useEffect(() => {
    if (!selectedMemberId || activeChatMode !== "member") return;
    const qUnread = query(
      collection(db, "member_chats"),
      where("member_id", "==", selectedMemberId),
      where("sender_role", "==", "MEMBER")
    );
    getDocs(qUnread).then((snap) => {
      const batch = writeBatch(db);
      let needsCommit = false;
      snap.docs.forEach((d) => {
        if (d.data().is_read !== true) {
          batch.update(doc(db, "member_chats", d.id), { is_read: true });
          needsCommit = true;
        }
      });
      if (needsCommit) {
        batch.commit().catch(() => {});
      }
    }).catch(() => {});
  }, [selectedMemberId, activeChatMode, memberMessages.length]);

  // Real-time typing listener for member
  useEffect(() => {
    if (!selectedMemberId || activeChatMode !== "member") {
      setIsMemberTyping(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "typing_status", selectedMemberId),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          const isRecent = d.member_time && Date.now() - d.member_time < 3500;
          setIsMemberTyping(!!d.member_typing && isRecent);
        } else {
          setIsMemberTyping(false);
        }
      },
      (_err) => {
        setIsMemberTyping(false);
      }
    );
    return () => unsub();
  }, [selectedMemberId, activeChatMode]);

  const broadcastAdminTyping = () => {
    if (!selectedMemberId || activeChatMode !== "member") return;
    setDoc(doc(db, "typing_status", selectedMemberId), {
      admin_typing: true,
      admin_time: Date.now(),
    }, { merge: true }).catch(() => {});

    if (adminTypingTimeoutRef.current) clearTimeout(adminTypingTimeoutRef.current);
    adminTypingTimeoutRef.current = setTimeout(() => {
      setDoc(doc(db, "typing_status", selectedMemberId), {
        admin_typing: false,
      }, { merge: true }).catch(() => {});
    }, 3000);
  };

  useEffect(() => {
    const q = query(collection(db, "members"), orderBy("nama", "asc"));
    getDocs(q).then(snap => {
      setAllMembers(snap.docs.map(d => ({ id: d.id, nama: d.data().nama })));
    });
  }, []);

  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    };
    scrollToBottom();
    const r1 = requestAnimationFrame(scrollToBottom);
    const t1 = setTimeout(scrollToBottom, 60);
    const t2 = setTimeout(scrollToBottom, 200);
    return () => {
      cancelAnimationFrame(r1);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [messages.length, memberMessages.length, previewUrl, selectedMemberId, isMemberTyping]);

  const { sendPushNotification } = useNotifications();

  const handleInputChange = (val: string) => {
    setNewMessage(val);
    if (activeChatMode === "member" && selectedMemberId) {
      broadcastAdminTyping();
    }
    const lastWord = val.split(" ").pop() || "";
    
    if (lastWord.startsWith("#")) {
      const search = lastWord.slice(1).toLowerCase();
      setFilteredTags(APP_TAGS.filter(tag => tag.label.toLowerCase().includes(search)));
      setShowTagSuggestions(true);
      setShowMemberSuggestions(false);
    } else if (lastWord.startsWith("@")) {
      const search = lastWord.slice(1).toLowerCase();
      setFilteredMembers(allMembers.filter(m => m.nama.toLowerCase().includes(search)).slice(0, 5));
      setShowMemberSuggestions(true);
      setShowTagSuggestions(false);
    } else {
      setShowTagSuggestions(false);
      setShowMemberSuggestions(false);
    }
  };

  const applyTag = (tag: typeof APP_TAGS[0]) => {
    const words = newMessage.split(" ");
    words.pop();
    setNewMessage([...words, `#${tag.label} `].join(" "));
    setShowTagSuggestions(false);
  };

  const applyMemberTag = (member: {id: string, nama: string}) => {
    const words = newMessage.split(" ");
    words.pop();
    setNewMessage([...words, `@${member.nama.replace(/\s/g, "_")} `].join(" "));
    setShowMemberSuggestions(false);
  };

  const renderContentWithTags = (content: string, isMe: boolean) => {
    if (!content) return null;
    // Split by tags (#Page or @Member_Name)
    const parts = content.split(/(#[a-zA-Z]+|@[a-zA-Z0-9_]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("#")) {
        const tagName = part.slice(1);
        const tag = APP_TAGS.find(t => t.label.toLowerCase() === tagName.toLowerCase());
        if (tag) {
          return (
            <button
              key={i}
              onClick={() => router.push(tag.path)}
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-black transition-all mx-0.5 whitespace-nowrap",
                isMe 
                  ? "bg-white/20 text-white hover:bg-white/30" 
                  : "bg-[#FF5A2C]/10 text-[#FF5A2C] hover:bg-[#FF5A2C]/20"
              )}
            >
              <span className="text-[9px]">{tag.icon}</span>
              <span className="text-[10px] uppercase tracking-tighter">{tag.label}</span>
            </button>
          );
        }
      } else if (part.startsWith("@")) {
        const memberName = part.slice(1).replace(/_/g, " ");
        return (
          <button
            key={i}
            onClick={() => router.push(`/admin/members?search=${encodeURIComponent(memberName)}`)}
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-black transition-all mx-0.5 whitespace-nowrap",
              isMe 
                ? "bg-blue-500/30 text-white hover:bg-blue-500/50" 
                : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
            )}
          >
            <span className="text-[9px]">ðŸ‘¤</span>
            <span className="text-[10px] uppercase tracking-tighter">{memberName}</span>
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !user || isSending || isUploading) return;

    if (activeChatMode === "member" && !selectedMemberId) {
      toast.warning(language === 'id' ? "Silakan pilih member terlebih dahulu." : "Please select a member first.");
      return;
    }

    setIsSending(true);
    const content = newMessage;
    const file = selectedFile;
    setNewMessage("");
    setSelectedFile(null);
    setPreviewUrl("");
    setShowTagSuggestions(false);
    try {
      let imageUrl = "";
      if (file) {
        setIsUploading(true);
        const uploaded = await uploadToCloudinary(file);
        if (uploaded) imageUrl = uploaded;
        setIsUploading(false);
      }

      if (activeChatMode === "member") {
        await addDoc(collection(db, "member_chats"), {
          member_id: selectedMemberId,
          sender_id: user.email || user.name,
          sender_name: user.name,
          sender_role: "ADMIN",
          content: content,
          image_url: imageUrl,
          created_at: serverTimestamp(),
          is_read: false,
        });
        setDoc(doc(db, "typing_status", selectedMemberId), { admin_typing: false }, { merge: true }).catch(() => {});
      } else {
        await addDoc(collection(db, "chats"), {
          sender_id: user.email || user.name,
          sender_name: user.name,
          sender_role: user.role,
          content: content,
          image_url: imageUrl,
          created_at: serverTimestamp(),
          sender_photo: user.photoUrl || ""
        });

        await sendPushNotification({
          title: `Pesan baru dari ${user.name}`,
          body: imageUrl ? "[Gambar]" : content,
          topic: "staff-chat",
          data: { url: "/chat" }
        });
      }

    } catch (error: any) { toast.error(t.failed); } finally { setIsSending(false); setIsUploading(false); }
  };

  const handleDeleteMessage = (msg: ChatMessage) => {
    if (!user) return;
    const isMe = msg.sender_id === (user.email || user.name);
    if (!isMe) return;
    const createdAt = msg.created_at?.toDate() || new Date();
    const minutesDiff = differenceInMinutes(new Date(), createdAt);
    
    if (minutesDiff < 5) {
      setDeleteMsgModal({ isOpen: true, msg, type: 'hard' });
    } else {
      setDeleteMsgModal({ isOpen: true, msg, type: 'soft' });
    }
  };

  const confirmDeleteMessage = async () => {
    const { msg, type } = deleteMsgModal;
    if (!msg) return;
    try {
      if (type === 'hard') {
        await deleteDoc(doc(db, "chats", msg.id));
      } else {
        await updateDoc(doc(db, "chats", msg.id), { 
          is_deleted: true, 
          content: language === 'id' ? "Pesan telah dihapus" : "Message has been deleted", 
          image_url: "" 
        });
      }
      setDeleteMsgModal({ isOpen: false, msg: null, type: 'soft' });
    } catch (e) { toast.error(t.failed); }
  };

  const handleClearHistory = () => {
    if (user?.role !== "DEVELOPER") return;
    setClearHistoryModalOpen(true);
  };

  const confirmClearHistory = async () => {
    setIsClearing(true);
    try {
      const q = query(collection(db, "chats"));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (e) { toast.error(t.failed); } finally { setIsClearing(false); setClearHistoryModalOpen(false); }
  };

  return (
    <div className="flex h-screen max-h-screen overflow-hidden bg-[#0A0D14]">
      <Sidebar />
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0 h-screen max-h-screen overflow-hidden">
        <Header />
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative p-2 sm:p-4 bg-[#0A0D14]">
          {/* Top Bar: Title & Mode Switcher in Compact Single Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2 px-2 py-1 shrink-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight heading-font uppercase">{t.chat}</h1>
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest px-2 py-0.5 rounded-md bg-white/5 border border-white/5 hidden sm:inline-block">
                {activeChatMode === "internal"
                  ? (language === 'id' ? "RUANG INTERNAL" : "INTERNAL TEAM")
                  : (language === 'id' ? "CHAT MEMBER LANGSUNG" : "DIRECT MEMBER CHATS")}
              </span>
            </div>

            {/* Chat Mode Switcher Tabs */}
            <div className="flex items-center gap-2">
              <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                <button
                  onClick={() => {
                    setActiveChatMode("internal");
                    setSelectedMemberId("");
                  }}
                  className={`h-9 px-4 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all flex items-center gap-2 ${
                    activeChatMode === "internal"
                      ? "bg-[#FF5A2C] text-white shadow-md shadow-orange-500/20"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {language === 'id' ? "Staf Internal" : "Internal"}
                </button>
                <button
                  onClick={() => {
                    setActiveChatMode("member");
                    setSelectedMemberId("");
                    setIsLoading(true);
                  }}
                  className={`h-9 px-4 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all flex items-center gap-2 ${
                    activeChatMode === "member"
                      ? "bg-[#FF5A2C] text-white shadow-md shadow-orange-500/20"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {language === 'id' ? "Member CS" : "Member"}
                </button>
              </div>

              {user?.role === "DEVELOPER" && activeChatMode === "internal" && (
                <button onClick={handleClearHistory} disabled={isClearing} className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all">
                  {isClearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eraser className="h-3.5 w-3.5" />}
                  <span>{language === 'id' ? "Hapus" : "Clear"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Fullscreen Chat Surface without Bulky Card Padding */}
          <div className="flex-1 flex flex-col bg-[#111520] border border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden relative min-h-0 shadow-2xl">
            {activeChatMode === "internal" ? (
              // INTERNAL STAFF CHAT LIST
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 custom-scrollbar">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
                    <Loader2 className="h-8 w-8 animate-spin text-[#FF5A2C]" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Syncing...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                    <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center">
                      <MessageCircle className="h-10 w-10 text-gray-700" />
                    </div>
                    <h3 className="text-xl font-black text-foreground heading-font uppercase tracking-tight">
                      {language === 'id' ? "Belum ada obrolan" : "No messages yet"}
                    </h3>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {messages.map((msg, index) => {
                      const isMe = msg.sender_id === (user?.email || user?.name);
                      const showAvatar = index === 0 || messages[index - 1].sender_id !== msg.sender_id;
                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`flex gap-4 max-w-[90%] sm:max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'} group`}>
                            {!isMe && (
                              <div className={cn(
                                "w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden transition-all shadow-md",
                                !showAvatar && "opacity-0",
                                msg.sender_role === 'DEVELOPER' 
                                  ? "p-[1.5px] bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 ring-1 ring-blue-500/10" 
                                  : "glass border border-white/10"
                              )}>
                                <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-black/20">
                                  {msg.sender_photo ? <img src={msg.sender_photo} alt={msg.sender_name} className="w-full h-full object-cover no-invert" /> : <User className="h-5 w-5 text-gray-500" />}
                                </div>
                              </div>
                            )}
                            <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                              {showAvatar && !isMe && (
                                <span className="text-[10px] font-black text-gray-500 mb-2 px-1 flex items-center gap-2 uppercase tracking-widest">
                                  {msg.sender_name} 
                                  <span className="w-1 h-1 rounded-full bg-[#FF5A2C]/50" /> 
                                  <span className={cn(
                                    "font-black",
                                    msg.sender_role === 'DEVELOPER' ? "text-blue-400" : "text-[#FF5A2C]"
                                  )}>{msg.sender_role}</span>
                                </span>
                              )}
                              <div className="flex items-center gap-3">
                                {isMe && !msg.is_deleted && <button onClick={() => handleDeleteMessage(msg)} className="opacity-0 group-hover:opacity-100 p-2 text-gray-500 hover:text-red-500 transition-all"><Trash2 className="h-4 w-4" /></button>}
                                <div className={`rounded-2xl shadow-lg overflow-hidden ${msg.is_deleted ? 'bg-white/5 border border-white/5 italic text-gray-500 px-4 py-2' : isMe ? 'bg-gradient-to-br from-[#FF5A2C] to-red-600 text-white rounded-tr-none' : 'glass border border-white/5 text-foreground rounded-tl-none'}`}>
                                  {msg.image_url && !msg.is_deleted && <div className="p-1"><img src={msg.image_url} alt="..." className="max-w-full sm:max-w-md rounded-xl cursor-pointer no-invert" onClick={() => window.open(msg.image_url, '_blank')} /></div>}
                                  {msg.content && (
                                    <div className="px-4 py-2.5 text-[13px] font-bold leading-relaxed whitespace-pre-wrap">
                                      {renderContentWithTags(msg.content, isMe)}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <span className="text-[9px] font-black text-gray-500 mt-2 uppercase tracking-widest opacity-60">{msg.created_at ? format(msg.created_at.toDate(), "HH:mm", { locale: language === 'id' ? id : enUS }) : "..."}</span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>
            ) : (
              // MEMBER CHATS DUAL-PANE VIEW
              <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-white/5 text-left">
                {/* Left pane: Active conversations & Member Search */}
                <div className="w-full md:w-80 flex flex-col flex-shrink-0 min-h-0 bg-white/[0.01]">
                  <div className="p-4 border-b border-white/5">
                    <input
                      type="text"
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      placeholder={language === 'id' ? "Cari nama member..." : "Search member..."}
                      className="w-full h-11 bg-black/20 border border-white/10 focus:border-[#FF5A2C]/50 rounded-2xl px-4 text-xs font-bold text-white placeholder:text-gray-600 focus:outline-none transition-all"
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {(() => {
                      const getMemberName = (id: string) => allMembers.find(m => m.id === id)?.nama || "Unknown Member";

                      const activeConv = memberConversations.filter(c =>
                        getMemberName(c.memberId).toLowerCase().includes(memberSearchQuery.toLowerCase())
                      );

                      const otherMembers = allMembers.filter(m =>
                        m.nama.toLowerCase().includes(memberSearchQuery.toLowerCase()) &&
                        !memberConversations.some(c => c.memberId === m.id)
                      );

                      return (
                        <>
                          {activeConv.map((conv) => {
                            const name = getMemberName(conv.memberId);
                            const isActive = selectedMemberId === conv.memberId;
                            const hasUnread = (conv.unreadCount || 0) > 0;
                            const convTime = conv.lastMessageTime?.toDate
                              ? format(conv.lastMessageTime.toDate(), "HH:mm", { locale: language === 'id' ? id : enUS })
                              : conv.lastMessageTime?.seconds
                              ? format(new Date(conv.lastMessageTime.seconds * 1000), "HH:mm", { locale: language === 'id' ? id : enUS })
                              : "...";

                            return (
                              <button
                                key={conv.memberId}
                                onClick={() => setSelectedMemberId(conv.memberId)}
                                className={`w-full p-4 rounded-2xl text-left transition-all flex flex-col gap-1.5 border relative ${
                                  isActive
                                    ? "bg-[#FF5A2C]/15 border-[#FF5A2C] text-white shadow-lg shadow-[#FF5A2C]/15"
                                    : hasUnread
                                    ? "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/60 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/40"
                                    : "bg-transparent border-transparent hover:bg-white/[0.03] text-gray-400 hover:text-white"
                                }`}
                              >
                                <div className="flex justify-between items-center w-full">
                                  <div className="flex items-center gap-2 max-w-[70%]">
                                    {hasUnread && (
                                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0 ring-2 ring-emerald-400/40" />
                                    )}
                                    <span className={`text-xs font-black uppercase truncate tracking-tight ${hasUnread ? "text-emerald-300 font-extrabold" : ""}`}>
                                      {name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[8px] font-black opacity-60 uppercase shrink-0 tracking-wider">{convTime}</span>
                                    {hasUnread && (
                                      <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-[#042F2E] font-black text-[9px] shadow-sm animate-pulse">
                                        {conv.unreadCount} BARU
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`text-[10px] truncate ${hasUnread ? "text-emerald-100 font-bold" : "font-medium opacity-80"}`}>
                                    {conv.lastMessage || "Membuka percakapan"}
                                  </span>
                                  {hasUnread && (
                                    <span className="text-[8px] font-extrabold text-emerald-400 uppercase tracking-widest shrink-0">
                                      Belum Dibaca
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}

                          {otherMembers.length > 0 && (
                            <div className="pt-4 pb-2 px-3 border-t border-white/5 mt-4">
                              <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">
                                {language === 'id' ? "Mulai Chat Baru" : "Start New Chat"}
                              </p>
                            </div>
                          )}

                          {otherMembers.map((m) => {
                            const isActive = selectedMemberId === m.id;
                            return (
                              <button
                                key={m.id}
                                onClick={() => setSelectedMemberId(m.id)}
                                className={`w-full p-3.5 rounded-2xl text-left transition-all flex items-center gap-3 border ${
                                  isActive
                                    ? "bg-[#FF5A2C]/10 border-[#FF5A2C]/30 text-white"
                                    : "bg-transparent border-transparent hover:bg-white/[0.03] text-gray-400 hover:text-white"
                                }`}
                              >
                                <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center font-black text-[10px] uppercase border border-white/10 text-gray-400">
                                  {m.nama.substring(0, 2)}
                                </div>
                                <span className="text-xs font-black uppercase truncate">{m.nama}</span>
                              </button>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Right pane: Chat logs */}
                <div className="flex-1 flex flex-col min-h-0 bg-transparent relative">
                  {selectedMemberId ? (
                    <>
                      {/* Sub-header details */}
                      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20 flex-shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#FF5A2C]/15 border border-[#FF5A2C]/20 flex items-center justify-center font-black text-xs text-[#FF5A2C]">
                            {allMembers.find(m => m.id === selectedMemberId)?.nama.substring(0, 2).toUpperCase() || "MB"}
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-wider">
                              {allMembers.find(m => m.id === selectedMemberId)?.nama || "Member"}
                            </h4>
                            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">
                              ID: {selectedMemberId}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Messages list */}
                      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative">
                        {isMemberLoading && memberMessages.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
                            <Loader2 className="h-8 w-8 animate-spin text-[#FF5A2C]" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Memuat pesan...</p>
                          </div>
                        ) : memberMessages.length === 0 ? (
                          <div className="flex-col items-center justify-center h-full text-center space-y-6 flex">
                            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                              <MessageCircle className="h-8 w-8 text-gray-700" />
                            </div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                              {language === 'id' ? "Belum ada percakapan dengan member ini" : "No messages with this member yet"}
                            </p>
                          </div>
                        ) : (
                          <AnimatePresence initial={false}>
                            {memberMessages.map((msg, index) => {
                              const isMe = msg.sender_role === "ADMIN";
                              const showAvatar = index === 0 || memberMessages[index - 1].sender_role !== msg.sender_role;
                              const msgTime = msg.created_at?.toDate
                                ? format(msg.created_at.toDate(), "HH:mm", { locale: language === 'id' ? id : enUS })
                                : "...";

                              return (
                                <motion.div
                                  key={msg.id || index}
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                                >
                                  <div className={`flex gap-3 max-w-[85%] sm:max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                      {showAvatar && !isMe && (
                                        <span className="text-[9px] font-black text-[#FF5A2C] mb-1.5 uppercase tracking-widest">
                                          {msg.sender_name}
                                        </span>
                                      )}
                                      {showAvatar && isMe && (
                                        <span className="text-[9px] font-black text-blue-400 mb-1.5 uppercase tracking-widest">
                                          {msg.sender_name} (Admin)
                                        </span>
                                      )}
                                      <div className={`rounded-2xl shadow-lg overflow-hidden ${
                                        isMe
                                          ? 'bg-gradient-to-br from-[#FF5A2C] to-red-600 text-white rounded-tr-none'
                                          : 'bg-white/5 border border-white/10 text-white rounded-tl-none'
                                      }`}>
                                        {msg.image_url && (
                                          <div className="p-1">
                                            <img
                                              src={msg.image_url}
                                              alt="..."
                                              className="max-w-full sm:max-w-md rounded-xl cursor-pointer no-invert"
                                              onClick={() => window.open(msg.image_url, '_blank')}
                                            />
                                          </div>
                                        )}
                                        {msg.content && (
                                          <div className="px-4 py-2.5 text-[13px] font-bold leading-relaxed whitespace-pre-wrap">
                                            {msg.content}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 mt-1.5 opacity-80">
                                        <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">
                                          {msgTime}
                                        </span>
                                        {isMe && (
                                          <span className="inline-flex items-center ml-0.5 select-none font-bold" title={msg.is_read ? "Dibaca oleh member" : "Terkirim"}>
                                            {msg.is_read ? (
                                              <span className="text-sky-300 font-black text-[11px] tracking-[-2px] leading-none">âœ“âœ“</span>
                                            ) : (
                                              <span className="text-white/60 font-black text-[11px] leading-none">âœ“</span>
                                            )}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        )}

                        {/* Member Typing Indicator in Admin Chat */}
                        {isMemberTyping && (
                          <div className="flex justify-start">
                            <div className="flex flex-col items-start max-w-[85%] sm:max-w-[70%]">
                              <div className="px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-white rounded-tl-none shadow-md flex items-center gap-2">
                                <span className="text-[11px] font-medium text-gray-300">
                                  {allMembers.find(m => m.id === selectedMemberId)?.nama || "Member"} sedang mengetik
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 bg-[#FF5A2C] rounded-full animate-bounce [animation-delay:-0.3s]" />
                                  <span className="w-1.5 h-1.5 bg-[#FF5A2C] rounded-full animate-bounce [animation-delay:-0.15s]" />
                                  <span className="w-1.5 h-1.5 bg-[#FF5A2C] rounded-full animate-bounce" />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-6">
                      <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center">
                        <MessageCircle className="h-10 w-10 text-gray-700" />
                      </div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tight">
                        {language === 'id' ? "Pilih Member" : "Select a Member"}
                      </h3>
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-wider max-w-xs leading-relaxed">
                        {language === 'id'
                          ? "Silakan pilih salah satu member dari daftar di sebelah kiri untuk melihat percakapan atau mulai mengirim pesan."
                          : "Please select a member from the list on the left to view their chat log or start messaging."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Input area at bottom of card */}
            {(!(activeChatMode === "member" && !selectedMemberId)) && (
              <div className="p-4 sm:p-8 bg-black/5 border-t border-white/5 pb-[safe-area-inset-bottom] relative">
                <AnimatePresence>
                  {activeChatMode === "internal" && ((showTagSuggestions && filteredTags.length > 0) || (showMemberSuggestions && filteredMembers.length > 0)) ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-full left-4 sm:left-8 mb-4 w-64 glass-dark border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[100]"
                    >
                      <div className="p-3 border-b border-white/5 bg-white/5 text-left">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                          {showTagSuggestions ? "Tag Application Feature" : "Mention Member"}
                        </p>
                      </div>
                      <div className="max-h-48 overflow-y-auto custom-scrollbar">
                        {showTagSuggestions ? filteredTags.map((tag) => (
                          <button
                            key={tag.label}
                            onClick={() => applyTag(tag)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FF5A2C]/10 text-left transition-all group"
                          >
                            <span className="text-lg group-hover:scale-125 transition-transform">{tag.icon}</span>
                            <span className="text-xs font-black text-foreground uppercase tracking-tight">{tag.label}</span>
                          </button>
                        )) : filteredMembers.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => applyMemberTag(m)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-500/10 text-left transition-all group"
                          >
                            <span className="text-lg group-hover:scale-125 transition-transform">ðŸ‘¤</span>
                            <div className="flex flex-col text-left">
                              <span className="text-xs font-black text-foreground uppercase tracking-tight">{m.nama}</span>
                              <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Member</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {previewUrl && (
                  <div className="mb-4 sm:mb-6 relative inline-block text-left">
                    <div className="relative rounded-3xl overflow-hidden border-2 border-[#FF5A2C]/30 shadow-2xl">
                      <img src={previewUrl} alt="..." className="h-32 sm:h-40 w-auto object-cover no-invert" />
                      <button onClick={() => { setSelectedFile(null); setPreviewUrl(""); }} className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full"><X className="h-4 w-4" /></button>
                      {isUploading && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="h-8 w-8 text-white animate-spin" /></div>}
                    </div>
                  </div>
                )}
                <form onSubmit={handleSendMessage} className="flex items-center gap-2 sm:gap-4">
                  <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setSelectedFile(file); const r = new FileReader(); r.onloadend = () => setPreviewUrl(r.result as string); r.readAsDataURL(file); } }} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 sm:p-4 rounded-2xl glass-dark text-gray-400 border border-white/10 flex-shrink-0"><Paperclip className="h-5 w-5" /></button>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder={
                      activeChatMode === "member"
                        ? (language === 'id' ? "Tulis pesan ke member..." : "Write message to member...")
                        : (language === 'id' ? "Tulis pesan atau ketik # untuk tag..." : "Write message or type # to tag...")
                    }
                    className="flex-1 bg-black/20 border border-white/10 rounded-2xl sm:rounded-3xl px-4 sm:px-8 py-3 sm:py-4 text-sm text-foreground focus:outline-none focus:border-[#FF5A2C]/50 font-bold min-w-0"
                  />
                  <button type="submit" disabled={(!newMessage.trim() && !selectedFile) || isSending || isUploading} className="bg-gradient-to-br from-[#FF5A2C] to-red-600 text-white p-3 sm:p-4 rounded-2xl shadow-xl shadow-orange-500/20 active:scale-95 disabled:opacity-50 flex-shrink-0">
                    {isSending || isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </button>
                </form>
              </div>
            )}
          </div>
        </main>
      </div>
      <DeleteConfirmModal 
        isOpen={deleteMsgModal.isOpen}
        onClose={() => setDeleteMsgModal({ isOpen: false, msg: null, type: 'soft' })}
        onConfirm={confirmDeleteMessage}
        title={language === 'id' ? "Hapus Pesan" : "Delete Message"}
        message={deleteMsgModal.type === 'hard' 
          ? (language === 'id' ? "Hapus pesan ini secara permanen?" : "Delete this message permanently?")
          : (language === 'id' 
              ? "Pesan sudah lama. Ganti isi pesan menjadi 'Pesan telah dihapus'?" 
              : "Message is old. Replace content with 'Message deleted'?")}
      />

      <DeleteConfirmModal 
        isOpen={clearHistoryModalOpen}
        onClose={() => setClearHistoryModalOpen(false)}
        onConfirm={confirmClearHistory}
        title={language === 'id' ? "KOSONGKAN CHAT" : "CLEAR HISTORY"}
        message={language === 'id' 
          ? "Seluruh riwayat obrolan tim akan dihapus permanen. Lanjutkan?" 
          : "All team chat history will be permanently erased. Proceed?"}
        confirmText={language === 'id' ? "Ya, Kosongkan" : "Yes, Clear"}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FF5A2C] border-t-transparent" /></div>}>
      <ChatContent />
    </Suspense>
  );
}
