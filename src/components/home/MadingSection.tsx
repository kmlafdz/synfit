"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  FileText,
  ExternalLink,
  Sparkles,
  Clock,
  Play,
  Share2,
  Newspaper,
  Flame,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { MadingPost, DEFAULT_MADING_POSTS, MadingPlatform } from "@/types/mading";

const YoutubeIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

interface MadingSectionProps {
  isDark: boolean;
  language: "id" | "en";
}

export function MadingSection({ isDark, language }: MadingSectionProps) {
  const [posts, setPosts] = useState<MadingPost[]>(DEFAULT_MADING_POSTS);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [selectedPost, setSelectedPost] = useState<MadingPost | null>(null);

  // Real-time synchronization from Firestore collection "mading_posts"
  useEffect(() => {
    try {
      const q = query(collection(db, "mading_posts"), orderBy("publishedAt", "desc"));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const fetched: MadingPost[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              fetched.push({
                id: doc.id,
                title: data.title || "Konten Tanpa Judul",
                platform: data.platform || "article",
                url: data.url || "#",
                thumbnailUrl: data.thumbnailUrl || "/landing/facility_cardio.jpg",
                description: data.description || "",
                author: data.author || "SynFit Editorial",
                durationOrReadTime: data.durationOrReadTime || "3 mnt",
                featured: Boolean(data.featured),
                publishedAt: data.publishedAt || new Date().toISOString(),
                order: data.order || 0,
              });
            });
            // Merge with defaults if few
            setPosts(fetched);
          } else {
            setPosts(DEFAULT_MADING_POSTS);
          }
        },
        (error) => {
          console.warn("Mading listener notice, using default posts:", error);
          setPosts(DEFAULT_MADING_POSTS);
        }
      );
      return () => unsubscribe();
    } catch (err) {
      console.warn("Mading init notice:", err);
      setPosts(DEFAULT_MADING_POSTS);
    }
  }, []);

  const filteredPosts = posts.filter((p) => {
    if (selectedFilter === "all") return true;
    return p.platform === selectedFilter;
  });

  const getPlatformBadge = (platform: MadingPlatform) => {
    switch (platform) {
      case "youtube":
        return {
          icon: <YoutubeIcon className="h-3.5 w-3.5 text-red-500" />,
          label: "YouTube",
          bg: "bg-red-500/15 border-red-500/30 text-red-400",
        };
      case "tiktok":
        return {
          icon: <Video className="h-3.5 w-3.5 text-cyan-400" />,
          label: "TikTok",
          bg: "bg-cyan-500/15 border-cyan-500/30 text-cyan-400",
        };
      case "blog":
        return {
          icon: <FileText className="h-3.5 w-3.5 text-blue-400" />,
          label: "Blog",
          bg: "bg-blue-500/15 border-blue-500/30 text-blue-400",
        };
      case "instagram":
        return {
          icon: <Flame className="h-3.5 w-3.5 text-pink-400" />,
          label: "Instagram",
          bg: "bg-pink-500/15 border-pink-500/30 text-pink-400",
        };
      default:
        return {
          icon: <Newspaper className="h-3.5 w-3.5 text-amber-400" />,
          label: "Artikel",
          bg: "bg-amber-500/15 border-amber-500/30 text-amber-400",
        };
    }
  };

  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const hasDragged = useRef(false);

  const handleCardTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      hasDragged.current = false;
    }
  };

  const handleCardTouchMove = (e: React.TouchEvent) => {
    if (touchStartPos.current && e.touches.length === 1) {
      const diffX = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
      const diffY = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
      if (diffX > 8 || diffY > 8) {
        hasDragged.current = true;
      }
    }
  };

  const handleCardTouchEnd = () => {
    touchStartPos.current = null;
  };

  const handleOpenLink = (url: string) => {
    if (hasDragged.current) return;
    if (url && url !== "#") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      data-no-swipe="true"
      className="space-y-3 pt-2"
    >
      {/* Header and Platform Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className={`text-sm font-black ${isDark ? "text-white" : "text-gray-900"}`}>
              {language === "id" ? "Mading SynFit & Konten Edukasi" : "SynFit Bulletin Board & Media"}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Live Updates
            </span>
          </div>
          <p className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            {language === "id"
              ? "Kumpulan video YouTube, tips TikTok, artikel blog & panduan kebugaran harian"
              : "Curated YouTube videos, TikTok tips, blogs & fitness transformation articles"}
          </p>
        </div>

        {/* Filter Pills */}
        <div
          data-no-swipe="true"
          className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto no-scrollbar p-0.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold"
        >
          <button
            onClick={() => setSelectedFilter("all")}
            className={`px-2.5 py-1 rounded-lg transition-all shrink-0 ${
              selectedFilter === "all"
                ? "bg-blue-600 text-white shadow"
                : isDark
                ? "text-gray-400 hover:text-white"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setSelectedFilter("youtube")}
            className={`px-2.5 py-1 rounded-lg transition-all shrink-0 flex items-center gap-1 ${
              selectedFilter === "youtube"
                ? "bg-red-600 text-white shadow"
                : isDark
                ? "text-gray-400 hover:text-white"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <YoutubeIcon className="h-3 w-3" />
            <span>YouTube</span>
          </button>
          <button
            onClick={() => setSelectedFilter("tiktok")}
            className={`px-2.5 py-1 rounded-lg transition-all shrink-0 flex items-center gap-1 ${
              selectedFilter === "tiktok"
                ? "bg-cyan-600 text-white shadow"
                : isDark
                ? "text-gray-400 hover:text-white"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Video className="h-3 w-3" />
            <span>TikTok</span>
          </button>
          <button
            onClick={() => setSelectedFilter("blog")}
            className={`px-2.5 py-1 rounded-lg transition-all shrink-0 flex items-center gap-1 ${
              selectedFilter === "blog"
                ? "bg-blue-600 text-white shadow"
                : isDark
                ? "text-gray-400 hover:text-white"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <FileText className="h-3 w-3" />
            <span>Blog</span>
          </button>
        </div>
      </div>

      {/* Horizontal Cards Slider */}
      <div
        data-no-swipe="true"
        className="flex gap-3.5 overflow-x-auto no-scrollbar pb-2 pt-1 -mx-4 px-4 sm:mx-0 sm:px-0"
      >
        {filteredPosts.map((post) => {
          const badge = getPlatformBadge(post.platform);
          return (
            <div
              key={post.id}
              onTouchStart={handleCardTouchStart}
              onTouchMove={handleCardTouchMove}
              onTouchEnd={handleCardTouchEnd}
              onClick={() => handleOpenLink(post.url)}
              className="group relative shrink-0 w-64 sm:w-72 rounded-2xl overflow-hidden shadow-lg border border-white/10 cursor-pointer transition-all duration-300 hover:border-blue-500/50 hover:shadow-blue-950/20 active:scale-[0.99] flex flex-col bg-[#121622]"
            >
              {/* Media Thumbnail with Play Overlay */}
              <div className="relative h-40 w-full overflow-hidden bg-black">
                <img
                  src={post.thumbnailUrl}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#121622] via-black/30 to-black/40" />

                {/* Platform Badge Top Left */}
                <div
                  className={`absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-md ${badge.bg}`}
                >
                  {badge.icon}
                  <span>{badge.label}</span>
                </div>

                {/* Duration / Read Time Top Right */}
                {post.durationOrReadTime && (
                  <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-gray-300 text-[10px] font-mono flex items-center gap-1">
                    <Clock className="h-3 w-3 text-yellow-400" />
                    <span>{post.durationOrReadTime}</span>
                  </div>
                )}

                {/* Play Button Indicator for Video Platforms */}
                {(post.platform === "youtube" || post.platform === "tiktok") && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-md border border-white/30 flex items-center justify-center group-hover:scale-110 group-hover:bg-red-600 group-hover:border-red-500 text-white transition-all shadow-xl">
                      <Play className="h-5 w-5 fill-current ml-0.5" />
                    </div>
                  </div>
                )}
              </div>

              {/* Text Information Bottom */}
              <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-black text-white line-clamp-2 group-hover:text-blue-400 transition-colors">
                    {post.title}
                  </h4>
                  {post.description && (
                    <p className="text-[10px] text-gray-400 line-clamp-2 mt-1 leading-relaxed">
                      {post.description}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-gray-400">
                  <span className="truncate max-w-[140px] font-medium text-gray-300">{post.author}</span>
                  <span className="flex items-center gap-1 text-blue-400 font-bold group-hover:underline">
                    <span>Lihat</span>
                    <ExternalLink className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
