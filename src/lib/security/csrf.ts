/**
 * CSRF & ORIGIN SECURITY VERIFIER
 * Protects cookie-authenticated and sensitive state-changing endpoints from cross-site request forgery.
 */

/**
 * Validates that the request origin or referer matches the expected host.
 * If neither header is present (e.g. native non-browser client or same-origin direct curl),
 * it allows requests unless strictly required.
 */
export function verifySameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host") || request.headers.get("x-forwarded-host");

  if (!host) {
    return true; // Unable to verify host, rely on custom session headers
  }

  // If origin is present, check against host
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host.toLowerCase() === host.toLowerCase()) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // If referer is present, check against host
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.host.toLowerCase() === host.toLowerCase()) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // If both origin and referer are absent, allow only if custom auth headers are present
  // (Standard cross-origin form submissions cannot set custom headers)
  const hasCustomAuth =
    request.headers.has("x-member-session-token") ||
    request.headers.has("authorization");

  return hasCustomAuth;
}
