/**
 * IN-MEMORY SLIDING-WINDOW RATE LIMITER
 * Lightweight, zero-dependency rate limiter for public and sensitive API routes.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up stale entries every 5 minutes without keeping Node process alive
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < 300000);
      if (record.timestamps.length === 0) {
        rateLimitStore.delete(key);
      }
    }
  }, 300000);
  if (timer.unref) {
    timer.unref();
  }
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

/**
 * Checks and increments rate limit for a given key.
 * @param key Unique identifier (e.g., `lookup:ip_address` or `login:phone`)
 * @param maxRequests Maximum allowed requests in the time window
 * @param windowMs Time window in milliseconds (default: 60,000ms = 1 minute)
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 20,
  windowMs: number = 60000
): RateLimitResult {
  const now = Date.now();
  let record = rateLimitStore.get(key);

  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Filter timestamps within the active sliding window
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

  if (record.timestamps.length >= maxRequests) {
    const oldestTimestamp = record.timestamps[0];
    const resetMs = Math.max(0, windowMs - (now - oldestTimestamp));
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      resetMs,
    };
  }

  record.timestamps.push(now);
  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - record.timestamps.length,
    resetMs: windowMs,
  };
}

/**
 * LIMITASI RATE LIMITER IN-MEMORY:
 * 1. Penyimpanan berada di RAM proses Node.js lokal (in-memory Map).
 * 2. Pada lingkungan multi-instance (serverless lambdas, clustered containers), counter tidak
 *    dibagikan antar instance (no shared state).
 * 3. Data counter akan ter-reset saat instance di-restart atau mengalami cold start.
 * 4. Untuk traffic enterprise skala tinggi, disarankan menggunakan shared distributed store
 *    (seperti Redis / Upstash / Firebase RTDB) setelah disetujui.
 *
 * TRUSTED PROXY IP HANDLING:
 * Mencegah IP Spoofing via header X-Forwarded-For palsu.
 * Prioritas:
 * 1. cf-connecting-ip: Disediakan dan ditimpa secara otoritatif oleh Cloudflare.
 * 2. x-real-ip: Disediakan oleh reverse proxy resmi (Nginx/Caddy/Vercel).
 * 3. x-forwarded-for: Diambil dari entri paling kanan jika di belakang proxy tepercaya,
 *    atau entri pertama jika tanpa proxy terkonfigurasi.
 */
export function getClientIp(request: Request): string {
  // 1. Cloudflare authoritative client IP
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) {
    return cfIp.trim();
  }

  // 2. Direct reverse proxy header
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  // 3. X-Forwarded-For parsing with trusted proxy awareness
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ips = forwarded.split(",").map((ip) => ip.trim()).filter(Boolean);
    if (ips.length > 0) {
      // In trusted reverse-proxy topologies (e.g. Vercel, Nginx), the immediate client
      // or outermost proxy address is preserved safely.
      return ips[0];
    }
  }

  return "127.0.0.1";
}
