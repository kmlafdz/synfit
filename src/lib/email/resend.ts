/**
 * SYNFIT AI — CENTRALIZED RESEND EMAIL SERVICE
 * Server-side transactional email service using official Resend SDK.
 * 
 * SECURITY RULES:
 * - RESEND_API_KEY is read strictly from backend environment variables.
 * - Never expose API keys to frontend or client-side bundles.
 * - Idempotent delivery protection to prevent duplicate sends.
 */

import { Resend } from "resend";

// Server-side environment resolution
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return null;
  }
  return new Resend(apiKey.trim());
};

const getFromEmail = () => {
  return process.env.RESEND_FROM_EMAIL || "SynFit AI <onboarding@resend.dev>";
};

const getAppBaseUrl = () => {
  return process.env.APP_BASE_URL || "https://synfitgym.web.app";
};

// In-memory idempotency cache (keyed by sendKey: timestamp)
const recentSends = new Map<string, number>();
const IDEMPOTENCY_WINDOW_MS = 60 * 1000; // 60 seconds duplicate protection

function isDuplicateSend(idempotencyKey: string): boolean {
  const lastSent = recentSends.get(idempotencyKey);
  const now = Date.now();
  if (lastSent && now - lastSent < IDEMPOTENCY_WINDOW_MS) {
    return true;
  }
  recentSends.set(idempotencyKey, now);
  // Clean up older keys
  if (recentSends.size > 500) {
    for (const [k, v] of recentSends.entries()) {
      if (now - v > IDEMPOTENCY_WINDOW_MS) recentSends.delete(k);
    }
  }
  return false;
}

export interface WelcomeEmailParams {
  toEmail: string;
  memberName: string;
  membershipType?: string;
  expiryDate?: string;
  memberId?: string;
}

export interface MembershipReminderParams {
  toEmail: string;
  memberName: string;
  daysRemaining: number;
  expiryDate: string;
}

export interface WorkoutSummaryEmailParams {
  toEmail: string;
  memberName: string;
  exerciseType: string;
  reps: number;
  accuracy: number;
  durationSeconds: number;
}

/**
 * 1. Welcome Email Template
 */
