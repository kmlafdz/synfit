import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalizes any Indonesian phone input to start with +62 (e.g. +6281234567890)
 */
export function formatPhoneWithPlus62(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = "62" + digits.substring(1);
  } else if (!digits.startsWith("62")) {
    digits = "62" + digits;
  }
  return `+${digits}`;
}

/**
 * Normalizes phone number into digits-only starting with 62 (ideal for wa.me links, e.g. 6281234567890)
 */
export function getCleanWaPhone(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = "62" + digits.substring(1);
  } else if (!digits.startsWith("62")) {
    digits = "62" + digits;
  }
  return digits;
}

/**
 * Formats a phone number for clear UI display with +62 and spaces (e.g. +62 812-3456-7890)
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return "-";
  const withPlus = formatPhoneWithPlus62(phone);
  const raw = withPlus.replace("+62", "");
  if (raw.length <= 3) return withPlus;
  if (raw.length <= 7) return `+62 ${raw.slice(0, 3)}-${raw.slice(3)}`;
  return `+62 ${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7)}`;
}

