"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { motion, AnimatePresence } from "framer-motion";
import {
  Newspaper,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  Video,
  FileText,
  Flame,
  Search,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
  Loader2,
  X,
} from "lucide-react";

const YoutubeIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useLanguageStore } from "@/store/useLanguageStore";
import { useUIStore } from "@/store/useUIStore";
import { MadingPost, MadingPlatform, DEFAULT_MADING_POSTS } from "@/types/mading";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminMadingPage() {
  const { language } = useLanguageStore();
  const { adminTheme } = useUIStore();
  const isDark = adminTheme === "dark";

  const [posts, setPosts] = useState<MadingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("all");

  // Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<MadingPost | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingThumb, setIsUploadingThumb] = useState(false);

  // Form Fields
  const [formTitle, setFormTitle] = useState("");
  const [formPlatform, setFormPlatform] = useState<MadingPlatform>("youtube");
  const [formUrl, setFormUrl] = useState("");
  const [formThumbnail, setFormThumbnail] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAuthor, setFormAuthor] = useState("");
  const [formDuration, setFormDuration] = useState("");
  const [formFeatured, setFormFeatured] = useState(false);

  // Subscribe to Firestore collection "mading_posts"
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "mading_posts"), orderBy("publishedAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: MadingPost[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              title: data.title || "",
              platform: data.platform || "article",
              url: data.url || "",
              thumbnailUrl: data.thumbnailUrl || "/landing/facility_cardio.jpg",
              description: data.description || "",
              author: data.author || "",
              durationOrReadTime: data.durationOrReadTime || "",
              featured: Boolean(data.featured),
              publishedAt: data.publishedAt || new Date().toISOString(),
              order: data.order || 0,
            });
          });
          setPosts(list);
        } else {
          // Initialize with default posts if collection is completely empty
          setPosts(DEFAULT_MADING_POSTS);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching mading posts:", error);
        setPosts(DEFAULT_MADING_POSTS);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleOpenAddModal = () => {
    setEditingPost(null);
    setFormTitle("");
    setFormPlatform("youtube");
    setFormUrl("");
    setFormThumbnail("/landing/hero_strength.jpg");
    setFormDescription("");
    setFormAuthor("SynFit Editorial");
    setFormDuration("5:00 min");
    setFormFeatured(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (post: MadingPost) => {
    setEditingPost(post);
    setFormTitle(post.title);
    setFormPlatform(post.platform);
    setFormUrl(post.url);
    setFormThumbnail(post.thumbnailUrl);
    setFormDescription(post.description || "");
    setFormAuthor(post.author || "SynFit Editorial");
    setFormDuration(post.durationOrReadTime || "");
    setFormFeatured(Boolean(post.featured));
    setIsModalOpen(true);
  };

  // Auto-generate YouTube thumbnail if valid URL is entered
  const handleUrlChange = (newUrl: string) => {
    setFormUrl(newUrl);
    if (formPlatform === "youtube" && !formThumbnail.includes("res.cloudinary.com")) {
      const match = newUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
      if (match && match[1]) {
        setFormThumbnail(`https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`);
      }
    }
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingThumb(true);
    try {
      const secureUrl = await uploadToCloudinary(file);
      if (secureUrl) {
        setFormThumbnail(secureUrl);
        toast.success(language === "id" ? "Thumbnail berhasil diunggah!" : "Thumbnail uploaded successfully!");
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(language === "id" ? "Gagal mengunggah gambar" : "Failed to upload image");
    } finally {
      setIsUploadingThumb(false);
    }
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.warning(language === "id" ? "Judul konten wajib diisi." : "Content title is required.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: formTitle.trim(),
        platform: formPlatform,
        url: formUrl.trim() || "#",
        thumbnailUrl: formThumbnail.trim() || "/landing/facility_cardio.jpg",
        description: formDescription.trim(),
        author: formAuthor.trim() || "SynFit Editorial",
        durationOrReadTime: formDuration.trim() || "3 min",
        featured: formFeatured,
        publishedAt: editingPost?.publishedAt || new Date().toISOString(),
        updatedAt: serverTimestamp(),
      };

      if (editingPost) {
        await updateDoc(doc(db, "mading_posts", editingPost.id), payload);
        toast.success(language === "id" ? "Konten mading berhasil diperbarui!" : "Post updated successfully!");
      } else {
        await addDoc(collection(db, "mading_posts"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success(language === "id" ? "Konten baru berhasil ditambahkan ke mading!" : "New post added to bulletin board!");
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error("Save mading error:", err);
      toast.error(language === "id" ? "Gagal menyimpan konten." : "Failed to save post.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePost = async (post: MadingPost) => {
    if (!confirm(language === "id" ? `Hapus konten "${post.title}"?` : `Delete post "${post.title}"?`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, "mading_posts", post.id));
      toast.success(language === "id" ? "Konten berhasil dihapus." : "Post deleted.");
    } catch (err) {
      console.error("Delete mading error:", err);
      toast.error(language === "id" ? "Gagal menghapus konten." : "Failed to delete post.");
    }
  };

  const getPlatformIcon = (platform: MadingPlatform) => {
    switch (platform) {
      case "youtube":
        return <YoutubeIcon className="h-4 w-4 text-red-500" />;
      case "tiktok":
        return <Video className="h-4 w-4 text-cyan-400" />;
      case "blog":
        return <FileText className="h-4 w-4 text-blue-400" />;
      case "instagram":
        return <Flame className="h-4 w-4 text-pink-500" />;
      default:
        return <Newspaper className="h-4 w-4 text-amber-400" />;
    }
  };

  const filteredPosts = posts.filter((p) => {
    const matchFilter = selectedFilter === "all" || p.platform === selectedFilter;
    const matchSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.author && p.author.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchFilter && matchSearch;
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Top Title & CTA Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-950/20">
                  <Newspaper className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {language === "id" ? "Kelola Mading & Media Edukasi" : "Bulletin Board & Media Management"}
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    {language === "id"
                      ? "Publikasikan konten YouTube, TikTok, dan Blog ke beranda utama member secara realtime"
                      : "Publish YouTube, TikTok, and Blog posts directly to member homepage"}
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleOpenAddModal}
              className="bg-gradient-to-r from-orange-600 to-[#FF5A2C] hover:from-orange-500 hover:to-[#FF5A2C] text-white font-bold text-xs shadow-lg shadow-orange-950/30 flex items-center gap-2 rounded-xl h-11 px-5"
            >
              <Plus className="h-4 w-4" />
              <span>{language === "id" ? "Tambah Konten Mading" : "Add New Post"}</span>
            </Button>
          </div>

          {/* Filter Bar & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-card border border-border">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder={language === "id" ? "Cari judul konten, penulis..." : "Search content..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-background/50 border-border text-xs"
              />
            </div>

            {/* Platform Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(["all", "youtube", "tiktok", "blog", "article"] as const).map((plat) => (
                <button
                  key={plat}
                  onClick={() => setSelectedFilter(plat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all capitalize whitespace-nowrap ${
                    selectedFilter === plat
                      ? "bg-blue-600 text-white shadow"
                      : "bg-background/60 hover:bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {plat === "all" ? (language === "id" ? "Semua" : "All") : plat}
                </button>
              ))}
            </div>
          </div>

          {/* Posts Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 text-center space-y-3">
              <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
              <p className="text-xs text-muted-foreground">Memuat data mading...</p>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card/40 space-y-3">
              <Newspaper className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
              <p className="text-sm font-bold text-foreground">
                {language === "id" ? "Belum ada konten mading." : "No posts found."}
              </p>
              <Button onClick={handleOpenAddModal} variant="outline" size="sm" className="rounded-xl">
                Tambah Konten Pertama
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className="rounded-2xl border border-border bg-card overflow-hidden shadow-lg flex flex-col justify-between group hover:border-orange-500/40 transition-all duration-300"
                >
                  {/* Thumbnail Preview */}
                  <div className="relative h-48 w-full bg-black overflow-hidden">
                    <img
                      src={post.thumbnailUrl}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Platform Badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-white text-[11px] font-bold">
                      {getPlatformIcon(post.platform)}
                      <span className="capitalize">{post.platform}</span>
                    </div>

                    {/* Duration / Read Time Badge */}
                    {post.durationOrReadTime && (
                      <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] text-gray-300 font-mono">
                        {post.durationOrReadTime}
                      </div>
                    )}

                    {/* Action Link button */}
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-3 right-3 px-2.5 py-1 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1 transition-all"
                    >
                      <span>Buka Link</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  {/* Body Info */}
                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-foreground line-clamp-2 leading-snug">
                        {post.title}
                      </h3>
                      {post.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5 leading-relaxed">
                          {post.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                      <span className="truncate max-w-[150px] font-medium">{post.author}</span>
                      <span className="text-[10px]">
                        {new Date(post.publishedAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="px-4 py-3 bg-muted/30 border-t border-border flex items-center justify-between gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEditModal(post)}
                      className="h-8 rounded-lg text-xs font-bold text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 flex items-center gap-1.5"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePost(post)}
                      className="h-8 rounded-lg text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Hapus</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal Form Tambah/Ubah */}
          <AnimatePresence>
            {isModalOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
                onClick={() => setIsModalOpen(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 20 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-lg rounded-3xl bg-card border border-border shadow-2xl overflow-hidden my-auto"
                >
                  {/* Modal Header */}
                  <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Newspaper className="h-5 w-5 text-orange-500" />
                      <h3 className="font-black text-base text-foreground">
                        {editingPost ? "Edit Konten Mading" : "Tambah Konten Mading Baru"}
                      </h3>
                    </div>
                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Modal Form */}
                  <form onSubmit={handleSavePost} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                    {/* Platform Picker */}
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase block mb-1.5">
                        Platform Konten
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {(["youtube", "tiktok", "blog", "article"] as const).map((plat) => (
                          <button
                            type="button"
                            key={plat}
                            onClick={() => setFormPlatform(plat)}
                            className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-bold transition-all ${
                              formPlatform === plat
                                ? "bg-orange-600/15 border-orange-500 text-orange-400"
                                : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {getPlatformIcon(plat)}
                            <span className="capitalize">{plat}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Judul Konten */}
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                        Judul Konten <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="text"
                        placeholder="Contoh: Cara Menghitung Kalori & Protein..."
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        required
                        className="rounded-xl h-11 text-xs"
                      />
                    </div>

                    {/* URL Target */}
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                        Link URL Konten (YouTube/TikTok/Blog)
                      </label>
                      <Input
                        type="url"
                        placeholder="https://..."
                        value={formUrl}
                        onChange={(e) => handleUrlChange(e.target.value)}
                        className="rounded-xl h-11 text-xs"
                      />
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">
                        Tip: Jika link YouTube dimasukkan, thumbnail akan otomatis terdeteksi!
                      </span>
                    </div>

                    {/* Thumbnail Preview & URL */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase block">
                        Thumbnail Banner Konten
                      </label>
                      <div className="flex items-center gap-3">
                        <div className="relative w-28 h-20 rounded-xl overflow-hidden bg-black border border-border shrink-0">
                          {formThumbnail ? (
                            <img src={formThumbnail} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                              No Image
                            </div>
                          )}
                          {isUploadingThumb && (
                            <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-white">
                              <Loader2 className="h-5 w-5 animate-spin" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 space-y-1.5">
                          <Input
                            type="text"
                            placeholder="URL Gambar Thumbnail..."
                            value={formThumbnail}
                            onChange={(e) => setFormThumbnail(e.target.value)}
                            className="rounded-xl h-9 text-xs"
                          />
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-bold cursor-pointer border border-border">
                            <Upload className="h-3.5 w-3.5" />
                            <span>Unggah Foto</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleThumbnailUpload}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Deskripsi Singkat */}
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                        Deskripsi Singkat / Catatan Edukasi
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Tuliskan rangkuman isi video atau tips singkat..."
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        className="w-full rounded-xl p-3 bg-background border border-border text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                      />
                    </div>

                    {/* Author & Duration */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                          Penulis / Akun
                        </label>
                        <Input
                          type="text"
                          placeholder="Contoh: @synfit.gym"
                          value={formAuthor}
                          onChange={(e) => setFormAuthor(e.target.value)}
                          className="rounded-xl h-10 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                          Durasi / Estimasi Baca
                        </label>
                        <Input
                          type="text"
                          placeholder="Contoh: 5:30 min / 3 mnt"
                          value={formDuration}
                          onChange={(e) => setFormDuration(e.target.value)}
                          className="rounded-xl h-10 text-xs"
                        />
                      </div>
                    </div>

                    {/* Action Submit */}
                    <div className="pt-4 border-t border-border flex items-center justify-end gap-2.5">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsModalOpen(false)}
                        className="rounded-xl h-11 px-5"
                      >
                        Batal
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSaving}
                        className="bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl h-11 px-6 shadow-lg shadow-orange-950/20"
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                        <span>{editingPost ? "Simpan Perubahan" : "Publikasikan ke Mading"}</span>
                      </Button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
