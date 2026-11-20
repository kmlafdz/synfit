/**
 * SYNFIT SECURE MEMBER AUTHENTICATION & SESSION MANAGEMENT
 * Server-side hashing, cryptographic session signing, and transparent legacy migration.
 */

import crypto from "crypto";

export interface MemberTokenPayload {
  accountId: string;
  memberId: string;
  whatsapp: string;
  name: string;
  mustChangePassword?: boolean;
  iat: number;
  exp: number;
}

// Deterministic server-side session secret with environment override
function getSessionSecret(): string {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  // Fallback to a deterministic derivative of the Firebase project or service account if available
  const seed = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "synfit-areta-fitness-default-secret-seed";
  return crypto.createHash("sha256").update(seed + "-session-secret-salt").digest("hex");
}

/**
 * Hashes a plaintext password using PBKDF2 with SHA-256 and a cryptographically random salt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 32, "sha256").toString("hex");
  return `${salt}$${hash}`;
}

/**
 * Verifies a password against a stored string.
 * Supports modern PBKDF2 hash and transparently identifies legacy plaintext passwords for re-hashing.
 */
export function verifyPassword(password: string, storedHashOrPlain: string): { valid: boolean; needsRehash: boolean } {
  if (!storedHashOrPlain || !password) {
    return { valid: false, needsRehash: false };
  }

  // Modern PBKDF2 format: salt$hash or $salt$hash
  if (storedHashOrPlain.includes("$")) {
    const raw = storedHashOrPlain.startsWith("$") ? storedHashOrPlain.substring(1) : storedHashOrPlain;
    const [salt, expectedHash] = raw.split("$");
    if (!salt || !expectedHash) {
      return { valid: false, needsRehash: false };
    }
    const computedHash = crypto.pbkdf2Sync(password, salt, 10000, 32, "sha256").toString("hex");
    const valid = crypto.timingSafeEqual(Buffer.from(computedHash, "hex"), Buffer.from(expectedHash, "hex"));
    if (valid) {
      return { valid: true, needsRehash: false };
    }

    // Default password interchangeable support (areta123 and synfit123)
    if (
      (password === "synfit123" || password === "areta123") &&
      (raw.includes("d5a8046bc95c478b53b95887ea154aab548be35bb91f8bc7e751f30f5d8200f7") ||
       raw.includes("b9c095037bd64c50214e15507656d7fad6f0229c99479339bfbba6234cdd4087"))
    ) {
      return { valid: true, needsRehash: true };
    }

    return { valid: false, needsRehash: false };
  }

  // Legacy plaintext verification (and legacy default passwords "synfit123" / "areta123")
  const isMatch =
    storedHashOrPlain === password ||
    ((password === "synfit123" || password === "areta123") &&
      (storedHashOrPlain === "synfit123" || storedHashOrPlain === "areta123"));

  if (isMatch) {
    return { valid: true, needsRehash: true };
  }

  return { valid: false, needsRehash: false };
}

/**
 * Cryptographically signs a member session payload with HMAC-SHA256 and an expiry timestamp.
 */
export function signMemberSessionToken(
  data: Omit<MemberTokenPayload, "iat" | "exp">,
  expiresInSeconds = 7 * 24 * 60 * 60 // 7 days default
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: MemberTokenPayload = {
    ...data,
    mustChangePassword: Boolean(data.mustChangePassword),
    iat: now,
    exp: now + expiresInSeconds,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const secret = getSessionSecret();
  const signature = crypto.createHmac("sha256", secret).update(payloadB64).digest("hex");

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies the cryptographic signature and expiration of a member session token.
 * Returns null if the token is tampered, forged, or expired.
 */
export function verifyMemberSessionToken(token: string): MemberTokenPayload | null {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const [payloadB64, providedSig] = token.split(".");
  if (!payloadB64 || !providedSig) {
    return null;
  }

  const secret = getSessionSecret();
  const expectedSig = crypto.createHmac("sha256", secret).update(payloadB64).digest("hex");

  // Constant-time signature comparison to prevent timing attacks
  const bufProvided = Buffer.from(providedSig);
  const bufExpected = Buffer.from(expectedSig);
  if (bufProvided.length !== bufExpected.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(bufProvided, bufExpected)) {
    return null;
  }

  try {
    const jsonStr = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload: MemberTokenPayload = JSON.parse(jsonStr);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      // Token expired
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export interface ResolveMemberSessionResult {
  authenticated: boolean;
  session?: MemberTokenPayload;
  error?: string;
  statusCode?: number;
  mustChangePassword?: boolean;
}

/**
 * Robust server-side extraction and cryptographic validation of member sessions.
 * Enforces token validity, expiry, and server-side mandatory password change.
 */
export function resolveMemberSession(
  request: Request,
  options: { allowPendingPasswordChange?: boolean } = {}
): ResolveMemberSessionResult {
  const customHeader = request.headers.get("x-member-session-token");
  const authHeader = request.headers.get("authorization");
  const cookieHeader = request.headers.get("cookie") || "";

  let token: string | null = customHeader;

  if (!token && authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split("Bearer ")[1]?.trim() || null;
  }

  if (!token && cookieHeader) {
    const match = cookieHeader.match(/member_session_token=([^;]+)/);
    if (match && match[1]) {
      token = decodeURIComponent(match[1]);
    }
  }

  if (!token) {
    return {
      authenticated: false,
      error: "Kredensial sesi tidak ditemukan. Harap login kembali.",
      statusCode: 401,
    };
  }

  const payload = verifyMemberSessionToken(token);
  if (!payload) {
    return {
      authenticated: false,
      error: "Token sesi tidak valid, kedaluwarsa, atau telah dimanipulasi.",
      statusCode: 401,
    };
  }

  // Server-side enforcement of mandatory password change
  if (payload.mustChangePassword && !options.allowPendingPasswordChange) {
    return {
      authenticated: false,
      session: payload,
      mustChangePassword: true,
      error: "Anda diwajibkan mengganti kata sandi awal sebelum dapat menggunakan layanan ini.",
      statusCode: 403,
    };
  }

  return {
    authenticated: true,
    session: payload,
    mustChangePassword: Boolean(payload.mustChangePassword),
  };
}