export function buildWelcomeHtml(params: WelcomeEmailParams): string {
  const baseUrl = getAppBaseUrl();
  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Selamat Datang di SynFit AI</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #050507; color: #FFFFFF; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #0E121B; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #FF5E1E 0%, #E04E25 100%); padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 1px; color: #FFFFFF; text-transform: uppercase; }
    .header p { margin: 6px 0 0; font-size: 13px; color: rgba(255,255,255,0.85); font-weight: 600; }
    .content { padding: 32px 28px; line-height: 1.6; color: #E5E7EB; }
    .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin: 24px 0; }
    .card-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; }
    .card-row:last-child { margin-bottom: 0; }
    .card-label { color: #9CA3AF; font-weight: 500; }
    .card-val { color: #FFFFFF; font-weight: 700; }
    .cta-button { display: inline-block; background-color: #FF5E1E; color: #FFFFFF !important; font-size: 14px; font-weight: 800; text-decoration: none; padding: 14px 28px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; margin: 16px 0; }
    .footer { padding: 24px 28px; border-top: 1px solid rgba(255,255,255,0.06); text-align: center; font-size: 11px; color: #6B7280; }
  </style>
</head>
<body>
  <div style="padding: 24px 12px;">
    <div class="wrapper">
      <div class="header">
        <h1>SYNFIT AI</h1>
        <p>Advanced Athletic Fitness Management</p>
      </div>
      <div class="content">
        <h2 style="color: #FFFFFF; font-size: 18px; margin-top: 0;">Halo, ${params.memberName}! 👋</h2>
        <p>Selamat bergabung dalam ekosistem keanggotaan <strong>SynFit AI</strong>. Akun keanggotaan Anda telah berhasil diverifikasi dan terhubung ke sistem kami.</p>
        
        <div class="card">
          <div style="font-size: 11px; font-weight: 800; color: #FF5E1E; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Informasi Keanggotaan</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="padding: 4px 0; color: #9CA3AF;">Nama Member:</td>
              <td style="padding: 4px 0; color: #FFFFFF; font-weight: bold; text-align: right;">${params.memberName}</td>
            </tr>
            ${params.membershipType ? `
            <tr>
              <td style="padding: 4px 0; color: #9CA3AF;">Paket Membership:</td>
              <td style="padding: 4px 0; color: #FFFFFF; font-weight: bold; text-align: right;">${params.membershipType}</td>
            </tr>` : ""}
            ${params.expiryDate ? `
            <tr>
              <td style="padding: 4px 0; color: #9CA3AF;">Berlaku Hingga:</td>
              <td style="padding: 4px 0; color: #10B981; font-weight: bold; text-align: right;">${params.expiryDate}</td>
            </tr>` : ""}
          </table>
        </div>

        <p>Anda sekarang dapat mengakses Digital Member Card, fitur Absensi GPS, Konsultasi Latihan AI, dan Analisis Gerakan Real-time (AI Form Coach) melalui portal dashboard:</p>

        <div style="text-align: center;">
          <a href="${baseUrl}/member/dashboard" class="cta-button">Buka Dashboard Member</a>
        </div>

        <p style="font-size: 12px; color: #9CA3AF; margin-top: 24px;">Jika Anda memiliki pertanyaan mengenai fasilitas atau jadwal gym, Anda dapat menghubungi staf kami langsung melalui fitur Chat di dalam aplikasi.</p>
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} SynFit AI &bull; Areta Sport Management. Seluruh hak cipta dilindungi.</p>
        <p>Email ini dikirim otomatis sebagai konfirmasi pendaftaran akun Anda.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * 2. Membership Reminder Template
 */
export function buildReminderHtml(params: MembershipReminderParams): string {
  const baseUrl = getAppBaseUrl();
  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pengingat Masa Aktif Membership SynFit</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #050507; color: #FFFFFF; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #0E121B; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 1px; color: #FFFFFF; text-transform: uppercase; }
    .content { padding: 32px 28px; line-height: 1.6; color: #E5E7EB; }
    .card { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25); border-radius: 12px; padding: 20px; margin: 24px 0; }
    .cta-button { display: inline-block; background-color: #F59E0B; color: #042F2E !important; font-size: 14px; font-weight: 800; text-decoration: none; padding: 14px 28px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; }
    .footer { padding: 24px 28px; border-top: 1px solid rgba(255,255,255,0.06); text-align: center; font-size: 11px; color: #6B7280; }
  </style>
</head>
<body>
  <div style="padding: 24px 12px;">
    <div class="wrapper">
      <div class="header">
        <h1>PENGINGAT KEANGGOTAAN</h1>
      </div>
      <div class="content">
        <h2 style="color: #FFFFFF; font-size: 18px; margin-top: 0;">Halo, ${params.memberName}!</h2>
        <p>Masa aktif membership SynFit Anda akan segera berakhir dalam <strong>${params.daysRemaining} hari lagi</strong> (${params.expiryDate}).</p>
        
        <div class="card">
          <p style="margin: 0; font-size: 13px; color: #FDE68A;">
            Pertahankan konsistensi latihan dan progres kebugaran Anda tanpa jeda. Anda dapat memperpanjang paket membership langsung secara online melalui dashboard.
          </p>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${baseUrl}/member/dashboard?tab=membership" class="cta-button">Perpanjang Membership Sekarang</a>
        </div>
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} SynFit AI &bull; Areta Sport Management.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * 3. Workout Summary Template
 */
export function buildWorkoutSummaryHtml(params: WorkoutSummaryEmailParams): string {
  const baseUrl = getAppBaseUrl();
  const minutes = Math.floor(params.durationSeconds / 60);
  const seconds = params.durationSeconds % 60;
  const durationText = `${minutes}m ${seconds}s`;

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ringkasan Sesi Latihan SynFit AI</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #050507; color: #FFFFFF; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #0E121B; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 1px; color: #FFFFFF; text-transform: uppercase; }
    .content { padding: 32px 28px; line-height: 1.6; color: #E5E7EB; }
    .stat-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin: 24px 0; text-align: center; }
    .stat-box { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px 8px; }
    .stat-num { font-size: 20px; font-weight: 900; color: #10B981; }
    .stat-lbl { font-size: 10px; color: #9CA3AF; text-transform: uppercase; margin-top: 4px; }
    .cta-button { display: inline-block; background-color: #10B981; color: #042F2E !important; font-size: 14px; font-weight: 800; text-decoration: none; padding: 14px 28px; border-radius: 9999px; text-transform: uppercase; }
    .footer { padding: 24px 28px; border-top: 1px solid rgba(255,255,255,0.06); text-align: center; font-size: 11px; color: #6B7280; }
  </style>
</head>
<body>
  <div style="padding: 24px 12px;">
    <div class="wrapper">
      <div class="header">
        <h1>RINGKASAN LATIHAN AI</h1>
      </div>
      <div class="content">
        <h2 style="color: #FFFFFF; font-size: 18px; margin-top: 0;">Kerja Bagus, ${params.memberName}! 🔥</h2>
        <p>Berikut ringkasan analisis performa gerakan latihan Anda dari <strong>SynFit AI Form Coach</strong>:</p>
        
        <table style="width: 100%; margin: 20px 0; border-collapse: separate; border-spacing: 8px;">
          <tr>
            <td style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; text-align: center;">
              <div style="font-size: 22px; font-weight: 900; color: #FFFFFF;">${params.exerciseType}</div>
              <div style="font-size: 10px; color: #9CA3AF; text-transform: uppercase; margin-top: 4px;">Gerakan</div>
            </td>
            <td style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; text-align: center;">
              <div style="font-size: 22px; font-weight: 900; color: #FF5E1E;">${params.reps}</div>
              <div style="font-size: 10px; color: #9CA3AF; text-transform: uppercase; margin-top: 4px;">Repetisi Sah</div>
            </td>
            <td style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; text-align: center;">
              <div style="font-size: 22px; font-weight: 900; color: #10B981;">${params.accuracy}%</div>
              <div style="font-size: 10px; color: #9CA3AF; text-transform: uppercase; margin-top: 4px;">Akurasi Form</div>
            </td>
          </tr>
        </table>

        <p style="font-size: 13px; color: #9CA3AF; text-align: center;">Durasi total sesi: <strong>${durationText}</strong></p>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${baseUrl}/member/dashboard?tab=coach" class="cta-button">Lanjutkan Sesi Latihan</a>
        </div>
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} SynFit AI &bull; Areta Sport Management.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

// ==========================================
// CENTRAL EXPORTED SEND FUNCTIONS
// ==========================================

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Sends Welcome Email to newly registered member.
 */
export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<SendEmailResult> {
  const idempotencyKey = `welcome:${params.toEmail.toLowerCase()}`;
  if (isDuplicateSend(idempotencyKey)) {
    console.log(`[Resend] Skipped duplicate welcome email to ${params.toEmail}`);
    return { success: true, skipped: true };
  }

  const resend = getResendClient();
  if (!resend) {
    console.warn(`[Resend] RESEND_API_KEY is not set. Welcome email to ${params.toEmail} simulated in dev mode.`);
    return { success: true, skipped: true, error: "RESEND_API_KEY is not configured (simulated in dev mode)" };
  }

  try {
    const from = getFromEmail();
    const subject = `Selamat Datang di SynFit AI, ${params.memberName}!`;
    const html = buildWelcomeHtml(params);
    const text = `Halo ${params.memberName}, selamat datang di SynFit AI! Keanggotaan Anda telah aktif. Buka dashboard di: ${getAppBaseUrl()}/member/dashboard`;

    const { data, error } = await resend.emails.send({
      from,
      to: [params.toEmail],
      subject,
      html,
      text,
    });

    if (error) {
      console.error("[Resend] Error sending welcome email:", error);
      return { success: false, error: error.message };
    }

    console.log(`[Resend] Welcome email sent successfully to ${params.toEmail} (ID: ${data?.id})`);
    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error("[Resend] Unexpected exception sending welcome email:", err.message || err);
    return { success: false, error: err.message || "Failed to send email" };
  }
}

/**
 * Sends Membership Expiry Reminder Email.
 */
export async function sendMembershipReminderEmail(params: MembershipReminderParams): Promise<SendEmailResult> {
  const idempotencyKey = `reminder:${params.toEmail.toLowerCase()}:${params.daysRemaining}`;
  if (isDuplicateSend(idempotencyKey)) {
    return { success: true, skipped: true };
  }

  const resend = getResendClient();
  if (!resend) {
    return { success: true, skipped: true, error: "RESEND_API_KEY is not configured (simulated in dev mode)" };
  }

  try {
    const from = getFromEmail();
    const subject = `Pemberitahuan: Masa Aktif Membership SynFit Berakhir dalam ${params.daysRemaining} Hari`;
    const html = buildReminderHtml(params);
    const text = `Halo ${params.memberName}, membership SynFit Anda akan berakhir pada ${params.expiryDate} (${params.daysRemaining} hari lagi). Perpanjang di ${getAppBaseUrl()}/member/dashboard?tab=membership`;

    const { data, error } = await resend.emails.send({
      from,
      to: [params.toEmail],
      subject,
      html,
      text,
    });

    if (error) {
      console.error("[Resend] Error sending reminder email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error("[Resend] Exception sending reminder email:", err.message || err);
    return { success: false, error: err.message || "Failed to send email" };
  }
}

/**
 * Sends Workout Summary Email.
 */
export async function sendWorkoutSummaryEmail(params: WorkoutSummaryEmailParams): Promise<SendEmailResult> {
  const idempotencyKey = `workout:${params.toEmail.toLowerCase()}:${Date.now()}`;
  const resend = getResendClient();
  if (!resend) {
    return { success: true, skipped: true, error: "RESEND_API_KEY is not configured (simulated in dev mode)" };
  }

  try {
    const from = getFromEmail();
    const subject = `Ringkasan Latihan SynFit AI: ${params.exerciseType} (${params.reps} Reps)`;
    const html = buildWorkoutSummaryHtml(params);
    const text = `Halo ${params.memberName}, Anda menyelesaikan sesi ${params.exerciseType} dengan ${params.reps} repetisi dan akurasi ${params.accuracy}%.`;

    const { data, error } = await resend.emails.send({
      from,
      to: [params.toEmail],
      subject,
      html,
      text,
    });

    if (error) {
      console.error("[Resend] Error sending workout summary:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error("[Resend] Exception sending workout summary:", err.message || err);
    return { success: false, error: err.message || "Failed to send email" };
  }
}
