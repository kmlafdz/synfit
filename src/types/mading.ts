export type MadingPlatform = "youtube" | "tiktok" | "instagram" | "blog" | "article" | "other";

export interface MadingPost {
  id: string;
  title: string;
  platform: MadingPlatform;
  url: string;
  thumbnailUrl: string;
  description?: string;
  author?: string;
  durationOrReadTime?: string;
  featured?: boolean;
  publishedAt: string; // ISO date or formatted
  order?: number;
}

export const DEFAULT_MADING_POSTS: MadingPost[] = [
  {
    id: "mading-yt-1",
    title: "Teknik Squat yang Benar agar Lutut Tidak Cedera | SynFit Form Guide",
    platform: "youtube",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    thumbnailUrl: "/landing/hero_strength.jpg",
    description: "Pelajari kedalaman squat, posisi lutut, dan pernapasan bracing yang tepat bersama Coach John.",
    author: "SynFit Official Channel",
    durationOrReadTime: "8:25 min",
    featured: true,
    publishedAt: "2026-10-20",
    order: 1,
  },
  {
    id: "mading-tiktok-1",
    title: "3 Gerakan Core Paling Efektif Tanpa Perlu Sit Up Ratusan Kali!",
    platform: "tiktok",
    url: "https://www.tiktok.com/@synfit.gym",
    thumbnailUrl: "/trainers/cathleen.jpg",
    description: "Latihan perut stabilisator bersama Coach Cathleen yang langsung membakar otot oblique & core.",
    author: "@synfit.gym",
    durationOrReadTime: "0:45 min",
    featured: true,
    publishedAt: "2026-10-22",
    order: 2,
  },
  {
    id: "mading-blog-1",
    title: "Panduan Nutrisi Pemula: Cara Menghitung Kalori & Protein Harian",
    platform: "blog",
    url: "https://synfit.com/blog/nutrition-guide",
    thumbnailUrl: "/landing/facility_cardio.jpg",
    description: "Memahami macro harian untuk menurunkan lemak tubuh tanpa kehilangan massa otot berharga.",
    author: "SynFit Health Editorial",
    durationOrReadTime: "4 mnt baca",
    featured: false,
    publishedAt: "2026-10-24",
    order: 3,
  },
  {
    id: "mading-tiktok-2",
    title: "Tips Stretching dan Mobilitas Bahu Sebelum Bench Press Berat",
    platform: "tiktok",
    url: "https://www.tiktok.com/@synfit.gym",
    thumbnailUrl: "/trainers/xiao_lian.jpg",
    description: "Pemanasan rotator cuff bersama Coach Xiao Lian agar sendi bahu siap menopang beban berat.",
    author: "@synfit.gym",
    durationOrReadTime: "0:58 min",
    featured: false,
    publishedAt: "2026-10-25",
    order: 4,
  },
  {
    id: "mading-article-1",
    title: "Kenapa Istirahat Cukup Sangat Krusial untuk Pertumbuhan Otot?",
    platform: "article",
    url: "https://synfit.com/blog/rest-recovery",
    thumbnailUrl: "/landing/facility_locker.jpg",
    description: "Otot tidak tumbuh saat Anda mengangkat beban di gym, melainkan saat Anda tidur dan beristirahat.",
    author: "Coach Frank",
    durationOrReadTime: "5 mnt baca",
    featured: false,
    publishedAt: "2026-10-25",
    order: 5,
  },
];
