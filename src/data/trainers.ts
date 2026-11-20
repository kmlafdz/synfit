export interface Trainer {
  id: string;
  name: string;
  gender: "female" | "male";
  title: string;
  specialization: string[];
  experienceYears: number;
  rating: number;
  reviewCount: number;
  pricePerSession: number; // in IDR
  packagePrice5Sessions?: number;
  packagePrice10Sessions?: number;
  bio: string;
  certifications: string[];
  image: string;
  scheduleAvailable: string;
  instagram?: string;
}

export const SYN_TRAINERS: Trainer[] = [
  {
    id: "trainer-cathleen",
    name: "Cathleen",
    gender: "female",
    title: "Senior Elite Trainer & Hypertrophy Coach",
    specialization: ["Body Sculpting", "Fat Loss", "Posture Correction", "Glute & Core"],
    experienceYears: 6,
    rating: 4.9,
    reviewCount: 142,
    pricePerSession: 175000,
    packagePrice5Sessions: 800000,
    packagePrice10Sessions: 1500000,
    bio: "Berfokus pada transformasi bentuk tubuh wanita (sculpting), penurunan persentase lemak, dan pembentukan pola makan berkelanjutan dengan teknik angkat beban yang aman.",
    certifications: ["NASM Certified Personal Trainer (CPT)", "ISSN Sports Nutrition Specialist"],
    image: "/trainers/cathleen.jpg",
    scheduleAvailable: "Senin - Sabtu (08:00 - 17:00)",
    instagram: "@cathleen.fitness",
  },
  {
    id: "trainer-xiao-lian",
    name: "Xiao Lian",
    gender: "female",
    title: "Functional & Mobility Specialist",
    specialization: ["Functional Training", "Pilates & Core", "HIIT Cardio", "Endurance"],
    experienceYears: 5,
    rating: 4.9,
    reviewCount: 98,
    pricePerSession: 160000,
    packagePrice5Sessions: 750000,
    packagePrice10Sessions: 1400000,
    bio: "Spesialis kekuatan fungsional, kelenturan sendi, dan kardio intensitas tinggi yang membentuk tubuh atletis, ramping, serta lincah tanpa rasa pegal berlebihan.",
    certifications: ["ACE Functional Training Certified", "Mat Pilates Level 2"],
    image: "/trainers/xiao_lian.jpg",
    scheduleAvailable: "Selasa - Minggu (07:00 - 15:00)",
    instagram: "@xiaolian_coach",
  },
  {
    id: "trainer-john",
    name: "John",
    gender: "male",
    title: "Master Strength & Bodybuilding Coach",
    specialization: ["Powerlifting", "Muscle Mass Bulking", "Strength & Conditioning", "Form Technique"],
    experienceYears: 8,
    rating: 5.0,
    reviewCount: 215,
    pricePerSession: 200000,
    packagePrice5Sessions: 900000,
    packagePrice10Sessions: 1700000,
    bio: "Coach John telah membimbing ratusan member mencapai peningkatan kekuatan PR (Personal Record), pembesaran massa otot bersih, serta teknik compound lift yang sempurna.",
    certifications: ["CSCS (Certified Strength and Conditioning Specialist)", "IPF Level 1 Coach"],
    image: "/trainers/john.jpg",
    scheduleAvailable: "Setiap Hari (13:00 - 21:00)",
    instagram: "@john_gympro",
  },
  {
    id: "trainer-budi",
    name: "Budi",
    gender: "male",
    title: "Lifestyle Transformation & Weight Loss Coach",
    specialization: ["Weight Management", "Beginner Friendly", "Agility & Cardio", "Circuit Training"],
    experienceYears: 5,
    rating: 4.8,
    reviewCount: 164,
    pricePerSession: 150000,
    packagePrice5Sessions: 700000,
    packagePrice10Sessions: 1300000,
    bio: "Pendekatan latihan yang ramah dan suportif, sangat cocok untuk pemula yang baru pertama kali memulai gym agar tetap konsisten dan menikmati setiap sesi latihan.",
    certifications: ["APKI Certified Fitness Trainer", "CPR & First Aid Certified"],
    image: "/trainers/budi.jpg",
    scheduleAvailable: "Senin - Sabtu (06:00 - 14:00)",
    instagram: "@coach_budi_fitness",
  },
  {
    id: "trainer-frank",
    name: "Frank",
    gender: "male",
    title: "Veteran Bodybuilding & Post-Rehab Specialist",
    specialization: ["Longevity Training", "Hypertrophy", "Joint Health", "Powerbuilding"],
    experienceYears: 15,
    rating: 5.0,
    reviewCount: 320,
    pricePerSession: 225000,
    packagePrice5Sessions: 1050000,
    packagePrice10Sessions: 1950000,
    bio: "Dengan pengalaman lebih dari 15 tahun di dunia kebugaran dan binaraga, Coach Frank mengajarkan biomekanika angkat beban presisi tinggi yang melindungi sendi untuk jangka panjang.",
    certifications: ["IFBB Certified Trainer", "Corrective Exercise Specialist (CES)"],
    image: "/trainers/frank.jpg",
    scheduleAvailable: "Senin - Jumat (10:00 - 19:00)",
    instagram: "@frank_physique",
  },
];
