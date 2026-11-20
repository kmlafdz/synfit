import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { Wifi } from 'lucide-react';
import { useLanguage } from '@/store/useLanguageStore';
import { useUIStore } from '@/store/useUIStore';

interface DigitalCardProps {
  memberId: string;
  name: string;
  status: string;
  qrToken: string;
  expiredAt: string;
  startDate?: string;
  tier?: string;
  isDark?: boolean;
}

export function DigitalCard({
  memberId,
  name,
  status,
  qrToken,
  expiredAt,
  startDate,
  tier,
  isDark: propIsDark,
}: DigitalCardProps) {
  const { language } = useLanguage();
  const { memberTheme } = useUIStore();
  const isDark = propIsDark !== undefined ? propIsDark : memberTheme === "dark";
  const isExpired = status === "Expired";

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 100 }}
      className="w-full max-w-sm mx-auto group select-none"
    >
      <div
        id="digital-card-export"
        className={`relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden transition-all duration-300 border ${
          isDark
            ? "bg-gradient-to-br from-[#0B0F17] via-[#111726] to-[#0A0D14] border-blue-500/30 shadow-[0_20px_45px_-12px_rgba(0,0,0,0.85)]"
            : "bg-gradient-to-br from-[#FFFFFF] via-[#F1F5F9] to-[#E2E8F0] border-blue-500/25 shadow-[0_16px_36px_-10px_rgba(37,99,235,0.18)]"
        }`}
      >
        {/* Subtle Ambient Flares & High-Tech Mesh */}
        <div
          className={`absolute -right-16 -top-16 w-52 h-52 rounded-full blur-3xl pointer-events-none transition-opacity ${
            isDark ? "bg-blue-600/25 opacity-70" : "bg-blue-400/15 opacity-60"
          }`}
        />
        <div
          className={`absolute -left-12 -bottom-12 w-48 h-48 rounded-full blur-2xl pointer-events-none transition-opacity ${
            isDark ? "bg-cyan-500/15 opacity-50" : "bg-indigo-300/20 opacity-50"
          }`}
        />
        <div
          className={`absolute inset-0 [background-size:16px_16px] pointer-events-none ${
            isDark
              ? "opacity-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)]"
              : "opacity-5 bg-[radial-gradient(#1e3a8a_1px,transparent_1px)]"
          }`}
        />

        <div className="relative z-20 h-full p-5 sm:p-6 flex flex-col justify-between">
          {/* Top Row: Brand & Chip / NFC */}
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-3">
              <div
                className={`w-10 h-10 rounded-xl overflow-hidden p-1 flex items-center justify-center border shadow-sm ${
                  isDark ? "bg-white/10 border-white/15" : "bg-white border-blue-200"
                }`}
              >
                <img src="/logo.png" alt="SynFit" className="w-full h-full object-contain no-invert" />
              </div>
              <div className="text-left">
                <h3 className={`font-black text-lg tracking-tight leading-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                  SynFit
                </h3>
                <p className={`text-[9px] font-black tracking-[0.2em] uppercase whitespace-nowrap ${
                  isDark ? "text-blue-400" : "text-blue-600"
                }`}>
                  {tier || (language === "id" ? "VIP PLATINUM" : "VIP PLATINUM")}
                </p>
              </div>
            </div>

            {/* EMV Metallic Chip & NFC Icon */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-6 rounded-sm bg-gradient-to-tr from-[#99794d] via-[#f3d9aa] to-[#a38053] p-1 flex flex-col justify-between shadow-sm border border-amber-300/40">
                <div className="w-full h-[1px] bg-black/40" />
                <div className="w-full h-[1px] bg-black/40" />
              </div>
              <Wifi className={`h-5 w-5 rotate-90 ${isDark ? "text-blue-400/80" : "text-blue-600/80"}`} />
            </div>
          </div>

          {/* Member Name */}
          <div className="text-left mt-1">
            <p className={`text-[9px] font-semibold uppercase tracking-widest mb-0.5 ${
              isDark ? "text-gray-400" : "text-gray-500"
            }`}>
              {language === "id" ? "NAMA ANGGOTA" : "MEMBER NAME"}
            </p>
            <p className={`text-base sm:text-lg font-black tracking-wide uppercase leading-tight truncate ${
              isDark ? "text-white" : "text-gray-900"
            }`}>
              {name}
            </p>
            <p className={`text-[10px] font-mono tracking-wider mt-0.5 font-bold ${
              isDark ? "text-blue-400" : "text-blue-600"
            }`}>
              ID: {memberId}
            </p>
          </div>

          {/* Bottom Row: Validity & Turnstile Dynamic QR */}
          <div className={`flex items-end justify-between gap-3 pt-1 border-t ${
            isDark ? "border-white/10" : "border-gray-200"
          }`}>
            <div className="text-left space-y-0.5">
              <p className={`text-[8px] font-semibold uppercase tracking-widest ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}>
                {language === "id" ? "MASA BERLAKU" : "VALID THRU"}
              </p>
              <p
                className={`font-mono text-xs font-bold ${
                  isExpired
                    ? "text-red-500"
                    : isDark
                    ? "text-gray-200 tracking-wider"
                    : "text-gray-900 tracking-wider"
                }`}
              >
                {isExpired ? "EXPIRED" : expiredAt}
              </p>
              {startDate && (
                <p className={`text-[8px] font-medium ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  {language === "id" ? `Mulai: ${startDate}` : `Joined: ${startDate}`}
                </p>
              )}
            </div>

            <div className="relative p-1.5 bg-white rounded-xl shadow-md shrink-0 border border-gray-100">
              {!isExpired ? (
                <QRCodeSVG value={qrToken} size={64} level="H" className="rounded-md" />
              ) : (
                <div className="w-[64px] h-[64px] bg-gray-200 rounded-md flex items-center justify-center">
                  <span className="text-[9px] font-black text-red-500 rotate-[-45deg] tracking-wider">INVALID</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
